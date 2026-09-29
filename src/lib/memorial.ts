// Pure memorial domain model shared by the browser editor, the server routes and
// the public memorial. Keep this file free of React, Supabase and DOM APIs so the
// same completeness rules run everywhere (and in `npm test`).

export type StopType = 'home' | 'church' | 'hall' | 'cemetery' | 'crematorium' | 'reception' | 'gathering' | 'other';
export type DispositionType = '' | 'burial' | 'cremation' | 'private_burial_later' | 'memorial_only' | 'other';
export type ProgrammeMode = '' | 'formal' | 'none';
export type ProgrammeType = 'prayer' | 'scripture' | 'hymn' | 'tribute' | 'obituary' | 'eulogy' | 'song' | 'announcement' | 'custom';

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
  type: ProgrammeType;
  time: string;
  title: string;
  presenter: string;
  detail: string;
}

export interface Draft {
  person: Person;
  story: { obituary: string; familyMessage: string };
  disposition: { type: DispositionType; notes: string };
  journey: Stop[];
  programme: { mode: ProgrammeMode; items: ProgrammeItem[] };
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
}

export function emptyDraft(): Draft {
  return {
    person: { firstName: '', lastName: '', preferredName: '', birthDate: '', passingDate: '', portraitPath: '', portraitUrl: '' },
    story: { obituary: '', familyMessage: '' },
    disposition: { type: '', notes: '' },
    journey: [],
    programme: { mode: '', items: [] },
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const STOP_TYPE_LABELS: Record<StopType, string> = {
  home: 'Family home',
  church: 'Church / service',
  hall: 'Hall / venue',
  cemetery: 'Cemetery / burial',
  crematorium: 'Crematorium',
  reception: 'Reception / gathering',
  gathering: 'Gathering point',
  other: 'Custom stop',
};

export const DISPOSITION_LABELS: Record<Exclude<DispositionType, ''>, string> = {
  burial: 'Burial',
  cremation: 'Cremation',
  private_burial_later: 'Private burial later',
  memorial_only: 'Memorial / service only',
  other: 'Other arrangement',
};

export const PROGRAMME_TYPE_LABELS: Record<ProgrammeType, string> = {
  prayer: 'Prayer',
  scripture: 'Scripture',
  hymn: 'Hymn',
  tribute: 'Speaker / Tribute',
  obituary: 'Obituary',
  eulogy: 'Eulogy',
  song: 'Song',
  announcement: 'Announcement',
  custom: 'Custom item',
};

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

export function journeyGate(draft: Draft): Gate {
  const type = draft.disposition.type;
  const stops = draft.journey;
  if (!type) return { ready: false, message: 'Choose what happens after the service.' };
  if (type === 'other' && !draft.disposition.notes.trim()) return { ready: false, message: 'Describe the other funeral arrangement.' };
  if (!stops.length || !stops.every(validStop)) return { ready: false, message: 'Add at least one complete stop with a date, time and exact map pin.' };
  if (type === 'burial' && !stops.some((s) => s.type === 'cemetery')) return { ready: false, message: 'This funeral is marked for burial, so add a Cemetery / burial stop.' };
  if (type === 'cremation' && !stops.some((s) => s.type === 'crematorium')) return { ready: false, message: 'This funeral is marked for cremation, so add a Crematorium stop.' };
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
          type: pick(i?.type, PROGRAMME_TYPES, 'custom'),
          time: timeStr(i?.time),
          title: str(i?.title, 200),
          presenter: str(i?.presenter, 200),
          detail: str(i?.detail, 1000),
        }))
        .filter((i: ProgrammeItem) => i.title.trim()),
    },
  };
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
