// Funeral-day run-sheet logic. Pure functions so the console, the server and the
// tests all agree on how times move when the day doesn't go to plan.

import { partOf, type ProgrammeItem, type Stop } from './memorial.ts';

const DEFAULT_MINUTES = 10;

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const m = toMinutes(hhmm);
  return m == null ? hhmm : fromMinutes(m + minutes);
}

/** Every item has a time and they run in order: safe to re-time automatically. */
export function isTimedSequence(items: ProgrammeItem[]): boolean {
  let prev = -1;
  for (const i of items) {
    const m = toMinutes(i.time);
    if (m == null || m < prev) return false;
    prev = m;
  }
  return items.length > 0;
}

/** How long each item lasts, from the gap to the next one (last item: 10 min). */
export function durations(items: ProgrammeItem[]): Map<string, number> {
  const out = new Map<string, number>();
  items.forEach((item, i) => {
    const a = toMinutes(item.time);
    const b = i + 1 < items.length ? toMinutes(items[i + 1].time) : null;
    out.set(item.id, a != null && b != null && b > a ? b - a : DEFAULT_MINUTES);
  });
  return out;
}

/** Lay items out back to back from a start time, keeping each one's length. */
export function retime(items: ProgrammeItem[], startMinutes: number, lengths: Map<string, number>): ProgrammeItem[] {
  let t = startMinutes;
  return items.map((item) => {
    const next = { ...item, time: fromMinutes(t) };
    t += lengths.get(item.id) ?? DEFAULT_MINUTES;
    return next;
  });
}

/**
 * Move an item (drag and drop). When the programme is fully timed, times are
 * rebuilt so the order still reads top to bottom and each item keeps its length.
 */
export function moveItem(items: ProgrammeItem[], from: number, to: number): ProgrammeItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  if (!isTimedSequence(items)) return next;
  return retime(next, toMinutes(items[0].time)!, durations(items));
}

/** Push every timed item from `fromIndex` on by `minutes` (negative = earlier). */
/** The vigil is one evening and the service another day: a delay in one never moves the other. */
const sameRun = (a: ProgrammeItem, b: ProgrammeItem) => (partOf(a) === 'vigil') === (partOf(b) === 'vigil');

export function shiftFrom(items: ProgrammeItem[], fromIndex: number, minutes: number): ProgrammeItem[] {
  const pivot = items[fromIndex];
  return items.map((item, i) => (i >= fromIndex && item.time && pivot && sameRun(item, pivot) ? { ...item, time: addMinutes(item.time, minutes) } : item));
}

/** Starting more than this early or late doesn't move the rest of the programme. */
export const MAX_SHIFT_MINUTES = 180;

/**
 * The coordinator taps "Start" on an item. It becomes the live item and its time
 * becomes now; with `shiftUpcoming`, everything after it moves by the same delay.
 */
export function startItem(items: ProgrammeItem[], key: string, now: Date, shiftUpcoming: boolean): { items: ProgrammeItem[]; delay: number } {
  const index = items.findIndex((i) => i.id === key);
  if (index < 0) return { items, delay: 0 };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const planned = toMinutes(items[index].time);
  const delay = planned == null ? 0 : nowMin - planned;
  let next = items.map((item, i) => (i === index ? { ...item, time: fromMinutes(nowMin) } : item));
  // Hours away from the plan (a test run, or a wrong clock): start it, but don't move the rest.
  if (Math.abs(delay) > MAX_SHIFT_MINUTES) return { items: next, delay: 0 };
  if (shiftUpcoming && delay !== 0) {
    const after = next.findIndex((item, i) => i > index && sameRun(item, items[index]));
    if (after >= 0) next = shiftFrom(next, after, delay);
  }
  return { items: next, delay };
}

/** Insert a new item after `afterIndex` (−1 = at the top), timed to fit if the programme is timed. */
export function insertItem(items: ProgrammeItem[], afterIndex: number, item: ProgrammeItem): ProgrammeItem[] {
  const next = [...items];
  next.splice(afterIndex + 1, 0, item);
  if (!item.time && isTimedSequence(items) && afterIndex >= 0) {
    const prev = items[afterIndex];
    const len = durations(items).get(prev.id) ?? DEFAULT_MINUTES;
    next[afterIndex + 1] = { ...item, time: addMinutes(prev.time, len) };
  }
  return next;
}

/**
 * Today's stop times still in the future, moved by `minutes`. The past is never
 * rewritten, but a stop already under way still has its departure moved (the
 * service ran late, so the procession leaves late).
 */
export function shiftTodaysStops(journey: Stop[], today: string, now: Date, minutes: number): { id: string; time: string; departTime: string }[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const future = (t: string) => (toMinutes(t) ?? -1) >= nowMin;
  return journey
    .filter((s) => s.date === today && (future(s.time) || future(s.departTime)))
    .map((s) => ({
      id: s.id,
      time: future(s.time) ? addMinutes(s.time, minutes) : s.time,
      departTime: s.departTime && future(s.departTime) ? addMinutes(s.departTime, minutes) : s.departTime,
    }));
}
