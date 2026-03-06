import { Hono } from 'hono';
import { query, queryOne, run, generateUUID, batch } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { addBatchSchema } from '../validation';
import type { Env, Product, StockBatch, StockAdjustment, StockAdjustmentWithProduct } from '../types';

const stock = new Hono<{ Bindings: Env }>();

// GET /stock
stock.get('/', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const batches = await query<StockBatch & { product_name: string; product_ean: string }>(c.env.DB, `
      SELECT sb.*, p.name as product_name, p.ean as product_ean
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE sb.quantity > 0
      ORDER BY p.name, sb.created_at
    `);
    return c.json(batches);
  } catch (error) {
    console.error('Get stock error:', error);
    return c.json({ error: 'Failed to fetch stock' }, 500);
  }
});

// POST /stock/add-batch
stock.post('/add-batch', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const body = await c.req.json();
    const validation = addBatchSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const { ean, name, quantity, price_cents } = validation.data;

    let product = await queryOne<Product>(c.env.DB, 'SELECT * FROM products WHERE ean = ?', [ean]);

    if (!product) {
      if (!name) {
        return c.json({
          error: 'Product not found. Provide "name" to create new product.',
          ean,
        }, 400);
      }

      const productId = generateUUID();
      const rows = await query<Product>(c.env.DB,
        'INSERT INTO products (id, name, ean, price_cents) VALUES (?, ?, ?, ?) RETURNING *',
        [productId, name, ean, price_cents]
      );
      product = rows[0];
    }

    const batchId = generateUUID();
    const batchRows = await query<StockBatch>(c.env.DB,
      'INSERT INTO stock_batches (id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?) RETURNING *',
      [batchId, product.id, quantity, price_cents]
    );

    const totalStock = await queryOne<{ total: number }>(c.env.DB,
      'SELECT CAST(COALESCE(SUM(quantity), 0) AS INTEGER) as total FROM stock_batches WHERE product_id = ?',
      [product.id]
    );

    return c.json({
      success: true,
      batch: batchRows[0],
      product: {
        id: product.id,
        name: product.name,
        ean: product.ean,
        total_stock: totalStock?.total || 0,
      },
    });
  } catch (error) {
    console.error('Add batch error:', error);
    return c.json({ error: 'Failed to add stock batch' }, 500);
  }
});

// POST /stock/adjustment
stock.post('/adjustment', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const body = await c.req.json();
    const { product_id, actual_quantity, reason, is_write_off } = body;

    if (!product_id) {
      return c.json({ error: 'product_id je povinny' }, 400);
    }

    if (typeof actual_quantity !== 'number' || actual_quantity < 0) {
      return c.json({ error: 'actual_quantity musi byt nezaporne cislo' }, 400);
    }

    const product = await queryOne<Product>(c.env.DB, 'SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return c.json({ error: 'Produkt nebol najdeny' }, 404);
    }

    const stockResult = await queryOne<{ expected: number; avg_price: number }>(c.env.DB,
      `SELECT
        CAST(COALESCE(SUM(quantity), 0) AS INTEGER) as expected,
        CAST(COALESCE(AVG(price_cents), ?) AS INTEGER) as avg_price
       FROM stock_batches
       WHERE product_id = ? AND quantity > 0`,
      [product.price_cents, product_id]
    );
    const expected_quantity = stockResult?.expected || 0;
    const avg_price = stockResult?.avg_price || product.price_cents;
    const difference = actual_quantity - expected_quantity;

    const adjustmentId = generateUUID();
    const user = c.get('user');

    // Atomic batch: insert adjustment, delete old batches, create new batch
    const statements: { sql: string; params: unknown[] }[] = [
      {
        sql: `INSERT INTO stock_adjustments
              (id, product_id, expected_quantity, actual_quantity, difference, reason, created_by, is_write_off)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [adjustmentId, product_id, expected_quantity, actual_quantity, difference, reason || null, user?.userId || null, is_write_off === true ? 1 : 0],
      },
      {
        sql: 'DELETE FROM stock_batches WHERE product_id = ?',
        params: [product_id],
      },
    ];

    if (actual_quantity > 0) {
      statements.push({
        sql: 'INSERT INTO stock_batches (id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)',
        params: [generateUUID(), product_id, actual_quantity, avg_price],
      });
    }

    await batch(c.env.DB, statements);

    const adjustment = await queryOne<StockAdjustment>(c.env.DB,
      'SELECT * FROM stock_adjustments WHERE id = ?',
      [adjustmentId]
    );

    let message: string;
    if (is_write_off === true && difference < 0) {
      message = `Odpisane zo skladu: ${Math.abs(difference)} ks`;
    } else if (difference < 0) {
      message = `Zaznamenane manko: ${Math.abs(difference)} ks`;
    } else if (difference > 0) {
      message = `Zaznamneny prebytok: ${difference} ks`;
    } else {
      message = 'Stav skladu suhlasi';
    }

    return c.json({
      success: true,
      adjustment,
      product: { id: product.id, name: product.name, ean: product.ean },
      message,
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return c.json({ error: 'Nepodarilo sa zaznamenat inventuru' }, 500);
  }
});

// GET /stock/adjustments
stock.get('/adjustments', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const adjustments = await query<StockAdjustmentWithProduct>(c.env.DB, `
      SELECT sa.*, p.name as product_name, p.ean as product_ean
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      ORDER BY sa.created_at DESC
      LIMIT 100
    `);
    return c.json(adjustments);
  } catch (error) {
    console.error('Get adjustments error:', error);
    return c.json({ error: 'Nepodarilo sa nacitat historiu inventur' }, 500);
  }
});

export default stock;
