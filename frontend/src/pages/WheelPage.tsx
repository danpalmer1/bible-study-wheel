import { useEffect, useMemo, useState } from 'react';
import { api, Attendee, Spin } from '../api/client';
import AttendeeSelector from '../components/AttendeeSelector';
import Wheel from '../components/Wheel';

export default function WheelPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSpin, setLastSpin] = useState<Spin | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(0);
  const [result, setResult] = useState<Attendee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<Attendee[]>('/attendees'),
      api.get<Spin | null>('/spins/latest'),
    ])
      .then(([attendeeList, latest]) => {
        if (cancelled) return;
        const active = attendeeList.filter((a) => a.active);
        setAttendees(active);
        setLastSpin(latest);
        const initial = new Set(
          active
            .filter((a) => !latest || a.attendeeId !== latest.selectedAttendeeId)
            .map((a) => a.attendeeId)
        );
        setSelectedIds(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const eligibleAttendees = useMemo(
    () => attendees.filter((a) => selectedIds.has(a.attendeeId)),
    [attendees, selectedIds]
  );

  const lastSpunDisabled = useMemo(
    () => (lastSpin && eligibleAttendees.length > 2 ? [lastSpin.selectedAttendeeId] : []),
    [lastSpin, eligibleAttendees.length]
  );

  const spin = async () => {
    if (eligibleAttendees.length === 0) return;
    setError(null);
    setResult(null);
    setSubmitting(true);
    const idx = Math.floor(Math.random() * eligibleAttendees.length);
    try {
      const winner = eligibleAttendees[idx];
      const spinResp = await api.post<Spin>('/spins', {
        selectedAttendeeId: winner.attendeeId,
        eligibleAttendeeIds: eligibleAttendees.map((a) => a.attendeeId),
      });
      setLastSpin(spinResp);
      setWinnerIndex(idx);
      setSpinning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spin failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onStopSpinning = () => {
    setSpinning(false);
    setResult(eligibleAttendees[winnerIndex] ?? null);
  };

  if (loading) return <p className="text-woodland-muted">Loading…</p>;

  const lastSpinName =
    lastSpin && attendees.find((a) => a.attendeeId === lastSpin.selectedAttendeeId)?.name;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3">Who&apos;s in?</h2>
        {lastSpunDisabled.length > 0 && lastSpinName && (
          <p className="text-xs text-woodland-muted mb-3">
            <strong className="text-woodland-ink">{lastSpinName}</strong> was selected last and is
            auto-excluded. Re-enable manually if needed.
          </p>
        )}
        <AttendeeSelector
          attendees={attendees}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabledIds={lastSpunDisabled}
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
          disabled={submitting || spinning || eligibleAttendees.length === 0}
          className="btn-primary mt-5 px-6"
        >
          {submitting ? 'Recording…' : spinning ? 'Spinning…' : 'Official spin'}
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
