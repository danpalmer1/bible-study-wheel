import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { load, User } from './db.js';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

export type JwtPayload = {
  userId: string;
  email: string;
  role: 'admin' | 'member';
};

export function signToken(user: User): string {
  return jwt.sign(
    { userId: user.userId, email: user.email, role: user.role } satisfies JwtPayload,
    SECRET,
    { expiresIn: '7d' }
  );
}

export interface AuthedRequest extends Request {
  auth?: JwtPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET) as JwtPayload;
    const db = load();
    const user = db.users.find((u) => u.userId === payload.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Account not active' });
    }
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}
