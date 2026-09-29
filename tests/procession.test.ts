import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceM, etaRange, formatEta, publicProcession, shouldSend, type ProcessionRecord } from '../src/lib/procession.ts';

const now = new Date('2026-09-29T11:00:00Z');
const rec = (over: Partial<ProcessionRecord> = {}): ProcessionRecord => ({
  status: 'SHARING',
  toStopId: 'cemetery',
  lat: -25.74,
  lng: 28.2,
  accuracy: 12,
  startedAt: '2026-09-29T10:30:00Z',
  expiresAt: '2026-09-29T16:30:00Z',
  positionAt: '2026-09-29T10:59:30Z',
  ...over,
});

test('guests see the latest position of an active share', () => {
  const p = publicProcession(rec(), now);
  assert.equal(p?.state, 'moving');
  assert.ok(p && 'lat' in p && p.lat === -25.74);
});

test('nothing is shown once sharing ends or expires', () => {
  assert.equal(publicProcession(rec({ status: 'ENDED' }), now), null);
  assert.equal(publicProcession(rec({ expiresAt: '2026-09-29T10:59:59Z' }), now), null);
  assert.equal(publicProcession(null, now), null);
});

test('a paused share hides the position; a quiet phone reads as signal lost', () => {
  const paused = publicProcession(rec({ status: 'PAUSED' }), now);
  assert.deepEqual(paused, { state: 'paused', toStopId: 'cemetery' });
  assert.equal(publicProcession(rec({ positionAt: '2026-09-29T10:50:00Z' }), now)?.state, 'signal_lost');
  assert.equal(publicProcession(rec({ lat: null, lng: null, positionAt: null }), now)?.state, 'waiting');
});

test('distance and a broad arrival estimate', () => {
  // Pretoria CBD to Hatfield: about 5 km in a straight line.
  const d = distanceM({ lat: -25.7461, lng: 28.1881 }, { lat: -25.7487, lng: 28.2380 });
  assert.ok(d > 4800 && d < 5200, String(d));
  const eta = etaRange(d)!;
  assert.ok(eta.min >= 5 && eta.max <= 20 && eta.max > eta.min, JSON.stringify(eta));
  assert.equal(formatEta(etaRange(100)), 'Arriving now');
  assert.match(formatEta(etaRange(20_000)), /^About \d+–\d+ minutes$/);
});

test('the phone sends every 15 s, or sooner after moving, never flooding', () => {
  const a = { lat: -25.74, lng: 28.2, at: 0 };
  assert.ok(shouldSend(null, a));
  assert.ok(!shouldSend(a, { ...a, at: 3_000, lat: -25.75 }), 'never within 5 s');
  assert.ok(!shouldSend(a, { ...a, at: 10_000 }), 'standing still: wait for 15 s');
  assert.ok(shouldSend(a, { ...a, at: 16_000 }));
  assert.ok(shouldSend(a, { lat: -25.741, lng: 28.2, at: 6_000 }), 'moved ~110 m');
});
