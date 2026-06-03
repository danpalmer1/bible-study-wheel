import { useEffect, useMemo, useState } from 'react';
import { api, Attendee } from '../api/client';
import AttendeeSelector from '../components/AttendeeSelector';
import Wheel from '../components/Wheel';
import { useSpinLock } from '../spin/SpinLockContext';

// The wheel is fully public and stateless — anyone can spin, results are
// never persisted. The authoritative "who was picked for the meeting"
// record lives in the admin meeting-log entry form, not here.
export default function WheelPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Winners are removed from the pool for the session and can't be re-added
  // until reload, so a spin never lands on the same person twice.
  const [spunIds, setSpunIds] = useState<Set<string>>(new Set());
  // Spin state is shared via context so Nav can lock navigation mid-spin.
  const { spinning, setSpinning } = useSpinLock();
  const [winnerIndex, setWinnerIndex] = useState(0);
  const [result, setResult] = useState<Attendee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Attendee[]>('/attendees')
      .then((attendeeList) => {
        if (cancelled) return;
        const active = attendeeList.filter((a) => a.active);
        setAttendees(active);
        setSelectedIds(new Set(active.map((a) => a.attendeeId)));
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

  const spin = () => {
    if (eligibleAttendees.length === 0 || spinning) return;
    setError(null);
    setResult(null);
    setWinnerIndex(Math.floor(Math.random() * eligibleAttendees.length));
    setSpinning(true);
  };

  const onStopSpinning = () => {
    const winner = eligibleAttendees[winnerIndex] ?? null;
    setSpinning(false);
    setResult(winner);
    if (winner) {
      setSpunIds((prev) => new Set(prev).add(winner.attendeeId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(winner.attendeeId);
        return next;
      });
    }
  };

  if (loading) return <p className="text-woodland-muted">Loading…</p>;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3">Who&apos;s in?</h2>
        <AttendeeSelector
          attendees={attendees}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabledIds={Array.from(spunIds)}
          disabled={spinning}
        />
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
