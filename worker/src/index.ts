import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleScheduled } from './scheduled';
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import purchasesRoutes from './routes/purchases';
import stockRoutes from './routes/stock';
import accountRoutes from './routes/account';
import adminRoutes from './routes/admin';
import type { Env, JWTPayload } from './types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

const app = new Hono<HonoEnv>();

// CORS middleware
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || '*',
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${new Date().toISOString()} ${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version endpoint
app.get('/version', (c) => {
  return c.json({
    version: '2.0.0',
    buildTime: new Date().toISOString(),
    runtime: 'cloudflare-workers',
  });
});

// API routes
app.route('/auth', authRoutes);
app.route('/products', productsRoutes);
app.route('/purchases', purchasesRoutes);
app.route('/stock', stockRoutes);
app.route('/account', accountRoutes);
app.route('/admin', adminRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env));
  },
};
