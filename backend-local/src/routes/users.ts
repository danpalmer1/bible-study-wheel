import { Router } from 'express';
import { load, save } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();

router.get('/pending', requireAuth, requireAdmin, (_req, res) => {
  const db = load();
  res.json(
    db.users
      .filter((u) => u.status === 'pending')
      .map((u) => ({
        userId: u.userId,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
      }))
  );
});

// All approved (active) users — used by Admin → Attendees to link a user
// to a roster entry and to gate the "Promote to admin" control.
router.get('/', requireAuth, requireAdmin, (_req, res) => {
  const db = load();
  res.json(
    db.users
      .filter((u) => u.status === 'active')
      .map((u) => ({
        userId: u.userId,
        email: u.email,
        name: u.name,
        role: u.role,
      }))
  );
});

router.post('/:id/promote', requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.userId === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.status !== 'active') {
    return res.status(400).json({ error: 'Can only promote active users' });
  }
  user.role = 'admin';
  save();
  res.json({ ok: true });
});

router.post('/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.userId === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.status = 'active';
  save();
  res.json({ ok: true });
});

router.post('/:id/reject', requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const idx = db.users.findIndex((u) => u.userId === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (db.users[idx].status !== 'pending') {
    return res.status(400).json({ error: 'Can only reject pending users' });
  }
  db.users.splice(idx, 1);
  save();
  res.json({ ok: true });
});

export default router;
