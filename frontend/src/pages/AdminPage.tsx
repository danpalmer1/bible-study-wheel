import { useEffect, useMemo, useState } from 'react';
import { api, Attendee, Meeting, MeetingTopicType } from '../api/client';
import { OT_BOOKS, NT_BOOKS, findBook } from '../data/bibleBooks';

type Tab = 'attendees' | 'meetings';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('attendees');
  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(['attendees', 'meetings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-md text-sm capitalize transition-colors ${
              tab === t
                ? 'bg-woodland-primary text-woodland-bg'
                : 'bg-woodland-surface-2 text-woodland-ink hover:bg-woodland-border'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'attendees' && <AttendeesTab />}
      {tab === 'meetings' && <MeetingsTab />}
    </div>
  );
}

function AttendeesTab() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    api.get<Attendee[]>('/attendees').then(setAttendees).catch((e) => setError(e.message));
  };
  useEffect(refresh, []);

  const add = async () => {
    if (!newName.trim()) return;
    await api.post('/attendees', { name: newName.trim() });
    setNewName('');
    refresh();
  };
  const toggleActive = async (a: Attendee) => {
    await api.put(`/attendees/${a.attendeeId}`, { active: !a.active });
    refresh();
  };
  const rename = async (a: Attendee) => {
    const name = prompt('Rename attendee', a.name);
    if (!name || name === a.name) return;
    await api.put(`/attendees/${a.attendeeId}`, { name });
    refresh();
  };

  return (
    <div className="card">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="px-5 py-3 border-b border-woodland-border flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New attendee name"
          className="input flex-1 py-1.5"
        />
        <button type="submit" className="btn-primary py-1.5">
          Add
        </button>
      </form>
      {error && <p className="px-5 py-3 text-woodland-danger text-sm">{error}</p>}
      <ul>
        {attendees.map((a) => (
          <li
            key={a.attendeeId}
            className="px-5 py-2.5 border-t border-woodland-border flex items-center justify-between gap-3 flex-wrap"
          >
            <div className={`min-w-[180px] ${a.active ? '' : 'text-woodland-subtle italic'}`}>
              {a.name}
            </div>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <button onClick={() => rename(a)} className="text-woodland-primary hover:underline">
                Rename
              </button>
              <button
                onClick={() => toggleActive(a)}
                className="text-woodland-muted hover:underline"
              >
                {a.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TopicDraft = {
  topicType: MeetingTopicType | '';
  book: string;
  chapter: number;
  topicText: string;
};

function emptyDraft(): TopicDraft {
  return { topicType: '', book: '', chapter: 0, topicText: '' };
}

function draftFromMeeting(m: Meeting | undefined): TopicDraft {
  if (!m) return emptyDraft();
  return {
    topicType: (m.topicType ?? '') as TopicDraft['topicType'],
    book: m.book ?? '',
    chapter: m.chapter ?? 0,
    topicText: m.topicText ?? '',
  };
}

function buildTopicBody(draft: TopicDraft) {
  const body: Record<string, unknown> = {
    topicType: draft.topicType || null,
    book: null,
    chapter: null,
    topicText: null,
  };
  if (draft.topicType === 'reading') {
    body.book = draft.book || null;
    body.chapter = draft.chapter || null;
  } else if (draft.topicType === 'presentation') {
    body.topicText = draft.topicText;
  }
  return body;
}

function topicSummary(m: Meeting): string {
  if (!m.topicType) return 'No topic';
  if (m.topicType === 'fourTs') return "4 T's";
  if (m.topicType === 'reading' && m.book && m.chapter) {
    const b = findBook(m.book);
    return `Reading: ${b?.name ?? m.book} ${m.chapter}`;
  }
  if (m.topicType === 'presentation') {
    return `Presentation${m.topicText ? `: ${m.topicText}` : ''}`;
  }
  return 'No topic';
}

function TopicEditor({
  value,
  onChange,
}: {
  value: TopicDraft;
  onChange: (next: TopicDraft) => void;
}) {
  const book = value.book ? findBook(value.book) : undefined;
  return (
    <div className="space-y-2">
      <select
        value={value.topicType}
        onChange={(e) =>
          onChange({ ...value, topicType: e.target.value as TopicDraft['topicType'] })
        }
        className="input py-1.5"
      >
        <option value="">— No topic —</option>
        <option value="fourTs">4 T's</option>
        <option value="reading">Reading</option>
        <option value="presentation">Presentation</option>
      </select>
      {value.topicType === 'reading' && (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={value.book}
            onChange={(e) =>
              onChange({ ...value, book: e.target.value, chapter: e.target.value ? 1 : 0 })
            }
            className="input py-1.5"
          >
            <option value="">— Book —</option>
            <optgroup label="Old Testament">
              {OT_BOOKS.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </optgroup>
            <optgroup label="New Testament">
              {NT_BOOKS.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </optgroup>
          </select>
          <select
            value={value.chapter || ''}
            onChange={(e) => onChange({ ...value, chapter: Number(e.target.value) })}
            disabled={!book}
            className="input py-1.5"
          >
            <option value="">{book ? '— Chapter —' : 'Pick a book first'}</option>
            {book &&
              Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>{`Chapter ${c}`}</option>
              ))}
          </select>
        </div>
      )}
      {value.topicType === 'presentation' && (
        <input
          value={value.topicText}
          onChange={(e) => onChange({ ...value, topicText: e.target.value })}
          placeholder="Presentation topic"
          className="input py-1.5"
        />
      )}
    </div>
  );
}

// Next upcoming Thursday (today if today is Thursday, otherwise the next one).
// Matches the verse route's nextThursday so the planner and the verse banner
// stay in phase — and so a meeting that already happened drops out of the
// "upcoming" outlook the day after, instead of lingering until next Thursday.
function nextThursday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
  return d;
}

function formatThursday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function validateDraft(draft: TopicDraft): string | null {
  if (!draft.topicType) return null;
  if (draft.topicType === 'reading' && (!draft.book || !draft.chapter)) {
    return 'Pick a book and chapter for the reading.';
  }
  if (draft.topicType === 'presentation' && !draft.topicText.trim()) {
    return 'Enter a presentation topic.';
  }
  return null;
}

function MeetingsTab() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [recordTopic, setRecordTopic] = useState<TopicDraft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    Promise.all([api.get<Attendee[]>('/attendees'), api.get<Meeting[]>('/meetings')])
      .then(([att, meet]) => {
        setAttendees(att);
        setMeetings(meet);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(refresh, []);

  useEffect(() => {
    const existing = meetings.find((m) => m.date === date);
    setPresentIds(new Set(existing?.attendeeIds ?? []));
    setSelectedAttendeeId(existing?.selectedAttendeeId ?? null);
    setRecordTopic(draftFromMeeting(existing));
  }, [date, meetings]);

  const visibleAttendees = useMemo(
    () => attendees.filter((a) => a.active || presentIds.has(a.attendeeId)),
    [attendees, presentIds]
  );

  const togglePresent = (id: string) => {
    const next = new Set(presentIds);
    if (next.has(id)) {
      next.delete(id);
      // The wheel only picks present people, so an absent attendee can't be
      // the selection — clear it if we just unchecked them.
      if (selectedAttendeeId === id) setSelectedAttendeeId(null);
    } else {
      next.add(id);
    }
    setPresentIds(next);
  };

  const saveUpcomingMany = async (
    entries: Array<{ date: string; draft: TopicDraft }>
  ): Promise<boolean> => {
    for (const { draft } of entries) {
      const msg = validateDraft(draft);
      if (msg) {
        setError(msg);
        return false;
      }
    }
    setError(null);
    setBusy(true);
    try {
      for (const { date: d, draft } of entries) {
        await api.post('/meetings', { date: d, ...buildTopicBody(draft) });
      }
      refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const deleteMeeting = async (m: Meeting) => {
    if (!window.confirm(`Delete the ${m.date} meeting? This can't be undone.`)) return;
    setError(null);
    setBusy(true);
    try {
      await api.del(`/meetings/${m.meetingId}`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!date) return;
    const msg = validateDraft(recordTopic);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post('/meetings', {
        date,
        attendeeIds: Array.from(presentIds),
        selectedAttendeeId,
        ...buildTopicBody(recordTopic),
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <UpcomingMeetings meetings={meetings} onSaveAll={saveUpcomingMany} busy={busy} />

      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-3">Record meeting attendance</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-woodland-muted mr-2">Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input inline-block w-auto py-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-woodland-muted block mb-1">Topic:</label>
            <TopicEditor value={recordTopic} onChange={setRecordTopic} />
          </div>
          <div>
            <label className="text-sm font-medium text-woodland-muted block mb-2">Attended:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {visibleAttendees.map((a) => (
                <label
                  key={a.attendeeId}
                  className={`flex items-center gap-2 text-sm ${
                    a.active ? '' : 'text-woodland-subtle italic'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={presentIds.has(a.attendeeId)}
                    onChange={() => togglePresent(a.attendeeId)}
                    className="accent-woodland-primary"
                  />
                  {a.name}
                  {!a.active && <span className="text-xs">(inactive)</span>}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-woodland-muted block mb-1">
              Selected by wheel:
            </label>
            <select
              value={selectedAttendeeId ?? ''}
              onChange={(e) => setSelectedAttendeeId(e.target.value || null)}
              className="input py-1.5 w-auto"
            >
              <option value="">— None —</option>
              {visibleAttendees
                .filter((a) => presentIds.has(a.attendeeId))
                .map((a) => (
                  <option key={a.attendeeId} value={a.attendeeId}>{a.name}</option>
                ))}
            </select>
          </div>
          <button onClick={submit} disabled={busy} className="btn-primary">
            Save meeting
          </button>
          {error && <p className="text-sm text-woodland-danger">{error}</p>}
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-woodland-border font-semibold">
          Recent meetings
        </div>
        {meetings.length === 0 && (
          <p className="px-5 py-4 text-woodland-muted text-sm">No meetings recorded yet.</p>
        )}
        <ul>
          {meetings.map((m) => {
            const selectedName = m.selectedAttendeeId
              ? attendees.find((a) => a.attendeeId === m.selectedAttendeeId)?.name
              : null;
            return (
              <li key={m.meetingId} className="px-5 py-2.5 border-t border-woodland-border text-sm">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-medium">{m.date}</span>{' '}
                    <span className="text-woodland-muted">— {topicSummary(m)}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs text-woodland-muted">
                      {m.attendeeIds.length} present
                      {selectedName && (
                        <>
                          <span className="mx-1.5">•</span>
                          <span className="text-woodland-accent">✦</span> {selectedName}
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => deleteMeeting(m)}
                      disabled={busy}
                      className="text-xs text-woodland-danger hover:underline disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function UpcomingMeetings({
  meetings,
  onSaveAll,
  busy,
}: {
  meetings: Meeting[];
  onSaveAll: (entries: Array<{ date: string; draft: TopicDraft }>) => Promise<boolean>;
  busy: boolean;
}) {
  const thursdays = useMemo(() => {
    const start = nextThursday();
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i * 7);
      return d;
    });
  }, []);

  const [drafts, setDrafts] = useState<Record<string, TopicDraft>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, TopicDraft> = {};
      for (const thu of thursdays) {
        const key = toISODate(thu);
        // Preserve in-progress edits so saving one row doesn't wipe siblings on refresh.
        next[key] = dirty.has(key) && key in prev
          ? prev[key]
          : draftFromMeeting(meetings.find((m) => m.date === key));
      }
      return next;
    });
    // `dirty` is intentionally excluded: it's read via the current closure and including
    // it would reseed (and re-render) on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings, thursdays]);

  const updateDraft = (key: string, next: TopicDraft) => {
    setDrafts((prev) => ({ ...prev, [key]: next }));
    setDirty((prev) => {
      if (prev.has(key)) return prev;
      const s = new Set(prev);
      s.add(key);
      return s;
    });
  };

  const saveAll = async () => {
    const entries = Array.from(dirty)
      .map((key) => ({ date: key, draft: drafts[key] }))
      .filter((e) => e.draft);
    if (entries.length === 0) return;
    const ok = await onSaveAll(entries);
    if (ok) setDirty(new Set());
  };

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-woodland-border">
        <h2 className="text-lg font-semibold">Upcoming meetings</h2>
        <p className="text-xs text-woodland-muted mt-0.5">
          Topic rotates Thursday at midnight. The verse banner pulls from the current week&apos;s
          reading, or the next reading in this 4-week outlook if this week isn&apos;t one.
        </p>
      </div>
      <ul>
        {thursdays.map((thu) => {
          const dateStr = toISODate(thu);
          const draft = drafts[dateStr] ?? emptyDraft();
          const isDirty = dirty.has(dateStr);
          return (
            <li key={dateStr} className="px-5 py-4 border-t border-woodland-border">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="min-w-[150px] pt-1">
                  <div className="text-sm font-medium">Week of {formatThursday(thu)}</div>
                  <div className="text-xs text-woodland-muted">
                    {dateStr}
                    {isDirty && (
                      <span className="ml-2 text-woodland-accent">• unsaved</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-[260px]">
                  <TopicEditor
                    value={draft}
                    onChange={(next) => updateDraft(dateStr, next)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="px-5 py-4 border-t border-woodland-border flex items-center justify-end gap-3">
        <span className="text-xs text-woodland-muted">
          {dirty.size === 0
            ? 'No changes'
            : `${dirty.size} unsaved change${dirty.size === 1 ? '' : 's'}`}
        </span>
        <button
          onClick={saveAll}
          disabled={busy || dirty.size === 0}
          className="btn-primary py-1.5"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
