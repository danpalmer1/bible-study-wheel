import { Router } from 'express';
import { load, Meeting } from '../db.js';

const router = Router();

type ChapterCache = { data: any; expires: number };
const chapterCache = new Map<string, ChapterCache>();
const CHAPTER_TTL_MS = 24 * 60 * 60 * 1000;

// Returns the next upcoming Thursday (today if today is Thursday, otherwise
// the next one). Mirrors backend-aws/functions/verse so the verse banner
// behaves the same in local dev.
function nextThursday(now = new Date()): Date {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysUntilThursday = (4 - today.getDay() + 7) % 7;
  today.setDate(today.getDate() + daysUntilThursday);
  return today;
}

function bookApiPath(book: string): string {
  return book.replace(/-/g, '+');
}

async function fetchChapter(book: string, chapter: number) {
  const key = `${book}:${chapter}`;
  const cached = chapterCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const url = `https://bible-api.com/${bookApiPath(book)}+${chapter}?translation=web`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  if (!Array.isArray(data?.verses) || data.verses.length === 0) return null;
  chapterCache.set(key, { data, expires: Date.now() + CHAPTER_TTL_MS });
  return data;
}

function findUpcomingReading(meetings: Meeting[], from: Date): Meeting | null {
  for (let i = 0; i < 5; i++) {
    const target = new Date(from);
    target.setDate(target.getDate() + i * 7);
    const dateStr = target.toISOString().slice(0, 10);
    const m = meetings.find((meeting) => meeting.date === dateStr);
    if (m && m.topicType === 'reading' && m.book && typeof m.chapter === 'number') {
      return m;
    }
  }
  return null;
}

router.get('/', async (_req, res) => {
  try {
    const db = load();
    const thursday = nextThursday();
    const meeting = findUpcomingReading(db.meetings, thursday);
    if (!meeting || !meeting.book || !meeting.chapter) return res.json(null);

    const chapter = await fetchChapter(meeting.book, meeting.chapter);
    if (!chapter) return res.json(null);

    const verses = chapter.verses;
    const pick = verses[Math.floor(Math.random() * verses.length)];
    res.json({
      text: String(pick.text).replace(/\s+/g, ' ').trim(),
      reference: `${pick.book_name} ${pick.chapter}:${pick.verse}`,
      translation: chapter.translation_name ?? 'World English Bible',
      weekOf: meeting.date,
    });
  } catch (err) {
    console.error('verse error', err);
    res.json(null);
  }
});

export default router;
