import { Hono } from 'hono';
import { query } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { sendReminderEmail } from '../email';
import type { Env, AccountBalance } from '../types';

const admin = new Hono<{ Bindings: Env }>();

// POST /admin/reminder
admin.post('/reminder', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const debtors = await query<AccountBalance>(c.env.DB,
      `SELECT u.id, u.email, u.name, u.role,
              COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
       FROM users u
       LEFT JOIN account_entries e ON u.id = e.user_id
       GROUP BY u.id, u.email, u.name, u.role
       HAVING balance_eur < -5
       ORDER BY balance_eur ASC`
    );

    if (debtors.length === 0) {
      return c.json({
        success: true,
        message: 'No debtors found with balance below -5 EUR',
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
    const debtors = await query<AccountBalance>(c.env.DB,
      `SELECT u.id, u.email, u.name, u.role,
              COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
       FROM users u
       LEFT JOIN account_entries e ON u.id = e.user_id
       GROUP BY u.id, u.email, u.name, u.role
       HAVING balance_eur < 0
       ORDER BY balance_eur ASC`
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
    const users = await query<AccountBalance>(c.env.DB,
      `SELECT u.id, u.email, u.name, u.role,
              COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
       FROM users u
       LEFT JOIN account_entries e ON u.id = e.user_id
       GROUP BY u.id, u.email, u.name, u.role
       ORDER BY u.email`
    );
    return c.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

export default admin;
