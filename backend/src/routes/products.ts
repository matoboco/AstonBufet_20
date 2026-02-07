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
        p.*,
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

// GET /products/by-ean/:ean
router.get('/by-ean/:ean', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ean } = req.params;

    const product = await queryOne<ProductWithStock>(`
      SELECT
        p.*,
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
        p.*,
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
    const { name, ean } = req.body;

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

    const product = await queryOne<Product>(
      'UPDATE products SET name = $1, ean = COALESCE($2, ean) WHERE id = $3 RETURNING *',
      [name.trim(), ean?.trim() || null, id]
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

    const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);

    res.json({
      quantity,
      total_cents: totalCost,
      total_eur: totalCost / 100,
      unit_price_cents: Math.round(totalCost / quantity),
      unit_price_eur: totalCost / quantity / 100,
      available_stock: totalStock,
      breakdown,
    });
  } catch (error) {
    console.error('Price preview error:', error);
    res.status(500).json({ error: 'Nepodarilo sa vypočítať cenu' });
  }
});

export default router;
