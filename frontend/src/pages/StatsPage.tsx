import { useEffect, useState } from 'react';
import { api, Stats } from '../api/client';

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Stats>('/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-woodland-danger">{error}</p>;
  if (!stats) return <p className="text-woodland-muted">Loading…</p>;

  const rows = [...stats.attendees].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-woodland-border flex items-center justify-between">
        <h1 className="text-xl font-semibold">Statistics</h1>
        {stats.lastPick && (
          <span className="text-xs text-woodland-muted">
            Last pick: {stats.lastPick.date}
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-woodland-bg text-woodland-muted">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Name</th>
            <th className="text-right px-4 py-2.5 font-medium">Meetings</th>
            <th
              className="text-right px-4 py-2.5 font-medium"
              title="Meetings this person was on the wheel — attended, minus the meeting right after they were picked"
            >
              On wheel
            </th>
            <th className="text-right px-4 py-2.5 font-medium">Picked</th>
            <th className="text-right px-4 py-2.5 font-medium" title="Picked ÷ On wheel">
              Pick rate
            </th>
            <th className="text-center px-4 py-2.5 font-medium">Last picked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rate =
              row.timesEligible > 0 ? (row.timesSelected / row.timesEligible) * 100 : null;
            return (
              <tr
                key={row.attendeeId}
                className={`border-t border-woodland-border ${
                  row.active ? '' : 'text-woodland-subtle italic'
                }`}
              >
                <td className="px-4 py-2.5">
                  {row.name}
                  {!row.active && <span className="ml-2 text-xs">(inactive)</span>}
                </td>
                <td className="px-4 py-2.5 text-right">{row.meetingsAttended}</td>
                <td className="px-4 py-2.5 text-right">{row.timesEligible}</td>
                <td className="px-4 py-2.5 text-right">{row.timesSelected}</td>
                <td className="px-4 py-2.5 text-right text-woodland-muted">
                  {rate === null ? '—' : `${rate.toFixed(0)}%`}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {row.isLastSelected ? (
                    <span className="text-woodland-accent">●</span>
                  ) : (
                    <span className="text-woodland-subtle">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-5 py-3 text-xs text-woodland-muted border-t border-woodland-border bg-woodland-bg">
        <strong>On wheel</strong> = meetings this person was eligible for — i.e. attended, not
        counting the meeting right after they were picked (whoever prays sits out the next
        wheel). <strong>Pick rate</strong> = picked ÷ on wheel. The authoritative pick is
        whoever the admin recorded for that meeting.
      </p>
    </div>
  );
}
