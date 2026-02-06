import { Router, Response } from 'express';
import { query, queryOne, getClient } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { addBatchSchema } from '../validation';
import { AuthenticatedRequest, Product, StockBatch, StockAdjustment, StockAdjustmentWithProduct } from '../types';

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

// POST /stock/adjustment - Record inventory count and adjust stock (office_assistant only)
router.post('/adjustment', authenticateToken, requireRole('office_assistant'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await getClient();

  try {
    const { product_id, actual_quantity, reason, is_write_off } = req.body;

    if (!product_id) {
      res.status(400).json({ error: 'product_id je povinný' });
      return;
    }

    if (typeof actual_quantity !== 'number' || actual_quantity < 0) {
      res.status(400).json({ error: 'actual_quantity musí byť nezáporné číslo' });
      return;
    }

    await client.query('BEGIN');

    // Get product
    const product = await queryOne<Product>('SELECT * FROM products WHERE id = $1', [product_id]);
    if (!product) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Produkt nebol nájdený' });
      return;
    }

    // Calculate expected quantity from stock batches
    const stockResult = await client.query<{ expected: number; avg_price: number }>(
      `SELECT
        COALESCE(SUM(quantity), 0)::integer as expected,
        COALESCE(AVG(price_cents), $2)::integer as avg_price
       FROM stock_batches
       WHERE product_id = $1 AND quantity > 0`,
      [product_id, product.price_cents]
    );
    const expected_quantity = stockResult.rows[0]?.expected || 0;
    const avg_price = stockResult.rows[0]?.avg_price || product.price_cents;

    // Calculate difference
    const difference = actual_quantity - expected_quantity;

    // Record the adjustment
    const adjustmentResult = await client.query<StockAdjustment>(
      `INSERT INTO stock_adjustments
       (product_id, expected_quantity, actual_quantity, difference, reason, created_by, is_write_off)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [product_id, expected_quantity, actual_quantity, difference, reason || null, req.user?.userId || null, is_write_off === true]
    );

    // Clear existing batches for this product
    await client.query('DELETE FROM stock_batches WHERE product_id = $1', [product_id]);

    // Create new batch with actual quantity (if > 0)
    if (actual_quantity > 0) {
      await client.query(
        'INSERT INTO stock_batches (product_id, quantity, price_cents) VALUES ($1, $2, $3)',
        [product_id, actual_quantity, avg_price]
      );
    }

    await client.query('COMMIT');

    let message: string;
    if (is_write_off === true && difference < 0) {
      message = `Odpísané zo skladu: ${Math.abs(difference)} ks`;
    } else if (difference < 0) {
      message = `Zaznamenané manko: ${Math.abs(difference)} ks`;
    } else if (difference > 0) {
      message = `Zaznamenný prebytok: ${difference} ks`;
    } else {
      message = 'Stav skladu súhlasí';
    }

    res.json({
      success: true,
      adjustment: adjustmentResult.rows[0],
      product: {
        id: product.id,
        name: product.name,
        ean: product.ean,
      },
      message,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Stock adjustment error:', error);
    res.status(500).json({ error: 'Nepodarilo sa zaznamenať inventúru' });
  } finally {
    client.release();
  }
});

// GET /stock/adjustments - Get adjustment history (office_assistant only)
router.get('/adjustments', authenticateToken, requireRole('office_assistant'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adjustments = await query<StockAdjustmentWithProduct>(`
      SELECT sa.*, p.name as product_name, p.ean as product_ean
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      ORDER BY sa.created_at DESC
      LIMIT 100
    `);

    res.json(adjustments);
  } catch (error) {
    console.error('Get adjustments error:', error);
    res.status(500).json({ error: 'Nepodarilo sa načítať históriu inventúr' });
  }
});

export default router;
