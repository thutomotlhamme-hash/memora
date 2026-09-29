import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../config';
import { displayName, normaliseDraft, type ProgrammeItem } from '../memorial';
import { loadCaseById } from './cases';
import { linkSecret } from './links';

// The coordinator's private run-sheet link: /run/<caseId>.<v>.<mac>
// Signed with MEMORA_LINK_SECRET and bound to the memorial's run_version, so the
// family can revoke every shared link at once by resetting it.

function mac(caseId: string, version: number): string {
  return createHmac('sha256', linkSecret()).update(`run:${caseId}:${version}`).digest('base64url');
}

export function runToken(caseId: string, version: number): string {
  if (!linkSecret()) throw new Error('MEMORA_LINK_SECRET is not set');
  return `${caseId}.${version}.${mac(caseId, version)}`;
}

export const runUrl = (caseId: string, version: number) => `${siteUrl()}/run/${runToken(caseId, version)}`;

/** Returns the case id if the token is genuine and not revoked. */
export async function verifyRunToken(admin: SupabaseClient, token: string | null | undefined): Promise<string | null> {
  if (!linkSecret() || !token) return null;
  const [caseId, v, sig] = String(token).split('.');
  const version = Number(v);
  if (!caseId || !sig || !/^[0-9a-f-]{36}$/i.test(caseId) || !Number.isInteger(version)) return null;
  const expected = Buffer.from(mac(caseId, version));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const { data } = await admin.from('memora_cases').select('run_version,status').eq('id', caseId).maybeSingle();
  if (!data || data.status === 'ARCHIVED' || Number(data.run_version) !== version) return null;
  return caseId;
}

export interface RunSnapshot {
  name: string;
  slug: string;
  status: string;
  journey: ReturnType<typeof normaliseDraft>['journey'];
  programme: ProgrammeItem[];
  liveKey: string | null;
  updatedAt: string;
}

export async function loadRunSnapshot(admin: SupabaseClient, caseId: string): Promise<RunSnapshot | null> {
  const loaded = await loadCaseById(admin, caseId);
  if (!loaded) return null;
  return {
    name: displayName(loaded.draft.person, 'the memorial'),
    slug: loaded.meta.slug,
    status: loaded.meta.status,
    journey: loaded.draft.journey,
    programme: loaded.draft.programme.items,
    liveKey: loaded.meta.liveKey ?? null,
    updatedAt: loaded.meta.updatedAt ?? '',
  };
}

export type RunUpdate = {
  base: string;
  programme?: unknown[];
  stopTimes?: { id: string; time: string; departTime?: string }[];
  liveKey?: string | null;
};

/** Applies coordinator changes atomically. Returns 'stale' if someone else saved first. */
export async function applyRunUpdate(admin: SupabaseClient, caseId: string, u: RunUpdate): Promise<'ok' | 'stale' | 'not_found'> {
  const programme = u.programme ? normaliseDraft({ programme: { mode: 'formal', items: u.programme } }).programme.items : null;
  const stopTimes = Array.isArray(u.stopTimes)
    ? u.stopTimes
        .filter((s) => typeof s?.id === 'string' && /^\d{2}:\d{2}$/.test(String(s.time)))
        .slice(0, 20)
        .map((s) => ({ id: s.id.slice(0, 80), time: s.time, ...(s.departTime !== undefined ? { departTime: /^\d{2}:\d{2}$/.test(String(s.departTime)) ? s.departTime : '' } : {}) }))
    : null;
  const setLive = u.liveKey !== undefined;
  const { error } = await admin.rpc('memora_run_update', {
    p_case_id: caseId,
    p_base: u.base || null,
    p_programme: programme,
    p_stop_times: stopTimes,
    p_set_live: setLive,
    p_live_key: setLive ? (u.liveKey ? String(u.liveKey).slice(0, 80) : null) : null,
  });
  if (!error) return 'ok';
  if (error.code === '40001' || /stale/.test(error.message)) return 'stale';
  if (error.code === 'P0002') return 'not_found';
  throw new Error(error.message);
}
