import { Hono } from 'hono';
import { query, queryOne } from '../db';
import { authenticateToken } from '../middleware';
import { purchaseSchema } from '../validation';
import type { Env, Product, StockBatch, AccountBalance, JWTPayload } from '../types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

const purchases = new Hono<HonoEnv>();

// POST /purchases - FIFO purchase with D1 batch (atomic)
purchases.post('/', authenticateToken, async (c) => {
  try {
    const body = await c.req.json();
    const validation = purchaseSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const { product_id, quantity } = validation.data;
    const userId = c.get('user').userId;
    const db = c.env.DB;

    // Step 1: Read product and batches (SELECT phase)
    const product = await queryOne<Product>(db, 'SELECT * FROM products WHERE id = ?', [product_id]);

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const batches = await query<StockBatch>(
      db,
      `SELECT * FROM stock_batches
       WHERE product_id = ? AND quantity > 0
       ORDER BY created_at ASC`,
      [product_id]
    );

    const totalStock = batches.reduce((sum, batch) => sum + batch.quantity, 0);

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

    // Step 2: Calculate FIFO allocations in JS
    let remainingQty = quantity;
    let totalCost = 0;
    const allocations: { batch_id: string; qty: number; price_cents: number }[] = [];
    const updateStatements: D1PreparedStatement[] = [];

    for (const batch of batches) {
      if (remainingQty === 0) break;

      const allocQty = Math.min(remainingQty, batch.quantity);
      const newQty = batch.quantity - allocQty;

      updateStatements.push(
        db.prepare('UPDATE stock_batches SET quantity = ? WHERE id = ?').bind(newQty, batch.id)
      );

      const unitPrice = hasActiveSale ? product.sale_price_cents! : batch.price_cents;
      totalCost += allocQty * unitPrice;
      allocations.push({
        batch_id: batch.id,
        qty: allocQty,
        price_cents: unitPrice,
      });

      remainingQty -= allocQty;
    }

    // Step 3: Execute all updates + insert account entry atomically via batch()
    const description = `Nákup: ${quantity}x ${product.name}`;
    const entryId = crypto.randomUUID();

    updateStatements.push(
      db.prepare(
        `INSERT INTO account_entries (id, user_id, amount_cents, description)
         VALUES (?, ?, ?, ?)`
      ).bind(entryId, userId, -totalCost, description)
    );

    // D1 batch is atomic: all-or-nothing
    await db.batch(updateStatements);

    // Get updated balance
    const balance = await queryOne<{ balance_eur: number }>(
      db,
      'SELECT balance_eur FROM account_balances WHERE id = ?',
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
