const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {}
    throw new Error(message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export type Attendee = {
  attendeeId: string;
  name: string;
  active: boolean;
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
  topicType?: MeetingTopicType | null;
  book?: string | null;
  chapter?: number | null;
  topicText?: string | null;
  createdBy: string;
  createdAt: string;
};

export type ServerVerse = {
  text: string;
  reference: string;
  translation: string;
  weekOf: string;
};

export type Stats = {
  attendees: Array<{
    attendeeId: string;
    name: string;
    active: boolean;
    meetingsAttended: number;
    timesEligible: number;
    timesSelected: number;
    isLastSelected: boolean;
  }>;
  lastSpin: Spin | null;
};

export type PendingUser = {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
};

export type AuthUser = {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
};
