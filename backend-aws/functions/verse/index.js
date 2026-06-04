const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { doc, ok } = require('../shared/helpers');

const MEETINGS_TABLE = process.env.MEETINGS_TABLE;

const chapterCache = new Map();
const CHAPTER_TTL_MS = 24 * 60 * 60 * 1000;

// Returns the next upcoming Thursday (today if today is Thursday, otherwise the
// next one) anchored to the GROUP's timezone — not the Lambda's UTC clock — so
// the reading rolls over at the group's midnight instead of up to a day early.
// Override with the GROUP_TZ env var if the group isn't in US Central.
const GROUP_TZ = process.env.GROUP_TZ || 'America/Chicago';

function nextThursday(now = new Date()) {
  // en-CA formats as YYYY-MM-DD — the calendar date in the group's timezone.
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: GROUP_TZ }).format(now);
  // Pin to noon UTC so the weekday is unambiguous and DST can't shift it.
  // findUpcomingReading steps in whole days and compares YYYY-MM-DD, so the
  // calendar date is all that matters from here.
  const d = new Date(`${localDate}T12:00:00Z`);
  const daysUntilThursday = (4 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + daysUntilThursday);
  return d;
}

function bookApiPath(book) {
  return String(book).replace(/-/g, '+');
}

async function fetchChapter(book, chapter) {
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

function findUpcomingReading(meetings, from) {
  for (let i = 0; i < 5; i++) {
    const target = new Date(from);
    target.setUTCDate(target.getUTCDate() + i * 7);
    const dateStr = target.toISOString().slice(0, 10);
    const m = meetings.find((meeting) => meeting.date === dateStr);
    if (m && m.topicType === 'reading' && m.book && typeof m.chapter === 'number') {
      return m;
    }
  }
  return null;
}

exports.handler = async () => {
  try {
    const out = await doc.send(new ScanCommand({ TableName: MEETINGS_TABLE }));
    const meetings = out.Items ?? [];
    const thursday = nextThursday();
    const meeting = findUpcomingReading(meetings, thursday);
    if (!meeting) return ok(null);
    const chapter = await fetchChapter(meeting.book, meeting.chapter);
    if (!chapter) return ok(null);
    const verses = chapter.verses;
    const pick = verses[Math.floor(Math.random() * verses.length)];
    return ok({
      text: String(pick.text).replace(/\s+/g, ' ').trim(),
      reference: `${pick.book_name} ${pick.chapter}:${pick.verse}`,
      translation: chapter.translation_name || 'World English Bible',
      weekOf: meeting.date,
    });
  } catch (e) {
    console.error('verse error', e);
    return ok(null);
  }
};
