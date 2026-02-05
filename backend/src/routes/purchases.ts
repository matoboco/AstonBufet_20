import { Router, Response } from 'express';
import { getClient, queryOne } from '../db';
import { authenticateToken } from '../middleware';
import { purchaseSchema } from '../validation';
import { AuthenticatedRequest, Product, StockBatch } from '../types';

const router = Router();

// POST /purchases - FIFO purchase with atomic transaction
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await getClient();

  try {
    const validation = purchaseSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { product_id, quantity } = validation.data;
    const userId = req.user!.userId;

    await client.query('BEGIN');

    // Check product exists
    const product = await client.query<Product>(
      'SELECT * FROM products WHERE id = $1',
      [product_id]
    );

    if (product.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Get available batches (FIFO - oldest first)
    const batches = await client.query<StockBatch>(
      `SELECT * FROM stock_batches
       WHERE product_id = $1 AND quantity > 0
       ORDER BY created_at ASC
       FOR UPDATE`,
      [product_id]
    );

    // Calculate total available stock
    const totalStock = batches.rows.reduce((sum, batch) => sum + batch.quantity, 0);

    if (totalStock < quantity) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'Insufficient stock',
        available: totalStock,
        requested: quantity,
      });
      return;
    }

    // FIFO allocation
    let remainingQty = quantity;
    let totalCost = 0;
    const allocations: { batch_id: string; qty: number; price_cents: number }[] = [];

    for (const batch of batches.rows) {
      if (remainingQty === 0) break;

      const allocQty = Math.min(remainingQty, batch.quantity);
      const newQty = batch.quantity - allocQty;

      await client.query(
        'UPDATE stock_batches SET quantity = $1 WHERE id = $2',
        [newQty, batch.id]
      );

      totalCost += allocQty * batch.price_cents;
      allocations.push({
        batch_id: batch.id,
        qty: allocQty,
        price_cents: batch.price_cents,
      });

      remainingQty -= allocQty;
    }

    // Create account entry (negative for purchase)
    const description = `Nákup: ${quantity}x ${product.rows[0].name}`;
    await client.query(
      `INSERT INTO account_entries (user_id, amount_cents, description)
       VALUES ($1, $2, $3)`,
      [userId, -totalCost, description]
    );

    await client.query('COMMIT');

    // Get updated balance
    const balance = await queryOne<{ balance_eur: number }>(
      'SELECT balance_eur FROM account_balances WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      purchase: {
        product_id,
        product_name: product.rows[0].name,
        quantity,
        total_cents: totalCost,
        total_eur: totalCost / 100,
        allocations,
      },
      new_balance_eur: balance?.balance_eur || 0,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Purchase failed' });
  } finally {
    client.release();
  }
});

export default router;
