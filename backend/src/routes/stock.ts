import { Router, Response } from 'express';
import { query, queryOne, getClient } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { addBatchSchema } from '../validation';
import { AuthenticatedRequest, Product, StockBatch } from '../types';

const router = Router();

// GET /stock - Get all stock batches
router.get('/', authenticateToken, requireRole('office_assistant'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const batches = await query<StockBatch & { product_name: string; product_ean: string }>(`
      SELECT sb.*, p.name as product_name, p.ean as product_ean
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE sb.quantity > 0
      ORDER BY p.name, sb.created_at
    `);

    res.json(batches);
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// POST /stock/add-batch - Add new FIFO batch (office_assistant only)
router.post('/add-batch', authenticateToken, requireRole('office_assistant'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await getClient();

  try {
    const validation = addBatchSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { ean, name, quantity, price_cents } = validation.data;

    await client.query('BEGIN');

    // Check if product exists
    let product = await queryOne<Product>('SELECT * FROM products WHERE ean = $1', [ean]);

    // If product doesn't exist and name is provided, create it
    if (!product) {
      if (!name) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: 'Product not found. Provide "name" to create new product.',
          ean,
        });
        return;
      }

      const result = await client.query<Product>(
        'INSERT INTO products (name, ean, price_cents) VALUES ($1, $2, $3) RETURNING *',
        [name, ean, price_cents]
      );
      product = result.rows[0];
    }

    // Add new batch
    const batchResult = await client.query<StockBatch>(
      `INSERT INTO stock_batches (product_id, quantity, price_cents)
       VALUES ($1, $2, $3) RETURNING *`,
      [product.id, quantity, price_cents]
    );

    await client.query('COMMIT');

    // Get total stock for product
    const totalStock = await queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(quantity), 0)::integer as total FROM stock_batches WHERE product_id = $1',
      [product.id]
    );

    res.json({
      success: true,
      batch: batchResult.rows[0],
      product: {
        id: product.id,
        name: product.name,
        ean: product.ean,
        total_stock: totalStock?.total || 0,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add batch error:', error);
    res.status(500).json({ error: 'Failed to add stock batch' });
  } finally {
    client.release();
  }
});

export default router;
