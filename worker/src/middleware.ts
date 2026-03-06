import { Context, Next } from 'hono';
import { jwtVerify, SignJWT } from 'jose';
import { queryOne } from './db';
import type { Env, JWTPayload } from './types';

// Extend Hono context with user info
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

function getSecret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET || 'default-secret-change-me');
}

export async function authenticateToken(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return c.json({ error: 'Access token required' }, 401);
  }

  try {
    const secret = getSecret(c.env);
    const { payload } = await jwtVerify(token, secret);
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
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
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
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
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

export async function generateToken(payload: JWTPayload, env: Env): Promise<string> {
  const secret = getSecret(env);
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('365d')
    .sign(secret);
}

export function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}
