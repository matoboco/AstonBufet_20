import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { generateOTP, generateToken, authenticateToken } from '../middleware';
import { sendOTPEmail } from '../email';
import { requestCodeSchema, verifyCodeSchema } from '../validation';
import { User, LoginCode, JWTPayload, AuthenticatedRequest } from '../types';

const router = Router();

/**
 * Check if email should have office_assistant role based on OFFICE_ASSISTANT_EMAILS env variable
 * Supports suffix matching: if "assistant@aston.sk" is defined, then "mbocko+assistant@aston.sk" also matches
 */
const getOfficeAssistantSuffixes = (): string[] => {
  const emailsEnv = process.env.OFFICE_ASSISTANT_EMAILS || '';
  return emailsEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
};

const isOfficeAssistantEmail = (email: string): boolean => {
  const suffixes = getOfficeAssistantSuffixes();
  const normalizedEmail = email.toLowerCase();
  return suffixes.some((suffix) => normalizedEmail.endsWith(suffix));
};

const determineUserRole = (email: string): 'user' | 'office_assistant' => {
  return isOfficeAssistantEmail(email) ? 'office_assistant' : 'user';
};

// POST /auth/request-code
router.post('/request-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = requestCodeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    // Normalize email to lowercase
    const email = validation.data.email.trim().toLowerCase();

    // Validate @aston.sk emails - must use short format without dots
    if (email.endsWith('@aston.sk')) {
      const localPart = email.split('@')[0];
      if (localPart.includes('.')) {
        res.status(400).json({
          error: 'Prosím, použi krátku emailovú adresu v tvare mpriezvisko@aston.sk (bez bodky)'
        });
        return;
      }
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate existing codes
    await query('UPDATE login_codes SET used = true WHERE email = $1 AND used = false', [email]);

    // Create new code
    await query(
      'INSERT INTO login_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, code, expiresAt]
    );

    // Send email
    await sendOTPEmail(email, code);

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Request code error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /auth/verify-code
router.post('/verify-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = verifyCodeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    // Normalize email to lowercase
    const email = validation.data.email.trim().toLowerCase();
    const code = validation.data.code;
    const name = validation.data.name?.trim() || null;

    // Find valid code
    const loginCode = await queryOne<LoginCode>(
      `SELECT * FROM login_codes
       WHERE email = $1 AND code = $2 AND used = false AND expires_at > NOW()`,
      [email, code]
    );

    if (!loginCode) {
      res.status(400).json({ error: 'Invalid or expired code' });
      return;
    }

    // Mark code as used
    await query('UPDATE login_codes SET used = true WHERE id = $1', [loginCode.id]);

    // Get or create user
    let user = await queryOne<User>('SELECT * FROM users WHERE email = $1', [email]);
    const expectedRole = determineUserRole(email);

    if (!user) {
      // Create new user with appropriate role
      const result = await query<User>(
        'INSERT INTO users (email, name, role) VALUES ($1, $2, $3) RETURNING *',
        [email, name, expectedRole]
      );
      user = result[0];
      console.log(`Created new user: ${email} with role: ${expectedRole}`);
    } else {
      // Update existing user
      if (user.role !== expectedRole && expectedRole === 'office_assistant') {
        // Upgrade to office_assistant if they're in the list
        await query('UPDATE users SET role = $1 WHERE id = $2', [expectedRole, user.id]);
        user.role = expectedRole;
        console.log(`Upgraded user ${email} to role: ${expectedRole}`);
      }
      // Update name if provided
      if (name && name !== user.name) {
        await query('UPDATE users SET name = $1 WHERE id = $2', [name, user.id]);
        user.name = name;
      }
    }

    // Generate JWT
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.token_version,
    };

    const token = generateToken(payload);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// PUT /auth/profile - Update user profile (name)
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const trimmedName = name?.trim() || null;

    const user = await queryOne<User>(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [trimmedName, req.user!.userId]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate new JWT with updated name
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.token_version,
    };

    const token = generateToken(payload);

    res.json({
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
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
