// Live Funeral Mode. Time-aware only (never GPS): compares the guest's local
// clock against the journey stop times and, for a formal programme, the order-of-
// service times already stored on the memorial. The one public /m/<slug> page is
// therefore also the funeral-day guide, without a second URL or QR.

import { localDateKey, type Draft, type ProgrammeItem, type Stop } from './memorial.ts';

export type LivePhase =
  | { phase: 'none' }
  | { phase: 'upcoming'; daysUntil: number; date: string }
  | { phase: 'between'; date: string }
  | { phase: 'before_start'; nextStop: Stop }
  | { phase: 'at_stop'; currentStop: Stop; nextStop: Stop }
  | { phase: 'in_transit'; currentStop: Stop; nextStop: Stop }
  | { phase: 'concluded_today'; currentStop: Stop }
  | { phase: 'concluded' };

export function timeToMinutes(value: string | null | undefined): number | null {
  const m = String(value ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((new Date(`${toKey}T00:00:00`).getTime() - new Date(`${fromKey}T00:00:00`).getTime()) / 86_400_000);
}

export function liveFuneralState(journey: Stop[], now = new Date()): LivePhase {
  if (!journey.length) return { phase: 'none' };
  const today = localDateKey(now);
  const dates = journey.map((s) => s.date).filter(Boolean).sort();
  if (!dates.length) return { phase: 'none' };
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  const todays = journey
    .filter((s) => s.date === today)
    .sort((a, b) => (timeToMinutes(a.time) ?? 0) - (timeToMinutes(b.time) ?? 0));

  if (!todays.length) {
    if (today < earliest) return { phase: 'upcoming', daysUntil: daysBetween(today, earliest), date: earliest };
    if (today > latest) return { phase: 'concluded' };
    const next = dates.find((d) => d > today) ?? latest;
    return { phase: 'between', date: next };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  let currentStop: Stop | null = null;
  let nextStop: Stop | null = null;
  for (const stop of todays) {
    const start = timeToMinutes(stop.time);
    if (start != null && start <= minutes) currentStop = stop;
    else {
      nextStop = stop;
      break;
    }
  }
  if (!currentStop && !nextStop) return { phase: 'none' };
  if (!currentStop) return { phase: 'before_start', nextStop: nextStop! };
  if (!nextStop) return { phase: 'concluded_today', currentStop };
  const depart = timeToMinutes(currentStop.departTime);
  if (depart != null && depart <= minutes) return { phase: 'in_transit', currentStop, nextStop };
  return { phase: 'at_stop', currentStop, nextStop };
}

/**
 * What's happening in the service. When the funeral-day coordinator has marked
 * an item as started (liveKey), that wins over the clock: current is that item
 * and next is the one after it in the running order.
 */
export function liveProgrammeState(
  programme: Draft['programme'],
  now = new Date(),
  liveKey?: string | null,
): { current: ProgrammeItem | null; next: ProgrammeItem | null } | null {
  if (programme.mode !== 'formal') return null;
  if (liveKey) {
    const i = programme.items.findIndex((item) => item.id === liveKey);
    if (i >= 0) return { current: programme.items[i], next: programme.items[i + 1] ?? null };
  }
  const timed = programme.items.filter((i) => timeToMinutes(i.time) != null);
  if (!timed.length) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  let current: ProgrammeItem | null = null;
  let next: ProgrammeItem | null = null;
  for (const item of timed) {
    if ((timeToMinutes(item.time) ?? 0) <= minutes) current = item;
    else {
      next = item;
      break;
    }
  }
  return current || next ? { current, next } : null;
}
