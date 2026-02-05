import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { ProductWithStock, Product } from '../types';

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

export default router;
