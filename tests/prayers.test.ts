import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datesBetween, emptyPrayers, normaliseDraft, prayerEvenings, prayerEveningFor, prayerStops, withPrayers, type PrayerWeek, type Stop } from '../src/lib/memorial.ts';
import { stageView } from '../src/lib/stage.ts';

const week = (): PrayerWeek => ({
  ...emptyPrayers(),
  enabled: true,
  place: 'Family home',
  address: '14 Jacaranda Street',
  lat: -25.74,
  lng: 28.21,
  time: '18:00',
  endTime: '19:30',
  evenings: prayerEvenings([], '2026-09-28', '2026-10-01'),
});

test('a date range becomes one evening per day, keeping what was filled in', () => {
  assert.deepEqual(datesBetween('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  const w = week();
  w.evenings[1] = { ...w.evenings[1], title: 'A service of comfort', scripture: 'Psalm 23' };
  const moved = prayerEvenings(w.evenings, '2026-09-29', '2026-10-02');
  assert.equal(moved.length, 4);
  assert.equal(moved[0].title, 'A service of comfort');
  assert.equal(moved[3].title, '');
});

test('evenings that are on become stops at the week’s time and place', () => {
  const w = week();
  w.evenings[2].on = false;
  w.evenings[1].time = '18:30';
  const stops = prayerStops(w);
  assert.deepEqual(stops.map((s) => s.date), ['2026-09-28', '2026-09-29', '2026-10-01']);
  assert.equal(stops[1].time, '18:30');
  assert.equal(stops[0].departTime, '19:30');
  assert.equal(stops[0].address, '14 Jacaranda Street');
  assert.equal(prayerEveningFor(w, stops[1].id)?.date, '2026-09-29');
  assert.deepEqual(prayerStops({ ...w, enabled: false }), []);
});

test('prayer weeks survive a round trip through the draft normaliser', () => {
  const w = week();
  w.evenings[0].word = 'Hope';
  const d = normaliseDraft(JSON.parse(JSON.stringify({ prayers: w })));
  assert.equal(d.prayers.enabled, true);
  assert.equal(d.prayers.evenings[0].word, 'Hope');
  assert.ok(Number.isNaN(normaliseDraft({}).prayers.lat));
});

test('on a prayer evening guests see it live, with the next gathering up next', () => {
  const vigil: Stop = { id: 'v', type: 'vigil', title: 'Night vigil', date: '2026-10-02', time: '18:00', departTime: '', address: '', landmark: '', parking: '', transport: '', notes: '', lat: -25.7, lng: 28.2 };
  const w = week();
  w.evenings[1].title = 'The Lord is my shepherd';
  const journey = withPrayers([vigil], w);
  const at = new Date('2026-09-29T18:40:00');
  const v = stageView(journey, { mode: '', items: [] }, null, at);
  assert.equal(v?.mode, 'now');
  assert.equal(v?.focus?.title, 'The Lord is my shepherd');
  assert.equal(v?.after?.date, '2026-09-30');
  const morning = stageView(journey, { mode: '', items: [] }, null, new Date('2026-10-01T09:00:00'));
  assert.equal(morning?.mode, 'before');
  const last = stageView(journey, { mode: '', items: [] }, null, new Date('2026-10-01T18:10:00'));
  assert.equal(last?.after?.id, 'v', 'after the last evening comes the vigil');
});
