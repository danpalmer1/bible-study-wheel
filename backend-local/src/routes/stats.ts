import { Router } from 'express';
import { load } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/', requireAuth, (_req, res) => {
  const db = load();

  const meetingsWithPick = db.meetings.filter((m) => m.selectedAttendeeId);
  const lastPick =
    meetingsWithPick.length === 0
      ? null
      : [...meetingsWithPick].sort((a, b) => b.date.localeCompare(a.date))[0];

  const attendees = db.attendees.map((a) => {
    const meetingsAttended = db.meetings.filter((m) => m.attendeeIds.includes(a.attendeeId)).length;
    const timesSelected = meetingsWithPick.filter((m) => m.selectedAttendeeId === a.attendeeId).length;
    return {
      attendeeId: a.attendeeId,
      name: a.name,
      active: a.active,
      meetingsAttended,
      // Pick rate denominator: every attendee at a meeting is on the wheel,
      // so eligibility collapses to attendance in the new (stateless-wheel) model.
      timesEligible: meetingsAttended,
      timesSelected,
      isLastSelected: lastPick?.selectedAttendeeId === a.attendeeId,
    };
  });

  res.json({
    attendees,
    lastPick: lastPick
      ? {
          meetingId: lastPick.meetingId,
          date: lastPick.date,
          selectedAttendeeId: lastPick.selectedAttendeeId!,
        }
      : null,
  });
});

export default router;
