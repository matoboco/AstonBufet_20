import { Hono } from 'hono';
import { query, queryOne, run, generateUUID } from '../db';
import { authenticateToken, requireRole, requireSelfOrRole } from '../middleware';
import { depositSchema } from '../validation';
import { sendDepositEmail } from '../email';
import type { Env, AccountBalance, AccountHistoryEntry, ShortageAcknowledgement, ShortageSummary } from '../types';

const account = new Hono<{ Bindings: Env }>();

// GET /account/balances
account.get('/balances', authenticateToken, async (c) => {
  try {
    const user = c.get('user');
    if (user.role === 'office_assistant') {
      const balances = await query<AccountBalance>(c.env.DB,
        `SELECT u.id, u.email, u.name, u.role,
                COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
         FROM users u
         LEFT JOIN account_entries e ON u.id = e.user_id
         GROUP BY u.id, u.email, u.name, u.role
         ORDER BY balance_eur ASC`
      );
      return c.json(balances);
    } else {
      const balance = await queryOne<AccountBalance>(c.env.DB,
        `SELECT u.id, u.email, u.name, u.role,
                COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
         FROM users u
         LEFT JOIN account_entries e ON u.id = e.user_id
         WHERE u.id = ?
         GROUP BY u.id, u.email, u.name, u.role`,
        [user.userId]
      );
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
    const balance = await queryOne<AccountBalance>(c.env.DB,
      `SELECT u.id, u.email, u.name, u.role,
              COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
       FROM users u
       LEFT JOIN account_entries e ON u.id = e.user_id
       WHERE u.id = ?
       GROUP BY u.id, u.email, u.name, u.role`,
      [user.userId]
    );
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
    const history = await query<AccountHistoryEntry>(c.env.DB,
      `SELECT e.*, u.email, u.name,
              SUM(e.amount_cents) OVER (PARTITION BY e.user_id ORDER BY e.created_at)/100.0 as running_balance_eur
       FROM account_entries e
       JOIN users u ON e.user_id = u.id
       WHERE e.user_id = ?
       ORDER BY e.created_at DESC`,
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
    const user = c.get('user');
    const history = await query<AccountHistoryEntry>(c.env.DB,
      `SELECT e.*, u.email, u.name,
              SUM(e.amount_cents) OVER (PARTITION BY e.user_id ORDER BY e.created_at)/100.0 as running_balance_eur
       FROM account_entries e
       JOIN users u ON e.user_id = u.id
       WHERE e.user_id = ?
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [user.userId]
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

    const targetUser = await queryOne<{ id: string; email: string; name: string | null }>(
      c.env.DB, 'SELECT id, email, name FROM users WHERE id = ?', [user_id]
    );

    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const previousBalance = await queryOne<{ balance_eur: number }>(c.env.DB,
      `SELECT COALESCE(SUM(amount_cents)/100.0, 0) as balance_eur
       FROM account_entries WHERE user_id = ?`,
      [user_id]
    );
    const previousBalanceCents = Math.round((Number(previousBalance?.balance_eur) || 0) * 100);

    const actualDepositCents = contribution_cents ? amount_cents - contribution_cents : amount_cents;
    const description = note || 'Vklad / Vyrovnanie dlhu';
    const entryId = generateUUID();

    await run(c.env.DB,
      'INSERT INTO account_entries (id, user_id, amount_cents, description) VALUES (?, ?, ?, ?)',
      [entryId, user_id, actualDepositCents, description]
    );

    if (contribution_cents && contribution_cents > 0) {
      const contribId = generateUUID();
      await run(c.env.DB,
        'INSERT INTO shortage_contributions (id, user_id, amount_cents, description, recorded_by) VALUES (?, ?, ?, ?, ?)',
        [contribId, user_id, contribution_cents, 'Prispevok na manko', c.get('user').userId]
      );
    }

    const newBalance = await queryOne<{ balance_eur: number }>(c.env.DB,
      `SELECT COALESCE(SUM(amount_cents)/100.0, 0) as balance_eur
       FROM account_entries WHERE user_id = ?`,
      [user_id]
    );
    const newBalanceCents = Math.round((Number(newBalance?.balance_eur) || 0) * 100);

    // Send email notification (fire-and-forget via waitUntil)
    c.executionCtx.waitUntil(
      sendDepositEmail(c.env, {
        email: targetUser.email,
        name: targetUser.name,
        totalPaidCents: amount_cents,
        depositedCents: actualDepositCents,
        contributionCents: contribution_cents || 0,
        previousBalanceCents,
        newBalanceCents,
      })
    );

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
      new_balance_eur: newBalance?.balance_eur || 0,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    return c.json({ error: 'Failed to process deposit' }, 500);
  }
});

// GET /account/shortage-summary
account.get('/shortage-summary', authenticateToken, requireRole('office_assistant'), async (c) => {
  try {
    const shortageResult = await queryOne<{ total_shortage_cents: number }>(c.env.DB,
      `SELECT CAST(COALESCE(SUM(ABS(sa.difference) * p.price_cents), 0) AS INTEGER) as total_shortage_cents
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.id
       WHERE sa.difference < 0 AND (sa.is_write_off = 0 OR sa.is_write_off IS NULL)`
    );

    const contribResult = await queryOne<{ total_contributions_cents: number }>(c.env.DB,
      'SELECT CAST(COALESCE(SUM(amount_cents), 0) AS INTEGER) as total_contributions_cents FROM shortage_contributions'
    );

    const totalShortageCents = shortageResult?.total_shortage_cents || 0;
    const totalContributionsCents = contribResult?.total_contributions_cents || 0;

    return c.json({
      total_shortage_cents: totalShortageCents,
      total_shortage_eur: totalShortageCents / 100,
      total_contributions_cents: totalContributionsCents,
      total_contributions_eur: totalContributionsCents / 100,
      remaining_shortage_cents: totalShortageCents - totalContributionsCents,
      remaining_shortage_eur: (totalShortageCents - totalContributionsCents) / 100,
    });
  } catch (error) {
    console.error('Get shortage summary error:', error);
    return c.json({ error: 'Failed to fetch shortage summary' }, 500);
  }
});

// GET /account/shortage-warning
account.get('/shortage-warning', authenticateToken, async (c) => {
  try {
    const jwtUser = c.get('user');

    const user = await queryOne<{ created_at: string }>(c.env.DB,
      'SELECT created_at FROM users WHERE id = ?', [jwtUser.userId]
    );

    const lastAck = await queryOne<ShortageAcknowledgement>(c.env.DB,
      'SELECT * FROM shortage_acknowledgements WHERE user_id = ?', [jwtUser.userId]
    );

    const cutoffDate = lastAck?.acknowledged_at || user?.created_at || new Date().toISOString();

    const shortageResult = await queryOne<{ total_shortage: number; total_value_cents: number; first_shortage_at: string | null }>(c.env.DB,
      `SELECT
        CAST(COALESCE(SUM(ABS(sa.difference)), 0) AS INTEGER) as total_shortage,
        CAST(COALESCE(SUM(ABS(sa.difference) * p.price_cents), 0) AS INTEGER) as total_value_cents,
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

    const adjustments = await query<{ product_name: string; difference: number; price_cents: number; created_at: string }>(c.env.DB,
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
    const jwtUser = c.get('user');

    const shortageResult = await queryOne<{ total: number }>(c.env.DB,
      'SELECT CAST(COALESCE(SUM(ABS(difference)), 0) AS INTEGER) as total FROM stock_adjustments WHERE difference < 0'
    );
    const currentTotal = Number(shortageResult?.total) || 0;

    const existingAck = await queryOne<ShortageAcknowledgement>(c.env.DB,
      'SELECT * FROM shortage_acknowledgements WHERE user_id = ?',
      [jwtUser.userId]
    );

    if (existingAck) {
      await run(c.env.DB,
        `UPDATE shortage_acknowledgements SET acknowledged_at = datetime('now'), shortage_total = ? WHERE user_id = ?`,
        [currentTotal, jwtUser.userId]
      );
    } else {
      const id = generateUUID();
      await run(c.env.DB,
        'INSERT INTO shortage_acknowledgements (id, user_id, shortage_total) VALUES (?, ?, ?)',
        [id, jwtUser.userId, currentTotal]
      );
    }

    return c.json({ success: true, acknowledged_at: new Date().toISOString() });
  } catch (error) {
    console.error('Acknowledge shortage error:', error);
    return c.json({ error: 'Failed to acknowledge shortage' }, 500);
  }
});

export default account;
