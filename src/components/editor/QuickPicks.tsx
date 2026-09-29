'use client';

import { useNow } from '@/lib/hooks';
import { localDateKey } from '@/lib/memorial';

// One-tap answers under a date or time field, so most families never open a calendar.

export type Pick = { label: string; value: string };

export function QuickPicks({
  picks,
  value,
  onPick,
  label,
}: {
  /** A list, or a function of today's date (worked out in the browser, so server and phone agree). */
  picks: Pick[] | ((now: Date) => Pick[]);
  value: string;
  onPick: (v: string) => void;
  label: string;
}) {
  const now = useNow();
  const list = typeof picks === 'function' ? (now ? picks(now) : []) : picks;
  if (!list.length) return null;
  return (
    <div className="quick-picks" role="group" aria-label={label}>
      {list.map((p) => (
        <button key={p.value} type="button" className={`chip${p.value === value ? ' on' : ''}`} aria-pressed={p.value === value} onClick={() => onPick(p.value)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};
const short = (d: Date) => `${d.toLocaleDateString('en-ZA', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-ZA', { month: 'short' })}`;

/** Today, yesterday and the days just before: when someone has just passed. */
export function recentDays(now = new Date()): Pick[] {
  return [0, 1, 2, 3].map((n) => {
    const d = addDays(now, -n);
    return { value: localDateKey(d), label: n === 0 ? 'Today' : n === 1 ? 'Yesterday' : short(d) };
  });
}

/**
 * Likely days for a gathering. With a date already in the journey: that day, the
 * day before (the vigil) and the day after. Otherwise the coming weekends, when
 * most South African funerals are held.
 */
export function likelyDays(journeyDates: string[], now = new Date()): Pick[] {
  const known = [...new Set(journeyDates.filter(Boolean))].sort();
  if (known.length) {
    const main = new Date(`${known[known.length - 1]}T12:00:00`);
    const days = [-1, 0, 1].map((n) => addDays(main, n));
    return days.map((d, i) => ({ value: localDateKey(d), label: `${i === 0 ? 'Day before · ' : i === 2 ? 'Day after · ' : 'Same day · '}${short(d)}` }));
  }
  const out: Pick[] = [];
  for (let n = 1; n <= 21 && out.length < 4; n++) {
    const d = addDays(now, n);
    if (d.getDay() === 6 || d.getDay() === 0) out.push({ value: localDateKey(d), label: short(d) });
  }
  return out;
}

/** Start times funerals and vigils usually use. */
export const LIKELY_TIMES: Pick[] = ['06:00', '08:00', '09:00', '10:00', '12:00', '18:00'].map((t) => ({ value: t, label: t }));
