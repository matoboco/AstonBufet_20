import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { sendReminderEmail } from '../email';
import { AuthenticatedRequest, AccountBalance } from '../types';

const router = Router();

// POST /admin/reminder - Send reminders to all debtors (office_assistant only)
router.post('/reminder', authenticateToken, requireRole('office_assistant'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Get all users with balance < -5€
    const debtors = await query<AccountBalance>(
      'SELECT * FROM account_balances WHERE balance_eur < -5 ORDER BY balance_eur ASC'
    );

    if (debtors.length === 0) {
      res.json({
        success: true,
        message: 'No debtors found with balance below -5€',
        sent_to: [],
      });
      return;
    }

    const results: { email: string; balance_eur: number; success: boolean; error?: string }[] = [];

    for (const debtor of debtors) {
      try {
        await sendReminderEmail(debtor.email, debtor.balance_eur);
        results.push({
          email: debtor.email,
          balance_eur: debtor.balance_eur,
          success: true,
        });
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

    res.json({
      success: true,
      message: `Sent ${successCount}/${debtors.length} reminders`,
      sent_to: results,
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

// GET /admin/debtors - Get list of debtors
router.get('/debtors', authenticateToken, requireRole('office_assistant'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const debtors = await query<AccountBalance>(
      'SELECT * FROM account_balances WHERE balance_eur < 0 ORDER BY balance_eur ASC'
    );

    res.json(debtors);
  } catch (error) {
    console.error('Get debtors error:', error);
    res.status(500).json({ error: 'Failed to fetch debtors' });
  }
});

// GET /admin/users - Get all users (office_assistant only)
router.get('/users', authenticateToken, requireRole('office_assistant'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await query<AccountBalance>(
      'SELECT * FROM account_balances ORDER BY email'
    );

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
