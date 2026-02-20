import { Hono } from 'hono';
import { query } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { sendReminderEmail } from '../email';
import type { Env, AccountBalance, JWTPayload } from '../types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

const admin = new Hono<HonoEnv>();

// POST /admin/reminder
admin.post('/reminder', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const debtors = await query<AccountBalance>(
      c.env.DB,
      'SELECT * FROM account_balances WHERE balance_eur < -5 ORDER BY balance_eur ASC'
    );

    if (debtors.length === 0) {
      return c.json({
        success: true,
        message: 'No debtors found with balance below -5€',
        sent_to: [],
      });
    }

    const results: { email: string; balance_eur: number; success: boolean; error?: string }[] = [];

    for (const debtor of debtors) {
      try {
        await sendReminderEmail(c.env, debtor.email, debtor.balance_eur, debtor.name);
        results.push({ email: debtor.email, balance_eur: debtor.balance_eur, success: true });
      } catch (error) {
        results.push({
          email: debtor.email,
          balance_eur: debtor.balance_eur,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return c.json({
      success: true,
      message: `Sent ${successCount}/${debtors.length} reminders`,
      sent_to: results,
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    return c.json({ error: 'Failed to send reminders' }, 500);
  }
});

// GET /admin/debtors
admin.get('/debtors', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const debtors = await query<AccountBalance>(
      c.env.DB,
      'SELECT * FROM account_balances WHERE balance_eur < 0 ORDER BY balance_eur ASC'
    );
    return c.json(debtors);
  } catch (error) {
    console.error('Get debtors error:', error);
    return c.json({ error: 'Failed to fetch debtors' }, 500);
  }
});

// GET /admin/users
admin.get('/users', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const users = await query<AccountBalance>(c.env.DB, 'SELECT * FROM account_balances ORDER BY email');
    return c.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

export default admin;
