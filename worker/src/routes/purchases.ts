import { Hono } from 'hono';
import { query, queryOne, run, generateUUID, batch } from '../db';
import { authenticateToken } from '../middleware';
import { purchaseSchema } from '../validation';
import type { Env, Product, StockBatch } from '../types';

const purchases = new Hono<{ Bindings: Env }>();

/**
 * POST /purchases - FIFO purchase with D1 batch (atomic transaction)
 *
 * D1 doesn't support BEGIN/COMMIT transactions like PostgreSQL.
 * Instead, we use D1 batch() which executes all statements atomically.
 * We first read data, compute the FIFO allocation, then batch all writes.
 */
purchases.post('/', authenticateToken, async (c) => {
  try {
    const body = await c.req.json();
    const validation = purchaseSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const { product_id, quantity } = validation.data;
    const userId = c.get('user').userId;

    // Read phase: get product and batches
    const product = await queryOne<Product>(
      c.env.DB,
      'SELECT * FROM products WHERE id = ?',
      [product_id]
    );

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const batches = await query<StockBatch>(c.env.DB,
      `SELECT * FROM stock_batches
       WHERE product_id = ? AND quantity > 0
       ORDER BY created_at ASC`,
      [product_id]
    );

    const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);

    if (totalStock < quantity) {
      return c.json({
        error: 'Insufficient stock',
        available: totalStock,
        requested: quantity,
      }, 400);
    }

    // Check for active sale price
    const hasActiveSale = product.sale_price_cents != null
      && product.sale_expires_at != null
      && new Date(product.sale_expires_at) > new Date();

    // Compute FIFO allocation
    let remainingQty = quantity;
    let totalCost = 0;
    const allocations: { batch_id: string; qty: number; price_cents: number }[] = [];
    const batchUpdates: { sql: string; params: unknown[] }[] = [];

    for (const b of batches) {
      if (remainingQty === 0) break;

      const allocQty = Math.min(remainingQty, b.quantity);
      const newQty = b.quantity - allocQty;

      batchUpdates.push({
        sql: 'UPDATE stock_batches SET quantity = ? WHERE id = ?',
        params: [newQty, b.id],
      });

      const unitPrice = hasActiveSale ? product.sale_price_cents! : b.price_cents;
      totalCost += allocQty * unitPrice;
      allocations.push({ batch_id: b.id, qty: allocQty, price_cents: unitPrice });

      remainingQty -= allocQty;
    }

    // Create account entry
    const entryId = generateUUID();
    const description = `Nakup: ${quantity}x ${product.name}`;

    // Write phase: atomic batch
    const statements = [
      ...batchUpdates,
      {
        sql: 'INSERT INTO account_entries (id, user_id, amount_cents, description) VALUES (?, ?, ?, ?)',
        params: [entryId, userId, -totalCost, description],
      },
    ];

    await batch(c.env.DB, statements);

    // Get updated balance
    const balance = await queryOne<{ balance_eur: number }>(c.env.DB,
      `SELECT COALESCE(SUM(amount_cents)/100.0, 0) as balance_eur
       FROM account_entries WHERE user_id = ?`,
      [userId]
    );

    return c.json({
      success: true,
      purchase: {
        product_id,
        product_name: product.name,
        quantity,
        total_cents: totalCost,
        total_eur: totalCost / 100,
        allocations,
      },
      new_balance_eur: balance?.balance_eur || 0,
    });
  } catch (error) {
    console.error('Purchase error:', error);
    return c.json({ error: 'Purchase failed' }, 500);
  }
});

export default purchases;
