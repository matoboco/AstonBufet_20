import { Hono } from 'hono';
import { query, queryOne } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import type { Env, ProductWithStock, Product, JWTPayload } from '../types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

const products = new Hono<HonoEnv>();

// GET /products
products.get('/', async (c) => {
  try {
    const result = await query<ProductWithStock>(c.env.DB, `
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        CASE WHEN p.sale_expires_at > datetime('now') THEN p.sale_price_cents ELSE NULL END as sale_price_cents,
        CASE WHEN p.sale_expires_at > datetime('now') THEN p.sale_expires_at ELSE NULL END as sale_expires_at,
        COALESCE(SUM(sb.quantity), 0) as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      GROUP BY p.id
      ORDER BY p.name
    `);
    return c.json(result);
  } catch (error) {
    console.error('Get products error:', error);
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

// GET /products/on-sale
products.get('/on-sale', async (c) => {
  try {
    const result = await query<ProductWithStock>(c.env.DB, `
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        p.sale_price_cents,
        p.sale_expires_at,
        COALESCE(SUM(sb.quantity), 0) as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.sale_price_cents IS NOT NULL
        AND p.sale_expires_at > datetime('now')
      GROUP BY p.id
      HAVING COALESCE(SUM(sb.quantity), 0) > 0
      ORDER BY p.sale_expires_at ASC
    `);
    return c.json(result);
  } catch (error) {
    console.error('Get on-sale products error:', error);
    return c.json({ error: 'Failed to fetch on-sale products' }, 500);
  }
});

// GET /products/by-ean/:ean
products.get('/by-ean/:ean', async (c) => {
  try {
    const ean = c.req.param('ean');
    const product = await queryOne<ProductWithStock>(c.env.DB, `
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        CASE WHEN p.sale_expires_at > datetime('now') THEN p.sale_price_cents ELSE NULL END as sale_price_cents,
        CASE WHEN p.sale_expires_at > datetime('now') THEN p.sale_expires_at ELSE NULL END as sale_expires_at,
        COALESCE(SUM(sb.quantity), 0) as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.ean = ?
      GROUP BY p.id
    `, [ean]);

    if (!product) {
      return c.json({ error: 'Product not found', ean }, 404);
    }
    return c.json(product);
  } catch (error) {
    console.error('Get product by EAN error:', error);
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

// GET /products/:id
products.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await queryOne<ProductWithStock>(c.env.DB, `
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        CASE WHEN p.sale_expires_at > datetime('now') THEN p.sale_price_cents ELSE NULL END as sale_price_cents,
        CASE WHEN p.sale_expires_at > datetime('now') THEN p.sale_expires_at ELSE NULL END as sale_expires_at,
        COALESCE(SUM(sb.quantity), 0) as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.id = ?
      GROUP BY p.id
    `, [id]);

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }
    return c.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

// GET /products/:id/price-preview
products.get('/:id/price-preview', async (c) => {
  try {
    const id = c.req.param('id');
    const quantity = parseInt(c.req.query('quantity') || '1') || 1;

    const product = await queryOne<Product>(c.env.DB, 'SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return c.json({ error: 'Produkt nebol nájdený' }, 404);
    }

    const hasActiveSale = product.sale_price_cents != null
      && product.sale_expires_at != null
      && new Date(product.sale_expires_at) > new Date();

    const batches = await query<{ quantity: number; price_cents: number }>(
      c.env.DB,
      `SELECT quantity, price_cents FROM stock_batches
       WHERE product_id = ? AND quantity > 0
       ORDER BY created_at ASC`,
      [id]
    );

    if (batches.length === 0) {
      return c.json({ error: 'Produkt nie je na sklade' }, 404);
    }

    const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);

    if (hasActiveSale) {
      const salePrice = product.sale_price_cents!;
      const totalCost = salePrice * quantity;
      return c.json({
        quantity,
        total_cents: totalCost,
        total_eur: totalCost / 100,
        unit_price_cents: salePrice,
        unit_price_eur: salePrice / 100,
        available_stock: totalStock,
        is_sale: true,
        breakdown: [{ quantity, price_cents: salePrice }],
      });
    }

    let remainingQty = quantity;
    let totalCost = 0;
    const breakdown: { quantity: number; price_cents: number }[] = [];

    for (const batch of batches) {
      if (remainingQty === 0) break;
      const allocQty = Math.min(remainingQty, batch.quantity);
      totalCost += allocQty * batch.price_cents;
      breakdown.push({ quantity: allocQty, price_cents: batch.price_cents });
      remainingQty -= allocQty;
    }

    return c.json({
      quantity,
      total_cents: totalCost,
      total_eur: totalCost / 100,
      unit_price_cents: Math.round(totalCost / quantity),
      unit_price_eur: totalCost / quantity / 100,
      available_stock: totalStock,
      is_sale: false,
      breakdown,
    });
  } catch (error) {
    console.error('Price preview error:', error);
    return c.json({ error: 'Nepodarilo sa vypočítať cenu' }, 500);
  }
});

// PUT /products/:id
products.put('/:id', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, ean, sale_price_cents, sale_expires_at } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Názov produktu je povinný' }, 400);
    }

    if (ean) {
      const existing = await queryOne<Product>(
        c.env.DB,
        'SELECT id FROM products WHERE ean = ? AND id != ?',
        [ean.trim(), id]
      );
      if (existing) {
        return c.json({ error: 'EAN kód už používa iný produkt' }, 400);
      }
    }

    if (sale_price_cents !== undefined && sale_price_cents !== null) {
      if (typeof sale_price_cents !== 'number' || sale_price_cents <= 0) {
        return c.json({ error: 'Akciová cena musí byť kladné číslo' }, 400);
      }
      if (!sale_expires_at) {
        return c.json({ error: 'Dátum vypršania akcie je povinný' }, 400);
      }
    }

    let saleExpiresValue: string | null = sale_expires_at ?? null;
    if (saleExpiresValue && saleExpiresValue.length === 10) {
      saleExpiresValue = `${saleExpiresValue}T23:59:59`;
    }

    await query(
      c.env.DB,
      `UPDATE products
       SET name = ?, ean = COALESCE(?, ean),
           sale_price_cents = ?,
           sale_expires_at = ?
       WHERE id = ?`,
      [name.trim(), ean?.trim() || null, sale_price_cents ?? null, saleExpiresValue, id]
    );

    const product = await queryOne<Product>(c.env.DB, 'SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return c.json({ error: 'Produkt nebol nájdený' }, 404);
    }

    return c.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    return c.json({ error: 'Nepodarilo sa aktualizovať produkt' }, 500);
  }
});

// DELETE /products/:id
products.delete('/:id', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const id = c.req.param('id');

    const product = await queryOne<ProductWithStock>(c.env.DB, `
      SELECT
        p.*,
        COALESCE(SUM(sb.quantity), 0) as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.id = ?
      GROUP BY p.id
    `, [id]);

    if (!product) {
      return c.json({ error: 'Produkt nebol nájdený' }, 404);
    }

    if (product.stock_quantity > 0) {
      return c.json({ error: 'Nie je možné zmazať produkt s nenulovým stavom skladu' }, 400);
    }

    await query(c.env.DB, 'DELETE FROM products WHERE id = ?', [id]);
    return c.json({ message: 'Produkt bol zmazaný' });
  } catch (error) {
    console.error('Delete product error:', error);
    return c.json({ error: 'Nepodarilo sa zmazať produkt' }, 500);
  }
});

export default products;
