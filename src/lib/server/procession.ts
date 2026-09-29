import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { SHARING_HOURS, isExpired, publicProcession, type ProcessionRecord } from '../procession';

const COLUMNS = 'status,to_stop_key,latitude,longitude,accuracy_m,started_at,expires_at,position_at';

type Row = {
  status: ProcessionRecord['status'];
  to_stop_key: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  accuracy_m: number | null;
  started_at: string | null;
  expires_at: string | null;
  position_at: string | null;
};

const num = (v: number | string | null) => (v == null ? null : Number(v));
const toRecord = (r: Row): ProcessionRecord => ({
  status: r.status,
  toStopId: r.to_stop_key,
  lat: num(r.latitude),
  lng: num(r.longitude),
  accuracy: r.accuracy_m,
  startedAt: r.started_at,
  expiresAt: r.expires_at,
  positionAt: r.position_at,
});

const CLEARED = { status: 'ENDED', latitude: null, longitude: null, accuracy_m: null, position_at: null, expires_at: null } as const;

/** The current share. An expired one is ended (and its position erased) on read. */
export async function loadProcession(admin: SupabaseClient, caseId: string): Promise<ProcessionRecord | null> {
  const { data } = await admin.from('memora_procession').select(COLUMNS).eq('case_id', caseId).maybeSingle();
  if (!data) return null;
  const record = toRecord(data as Row);
  if (record.status !== 'ENDED' && isExpired(record)) {
    await admin.from('memora_procession').update({ ...CLEARED, updated_at: new Date().toISOString() }).eq('case_id', caseId);
    return { ...record, status: 'ENDED', lat: null, lng: null, accuracy: null, positionAt: null, expiresAt: null };
  }
  return record;
}

export async function loadPublicProcession(admin: SupabaseClient, caseId: string) {
  return publicProcession(await loadProcession(admin, caseId));
}

export type ProcessionAction =
  | { action: 'start'; toStopId: string }
  | { action: 'position'; lat: number; lng: number; accuracy?: number }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'end' };

export function parseAction(body: unknown): ProcessionAction | null {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (b.action) {
    case 'start':
      return typeof b.toStopId === 'string' && b.toStopId ? { action: 'start', toStopId: b.toStopId.slice(0, 80) } : null;
    case 'position': {
      const lat = Number(b.lat);
      const lng = Number(b.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      const accuracy = Number(b.accuracy);
      return { action: 'position', lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : undefined };
    }
    case 'pause':
    case 'resume':
    case 'end':
      return { action: b.action };
    default:
      return null;
  }
}

/**
 * Applies a coordinator action. Returns the new record, or an error message
 * the coordinator can act on.
 */
export async function applyProcession(admin: SupabaseClient, caseId: string, a: ProcessionAction): Promise<{ record: ProcessionRecord | null } | { error: string; status: number }> {
  const now = new Date();
  const stamp = now.toISOString();
  const current = await loadProcession(admin, caseId);

  if (a.action === 'start') {
    const { data: stop } = await admin.from('memora_stops').select('stop_key').eq('case_id', caseId).eq('stop_key', a.toStopId).maybeSingle();
    if (!stop) return { error: 'That stop is no longer on the funeral journey. Choose another.', status: 400 };
    const expires = new Date(now.getTime() + SHARING_HOURS * 3_600_000).toISOString();
    const { error } = await admin.from('memora_procession').upsert({
      case_id: caseId,
      status: 'SHARING',
      to_stop_key: a.toStopId,
      latitude: null,
      longitude: null,
      accuracy_m: null,
      position_at: null,
      started_at: stamp,
      expires_at: expires,
      updated_at: stamp,
    });
    if (error) throw new Error(error.message);
    await admin.from('memora_activity_log').insert({ case_id: caseId, action: 'PROCESSION_STARTED', metadata: { to: a.toStopId } });
    return { record: await loadProcession(admin, caseId) };
  }

  if (!current || current.status === 'ENDED') {
    if (a.action === 'end') return { record: current };
    return { error: 'Location sharing has ended. Start it again to share.', status: 409 };
  }

  if (a.action === 'position') {
    if (current.status !== 'SHARING') return { record: current };
    const { error } = await admin
      .from('memora_procession')
      .update({
        latitude: Number(a.lat.toFixed(6)),
        longitude: Number(a.lng.toFixed(6)),
        accuracy_m: a.accuracy != null ? Math.min(100_000, Math.round(a.accuracy)) : null,
        position_at: stamp,
        updated_at: stamp,
      })
      .eq('case_id', caseId)
      .eq('status', 'SHARING');
    if (error) throw new Error(error.message);
  } else if (a.action === 'pause') {
    // Pausing hides the position from guests straight away.
    await admin.from('memora_procession').update({ status: 'PAUSED', latitude: null, longitude: null, accuracy_m: null, position_at: null, updated_at: stamp }).eq('case_id', caseId);
  } else if (a.action === 'resume') {
    await admin.from('memora_procession').update({ status: 'SHARING', updated_at: stamp }).eq('case_id', caseId);
  } else if (a.action === 'end') {
    await admin.from('memora_procession').update({ ...CLEARED, updated_at: stamp }).eq('case_id', caseId);
    await admin.from('memora_activity_log').insert({ case_id: caseId, action: 'PROCESSION_ENDED', metadata: {} });
  }
  return { record: await loadProcession(admin, caseId) };
}
