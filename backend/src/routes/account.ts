import { Router, Response } from 'express';
import { query, queryOne } from '../db';
import { authenticateToken, requireRole, requireSelfOrRole } from '../middleware';
import { depositSchema } from '../validation';
import { AuthenticatedRequest, AccountBalance, AccountHistoryEntry, ShortageAcknowledgement } from '../types';

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

// GET /account/shortage-warning - Get unacknowledged shortage for current user
router.get('/shortage-warning', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Get user's creation date and last acknowledgement
    const user = await queryOne<{ created_at: Date }>(
      'SELECT created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );

    const lastAck = await queryOne<ShortageAcknowledgement>(
      'SELECT * FROM shortage_acknowledgements WHERE user_id = $1',
      [req.user!.userId]
    );

    // Use the later of: user creation date or last acknowledgement
    // This ensures new users don't see historical shortages from before they joined
    const cutoffDate = lastAck?.acknowledged_at || user?.created_at || new Date();

    // Get total shortage (negative differences) since cutoff date
    // Exclude write-offs (intentional removals like expired goods)
    const shortageQuery = `
      SELECT
        COALESCE(SUM(ABS(sa.difference)), 0)::integer as total_shortage,
        COALESCE(SUM(ABS(sa.difference) * p.price_cents), 0)::integer as total_value_cents,
        MIN(sa.created_at) as first_shortage_at
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      WHERE sa.difference < 0 AND sa.created_at > $1 AND (sa.is_write_off = FALSE OR sa.is_write_off IS NULL)
    `;

    const shortageResult = await queryOne<{ total_shortage: number; total_value_cents: number; first_shortage_at: Date | null }>(
      shortageQuery,
      [cutoffDate]
    );

    const totalShortage = Number(shortageResult?.total_shortage) || 0;
    const totalValueCents = Number(shortageResult?.total_value_cents) || 0;

    if (totalShortage === 0) {
      res.json({ has_warning: false });
      return;
    }

    // Get individual adjustments for display (exclude write-offs)
    const adjustmentsQuery = `
      SELECT p.name as product_name, sa.difference, p.price_cents, sa.created_at
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      WHERE sa.difference < 0 AND sa.created_at > $1 AND (sa.is_write_off = FALSE OR sa.is_write_off IS NULL)
      ORDER BY sa.created_at DESC
    `;

    const adjustments = await query<{ product_name: string; difference: number; price_cents: number; created_at: Date }>(
      adjustmentsQuery,
      [cutoffDate]
    );

    res.json({
      has_warning: true,
      total_shortage: totalShortage,
      total_value_eur: totalValueCents / 100,
      shortage_since: lastAck?.acknowledged_at || null,
      adjustments: adjustments.map(a => ({
        product_name: a.product_name,
        difference: Number(a.difference),
        value_eur: (Math.abs(Number(a.difference)) * Number(a.price_cents)) / 100,
        created_at: a.created_at,
      })),
    });
  } catch (error) {
    console.error('Get shortage warning error:', error);
    res.status(500).json({ error: 'Failed to fetch shortage warning' });
  }
});

// POST /account/acknowledge-shortage - Mark shortage warning as seen
router.post('/acknowledge-shortage', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Get current total shortage
    const shortageResult = await queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(ABS(difference)), 0)::integer as total FROM stock_adjustments WHERE difference < 0'
    );
    const currentTotal = Number(shortageResult?.total) || 0;

    // Upsert acknowledgement
    await query(
      `INSERT INTO shortage_acknowledgements (user_id, acknowledged_at, shortage_total)
       VALUES ($1, NOW(), $2)
       ON CONFLICT (user_id)
       DO UPDATE SET acknowledged_at = NOW(), shortage_total = $2`,
      [req.user!.userId, currentTotal]
    );

    res.json({ success: true, acknowledged_at: new Date().toISOString() });
  } catch (error) {
    console.error('Acknowledge shortage error:', error);
    res.status(500).json({ error: 'Failed to acknowledge shortage' });
  }
});

export default router;
