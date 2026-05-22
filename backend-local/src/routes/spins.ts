import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { load, save } from '../db.js';
import { requireAuth, AuthedRequest } from '../auth.js';

const router = Router();

router.get('/latest', requireAuth, (_req, res) => {
  const db = load();
  if (db.spins.length === 0) return res.json(null);
  const latest = [...db.spins].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  )[0];
  res.json(latest);
});

router.post('/', requireAuth, (req: AuthedRequest, res) => {
  const { selectedAttendeeId, eligibleAttendeeIds } = req.body ?? {};
  if (!selectedAttendeeId || !Array.isArray(eligibleAttendeeIds) || eligibleAttendeeIds.length === 0) {
    return res.status(400).json({ error: 'selectedAttendeeId and eligibleAttendeeIds required' });
  }
  if (!eligibleAttendeeIds.includes(selectedAttendeeId)) {
    return res.status(400).json({ error: 'Selected attendee must be in eligible list' });
  }
  const db = load();
  const all = new Set(db.attendees.map((a) => a.attendeeId));
  if (!all.has(selectedAttendeeId) || !eligibleAttendeeIds.every((id: string) => all.has(id))) {
    return res.status(400).json({ error: 'Unknown attendee id' });
  }
  const spin = {
    spinId: uuid(),
    timestamp: new Date().toISOString(),
    selectedAttendeeId,
    eligibleAttendeeIds,
    triggeredBy: req.auth!.userId,
  };
  db.spins.push(spin);
  save();
  res.status(201).json(spin);
});

export default router;
