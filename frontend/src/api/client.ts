const USE_AMPLIFY = import.meta.env.VITE_USE_AMPLIFY === 'true';
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (USE_AMPLIFY) {
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      // API Gateway Cognito User Pool authorizer expects the raw JWT, no Bearer prefix.
      return idToken ? { Authorization: idToken } : {};
    } catch {
      return {};
    }
  }
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
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
  /** Optional link to a Cognito (or local) user account. */
  userId?: string | null;
  createdAt: string;
};

export type ApprovedUser = {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
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
  lastPick: {
    meetingId: string;
    date: string;
    selectedAttendeeId: string;
  } | null;
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
