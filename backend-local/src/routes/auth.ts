import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { load, save } from '../db.js';
import { signToken, requireAuth, AuthedRequest } from '../auth.js';

const router = Router();

router.post('/signup', (req, res) => {
  const { email, password, firstName, lastName } = req.body ?? {};
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'email, password, firstName, lastName required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const name = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
  if (!name) {
    return res.status(400).json({ error: 'firstName and lastName cannot be blank' });
  }
  const db = load();
  const normalizedEmail = String(email).toLowerCase();
  if (db.users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const user = {
    userId: uuid(),
    email: normalizedEmail,
    name,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'member' as const,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  save();
  console.log(`[signup] New signup awaiting approval: ${user.name} <${user.email}>`);
  res.status(201).json({ ok: true });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const db = load();
  const user = db.users.find((u) => u.email === String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Account not yet approved by admin' });
  }
  res.json({
    token: signToken(user),
    user: { userId: user.userId, email: user.email, name: user.name, role: user.role },
  });
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const db = load();
  const user = db.users.find((u) => u.userId === req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    user: { userId: user.userId, email: user.email, name: user.name, role: user.role },
  });
});

export default router;
