import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoDraft } from '../src/lib/demo.ts';
import { liveFuneralState, liveProgrammeState } from '../src/lib/live.ts';
import { capitaliseName, emptyDraft, journeyGate, normaliseDraft, readiness, slugify, type Draft } from '../src/lib/memorial.ts';

const complete = (): Draft => {
  const d = demoDraft(new Date('2026-09-01T09:00:00'));
  d.person.portraitPath = 'case/portrait.jpg';
  return d;
};

test('an empty draft is not ready and lists what is missing', () => {
  const r = readiness(emptyDraft());
  assert.equal(r.complete, false);
  assert.equal(r.pct, 0);
  assert.equal(r.missing.length, 4);
});

test('the demo memorial with a portrait is complete', () => {
  const r = readiness(complete());
  assert.equal(r.complete, true, r.missing.join(', '));
  assert.equal(r.pct, 100);
});

test('burial requires a cemetery stop and cremation a crematorium', () => {
  const d = complete();
  d.journey = d.journey.filter((s) => s.type !== 'cemetery');
  assert.match(journeyGate(d).message, /Cemetery/);
  d.disposition.type = 'cremation';
  assert.match(journeyGate(d).message, /Crematorium/);
  d.disposition.type = 'memorial_only';
  assert.equal(journeyGate(d).ready, true);
  d.disposition = { type: 'other', notes: '' };
  assert.equal(journeyGate(d).ready, false);
});

test('a formal programme needs at least one titled item; "none" is fine', () => {
  const d = complete();
  d.programme = { mode: 'formal', items: [] };
  assert.equal(readiness(d).programme.ready, false);
  d.programme = { mode: 'none', items: [] };
  assert.equal(readiness(d).programme.ready, true);
});

test('normaliseDraft drops malformed stops, bad enums and oversized input', () => {
  const d = normaliseDraft({
    person: { firstName: 'A'.repeat(500), birthDate: 'not-a-date' },
    disposition: { type: 'launch-into-space' },
    journey: [
      { title: 'Good', date: '2026-10-01', time: '10:00:00', lat: -25.7, lng: 28.2, type: 'church' },
      { title: 'No pin', date: '2026-10-01', time: '10:00' },
      { title: 'Off the planet', date: '2026-10-01', time: '10:00', lat: 200, lng: 10 },
      { title: 'Bad type', date: '2026-10-01', time: '11:00', lat: 1, lng: 1, type: 'spaceport' },
    ],
    programme: { mode: 'formal', items: [{ title: '' }, { title: 'Prayer', type: 'prayer' }] },
  });
  assert.equal(d.person.firstName.length, 120);
  assert.equal(d.person.birthDate, '');
  assert.equal(d.disposition.type, '');
  assert.deepEqual(d.journey.map((s) => s.title), ['Good', 'Bad type']);
  assert.equal(d.journey[0].time, '10:00');
  assert.equal(d.journey[1].type, 'other');
  assert.deepEqual(d.programme.items.map((i) => i.title), ['Prayer']);
});

test('name and slug helpers', () => {
  assert.equal(capitaliseName("o'neil van der merwe-smith"), "O'Neil Van Der Merwe-Smith");
  assert.equal(slugify('Zoë  Ndlovu!'), 'zoe-ndlovu');
});

const at = (hhmm: string) => new Date(`2026-09-01T${hhmm}:00`);

test('Live Funeral Mode follows the clock through the day', () => {
  const j = complete().journey; // 10:00 church (departs 11:45), 12:30 cemetery (departs 13:30), 14:00 reception
  assert.equal(liveFuneralState(j, at('08:30')).phase, 'before_start');
  const s1 = liveFuneralState(j, at('10:15'));
  assert.equal(s1.phase, 'at_stop');
  assert.equal(s1.phase === 'at_stop' && s1.currentStop.title, 'Celebration service');
  assert.equal(liveFuneralState(j, at('12:00')).phase, 'in_transit');
  assert.equal(liveFuneralState(j, at('12:45')).phase, 'at_stop');
  assert.equal(liveFuneralState(j, at('15:30')).phase, 'concluded_today');
});

test('Live Funeral Mode before, between and after funeral days', () => {
  const j = complete().journey.map((s, i) => ({ ...s, date: i === 0 ? '2026-09-05' : '2026-09-07' }));
  const up = liveFuneralState(j, at('09:00'));
  assert.equal(up.phase, 'upcoming');
  assert.equal(up.phase === 'upcoming' && up.daysUntil, 4);
  assert.equal(liveFuneralState(j, new Date('2026-09-06T09:00:00')).phase, 'between');
  assert.equal(liveFuneralState(j, new Date('2026-09-09T09:00:00')).phase, 'concluded');
  assert.equal(liveFuneralState([], at('09:00')).phase, 'none');
});

test('live programme shows the current and next timed items', () => {
  const p = complete().programme;
  const s = liveProgrammeState(p, at('10:12'));
  assert.equal(s?.current?.title, 'Psalm 23');
  assert.equal(s?.next?.title, 'Amazing Grace');
  assert.equal(liveProgrammeState({ mode: 'none', items: [] }, at('10:12')), null);
});
