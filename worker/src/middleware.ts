import { Context, Next } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { queryOne } from './db';
import type { Env, JWTPayload } from './types';

type HonoEnv = { Bindings: Env; Variables: { user: JWTPayload } };

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function generateToken(payload: JWTPayload, secret: string): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('365d')
    .sign(getSecretKey(secret));
}

export function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

export async function authenticateToken(c: Context<HonoEnv>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return c.json({ error: 'Access token required' }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey(c.env.JWT_SECRET));
    const jwtPayload = payload as unknown as JWTPayload;

    // Verify token version
    const user = await queryOne<{ token_version: number }>(
      c.env.DB,
      'SELECT token_version FROM users WHERE id = ?',
      [jwtPayload.userId]
    );

    if (!user || user.token_version !== jwtPayload.tokenVersion) {
      return c.json({ error: 'Token has been revoked' }, 401);
    }

    c.set('user', jwtPayload);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 403);
  }
}

export function requireRole(...roles: string[]) {
  return async (c: Context<HonoEnv>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    await next();
  };
}

export function requireSelfOrRole(role: string) {
  return async (c: Context<HonoEnv>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    const requestedUserId = c.req.param('user_id');
    if (user.userId !== requestedUserId && user.role !== role) {
      return c.json({ error: 'Access denied' }, 403);
    }
    await next();
  };
}
