import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '..', 'db.json');

export type User = {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active';
  createdAt: string;
};

export type Attendee = {
  attendeeId: string;
  name: string;
  active: boolean;
  /** Optional link to a User. */
  userId?: string | null;
  createdAt: string;
};

export type Spin = {
  spinId: string;
  timestamp: string;
  selectedAttendeeId: string;
  eligibleAttendeeIds: string[];
  triggeredBy: string;
};

export type MeetingTopicType = 'fourTs' | 'reading' | 'presentation';

export type Meeting = {
  meetingId: string;
  date: string;
  attendeeIds: string[];
  /** Attendee picked by the wheel for this meeting (admin-recorded). */
  selectedAttendeeId?: string | null;
  topicType?: MeetingTopicType | null;
  book?: string | null;
  chapter?: number | null;
  topicText?: string | null;
  createdBy: string;
  createdAt: string;
};

export type DB = {
  users: User[];
  attendees: Attendee[];
  spins: Spin[];
  meetings: Meeting[];
};

let cache: DB | null = null;

export function load(): DB {
  if (cache) return cache;
  if (!existsSync(DB_PATH)) {
    cache = { users: [], attendees: [], spins: [], meetings: [] };
    save();
    return cache;
  }
  cache = JSON.parse(readFileSync(DB_PATH, 'utf-8')) as DB;
  return cache;
}

export function save() {
  if (!cache) return;
  writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

export function isEmpty(): boolean {
  const db = load();
  return db.users.length === 0 && db.attendees.length === 0;
}
