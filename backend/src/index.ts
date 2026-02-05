import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database initialization
import { initializeDatabase } from './db';

// Import routes
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import purchasesRoutes from './routes/purchases';
import stockRoutes from './routes/stock';
import accountRoutes from './routes/account';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/auth', authRoutes);
app.use('/products', productsRoutes);
app.use('/purchases', purchasesRoutes);
app.use('/stock', stockRoutes);
app.use('/account', accountRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const start = async () => {
  try {
    // Initialize database with migrations
    await initializeDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║     Firemný Bufet Backend API              ║
║     Running on port ${PORT}                    ║
╚════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();

export default app;
