// What guests' full-screen "on the day" view shows. Pure, so it can be tested:
// the clock and the journey decide the moment; the coordinator's run-sheet
// (the live key) decides which programme item is on, and when a part is over.

import { FUNERAL_ENDED, LAST_STOP_HOURS, dayOfPart, endedDay, liveFuneralState, liveProgrammeState, timeToMinutes, type RunDay } from './live.ts';
import { localDateKey, partOf, type Draft, type ProgrammeItem, type ProgrammePart, type Stop } from './memorial.ts';

export type StageMode =
  /** Today (or tonight), before the first gathering. */
  | 'before'
  /** A gathering is on. */
  | 'now'
  /** Between two places. */
  | 'transit'
  /** The coordinator finished tonight's vigil. */
  | 'vigil_ended'
  /** The coordinator ended the funeral: refreshments now, the after-tears later. */
  | 'after'
  /** The coordinator started an item though no journey stop is on right now. */
  | 'broadcast';

export type StageProgramme = {
  current: ProgrammeItem | null;
  next: ProgrammeItem | null;
  where: string;
};

export type StageView = {
  mode: StageMode;
  vigil: boolean;
  /** The place this moment is about (none for a broadcast without a stop). */
  focus: Stop | null;
  programme: StageProgramme | null;
  /** The next place: later today, or tomorrow's first stop after the vigil. */
  after: Stop | null;
  /** In 'after' mode: has the family already arrived at the focus place? */
  arrived?: boolean;
};

/** Where people go once the funeral itself is over. */
const AFTER_TYPES = new Set(['reception', 'home', 'gathering', 'aftertears']);

/** Today's refreshments and after-tears that haven't finished yet, in order. */
export function afterStops(journey: Stop[], now: Date): { stop: Stop; started: boolean }[] {
  const today = localDateKey(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const todays = journey.filter((s) => s.date === today).sort((a, b) => a.time.localeCompare(b.time));
  return todays
    .map((stop, i) => {
      const start = timeToMinutes(stop.time) ?? 0;
      const nextStart = timeToMinutes(todays[i + 1]?.time);
      const end = timeToMinutes(stop.departTime) ?? nextStart ?? (stop.type === 'aftertears' ? 24 * 60 : start + LAST_STOP_HOURS * 60);
      return { stop, started: start <= minutes, over: end <= minutes };
    })
    .filter((s) => AFTER_TYPES.has(s.stop.type) && !s.over)
    .map(({ stop, started }) => ({ stop, started }));
}

const PART_WHERE: Record<ProgrammePart, string> = {
  vigil: 'At the vigil',
  service: 'In the service',
  graveside: 'At the graveside',
};

/** Which part of the programme belongs at a stop (none for a reception or a home). */
export function partsForStop(stop: Stop): ProgrammePart[] {
  if (stop.type === 'vigil') return ['vigil'];
  if (stop.type === 'cemetery' || stop.type === 'crematorium') return ['graveside'];
  if (stop.type === 'church' || stop.type === 'hall' || stop.type === 'other') return ['service'];
  return [];
}

const dayOfStop = (stop: Stop): RunDay => (stop.type === 'vigil' ? 'vigil' : 'day');

function programmeAt(programme: Draft['programme'], liveKey: string | null, stop: Stop, now: Date): StageProgramme | null {
  const started = liveKey ? programme.items.find((i) => i.id === liveKey) : undefined;
  // The coordinator's started item counts only for its own evening or day: last night's
  // vigil item, never finished, doesn't take over the funeral morning.
  const parts = started && dayOfPart(partOf(started)) === dayOfStop(stop) ? [partOf(started)] : partsForStop(stop);
  if (!parts.length) return null;
  const state = liveProgrammeState(programme, now, liveKey, parts);
  return state ? { ...state, where: PART_WHERE[parts[0]] } : null;
}

function sameDayAfter(journey: Stop[], stop: Stop): Stop | null {
  const same = journey.filter((s) => s.date === stop.date).sort((a, b) => a.time.localeCompare(b.time));
  const i = same.findIndex((s) => s.id === stop.id);
  return i >= 0 ? (same[i + 1] ?? null) : null;
}

function firstAfterDay(journey: Stop[], date: string): Stop | null {
  return [...journey].filter((s) => s.date > date).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] ?? null;
}

export function stageView(journey: Stop[], programme: Draft['programme'], liveKey: string | null, now = new Date()): StageView | null {
  const live = liveFuneralState(journey, now);

  if (liveKey === FUNERAL_ENDED) {
    // The funeral is over: point everyone to the food and, later, the after-tears.
    const rest = afterStops(journey, now);
    if (!rest.length) return null;
    return {
      mode: 'after',
      vigil: false,
      focus: rest[0].stop,
      programme: null,
      after: rest[1]?.stop ?? null,
      arrived: rest[0].started,
    };
  }

  if (live.phase === 'before_start' || live.phase === 'at_stop' || live.phase === 'in_transit') {
    const focus = live.phase === 'at_stop' ? live.currentStop : live.nextStop;
    const vigil = focus.type === 'vigil';
    if (vigil && endedDay(liveKey) === 'vigil' && live.phase === 'at_stop') {
      return {
        mode: 'vigil_ended',
        vigil,
        focus,
        programme: null,
        after: firstAfterDay(journey, focus.date),
      };
    }
    return {
      mode: live.phase === 'at_stop' ? 'now' : live.phase === 'in_transit' ? 'transit' : 'before',
      vigil,
      focus,
      programme: live.phase === 'at_stop' ? programmeAt(programme, liveKey, focus, now) : null,
      // What's next: later today, else the next day's first gathering (tomorrow's prayers, the vigil, the funeral).
      after: live.phase === 'in_transit' ? null : ((live.phase === 'at_stop' ? live.nextStop : sameDayAfter(journey, focus)) ?? firstAfterDay(journey, focus.date)),
    };
  }

  // Nothing on the journey right now, but the coordinator is running the programme: show it.
  // (Not once the funeral is over, or days ahead, so a key left running never lingers.)
  const near = live.phase === 'none' || live.phase === 'between' || live.phase === 'concluded_today' || (live.phase === 'upcoming' && live.daysUntil <= 1);
  const started = liveKey && programme.mode === 'formal' ? programme.items.find((i) => i.id === liveKey) : undefined;
  if (started && near) {
    const part = partOf(started);
    const state = liveProgrammeState(programme, now, liveKey, [part]);
    return {
      mode: 'broadcast',
      vigil: part === 'vigil',
      focus: null,
      programme: state ? { ...state, where: PART_WHERE[part] } : null,
      after: null,
    };
  }
  return null;
}
