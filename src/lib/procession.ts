// Procession tracker. Pure functions shared by the coordinator's phone, the
// server and guests' memorial pages.

/** Sharing stops by itself this long after it started. */
export const SHARING_HOURS = 6;
/** Within this distance of the destination pin, the procession has arrived. */
export const ARRIVAL_RADIUS_M = 150;
/** No position for this long: guests see "signal lost" instead of a stale dot. */
export const STALE_AFTER_MS = 5 * 60_000;

export type ProcessionStatus = 'SHARING' | 'PAUSED' | 'ENDED';

/** What the database holds (one row per memorial, latest position only). */
export interface ProcessionRecord {
  status: ProcessionStatus;
  toStopId: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  positionAt: string | null;
}

/** What guests' pages receive. Null means "nothing to show". */
export type PublicProcession =
  | { state: 'waiting'; toStopId: string | null }
  | { state: 'moving'; toStopId: string | null; lat: number; lng: number; positionAt: string }
  | { state: 'signal_lost'; toStopId: string | null; positionAt: string | null }
  | { state: 'paused'; toStopId: string | null };

export function isExpired(p: Pick<ProcessionRecord, 'expiresAt'>, now = new Date()): boolean {
  return Boolean(p.expiresAt && new Date(p.expiresAt).getTime() <= now.getTime());
}

/** Guests only ever see the current position of an active, unexpired share. */
export function publicProcession(p: ProcessionRecord | null, now = new Date()): PublicProcession | null {
  if (!p || p.status === 'ENDED' || isExpired(p, now)) return null;
  if (p.status === 'PAUSED') return { state: 'paused', toStopId: p.toStopId };
  if (p.lat == null || p.lng == null || !p.positionAt) return { state: 'waiting', toStopId: p.toStopId };
  if (now.getTime() - new Date(p.positionAt).getTime() > STALE_AFTER_MS) return { state: 'signal_lost', toStopId: p.toStopId, positionAt: p.positionAt };
  return { state: 'moving', toStopId: p.toStopId, lat: p.lat, lng: p.lng, positionAt: p.positionAt };
}

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A deliberately broad arrival estimate. Roads are ~35% longer than a straight
 * line and processions move at 25–45 km/h, so this is a range, never a promise.
 */
export function etaRange(metres: number): { min: number; max: number } | null {
  if (!Number.isFinite(metres) || metres < 0) return null;
  if (metres <= ARRIVAL_RADIUS_M) return { min: 0, max: 0 };
  const road = metres * 1.35;
  const minutes = (kmh: number) => (road / 1000 / kmh) * 60;
  const round = (m: number) => (m < 10 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5);
  const min = round(minutes(45));
  const max = Math.max(min + (min < 10 ? 2 : 5), round(minutes(25)));
  return { min, max };
}

export function formatEta(range: { min: number; max: number } | null): string {
  if (!range) return '';
  if (range.max === 0) return 'Arriving now';
  return `About ${range.min}–${range.max} minutes`;
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** Should the phone send this fix? Every 15 s, or sooner after moving 75 m (never faster than every 5 s). */
export function shouldSend(last: { lat: number; lng: number; at: number } | null, next: { lat: number; lng: number; at: number }): boolean {
  if (!last) return true;
  const elapsed = next.at - last.at;
  if (elapsed < 5_000) return false;
  return elapsed >= 15_000 || distanceM(last, next) >= 75;
}
