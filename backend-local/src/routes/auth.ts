import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { load } from '../db.js';
import { signToken, requireAuth, AuthedRequest } from '../auth.js';

const router = Router();

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
