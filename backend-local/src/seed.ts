import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { load, save } from './db.js';

const ROSTER = [
  'Cole Carlson',
  'Dane Haubenschild',
  'Ethan Laskowski',
  'Ethan Linder',
  'Hunter Lestrud',
  'Henry Lupkes',
  'Garrett Myer',
  'Josh Marshall',
  'Tony McNiff',
  'Max Nelson',
  'Dan Palmer',
  'Hayden Richards',
  'Jade Rofles',
  'Joe Schoen',
  'Shane Thompson',
  'CJ Zins',
  'Charlie Zwick',
];

const PRESENT_MAY_14 = new Set([
  'Cole Carlson',
  'Ethan Laskowski',
  'Ethan Linder',
  'Josh Marshall',
  'Dan Palmer',
  'Hayden Richards',
  'Jade Rofles',
  'Joe Schoen',
]);

const SELECTED_MAY_14 = 'Josh Marshall';

function thursdayOf(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysSinceThursday = (d.getDay() + 7 - 4) % 7;
  d.setDate(d.getDate() - daysSinceThursday);
  return d.toISOString().slice(0, 10);
}

export function seedIfEmpty() {
  const db = load();
  if (db.users.length > 0 || db.attendees.length > 0) return false;

  const now = new Date().toISOString();
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@biblestudy.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin1234';
  const adminName = process.env.ADMIN_NAME ?? 'Admin';

  db.users.push({
    userId: uuid(),
    email: adminEmail.toLowerCase(),
    name: adminName,
    passwordHash: bcrypt.hashSync(adminPassword, 10),
    role: 'admin',
    status: 'active',
    createdAt: now,
  });

  const byName = new Map<string, string>();
  for (const name of ROSTER) {
    const id = uuid();
    byName.set(name, id);
    db.attendees.push({
      attendeeId: id,
      name,
      active: true,
      createdAt: now,
    });
  }

  const may14 = '2026-05-14';
  const presentIds = [...PRESENT_MAY_14].map((name) => byName.get(name)!).filter(Boolean);
  db.meetings.push({
    meetingId: uuid(),
    date: may14,
    attendeeIds: presentIds,
    selectedAttendeeId: byName.get(SELECTED_MAY_14)!,
    topicType: null,
    book: null,
    chapter: null,
    topicText: null,
    createdBy: 'seed',
    createdAt: `${may14}T19:00:00.000Z`,
  });

  const thisThursday = thursdayOf(new Date());
  if (thisThursday !== may14) {
    db.meetings.push({
      meetingId: uuid(),
      date: thisThursday,
      attendeeIds: [],
      topicType: 'reading',
      book: 'john',
      chapter: 1,
      topicText: null,
      createdBy: 'seed',
      createdAt: now,
    });
  }

  save();
  return true;
}
