import { useEffect, useState } from 'react';
import { api, ServerVerse } from '../api/client';

type Verse = {
  text: string;
  reference: string;
  attribution: string;
  source: 'reading' | 'fallback';
};

export default function VerseBanner() {
  const [verse, setVerse] = useState<Verse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fallback = () => {
      fetch('https://beta.ourmanna.com/api/v1/get?format=json&order=daily')
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const d = data?.verse?.details;
          if (!d) return;
          setVerse({
            text: d.text,
            reference: d.reference,
            attribution: d.version ?? '',
            source: 'fallback',
          });
        })
        .catch(() => {});
    };

    api
      .get<ServerVerse | null>('/verse')
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          fallback();
          return;
        }
        setVerse({
          text: data.text,
          reference: data.reference,
          attribution: data.translation,
          source: 'reading',
        });
      })
      .catch(() => {
        if (!cancelled) fallback();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!verse) {
    return (
      <div className="bg-woodland-surface-2 border-b border-woodland-border">
        <div className="max-w-5xl mx-auto px-4 py-2.5 text-center text-xs text-woodland-muted">
          &nbsp;
        </div>
      </div>
    );
  }

  return (
    <div className="bg-woodland-surface-2 border-b border-woodland-border">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-baseline justify-center gap-3 flex-wrap text-center">
        <span className="font-serif italic text-woodland-ink text-sm sm:text-[15px] leading-snug">
          &ldquo;{verse.text}&rdquo;
        </span>
        <span className="text-woodland-muted text-xs whitespace-nowrap">
          — {verse.reference}
          {verse.attribution ? ` (${verse.attribution})` : ''}
        </span>
      </div>
    </div>
  );
}
