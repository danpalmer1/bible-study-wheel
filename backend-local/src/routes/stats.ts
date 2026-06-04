import { Router } from 'express';
import { load } from '../db.js';

const router = Router();

// Public — anonymous visitors can see the stats table alongside the wheel.
router.get('/', (_req, res) => {
  const db = load();

  const meetingsWithPick = db.meetings.filter((m) => m.selectedAttendeeId);
  const lastPick =
    meetingsWithPick.length === 0
      ? null
      : [...meetingsWithPick].sort((a, b) => b.date.localeCompare(a.date))[0];

  // 1-meeting cooldown: whoever was picked at a meeting sits out the *next*
  // meeting's wheel. Map each meeting to the previous meeting's pick so we can
  // tell, per meeting, who was present-but-not-eligible.
  const chronological = [...db.meetings].sort((a, b) => a.date.localeCompare(b.date));
  const prevPickByMeetingId = new Map<string, string | null>();
  chronological.forEach((m, i) => {
    prevPickByMeetingId.set(m.meetingId, i > 0 ? chronological[i - 1].selectedAttendeeId ?? null : null);
  });

  const attendees = db.attendees.map((a) => {
    const attended = db.meetings.filter((m) => m.attendeeIds.includes(a.attendeeId));
    const meetingsAttended = attended.length;
    // On the wheel that meeting unless they were the previous meeting's pick.
    const timesEligible = attended.filter(
      (m) => prevPickByMeetingId.get(m.meetingId) !== a.attendeeId
    ).length;
    const timesSelected = meetingsWithPick.filter((m) => m.selectedAttendeeId === a.attendeeId).length;
    return {
      attendeeId: a.attendeeId,
      name: a.name,
      active: a.active,
      meetingsAttended,
      timesEligible,
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
