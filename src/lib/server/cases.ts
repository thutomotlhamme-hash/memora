import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { MEDIA_BUCKET } from '../config';
import { bestPlan, type PlanId } from '../plans';
import {
  emptyDraft,
  normaliseDraft,
  type CaseMeta,
  type CaseStatus,
  type Draft,
  type ProgrammeItem,
  type Stop,
} from '../memorial';

const CASE_COLUMNS =
  'id,status,slug,disposition_type,disposition_notes,programme_mode,obituary,family_message,published_at,archive_at,updated_at';
const PERSON_COLUMNS = 'first_name,last_name,preferred_name,birth_date,passing_date,portrait_path';
const STOP_COLUMNS =
  'id,stop_type,title,event_date,event_time,departure_time,address_text,landmark,parking_notes,transport_notes,notes,latitude,longitude,sort_order';
const ITEM_COLUMNS = 'id,item_type,start_time,title,presenter,detail,sort_order';

const hhmm = (v: unknown) => (v ? String(v).slice(0, 5) : '');

type Row = Record<string, any>;

function rowsToDraft(c: Row, person: Row | null, stops: Row[], items: Row[], portraitUrl = ''): Draft {
  return normaliseDraft({
    person: {
      firstName: person?.first_name ?? '',
      lastName: person?.last_name ?? '',
      preferredName: person?.preferred_name ?? '',
      birthDate: person?.birth_date ?? '',
      passingDate: person?.passing_date ?? '',
      portraitPath: person?.portrait_path ?? '',
      portraitUrl,
    },
    story: { obituary: c.obituary ?? '', familyMessage: c.family_message ?? '' },
    disposition: { type: c.disposition_type ?? '', notes: c.disposition_notes ?? '' },
    journey: stops.map(
      (s): Stop => ({
        id: s.id,
        type: s.stop_type,
        title: s.title,
        date: s.event_date,
        time: hhmm(s.event_time),
        departTime: hhmm(s.departure_time),
        address: s.address_text,
        landmark: s.landmark,
        parking: s.parking_notes,
        transport: s.transport_notes,
        notes: s.notes,
        lat: Number(s.latitude),
        lng: Number(s.longitude),
      }),
    ),
    programme: {
      mode: c.programme_mode ?? '',
      items: items.map(
        (i): ProgrammeItem => ({
          id: i.id,
          type: i.item_type,
          time: hhmm(i.start_time),
          title: i.title,
          presenter: i.presenter,
          detail: i.detail,
        }),
      ),
    },
  });
}

function toMeta(c: Row, plan: PlanId | null): CaseMeta {
  return {
    id: c.id,
    status: c.status as CaseStatus,
    slug: c.slug ?? '',
    publishedAt: c.published_at ?? null,
    archiveAt: c.archive_at ?? null,
    paid: Boolean(plan),
    plan,
    updatedAt: c.updated_at ?? null,
  };
}

async function signedUrl(client: SupabaseClient, path: string | null | undefined, seconds = 3600): Promise<string> {
  if (!path) return '';
  const { data, error } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(path, seconds);
  return error ? '' : (data?.signedUrl ?? '');
}

async function loadChildren(client: SupabaseClient, caseId: string) {
  const [personR, stopsR, itemsR] = await Promise.all([
    client.from('memora_people').select(PERSON_COLUMNS).eq('case_id', caseId).maybeSingle(),
    client.from('memora_stops').select(STOP_COLUMNS).eq('case_id', caseId).order('sort_order'),
    client.from('memora_programme_items').select(ITEM_COLUMNS).eq('case_id', caseId).order('sort_order'),
  ]);
  const error = personR.error || stopsR.error || itemsR.error;
  if (error) throw new Error(error.message);
  return { person: personR.data as Row | null, stops: (stopsR.data ?? []) as Row[], items: (itemsR.data ?? []) as Row[] };
}

/** The plan this memorial has a confirmed, verified payment for, or null. */
export async function paidPlan(client: SupabaseClient, caseId: string): Promise<PlanId | null> {
  const { data: orders } = await client.from('memora_orders').select('id,plan').eq('case_id', caseId).eq('status', 'PAID').limit(10);
  if (!orders?.length) return null;
  const { data: payments } = await client
    .from('memora_payments')
    .select('order_id')
    .in('order_id', orders.map((o) => o.id))
    .eq('status', 'CONFIRMED')
    .not('verified_at', 'is', null);
  const confirmed = new Set((payments ?? []).map((p) => p.order_id));
  return bestPlan(orders.filter((o) => confirmed.has(o.id)).map((o) => o.plan));
}

/** Loads a memorial the signed-in user owns. RLS returns nothing for anyone else. */
export async function loadOwnedCase(client: SupabaseClient, caseId: string): Promise<{ draft: Draft; meta: CaseMeta } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) return null;
  const { data: c, error } = await client.from('memora_cases').select(CASE_COLUMNS).eq('id', caseId).maybeSingle();
  if (error || !c) return null;
  const { person, stops, items } = await loadChildren(client, caseId);
  const [portraitUrl, plan] = await Promise.all([signedUrl(client, person?.portrait_path), paidPlan(client, caseId)]);
  return { draft: rowsToDraft(c, person, stops, items, portraitUrl), meta: toMeta(c, plan) };
}

export interface CaseSummary {
  id: string;
  status: CaseStatus;
  slug: string;
  name: string;
  passingDate: string;
  funeralDate: string;
  portraitUrl: string;
  updatedAt: string;
  archiveAt: string | null;
}

export async function listOwnedCases(client: SupabaseClient): Promise<CaseSummary[]> {
  const { data: cases, error } = await client
    .from('memora_cases')
    .select('id,status,slug,updated_at,archive_at,memora_people(first_name,last_name,preferred_name,passing_date,portrait_path),memora_stops(event_date,sort_order)')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error || !cases) return [];
  return Promise.all(
    cases.map(async (c: Row) => {
      const p = (Array.isArray(c.memora_people) ? c.memora_people[0] : c.memora_people) ?? {};
      const stops = ((c.memora_stops ?? []) as Row[]).sort((a, b) => a.sort_order - b.sort_order);
      return {
        id: c.id,
        status: c.status,
        slug: c.slug ?? '',
        name: [p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(' ') || 'Untitled memorial',
        passingDate: p.passing_date ?? '',
        funeralDate: stops[0]?.event_date ?? '',
        portraitUrl: await signedUrl(client, p.portrait_path, 900),
        updatedAt: c.updated_at,
        archiveAt: c.archive_at ?? null,
      };
    }),
  );
}

/** Atomically replaces the memorial content. Runs as the user, so RLS still applies. */
export async function saveOwnedDraft(client: SupabaseClient, caseId: string, draft: Draft): Promise<string> {
  const payload = { ...draft, person: { ...draft.person, portraitUrl: '' } };
  const { data, error } = await client.rpc('memora_save_draft', { p_case_id: caseId, p_draft: payload });
  if (error) throw new Error(error.message);
  return String(data ?? new Date().toISOString());
}

export type PublicMemorial =
  | { state: 'ok'; draft: Draft; meta: CaseMeta }
  | { state: 'not_found' }
  | { state: 'archived'; name: string };

/**
 * Public read for /m/<slug>. Uses the service role because anon has no table
 * access; only published memorials inside their public window are returned.
 */
export async function loadPublicMemorial(admin: SupabaseClient, slug: string): Promise<PublicMemorial> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { state: 'not_found' };
  const { data: c } = await admin.from('memora_cases').select(CASE_COLUMNS).eq('slug', slug).in('status', ['PUBLISHED', 'ARCHIVED']).maybeSingle();
  if (!c || !c.published_at) return { state: 'not_found' };
  const { person, stops, items } = await loadChildren(admin, c.id);
  const archived = c.status === 'ARCHIVED' || (c.archive_at && new Date(c.archive_at).getTime() <= Date.now());
  if (archived) {
    return { state: 'archived', name: [person?.preferred_name || person?.first_name, person?.last_name].filter(Boolean).join(' ') };
  }
  const portraitUrl = await signedUrl(admin, person?.portrait_path, 6 * 3600);
  const draft = rowsToDraft(c, person, stops, items, portraitUrl);
  draft.person.portraitPath = '';
  return { state: 'ok', draft, meta: toMeta(c, null) };
}

export { emptyDraft };
