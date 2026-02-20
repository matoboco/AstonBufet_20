import { Hono } from 'hono';
import { query, queryOne } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { addBatchSchema } from '../validation';
import type { Env, Product, StockBatch, StockAdjustment, StockAdjustmentWithProduct, JWTPayload } from '../types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

const stock = new Hono<HonoEnv>();

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
    const db = c.env.DB;

    // Check if product exists
    let product = await queryOne<Product>(db, 'SELECT * FROM products WHERE ean = ?', [ean]);

    if (!product) {
      if (!name) {
        return c.json({
          error: 'Product not found. Provide "name" to create new product.',
          ean,
        }, 400);
      }

      const productId = crypto.randomUUID();
      const batchId = crypto.randomUUID();

      // Create product and batch atomically
      await db.batch([
        db.prepare('INSERT INTO products (id, name, ean, price_cents) VALUES (?, ?, ?, ?)')
          .bind(productId, name, ean, price_cents),
        db.prepare('INSERT INTO stock_batches (id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)')
          .bind(batchId, productId, quantity, price_cents),
      ]);

      product = await queryOne<Product>(db, 'SELECT * FROM products WHERE id = ?', [productId]);
      const batch = await queryOne<StockBatch>(db, 'SELECT * FROM stock_batches WHERE id = ?', [batchId]);

      const totalStock = await queryOne<{ total: number }>(
        db,
        'SELECT COALESCE(SUM(quantity), 0) as total FROM stock_batches WHERE product_id = ?',
        [productId]
      );

      return c.json({
        success: true,
        batch,
        product: {
          id: product!.id,
          name: product!.name,
          ean: product!.ean,
          total_stock: totalStock?.total || 0,
        },
      });
    }

    // Product exists, just add batch
    const batchId = crypto.randomUUID();
    await query(
      db,
      'INSERT INTO stock_batches (id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)',
      [batchId, product.id, quantity, price_cents]
    );

    const batch = await queryOne<StockBatch>(db, 'SELECT * FROM stock_batches WHERE id = ?', [batchId]);

    const totalStock = await queryOne<{ total: number }>(
      db,
      'SELECT COALESCE(SUM(quantity), 0) as total FROM stock_batches WHERE product_id = ?',
      [product.id]
    );

    return c.json({
      success: true,
      batch,
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
      return c.json({ error: 'product_id je povinný' }, 400);
    }

    if (typeof actual_quantity !== 'number' || actual_quantity < 0) {
      return c.json({ error: 'actual_quantity musí byť nezáporné číslo' }, 400);
    }

    const db = c.env.DB;

    // Get product
    const product = await queryOne<Product>(db, 'SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return c.json({ error: 'Produkt nebol nájdený' }, 404);
    }

    // Calculate expected quantity
    const stockResult = await queryOne<{ expected: number; avg_price: number }>(
      db,
      `SELECT
        COALESCE(SUM(quantity), 0) as expected,
        COALESCE(AVG(price_cents), ?) as avg_price
       FROM stock_batches
       WHERE product_id = ? AND quantity > 0`,
      [product.price_cents, product_id]
    );
    const expected_quantity = stockResult?.expected || 0;
    const avg_price = Math.round(stockResult?.avg_price || product.price_cents);

    const difference = actual_quantity - expected_quantity;
    const adjustmentId = crypto.randomUUID();

    // Build batch: record adjustment, clear old batches, create new batch
    const statements: D1PreparedStatement[] = [
      db.prepare(
        `INSERT INTO stock_adjustments
         (id, product_id, expected_quantity, actual_quantity, difference, reason, created_by, is_write_off)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        adjustmentId, product_id, expected_quantity, actual_quantity,
        difference, reason || null, c.get('user')?.userId || null,
        is_write_off === true ? 1 : 0
      ),
      db.prepare('DELETE FROM stock_batches WHERE product_id = ?').bind(product_id),
    ];

    if (actual_quantity > 0) {
      statements.push(
        db.prepare(
          'INSERT INTO stock_batches (id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), product_id, actual_quantity, avg_price)
      );
    }

    await db.batch(statements);

    const adjustment = await queryOne<StockAdjustment>(
      db,
      'SELECT * FROM stock_adjustments WHERE id = ?',
      [adjustmentId]
    );

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

    return c.json({
      success: true,
      adjustment,
      product: {
        id: product.id,
        name: product.name,
        ean: product.ean,
      },
      message,
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return c.json({ error: 'Nepodarilo sa zaznamenať inventúru' }, 500);
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
    return c.json({ error: 'Nepodarilo sa načítať históriu inventúr' }, 500);
  }
});

export default stock;
