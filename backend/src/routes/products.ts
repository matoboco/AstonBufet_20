import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { ProductWithStock, Product, AuthenticatedRequest } from '../types';
import { authenticateToken, requireRole } from '../middleware';

const router = Router();

// GET /products
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await query<ProductWithStock>(`
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        CASE WHEN p.sale_expires_at > NOW() THEN p.sale_price_cents ELSE NULL END as sale_price_cents,
        CASE WHEN p.sale_expires_at > NOW() THEN p.sale_expires_at ELSE NULL END as sale_expires_at,
        COALESCE(SUM(sb.quantity), 0)::integer as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      GROUP BY p.id
      ORDER BY p.name
    `);

    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /products/on-sale - Products with active sale price and stock > 0
router.get('/on-sale', async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await query<ProductWithStock>(`
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        p.sale_price_cents,
        p.sale_expires_at,
        COALESCE(SUM(sb.quantity), 0)::integer as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.sale_price_cents IS NOT NULL
        AND p.sale_expires_at > NOW()
      GROUP BY p.id
      HAVING COALESCE(SUM(sb.quantity), 0) > 0
      ORDER BY p.sale_expires_at ASC
    `);

    res.json(products);
  } catch (error) {
    console.error('Get on-sale products error:', error);
    res.status(500).json({ error: 'Failed to fetch on-sale products' });
  }
});

// GET /products/by-ean/:ean
router.get('/by-ean/:ean', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ean } = req.params;

    const product = await queryOne<ProductWithStock>(`
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        CASE WHEN p.sale_expires_at > NOW() THEN p.sale_price_cents ELSE NULL END as sale_price_cents,
        CASE WHEN p.sale_expires_at > NOW() THEN p.sale_expires_at ELSE NULL END as sale_expires_at,
        COALESCE(SUM(sb.quantity), 0)::integer as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.ean = $1
      GROUP BY p.id
    `, [ean]);

    if (!product) {
      res.status(404).json({ error: 'Product not found', ean });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error('Get product by EAN error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// GET /products/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await queryOne<ProductWithStock>(`
      SELECT
        p.id, p.name, p.ean, p.price_cents, p.created_at,
        CASE WHEN p.sale_expires_at > NOW() THEN p.sale_price_cents ELSE NULL END as sale_price_cents,
        CASE WHEN p.sale_expires_at > NOW() THEN p.sale_expires_at ELSE NULL END as sale_expires_at,
        COALESCE(SUM(sb.quantity), 0)::integer as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// PUT /products/:id - Update product (office_assistant only)
router.put('/:id', authenticateToken, requireRole('office_assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, ean, sale_price_cents, sale_expires_at } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Názov produktu je povinný' });
      return;
    }

    // Check if new EAN is already used by another product
    if (ean) {
      const existingProduct = await queryOne<Product>(
        'SELECT id FROM products WHERE ean = $1 AND id != $2',
        [ean.trim(), id]
      );
      if (existingProduct) {
        res.status(400).json({ error: 'EAN kód už používa iný produkt' });
        return;
      }
    }

    // Validate sale price if provided
    if (sale_price_cents !== undefined && sale_price_cents !== null) {
      if (typeof sale_price_cents !== 'number' || sale_price_cents <= 0) {
        res.status(400).json({ error: 'Akciová cena musí byť kladné číslo' });
        return;
      }
      if (!sale_expires_at) {
        res.status(400).json({ error: 'Dátum vypršania akcie je povinný' });
        return;
      }
    }

    // If sale_expires_at is a date string (YYYY-MM-DD), set to end of day
    let saleExpiresValue: string | null = sale_expires_at ?? null;
    if (saleExpiresValue && saleExpiresValue.length === 10) {
      saleExpiresValue = `${saleExpiresValue}T23:59:59`;
    }

    const product = await queryOne<Product>(
      `UPDATE products
       SET name = $1, ean = COALESCE($2, ean),
           sale_price_cents = $4,
           sale_expires_at = $5
       WHERE id = $3 RETURNING *`,
      [name.trim(), ean?.trim() || null, id, sale_price_cents ?? null, saleExpiresValue]
    );

    if (!product) {
      res.status(404).json({ error: 'Produkt nebol nájdený' });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Nepodarilo sa aktualizovať produkt' });
  }
});

// DELETE /products/:id - Delete product (office_assistant only, stock must be 0)
router.delete('/:id', authenticateToken, requireRole('office_assistant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await queryOne<ProductWithStock>(`
      SELECT
        p.*,
        COALESCE(SUM(sb.quantity), 0)::integer as stock_quantity
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (!product) {
      res.status(404).json({ error: 'Produkt nebol nájdený' });
      return;
    }

    if (product.stock_quantity > 0) {
      res.status(400).json({ error: 'Nie je možné zmazať produkt s nenulovým stavom skladu' });
      return;
    }

    await query('DELETE FROM products WHERE id = $1', [id]);

    res.json({ message: 'Produkt bol zmazaný' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Nepodarilo sa zmazať produkt' });
  }
});

// GET /products/:id/price-preview - Calculate FIFO price for quantity
router.get('/:id/price-preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const quantity = parseInt(req.query.quantity as string) || 1;

    // Check for active sale price
    const product = await queryOne<Product>(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (!product) {
      res.status(404).json({ error: 'Produkt nebol nájdený' });
      return;
    }

    const hasActiveSale = product.sale_price_cents != null
      && product.sale_expires_at != null
      && new Date(product.sale_expires_at) > new Date();

    // Get available batches (FIFO - oldest first)
    const batches = await query<{ quantity: number; price_cents: number }>(
      `SELECT quantity, price_cents FROM stock_batches
       WHERE product_id = $1 AND quantity > 0
       ORDER BY created_at ASC`,
      [id]
    );

    if (batches.length === 0) {
      res.status(404).json({ error: 'Produkt nie je na sklade' });
      return;
    }

    const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);

    // If active sale, use sale price instead of FIFO
    if (hasActiveSale) {
      const salePrice = product.sale_price_cents!;
      const totalCost = salePrice * quantity;

      res.json({
        quantity,
        total_cents: totalCost,
        total_eur: totalCost / 100,
        unit_price_cents: salePrice,
        unit_price_eur: salePrice / 100,
        available_stock: totalStock,
        is_sale: true,
        breakdown: [{ quantity, price_cents: salePrice }],
      });
      return;
    }

    // Calculate FIFO price
    let remainingQty = quantity;
    let totalCost = 0;
    const breakdown: { quantity: number; price_cents: number }[] = [];

    for (const batch of batches) {
      if (remainingQty === 0) break;

      const allocQty = Math.min(remainingQty, batch.quantity);
      totalCost += allocQty * batch.price_cents;
      breakdown.push({
        quantity: allocQty,
        price_cents: batch.price_cents,
      });

      remainingQty -= allocQty;
    }

    res.json({
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
    res.status(500).json({ error: 'Nepodarilo sa vypočítať cenu' });
  }
});

export default router;
