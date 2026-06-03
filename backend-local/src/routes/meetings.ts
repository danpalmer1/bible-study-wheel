import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { load, save, MeetingTopicType } from '../db.js';
import { requireAuth, requireAdmin, AuthedRequest } from '../auth.js';

const router = Router();

const VALID_TYPES: MeetingTopicType[] = ['fourTs', 'reading', 'presentation'];

router.get('/', requireAuth, requireAdmin, (_req, res) => {
  const db = load();
  const sorted = [...db.meetings].sort((a, b) => b.date.localeCompare(a.date));
  res.json(sorted);
});

router.post('/', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const { date, attendeeIds, selectedAttendeeId, topicType, book, chapter, topicText } =
    req.body ?? {};
  if (!date) return res.status(400).json({ error: 'date required' });

  const db = load();
  const all = new Set(db.attendees.map((a) => a.attendeeId));

  if (attendeeIds !== undefined) {
    if (!Array.isArray(attendeeIds) || !attendeeIds.every((id: string) => all.has(id))) {
      return res.status(400).json({ error: 'Unknown attendee id' });
    }
  }
  if (
    selectedAttendeeId !== undefined &&
    selectedAttendeeId !== null &&
    !all.has(selectedAttendeeId)
  ) {
    return res.status(400).json({ error: 'Unknown selectedAttendeeId' });
  }
  if (topicType !== undefined && topicType !== null && !VALID_TYPES.includes(topicType)) {
    return res.status(400).json({ error: 'Invalid topicType' });
  }

  let meeting = db.meetings.find((m) => m.date === date);
  if (!meeting) {
    meeting = {
      meetingId: uuid(),
      date: String(date),
      attendeeIds: [],
      createdBy: req.auth!.userId,
      createdAt: new Date().toISOString(),
    };
    db.meetings.push(meeting);
  }

  if (attendeeIds !== undefined) {
    meeting.attendeeIds = attendeeIds;
  }
  if (selectedAttendeeId !== undefined) {
    meeting.selectedAttendeeId = selectedAttendeeId || null;
  }

  if (topicType !== undefined) {
    meeting.topicType = topicType || null;
    meeting.book = null;
    meeting.chapter = null;
    meeting.topicText = null;
    if (topicType === 'reading') {
      if (typeof book !== 'string' || !book) {
        return res.status(400).json({ error: 'reading requires book' });
      }
      if (typeof chapter !== 'number' || chapter < 1) {
        return res.status(400).json({ error: 'reading requires chapter (number)' });
      }
      meeting.book = book;
      meeting.chapter = chapter;
    } else if (topicType === 'presentation') {
      meeting.topicText = typeof topicText === 'string' ? topicText : '';
    }
  }

  save();
  res.status(201).json(meeting);
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const db = load();
  const idx = db.meetings.findIndex((m) => m.meetingId === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.meetings.splice(idx, 1);
  save();
  res.json({ ok: true });
});

export default router;
