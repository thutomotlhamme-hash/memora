// Pure memorial domain model shared by the browser editor, the server routes and
// the public memorial. Keep this file free of React, Supabase and DOM APIs so the
// same completeness rules run everywhere (and in `npm test`).

export type StopType = 'home' | 'vigil' | 'church' | 'hall' | 'cemetery' | 'crematorium' | 'reception' | 'aftertears' | 'gathering' | 'prayers' | 'other';
export type DispositionType = '' | 'burial' | 'cremation' | 'private_burial_later' | 'memorial_only' | 'other';
export type ProgrammeMode = '' | 'formal' | 'none';
export type ProgrammeType =
  | 'arrival'
  | 'prayer'
  | 'scripture'
  | 'hymn'
  | 'song'
  | 'sermon'
  | 'tribute'
  | 'obituary'
  | 'eulogy'
  | 'viewing'
  | 'candle'
  | 'committal'
  | 'wreath'
  | 'thanks'
  | 'announcement'
  | 'custom';
/** Where an item happens: the night vigil before, the main service, or at the graveside. */
export type ProgrammePart = 'vigil' | 'service' | 'graveside';

export interface Person {
  firstName: string;
  lastName: string;
  preferredName: string;
  birthDate: string;
  passingDate: string;
  /** Storage path for account-owned memorials. */
  portraitPath: string;
  /** Displayable URL: a signed URL, an object URL, or a guest data URL. Never persisted server-side. */
  portraitUrl: string;
}

export interface Stop {
  id: string;
  type: StopType;
  title: string;
  date: string;
  time: string;
  departTime: string;
  address: string;
  landmark: string;
  parking: string;
  transport: string;
  notes: string;
  lat: number;
  lng: number;
}

export interface ProgrammeItem {
  id: string;
  /** Missing on older drafts: treated as the main service. */
  part?: ProgrammePart;
  type: ProgrammeType;
  time: string;
  title: string;
  presenter: string;
  detail: string;
}

/** One evening of prayer at the family home in the week before the funeral. */
export interface PrayerEvening {
  date: string;
  /** Off: no prayers that evening (the day stays listed so the family can switch it back on). */
  on: boolean;
  /** Blank = the week's usual time. */
  time: string;
  endTime: string;
  /** The title of the evening's service, e.g. "Prayer of comfort". */
  title: string;
  /** The word of the day: the theme the evening is built around. */
  word: string;
  scripture: string;
  /** The church, pastor or person leading. */
  leader: string;
}

/** Prayers during the week: where, the usual time, and each evening's details. */
export interface PrayerWeek {
  enabled: boolean;
  place: string;
  address: string;
  landmark: string;
  lat: number;
  lng: number;
  time: string;
  endTime: string;
  notes: string;
  evenings: PrayerEvening[];
}

export interface Draft {
  person: Person;
  prayers: PrayerWeek;
  story: { obituary: string; familyMessage: string };
  disposition: { type: DispositionType; notes: string };
  journey: Stop[];
  /** releaseAt: ISO time guests may first see the programme; '' = straight away. */
  programme: { mode: ProgrammeMode; items: ProgrammeItem[]; releaseAt?: string };
}

export type CaseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CaseMeta {
  id: string;
  status: CaseStatus;
  slug: string;
  publishedAt: string | null;
  archiveAt: string | null;
  paid: boolean;
  updatedAt: string | null;
  /** Programme item the funeral-day coordinator marked as happening now. */
  liveKey?: string | null;
  liveStartedAt?: string | null;
  /** The funeral home this memorial belongs to: it publishes (and pays), not the family. */
  home?: { name: string; canPublish: boolean; phone: string } | null;
}

export function emptyDraft(): Draft {
  return {
    person: { firstName: '', lastName: '', preferredName: '', birthDate: '', passingDate: '', portraitPath: '', portraitUrl: '' },
    story: { obituary: '', familyMessage: '' },
    disposition: { type: '', notes: '' },
    journey: [],
    programme: { mode: '', items: [] },
    prayers: emptyPrayers(),
  };
}

export function emptyPrayers(): PrayerWeek {
  return { enabled: false, place: '', address: '', landmark: '', lat: NaN, lng: NaN, time: '18:00', endTime: '', notes: '', evenings: [] };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const STOP_TYPE_LABELS: Record<StopType, string> = {
  home: 'Family home',
  vigil: 'Night vigil',
  church: 'Church / service',
  hall: 'Hall / venue',
  cemetery: 'Cemetery / burial',
  crematorium: 'Crematorium',
  reception: 'Refreshments / reception',
  aftertears: 'After-tears',
  prayers: 'Prayer service',
  gathering: 'Gathering point',
  other: 'Custom stop',
};

export const DISPOSITION_LABELS: Record<Exclude<DispositionType, ''>, string> = {
  burial: 'Funeral service and burial',
  cremation: 'Funeral service and cremation',
  private_burial_later: 'Service now, private burial later',
  memorial_only: 'Memorial service only',
  other: 'Something else',
};

export const PROGRAMME_TYPE_LABELS: Record<ProgrammeType, string> = {
  arrival: 'Arrival of the deceased',
  prayer: 'Prayer',
  scripture: 'Scripture',
  hymn: 'Hymn',
  song: 'Song / choir',
  sermon: 'Sermon / message',
  tribute: 'Speaker / Tribute',
  obituary: 'Obituary',
  eulogy: 'Eulogy',
  viewing: 'Viewing / last respects',
  candle: 'Candle lighting',
  committal: 'Committal / lowering',
  wreath: 'Wreaths & flowers',
  thanks: 'Vote of thanks',
  announcement: 'Announcement',
  custom: 'Custom item',
};

export const PROGRAMME_PARTS: { id: ProgrammePart; label: string; hint: string }[] = [
  { id: 'vigil', label: 'Night vigil', hint: 'The evening before: prayers, hymns and memories with family and friends.' },
  { id: 'service', label: 'The service', hint: 'The main funeral or memorial service.' },
  { id: 'graveside', label: 'At the graveside', hint: 'Committal, prayers, wreaths and the vote of thanks at the cemetery.' },
];
export const partOf = (item: Pick<ProgrammeItem, 'part'>): ProgrammePart => item.part ?? 'service';
export const partLabel = (part: string) => PROGRAMME_PARTS.find((p) => p.id === part)?.label ?? 'The service';

/** Items grouped vigil → service → graveside, keeping each part's own order. */
export function programmeParts(items: ProgrammeItem[]): { part: ProgrammePart; label: string; items: ProgrammeItem[] }[] {
  return PROGRAMME_PARTS.map((p) => ({ part: p.id, label: p.label, items: items.filter((i) => partOf(i) === p.id) })).filter((g) => g.items.length);
}

/** Put items in part order (vigil, service, graveside) without changing the order inside a part. */
export function sortByPart(items: ProgrammeItem[]): ProgrammeItem[] {
  return programmeParts(items).flatMap((g) => g.items);
}

export type VigilKind = 'prayer' | 'night';

export const VIGIL_TEMPLATES: { id: VigilKind; label: string; hint: string }[] = [
  { id: 'prayer', label: 'A short prayer evening', hint: 'The arrival, a prayer and a hymn. About an hour.' },
  { id: 'night', label: 'A whole-night vigil', hint: 'The arrival, then prayers, hymns and memories through the night.' },
];

function addMinutes(hhmm: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  const base = m ? Number(m[1]) * 60 + Number(m[2]) : 18 * 60;
  const t = Math.min(base + minutes, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * A light night-vigil programme to start from. It opens with the deceased
 * arriving home; the scripture reading is optional.
 */
export function vigilTemplate(kind: VigilKind, opts: { arrival?: string; name?: string; scripture?: boolean } = {}): ProgrammeItem[] {
  const at = opts.arrival && /^\d{1,2}:\d{2}/.test(opts.arrival) ? opts.arrival.slice(0, 5) : '18:00';
  const who = opts.name?.trim() || 'our loved one';
  const item = (offset: number, type: ProgrammeType, title: string, detail = ''): ProgrammeItem => ({
    id: newId('item'),
    part: 'vigil',
    type,
    time: addMinutes(at, offset),
    title,
    presenter: '',
    detail,
  });
  const arrival = item(0, 'arrival', `${who} arrives home`, 'Family and friends gather to welcome them');
  const items =
    kind === 'prayer'
      ? [arrival, item(30, 'prayer', 'Opening prayer'), opts.scripture ? item(40, 'scripture', 'Scripture reading') : null, item(50, 'hymn', 'Hymn'), item(60, 'prayer', 'Closing prayer and blessing')]
      : [
          arrival,
          item(60, 'hymn', 'Opening hymn and prayer'),
          opts.scripture ? item(80, 'scripture', 'Scripture reading') : null,
          item(100, 'tribute', 'Memories and tributes'),
          item(180, 'prayer', 'Prayers and hymns through the night', 'Until the morning'),
        ];
  return items.filter((i): i is ProgrammeItem => i !== null);
}

const PART_STOPS: Record<ProgrammePart, StopType[]> = {
  vigil: ['vigil'],
  service: ['church', 'hall', 'other', 'home'],
  graveside: ['cemetery', 'crematorium'],
};

/**
 * When and where each part of the programme begins: the night vigil, the service,
 * the graveside. Guests need this most: the date and the start time, not only the
 * running order. Taken from the journey stop for that part, else the first timed item.
 */
export function partStart(journey: Stop[], items: ProgrammeItem[], part: ProgrammePart): { date: string; time: string; place: string } | null {
  const dated = [...journey].filter((s) => s.date).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const stop = dated.find((s) => PART_STOPS[part].includes(s.type));
  const firstTimed = items.find((i) => partOf(i) === part && i.time)?.time ?? '';
  if (stop) return { date: stop.date, time: (stop.time || firstTimed).slice(0, 5), place: stop.title };
  const funeralDay = dated.find((s) => s.type !== 'vigil')?.date ?? '';
  if (!funeralDay && !firstTimed) return null;
  // No vigil stop: the vigil is the evening before the funeral.
  const date = part === 'vigil' && funeralDay ? localDateKey(new Date(new Date(`${funeralDay}T12:00:00`).getTime() - 86_400_000)) : funeralDay;
  return { date, time: firstTimed.slice(0, 5), place: '' };
}

/** "Friday 2 October · from 18:00 · Family home" */
export function partStartLabel(start: { date: string; time: string; place: string } | null, part?: ProgrammePart): string {
  if (!start) return '';
  const d = start.date ? new Date(`${start.date}T12:00:00`) : null;
  const day = d && !Number.isNaN(d.getTime()) ? `${d.toLocaleDateString('en-ZA', { weekday: 'long' })} ${d.getDate()} ${d.toLocaleDateString('en-ZA', { month: 'long' })}` : '';
  // "Night vigil · … · Night vigil" says it twice: leave out a place named after the part.
  const place = part && start.place.trim().toLowerCase() === partLabel(part).toLowerCase() ? '' : start.place;
  return [day, start.time ? `from ${start.time}` : '', place].filter(Boolean).join(' · ');
}

/** Has the family released the programme to guests yet? */
export function programmeReleased(programme: Pick<Draft['programme'], 'releaseAt'>, now = new Date()): boolean {
  return !programme.releaseAt || new Date(programme.releaseAt).getTime() <= now.getTime();
}

export const stopLabel = (type: string) => STOP_TYPE_LABELS[type as StopType] ?? STOP_TYPE_LABELS.other;
export const dispositionLabel = (type: string) => DISPOSITION_LABELS[type as Exclude<DispositionType, ''>] ?? 'Not selected';
export const programmeTypeLabel = (type: string) => PROGRAMME_TYPE_LABELS[type as ProgrammeType] ?? PROGRAMME_TYPE_LABELS.custom;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function fmtDate(value: string | null | undefined, fallback = 'Not added'): string {
  if (!value) return fallback;
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function lifeDates(person: Pick<Person, 'birthDate' | 'passingDate'>): string {
  const born = person.birthDate ? fmtDate(person.birthDate) : '';
  const passed = person.passingDate ? fmtDate(person.passingDate) : '';
  if (born && passed) return `${born} — ${passed}`;
  return passed || born || '';
}

export function displayName(person: Pick<Person, 'firstName' | 'lastName' | 'preferredName'>, fallback = 'Your loved one'): string {
  return [person.preferredName || person.firstName, person.lastName].filter(Boolean).join(' ') || fallback;
}

export function initials(person: Pick<Person, 'firstName' | 'lastName' | 'preferredName'>): string {
  const first = (person.preferredName || person.firstName || 'M').trim()[0] ?? 'M';
  const last = (person.lastName || '').trim()[0] ?? '';
  return (first + last).toUpperCase();
}

export function capitaliseName(value: string): string {
  return String(value)
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) =>
      word
        .split(/([-'’])/)
        .map((part) => (/[-'’]/.test(part) ? part : part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
        .join(''),
    )
    .join(' ');
}

export function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The first funeral date: every new stop defaults to it. */
export function funeralDate(draft: Draft): string {
  return draft.journey.find((s) => s.date)?.date ?? '';
}

// ---------------------------------------------------------------------------
// Completeness rules — the single source of truth for "ready to publish".
// ---------------------------------------------------------------------------

export interface Gate {
  ready: boolean;
  message: string;
}

export function validStop(s: Partial<Stop> | null | undefined): boolean {
  return Boolean(s?.title?.trim() && s?.date && s?.time && Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng)));
}

export function personGate(draft: Draft): Gate {
  const p = draft.person;
  if (!p.firstName.trim() || !p.lastName.trim()) return { ready: false, message: 'Add their first name and surname.' };
  if (!p.passingDate) return { ready: false, message: 'Add the date of passing.' };
  if (!p.portraitPath && !p.portraitUrl) return { ready: false, message: 'Add a portrait photo.' };
  return { ready: true, message: 'Loved one details are complete.' };
}

/**
 * Stops must follow in time order: each one starts no earlier than the stop
 * before it ends (or starts, when it has no end time). Returns the first
 * problem in plain words, or null when the order is fine.
 */
export function journeyOrderProblem(stops: Pick<Stop, 'title' | 'date' | 'time' | 'departTime'>[]): string | null {
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const cur = stops[i];
    if (!prev.date || !prev.time || !cur.date || !cur.time) continue;
    const prevEnd = `${prev.date}T${prev.departTime || prev.time}`;
    const curStart = `${cur.date}T${cur.time}`;
    if (curStart < prevEnd) {
      const when = prev.departTime ? `ends at ${prev.departTime}` : `starts at ${prev.time}`;
      const day = cur.date !== prev.date ? ` on ${fmtDate(cur.date)}` : '';
      return `“${cur.title || 'This stop'}” starts at ${cur.time}${day}, but “${prev.title || 'the stop before it'}” ${when}. Each stop must start after the one before it.`;
    }
  }
  return null;
}

export function journeyGate(draft: Draft): Gate {
  const type = draft.disposition.type;
  const stops = draft.journey;
  if (!type) return { ready: false, message: 'Choose the kind of service.' };
  if (type === 'other' && !draft.disposition.notes.trim()) return { ready: false, message: 'Describe the service in the note.' };
  if (!stops.length || !stops.every(validStop)) return { ready: false, message: 'Add at least one complete stop with a date, time and exact map pin.' };
  const order = journeyOrderProblem(stops);
  if (order) return { ready: false, message: order };
  if (type === 'burial' && !stops.some((s) => s.type === 'cemetery')) return { ready: false, message: 'A funeral with burial needs the cemetery as a stop.' };
  if (type === 'cremation' && !stops.some((s) => s.type === 'crematorium')) return { ready: false, message: 'A funeral with cremation needs the crematorium as a stop.' };
  return { ready: true, message: 'The funeral journey is ready.' };
}

export const MIN_STORY_LENGTH = 20;

export function storyGate(draft: Draft): Gate {
  if (draft.story.obituary.trim().length < MIN_STORY_LENGTH) return { ready: false, message: 'Write at least a few sentences of their life story.' };
  return { ready: true, message: 'Their story is ready.' };
}

export function programmeGate(draft: Draft): Gate {
  const { mode, items } = draft.programme;
  if (!mode) return { ready: false, message: 'Choose whether there is a formal order of service.' };
  if (mode === 'none') return { ready: true, message: 'No formal programme.' };
  if (!items.length) return { ready: false, message: 'Add at least one item to the order of service.' };
  if (!items.every((i) => i.title.trim())) return { ready: false, message: 'Every programme item needs a title.' };
  return { ready: true, message: 'The order of service is ready.' };
}

export interface Readiness {
  person: Gate;
  journey: Gate;
  story: Gate;
  programme: Gate;
  complete: boolean;
  /** 0–100, counting the four content gates. */
  pct: number;
  missing: string[];
}

export function readiness(draft: Draft): Readiness {
  const person = personGate(draft);
  const journey = journeyGate(draft);
  const story = storyGate(draft);
  const programme = programmeGate(draft);
  const gates = [person, journey, story, programme];
  const done = gates.filter((g) => g.ready).length;
  return {
    person,
    journey,
    story,
    programme,
    complete: done === gates.length,
    pct: Math.round((done / gates.length) * 100),
    missing: gates.filter((g) => !g.ready).map((g) => g.message),
  };
}

export function hasMeaningfulDraft(draft: Draft | null | undefined): boolean {
  if (!draft) return false;
  const p = draft.person;
  return Boolean(
    p.firstName || p.lastName || p.portraitUrl || draft.story.obituary.trim() || draft.journey.length || draft.programme.items.length,
  );
}

// ---------------------------------------------------------------------------
// Sanitising untrusted input (localStorage, request bodies)
// ---------------------------------------------------------------------------

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const dateStr = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : '');
const timeStr = (v: unknown) => {
  const m = str(v).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(str(v)) ? (str(v) as T) : fallback;

const STOP_TYPES = Object.keys(STOP_TYPE_LABELS) as StopType[];
const PROGRAMME_TYPES = Object.keys(PROGRAMME_TYPE_LABELS) as ProgrammeType[];
const DISPOSITIONS: DispositionType[] = ['', 'burial', 'cremation', 'private_burial_later', 'memorial_only', 'other'];
const MODES: ProgrammeMode[] = ['', 'formal', 'none'];
const PARTS: ProgrammePart[] = ['vigil', 'service', 'graveside'];
const isoTime = (v: unknown): string => {
  const t = typeof v === 'string' && v ? new Date(v) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toISOString() : '';
};

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** Coerce anything into a well-formed Draft, dropping malformed stops/items. */
export function normaliseDraft(input: unknown): Draft {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const base = emptyDraft();
  const person = raw.person ?? {};
  const lat = (v: unknown) => (v === '' || v == null ? NaN : Number(v));
  return {
    person: {
      firstName: str(person.firstName, 120),
      lastName: str(person.lastName, 120),
      preferredName: str(person.preferredName, 120),
      birthDate: dateStr(person.birthDate),
      passingDate: dateStr(person.passingDate),
      portraitPath: str(person.portraitPath, 300),
      portraitUrl: str(person.portraitUrl, 3_000_000),
    },
    story: {
      obituary: str(raw.story?.obituary, 20000),
      familyMessage: str(raw.story?.familyMessage, 8000),
    },
    disposition: {
      type: pick(raw.disposition?.type, DISPOSITIONS, base.disposition.type),
      notes: str(raw.disposition?.notes, 500),
    },
    journey: (Array.isArray(raw.journey) ? raw.journey : [])
      .slice(0, 20)
      .map((s: any) => ({
        id: str(s?.id, 80) || newId('stop'),
        type: pick(s?.type, STOP_TYPES, 'other'),
        title: str(s?.title, 200),
        date: dateStr(s?.date),
        time: timeStr(s?.time),
        departTime: timeStr(s?.departTime),
        address: str(s?.address, 500),
        landmark: str(s?.landmark, 300),
        parking: str(s?.parking, 1000),
        transport: str(s?.transport, 1000),
        notes: str(s?.notes, 1000),
        lat: lat(s?.lat),
        lng: lat(s?.lng),
      }))
      .filter((s: Stop) => validStop(s) && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180),
    programme: {
      mode: pick(raw.programme?.mode, MODES, ''),
      items: (Array.isArray(raw.programme?.items) ? raw.programme.items : [])
        .slice(0, 60)
        .map((i: any) => ({
          id: str(i?.id, 80) || newId('item'),
          part: pick(i?.part, PARTS, 'service'),
          type: pick(i?.type, PROGRAMME_TYPES, 'custom'),
          time: timeStr(i?.time),
          title: str(i?.title, 200),
          presenter: str(i?.presenter, 200),
          detail: str(i?.detail, 1000),
        }))
        .filter((i: ProgrammeItem) => i.title.trim()),
      releaseAt: isoTime(raw.programme?.releaseAt),
    },
    prayers: normalisePrayers(raw.prayers),
  };
}

function normalisePrayers(input: unknown): PrayerWeek {
  const p = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const base = emptyPrayers();
  const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? NaN : Number(v));
  const lat = num(p.lat);
  const lng = num(p.lng);
  const seen = new Set<string>();
  return {
    enabled: p.enabled === true,
    place: str(p.place, 200),
    address: str(p.address, 500),
    landmark: str(p.landmark, 300),
    lat: Math.abs(lat) <= 90 ? lat : NaN,
    lng: Math.abs(lng) <= 180 ? lng : NaN,
    time: timeStr(p.time) || base.time,
    endTime: timeStr(p.endTime),
    notes: str(p.notes, 1000),
    evenings: (Array.isArray(p.evenings) ? p.evenings : [])
      .slice(0, 21)
      .map((e: any) => ({
        date: dateStr(e?.date),
        on: e?.on !== false,
        time: timeStr(e?.time),
        endTime: timeStr(e?.endTime),
        title: str(e?.title, 200),
        word: str(e?.word, 300),
        scripture: str(e?.scripture, 200),
        leader: str(e?.leader, 200),
      }))
      .filter((e: PrayerEvening) => e.date && !seen.has(e.date) && seen.add(e.date))
      .sort((a: PrayerEvening, b: PrayerEvening) => a.date.localeCompare(b.date)),
  };
}

/** Every date from `from` to `to`, inclusive (at most three weeks). */
export function datesBetween(from: string, to: string): string[] {
  if (!from || !to || to < from) return [];
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  while (out.length < 21) {
    const key = localDateKey(d);
    if (key > to) break;
    out.push(key);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Rebuild the evenings for a new date range, keeping what was already filled in for each date. */
export function prayerEvenings(existing: PrayerEvening[], from: string, to: string): PrayerEvening[] {
  const byDate = new Map(existing.map((e) => [e.date, e]));
  return datesBetween(from, to).map(
    (date) => byDate.get(date) ?? { date, on: true, time: '', endTime: '', title: '', word: '', scripture: '', leader: '' },
  );
}

/** The evenings that are on, as journey-like stops, so the live view and "up next" treat them like any gathering. */
export function prayerStops(week: PrayerWeek | undefined): Stop[] {
  if (!week?.enabled) return [];
  return week.evenings
    .filter((e) => e.on && e.date)
    .map((e) => ({
      id: `prayer-${e.date}`,
      type: 'prayers' as const,
      title: e.title || 'Evening prayers',
      date: e.date,
      time: e.time || week.time || '18:00',
      departTime: e.endTime || week.endTime,
      address: week.address || week.place,
      landmark: week.landmark,
      parking: '',
      transport: '',
      notes: week.notes,
      lat: week.lat,
      lng: week.lng,
    }));
}

/** The prayer evening behind a stop from prayerStops(). */
export function prayerEveningFor(week: PrayerWeek | undefined, stopId: string): PrayerEvening | null {
  if (!week || !stopId.startsWith('prayer-')) return null;
  return week.evenings.find((e) => `prayer-${e.date}` === stopId) ?? null;
}

/** The journey with the prayer evenings folded in, in date and time order. */
export function withPrayers(journey: Stop[], week: PrayerWeek | undefined): Stop[] {
  const prayers = prayerStops(week);
  if (!prayers.length) return journey;
  return [...prayers, ...journey].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

export type MapsProvider = 'google' | 'apple' | 'waze';

export function directionsUrl(stop: Pick<Stop, 'lat' | 'lng'>, provider: MapsProvider): string {
  const lat = Number(stop.lat);
  const lng = Number(stop.lng);
  if (provider === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (provider === 'apple') return `https://maps.apple.com/?daddr=${lat},${lng}`;
  return `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export function routeUrl(from: Pick<Stop, 'lat' | 'lng'>, to: Pick<Stop, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${Number(from.lat)},${Number(from.lng)}&destination=${Number(to.lat)},${Number(to.lng)}&travelmode=driving`;
}
