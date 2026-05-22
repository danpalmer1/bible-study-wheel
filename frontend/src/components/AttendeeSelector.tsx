import { Attendee } from '../api/client';

export default function AttendeeSelector({
  attendees,
  selectedIds,
  onChange,
  disabledIds = [],
}: {
  attendees: Attendee[];
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
  disabledIds?: string[];
}) {
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {attendees.map((a) => {
        const disabled = disabledIds.includes(a.attendeeId);
        const checked = selectedIds.has(a.attendeeId);
        return (
          <label
            key={a.attendeeId}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors cursor-pointer ${
              checked
                ? 'bg-woodland-primary/10 border-woodland-primary text-woodland-ink'
                : 'bg-woodland-bg border-woodland-border text-woodland-ink'
            } ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-woodland-surface-2'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(a.attendeeId)}
              className="accent-woodland-primary"
            />
            <span>{a.name}</span>
          </label>
        );
      })}
    </div>
  );
}
