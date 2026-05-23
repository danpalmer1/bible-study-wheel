import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { load, save } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();

// Public — the unauthenticated wheel page reads the roster.
router.get('/', (_req, res) => {
  const db = load();
  res.json(db.attendees);
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  const db = load();
  const attendee = {
    attendeeId: uuid(),
    name: name.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.attendees.push(attendee);
  save();
  res.status(201).json(attendee);
});

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const attendee = db.attendees.find((a) => a.attendeeId === req.params.id);
  if (!attendee) return res.status(404).json({ error: 'Not found' });
  const { name, active, userId } = req.body ?? {};
  if (typeof name === 'string' && name.trim()) attendee.name = name.trim();
  if (typeof active === 'boolean') attendee.active = active;
  if (userId !== undefined) {
    if (userId === null) {
      attendee.userId = null;
    } else if (typeof userId === 'string') {
      const user = db.users.find((u) => u.userId === userId);
      if (!user) return res.status(400).json({ error: 'Unknown userId' });
      attendee.userId = userId;
    }
  }
  save();
  res.json(attendee);
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const attendee = db.attendees.find((a) => a.attendeeId === req.params.id);
  if (!attendee) return res.status(404).json({ error: 'Not found' });
  attendee.active = false;
  save();
  res.json(attendee);
});

export default router;
