const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { doc, ok } = require('../shared/helpers');

const MEETINGS_TABLE = process.env.MEETINGS_TABLE;

const chapterCache = new Map();
const CHAPTER_TTL_MS = 24 * 60 * 60 * 1000;

function currentThursday(now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const daysSinceThursday = (today.getUTCDay() + 7 - 4) % 7;
  today.setUTCDate(today.getUTCDate() - daysSinceThursday);
  return today;
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
    const thursday = currentThursday();
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
