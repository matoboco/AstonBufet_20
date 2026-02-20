import { Hono } from 'hono';
import { query, queryOne } from '../db';
import { generateOTP, generateToken, authenticateToken } from '../middleware';
import { sendOTPEmail } from '../email';
import { requestCodeSchema, verifyCodeSchema } from '../validation';
import type { Env, User, LoginCode, JWTPayload } from '../types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

const auth = new Hono<HonoEnv>();

function getAllowedDomains(env: Env): string[] {
  const domainsEnv = env.ALLOWED_EMAIL_DOMAINS || '';
  return domainsEnv
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

function isEmailDomainAllowed(email: string, env: Env): boolean {
  const allowedDomains = getAllowedDomains(env);
  if (allowedDomains.length === 0) return true;
  const emailDomain = email.split('@')[1]?.toLowerCase();
  return allowedDomains.includes(emailDomain);
}

function getOfficeAssistantSuffixes(env: Env): string[] {
  const emailsEnv = env.OFFICE_ASSISTANT_EMAILS || '';
  return emailsEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

function isOfficeAssistantEmail(email: string, env: Env): boolean {
  const suffixes = getOfficeAssistantSuffixes(env);
  const normalizedEmail = email.toLowerCase();
  return suffixes.some((suffix) => normalizedEmail.endsWith(suffix));
}

function determineUserRole(email: string, env: Env): 'user' | 'office_assistant' {
  return isOfficeAssistantEmail(email, env) ? 'office_assistant' : 'user';
}

// POST /auth/request-code
auth.post('/request-code', async (c) => {
  try {
    const body = await c.req.json();
    const validation = requestCodeSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const email = validation.data.email.trim().toLowerCase();

    if (!isEmailDomainAllowed(email, c.env)) {
      const allowedDomains = getAllowedDomains(c.env);
      return c.json({
        error: `Povolené sú len emaily z domén: ${allowedDomains.join(', ')}`
      }, 400);
    }

    // Validate @aston.sk emails - must use short format without dots
    if (email.endsWith('@aston.sk')) {
      const localPart = email.split('@')[0];
      if (localPart.includes('.')) {
        return c.json({
          error: 'Prosím, použi krátku emailovú adresu v tvare mpriezvisko@aston.sk (bez bodky)'
        }, 400);
      }
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate existing codes
    await query(c.env.DB, 'UPDATE login_codes SET used = 1 WHERE email = ? AND used = 0', [email]);

    // Create new code
    await query(
      c.env.DB,
      'INSERT INTO login_codes (email, code, expires_at) VALUES (?, ?, ?)',
      [email, code, expiresAt]
    );

    // Send email
    await sendOTPEmail(c.env, email, code);

    return c.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Request code error:', error);
    return c.json({ error: 'Failed to send verification code' }, 500);
  }
});

// POST /auth/verify-code
auth.post('/verify-code', async (c) => {
  try {
    const body = await c.req.json();
    const validation = verifyCodeSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const email = validation.data.email.trim().toLowerCase();
    const code = validation.data.code;
    const name = validation.data.name?.trim() || null;

    // Find valid code
    const loginCode = await queryOne<LoginCode>(
      c.env.DB,
      `SELECT * FROM login_codes
       WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')`,
      [email, code]
    );

    if (!loginCode) {
      return c.json({ error: 'Invalid or expired code' }, 400);
    }

    // Mark code as used
    await query(c.env.DB, 'UPDATE login_codes SET used = 1 WHERE id = ?', [loginCode.id]);

    // Get or create user
    let user = await queryOne<User>(c.env.DB, 'SELECT * FROM users WHERE email = ?', [email]);
    const expectedRole = determineUserRole(email, c.env);

    if (!user) {
      const id = crypto.randomUUID();
      await query(
        c.env.DB,
        'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        [id, email, name, expectedRole]
      );
      user = await queryOne<User>(c.env.DB, 'SELECT * FROM users WHERE id = ?', [id]);
      console.log(`Created new user: ${email} with role: ${expectedRole}`);
    } else {
      if (user.role !== expectedRole && expectedRole === 'office_assistant') {
        await query(c.env.DB, 'UPDATE users SET role = ? WHERE id = ?', [expectedRole, user.id]);
        user.role = expectedRole;
        console.log(`Upgraded user ${email} to role: ${expectedRole}`);
      }
      if (name && name !== user.name) {
        await query(c.env.DB, 'UPDATE users SET name = ? WHERE id = ?', [name, user.id]);
        user.name = name;
      }
    }

    const payload: JWTPayload = {
      userId: user!.id,
      email: user!.email,
      name: user!.name,
      role: user!.role,
      tokenVersion: user!.token_version,
    };

    const token = await generateToken(payload, c.env.JWT_SECRET);

    return c.json({
      token,
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
      },
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return c.json({ error: 'Failed to verify code' }, 500);
  }
});

// PUT /auth/profile
auth.put('/profile', authenticateToken, async (c) => {
  try {
    const body = await c.req.json();
    const trimmedName = body.name?.trim() || null;

    await query(c.env.DB, 'UPDATE users SET name = ? WHERE id = ?', [trimmedName, c.get('user').userId]);
    const user = await queryOne<User>(c.env.DB, 'SELECT * FROM users WHERE id = ?', [c.get('user').userId]);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.token_version,
    };

    const token = await generateToken(payload, c.env.JWT_SECRET);

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

export default auth;
