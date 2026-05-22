import { Router } from 'express';
import { load } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/', requireAuth, (_req, res) => {
  const db = load();
  const lastSpin =
    db.spins.length === 0
      ? null
      : [...db.spins].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  const attendees = db.attendees.map((a) => {
    const meetingsAttended = db.meetings.filter((m) => m.attendeeIds.includes(a.attendeeId)).length;
    const timesEligible = db.spins.filter((s) => s.eligibleAttendeeIds.includes(a.attendeeId)).length;
    const timesSelected = db.spins.filter((s) => s.selectedAttendeeId === a.attendeeId).length;
    return {
      attendeeId: a.attendeeId,
      name: a.name,
      active: a.active,
      meetingsAttended,
      timesEligible,
      timesSelected,
      isLastSelected: lastSpin?.selectedAttendeeId === a.attendeeId,
    };
  });

  res.json({ attendees, lastSpin });
});

export default router;
