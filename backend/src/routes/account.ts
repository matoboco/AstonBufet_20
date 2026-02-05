import { Router, Response } from 'express';
import { query, queryOne } from '../db';
import { authenticateToken, requireRole, requireSelfOrRole } from '../middleware';
import { depositSchema } from '../validation';
import { AuthenticatedRequest, AccountBalance, AccountHistoryEntry } from '../types';

const router = Router();

// GET /account/balances - Get all balances (office_assistant) or own balance (user)
router.get('/balances', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role === 'office_assistant') {
      // Office assistant can see all balances
      const balances = await query<AccountBalance>(
        'SELECT * FROM account_balances ORDER BY balance_eur ASC'
      );
      res.json(balances);
    } else {
      // Regular user can only see their own balance
      const balance = await queryOne<AccountBalance>(
        'SELECT * FROM account_balances WHERE id = $1',
        [req.user!.userId]
      );
      res.json(balance ? [balance] : []);
    }
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// GET /account/my-balance - Get current user's balance
router.get('/my-balance', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const balance = await queryOne<AccountBalance>(
      'SELECT * FROM account_balances WHERE id = $1',
      [req.user!.userId]
    );

    res.json(balance || { id: req.user!.userId, email: req.user!.email, role: req.user!.role, balance_eur: 0 });
  } catch (error) {
    console.error('Get my balance error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// GET /account/history/:user_id - Get transaction history (self or office_assistant)
router.get('/history/:user_id', authenticateToken, requireSelfOrRole('office_assistant'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { user_id } = req.params;

    const history = await query<AccountHistoryEntry>(
      `SELECT * FROM account_history
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /account/my-history - Get current user's transaction history
router.get('/my-history', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const history = await query<AccountHistoryEntry>(
      `SELECT * FROM account_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user!.userId]
    );

    res.json(history);
  } catch (error) {
    console.error('Get my history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// POST /account/deposit - Add deposit (office_assistant only)
router.post('/deposit', authenticateToken, requireRole('office_assistant'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = depositSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { user_id, amount_cents, note } = validation.data;

    // Verify user exists
    const user = await queryOne<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE id = $1',
      [user_id]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Create positive entry (deposit)
    const description = note || 'Vklad / Vyrovnanie dlhu';
    await query(
      `INSERT INTO account_entries (user_id, amount_cents, description)
       VALUES ($1, $2, $3)`,
      [user_id, amount_cents, description]
    );

    // Get updated balance
    const balance = await queryOne<AccountBalance>(
      'SELECT * FROM account_balances WHERE id = $1',
      [user_id]
    );

    res.json({
      success: true,
      deposit: {
        user_id,
        user_email: user.email,
        amount_cents,
        amount_eur: amount_cents / 100,
        description,
      },
      new_balance_eur: balance?.balance_eur || 0,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

export default router;
