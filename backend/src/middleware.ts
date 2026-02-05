import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JWTPayload } from './types';
import { queryOne } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Verify token version
    const user = await queryOne<{ token_version: number }>(
      'SELECT token_version FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!user || user.token_version !== payload.tokenVersion) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireSelfOrRole = (role: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const requestedUserId = req.params.user_id;

    if (req.user.userId !== requestedUserId && req.user.role !== role) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  };
};

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
