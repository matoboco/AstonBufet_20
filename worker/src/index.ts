import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { query, run } from './db';
import { sendReminderEmail } from './email';
import type { Env, AccountBalance } from './types';

// Import routes
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import purchasesRoutes from './routes/purchases';
import stockRoutes from './routes/stock';
import accountRoutes from './routes/account';
import adminRoutes from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Request logging
app.use('*', async (c, next) => {
  console.log(`${new Date().toISOString()} ${c.req.method} ${c.req.path}`);
  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), runtime: 'cloudflare-worker' });
});

// Version endpoint
app.get('/version', (c) => {
  return c.json({
    version: '2.0.0',
    buildTime: new Date().toISOString(),
    runtime: 'cloudflare-worker',
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

// Cron trigger handler (replaces node-cron)
async function handleScheduled(env: Env): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running scheduled reminder job...`);

  try {
    const debtors = await query<AccountBalance>(env.DB,
      `SELECT u.id, u.email, u.name, u.role,
              COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
       FROM users u
       LEFT JOIN account_entries e ON u.id = e.user_id
       GROUP BY u.id, u.email, u.name, u.role
       HAVING balance_eur < -5
       ORDER BY balance_eur ASC`
    );

    console.log(`Found ${debtors.length} debtors with balance below -5 EUR`);

    let successCount = 0;
    let failCount = 0;

    for (const debtor of debtors) {
      try {
        await sendReminderEmail(env, debtor.email, debtor.balance_eur, debtor.name);
        console.log(`  Sent reminder to ${debtor.email} (${Number(debtor.balance_eur).toFixed(2)} EUR)`);
        successCount++;
      } catch (error) {
        console.error(`  Failed to send reminder to ${debtor.email}:`, error);
        failCount++;
      }
    }

    console.log(`Reminder job completed: ${successCount} sent, ${failCount} failed`);
  } catch (error) {
    console.error('Reminder job error:', error);
  }
}

// Cleanup expired OTP codes (runs daily at midnight)
async function cleanupExpiredOTPCodes(env: Env): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running expired OTP codes cleanup...`);

  try {
    const result = await run(
      env.DB,
      `DELETE FROM login_codes WHERE expires_at < datetime('now') OR used = 1`
    );
    console.log(`Deleted ${result.meta.changes} expired/used OTP codes`);
  } catch (error) {
    console.error('OTP cleanup error:', error);
  }
}

// Export for Cloudflare Worker
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === '0 0 * * *') {
      ctx.waitUntil(cleanupExpiredOTPCodes(env));
    } else {
      ctx.waitUntil(handleScheduled(env));
    }
  },
};
