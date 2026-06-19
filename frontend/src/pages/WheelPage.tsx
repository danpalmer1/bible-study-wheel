import { useEffect, useMemo, useState } from 'react';
import { api, Attendee, Stats } from '../api/client';
import AttendeeSelector from '../components/AttendeeSelector';
import Wheel from '../components/Wheel';
import { useSpinLock } from '../spin/SpinLockContext';

// The wheel is fully public — anyone can spin and results are never persisted.
// The authoritative "who was picked" record lives in the admin meeting-log form.
// One bit of history we do honor: whoever was picked at the most recent meeting
// (stats.lastPick) starts off the wheel, so nobody prays two meetings in a row.
export default function WheelPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // The most recent meeting's pick — excluded from the wheel for one meeting.
  const [lastPickId, setLastPickId] = useState<string | null>(null);
  // Spin state is shared via context so Nav can lock navigation mid-spin.
  const { spinning, setSpinning } = useSpinLock();
  const [winnerIndex, setWinnerIndex] = useState(0);
  const [result, setResult] = useState<Attendee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get<Attendee[]>('/attendees'), api.get<Stats>('/stats')])
      .then(([attendeeList, stats]) => {
        if (cancelled) return;
        const active = attendeeList.filter((a) => a.active);
        const lastPick = stats.lastPick?.selectedAttendeeId ?? null;
        setAttendees(active);
        setLastPickId(lastPick);
        // Start with nobody selected; the user opts people in (or hits "Select all").
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Safety net: never leave the nav locked if the page unmounts mid-spin.
  useEffect(() => () => setSpinning(false), [setSpinning]);

  const eligibleAttendees = useMemo(
    () => attendees.filter((a) => selectedIds.has(a.attendeeId)),
    [attendees, selectedIds]
  );

  // Attendees the user is allowed to pick: everyone except last meeting's pick.
  // The select-all toggle operates on exactly these.
  const selectableIds = useMemo(
    () =>
      attendees
        .filter((a) => a.attendeeId !== lastPickId)
        .map((a) => a.attendeeId),
    [attendees, lastPickId]
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));

  const spin = () => {
    if (eligibleAttendees.length === 0 || spinning) return;
    setError(null);
    setResult(null);
    setWinnerIndex(Math.floor(Math.random() * eligibleAttendees.length));
    setSpinning(true);
  };

  const onStopSpinning = () => {
    // Leave the wheel exactly as it landed: the winner stays in the pool, so the
    // configuration doesn't change. Exclusion is driven only by the backend's
    // last-meeting pick.
    setResult(eligibleAttendees[winnerIndex] ?? null);
    setSpinning(false);
  };

  if (loading) return <p className="text-woodland-muted">Loading…</p>;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Who&apos;s in?</h2>
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={spinning || selectableIds.length === 0}
            className="btn-secondary px-3 py-1"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <AttendeeSelector
          attendees={attendees}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabledIds={lastPickId ? [lastPickId] : []}
          disabled={spinning}
        />
        {lastPickId && attendees.some((a) => a.attendeeId === lastPickId) && (
          <p className="mt-3 text-xs text-woodland-muted">
            {attendees.find((a) => a.attendeeId === lastPickId)?.name} was picked last
            meeting and sits this one out.
          </p>
        )}
      </section>

      <section className="card p-5 flex flex-col items-center">
        <h2 className="text-lg font-semibold mb-3 self-start">Wheel</h2>
        <div className="flex-1 flex items-center justify-center">
          <Wheel
            names={eligibleAttendees.map((a) => a.name)}
            spinning={spinning}
            winnerIndex={winnerIndex}
            onStopSpinning={onStopSpinning}
          />
        </div>
        <button
          onClick={spin}
          disabled={spinning || eligibleAttendees.length === 0}
          className="btn-primary mt-5 px-6"
        >
          {spinning ? 'Spinning…' : 'Spin'}
        </button>
        {result && !spinning && (
          <div className="mt-4 text-lg font-serif">
            <span className="text-woodland-accent">✦</span>{' '}
            <strong>{result.name}</strong> is up
          </div>
        )}
        {error && <p className="mt-2 text-sm text-woodland-danger">{error}</p>}
      </section>
    </div>
  );
}
