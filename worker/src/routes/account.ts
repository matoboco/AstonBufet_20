import { Hono } from 'hono';
import { query, queryOne } from '../db';
import { authenticateToken, requireRole, requireSelfOrRole } from '../middleware';
import { depositSchema } from '../validation';
import { sendDepositEmail } from '../email';
import type { Env, AccountBalance, AccountHistoryEntry, ShortageAcknowledgement, ShortageSummary, JWTPayload } from '../types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

const account = new Hono<HonoEnv>();

// GET /account/balances
account.get('/balances', authenticateToken, async (c) => {
  try {
    const user = c.get('user');
    if (user.role === 'office_assistant') {
      const balances = await query<AccountBalance>(c.env.DB, 'SELECT * FROM account_balances ORDER BY balance_eur ASC');
      return c.json(balances);
    } else {
      const balance = await queryOne<AccountBalance>(c.env.DB, 'SELECT * FROM account_balances WHERE id = ?', [user.userId]);
      return c.json(balance ? [balance] : []);
    }
  } catch (error) {
    console.error('Get balances error:', error);
    return c.json({ error: 'Failed to fetch balances' }, 500);
  }
});

// GET /account/my-balance
account.get('/my-balance', authenticateToken, async (c) => {
  try {
    const user = c.get('user');
    const balance = await queryOne<AccountBalance>(c.env.DB, 'SELECT * FROM account_balances WHERE id = ?', [user.userId]);
    return c.json(balance || { id: user.userId, email: user.email, role: user.role, balance_eur: 0 });
  } catch (error) {
    console.error('Get my balance error:', error);
    return c.json({ error: 'Failed to fetch balance' }, 500);
  }
});

// GET /account/history/:user_id
account.get('/history/:user_id', authenticateToken, requireSelfOrRole('office_assistant'), async (c) => {
  try {
    const user_id = c.req.param('user_id');
    const history = await query<AccountHistoryEntry>(
      c.env.DB,
      `SELECT * FROM account_history
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [user_id]
    );
    return c.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

// GET /account/my-history
account.get('/my-history', authenticateToken, async (c) => {
  try {
    const history = await query<AccountHistoryEntry>(
      c.env.DB,
      `SELECT * FROM account_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [c.get('user').userId]
    );
    return c.json(history);
  } catch (error) {
    console.error('Get my history error:', error);
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

// POST /account/deposit
account.post('/deposit', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const body = await c.req.json();
    const validation = depositSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const { user_id, amount_cents, note, contribution_cents } = validation.data;
    const db = c.env.DB;

    // Verify user exists
    const targetUser = await queryOne<{ id: string; email: string; name: string | null }>(
      db, 'SELECT id, email, name FROM users WHERE id = ?', [user_id]
    );

    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get previous balance
    const previousBalance = await queryOne<{ balance_eur: number }>(
      db, 'SELECT balance_eur FROM account_balances WHERE id = ?', [user_id]
    );
    const previousBalanceCents = Math.round((Number(previousBalance?.balance_eur) || 0) * 100);

    const actualDepositCents = contribution_cents ? amount_cents - contribution_cents : amount_cents;
    const description = note || 'Vklad / Vyrovnanie dlhu';
    const entryId = crypto.randomUUID();

    // Build statements
    const statements: D1PreparedStatement[] = [
      db.prepare(
        'INSERT INTO account_entries (id, user_id, amount_cents, description) VALUES (?, ?, ?, ?)'
      ).bind(entryId, user_id, actualDepositCents, description),
    ];

    if (contribution_cents && contribution_cents > 0) {
      statements.push(
        db.prepare(
          'INSERT INTO shortage_contributions (id, user_id, amount_cents, description, recorded_by) VALUES (?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), user_id, contribution_cents, 'Príspevok na manko', c.get('user').userId)
      );
    }

    await db.batch(statements);

    // Get updated balance
    const balance = await queryOne<AccountBalance>(
      db, 'SELECT * FROM account_balances WHERE id = ?', [user_id]
    );
    const newBalanceCents = Math.round((Number(balance?.balance_eur) || 0) * 100);

    // Send email notification (async via waitUntil in the caller if possible, or just fire-and-forget)
    sendDepositEmail(c.env, {
      email: targetUser.email,
      name: targetUser.name,
      totalPaidCents: amount_cents,
      depositedCents: actualDepositCents,
      contributionCents: contribution_cents || 0,
      previousBalanceCents,
      newBalanceCents,
    }).catch(err => console.error('Failed to send deposit email:', err));

    return c.json({
      success: true,
      deposit: {
        user_id,
        user_email: targetUser.email,
        amount_cents: actualDepositCents,
        amount_eur: actualDepositCents / 100,
        description,
        contribution_cents: contribution_cents || 0,
        contribution_eur: (contribution_cents || 0) / 100,
      },
      new_balance_eur: balance?.balance_eur || 0,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    return c.json({ error: 'Failed to process deposit' }, 500);
  }
});

// GET /account/shortage-summary
account.get('/shortage-summary', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const summary = await queryOne<ShortageSummary>(c.env.DB, 'SELECT * FROM shortage_summary');

    return c.json({
      total_shortage_cents: summary?.total_shortage_cents || 0,
      total_shortage_eur: (summary?.total_shortage_cents || 0) / 100,
      total_contributions_cents: summary?.total_contributions_cents || 0,
      total_contributions_eur: (summary?.total_contributions_cents || 0) / 100,
      remaining_shortage_cents: (summary?.total_shortage_cents || 0) - (summary?.total_contributions_cents || 0),
      remaining_shortage_eur: ((summary?.total_shortage_cents || 0) - (summary?.total_contributions_cents || 0)) / 100,
    });
  } catch (error) {
    console.error('Get shortage summary error:', error);
    return c.json({ error: 'Failed to fetch shortage summary' }, 500);
  }
});

// GET /account/shortage-warning
account.get('/shortage-warning', authenticateToken, async (c) => {
  try {
    const userId = c.get('user').userId;
    const db = c.env.DB;

    const user = await queryOne<{ created_at: string }>(db, 'SELECT created_at FROM users WHERE id = ?', [userId]);
    const lastAck = await queryOne<ShortageAcknowledgement>(
      db, 'SELECT * FROM shortage_acknowledgements WHERE user_id = ?', [userId]
    );

    const cutoffDate = lastAck?.acknowledged_at || user?.created_at || new Date().toISOString();

    const shortageResult = await queryOne<{ total_shortage: number; total_value_cents: number; first_shortage_at: string | null }>(
      db,
      `SELECT
        COALESCE(SUM(ABS(sa.difference)), 0) as total_shortage,
        COALESCE(SUM(ABS(sa.difference) * p.price_cents), 0) as total_value_cents,
        MIN(sa.created_at) as first_shortage_at
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      WHERE sa.difference < 0 AND sa.created_at > ? AND (sa.is_write_off = 0 OR sa.is_write_off IS NULL)`,
      [cutoffDate]
    );

    const totalShortage = Number(shortageResult?.total_shortage) || 0;
    const totalValueCents = Number(shortageResult?.total_value_cents) || 0;

    if (totalShortage === 0) {
      return c.json({ has_warning: false });
    }

    const adjustments = await query<{ product_name: string; difference: number; price_cents: number; created_at: string }>(
      db,
      `SELECT p.name as product_name, sa.difference, p.price_cents, sa.created_at
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      WHERE sa.difference < 0 AND sa.created_at > ? AND (sa.is_write_off = 0 OR sa.is_write_off IS NULL)
      ORDER BY sa.created_at DESC`,
      [cutoffDate]
    );

    return c.json({
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
    return c.json({ error: 'Failed to fetch shortage warning' }, 500);
  }
});

// POST /account/acknowledge-shortage
account.post('/acknowledge-shortage', authenticateToken, async (c) => {
  try {
    const db = c.env.DB;
    const userId = c.get('user').userId;

    const shortageResult = await queryOne<{ total: number }>(
      db, 'SELECT COALESCE(SUM(ABS(difference)), 0) as total FROM stock_adjustments WHERE difference < 0'
    );
    const currentTotal = Number(shortageResult?.total) || 0;

    await query(
      db,
      `INSERT INTO shortage_acknowledgements (id, user_id, acknowledged_at, shortage_total)
       VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT (user_id)
       DO UPDATE SET acknowledged_at = datetime('now'), shortage_total = ?`,
      [crypto.randomUUID(), userId, currentTotal, currentTotal]
    );

    return c.json({ success: true, acknowledged_at: new Date().toISOString() });
  } catch (error) {
    console.error('Acknowledge shortage error:', error);
    return c.json({ error: 'Failed to acknowledge shortage' }, 500);
  }
});

export default account;
