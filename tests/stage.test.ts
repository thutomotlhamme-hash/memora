import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FUNERAL_ENDED } from '../src/lib/live.ts';
import { vigilTemplate, type Draft, type Stop } from '../src/lib/memorial.ts';
import { stageView } from '../src/lib/stage.ts';

const stop = (id: string, type: Stop['type'], date: string, time: string, departTime = ''): Stop => ({
  id, type, title: id, date, time, departTime, address: '', landmark: '', parking: '', transport: '', notes: '', lat: -25.7, lng: 28.2,
});
const journey = [
  stop('vigil', 'vigil', '2026-10-02', '18:00'),
  stop('church', 'church', '2026-10-03', '09:00', '11:00'),
  stop('cemetery', 'cemetery', '2026-10-03', '11:30', '12:30'),
  stop('home', 'home', '2026-10-03', '13:00'),
  stop('tears', 'aftertears', '2026-10-03', '17:00'),
];
const programme: Draft['programme'] = {
  mode: 'formal',
  items: [...vigilTemplate('prayer', { arrival: '18:00', name: 'Mma', scripture: true }), { id: 's1', part: 'service', type: 'prayer', time: '09:00', title: 'Opening prayer', presenter: '', detail: '' }],
};
const at = (d: string, t: string) => new Date(`${d}T${t}:00`);

test('the vigil template opens with the arrival home; scripture is optional', () => {
  const withScripture = vigilTemplate('prayer', { arrival: '19:00', name: 'Mma Naledi', scripture: true });
  assert.equal(withScripture[0].type, 'arrival');
  assert.equal(withScripture[0].time, '19:00');
  assert.match(withScripture[0].title, /Mma Naledi arrives home/);
  assert.ok(withScripture.every((i) => i.part === 'vigil'));
  assert.ok(withScripture.some((i) => i.type === 'scripture'));
  assert.ok(!vigilTemplate('night', { scripture: false }).some((i) => i.type === 'scripture'));
});

test('the vigil night shows the vigil, then a thank-you once the coordinator finishes it', () => {
  const live = stageView(journey, programme, programme.items[1].id, at('2026-10-02', '18:40'));
  assert.equal(live?.mode, 'now');
  assert.equal(live?.vigil, true);
  assert.equal(live?.programme?.current?.id, programme.items[1].id);
  const done = stageView(journey, programme, 'ended:vigil', at('2026-10-02', '20:00'));
  assert.equal(done?.mode, 'vigil_ended');
  assert.equal(done?.after?.id, 'church');
});

test('last night’s vigil item, never finished, does not take over the funeral morning', () => {
  const v = stageView(journey, programme, programme.items[2].id, at('2026-10-03', '09:10'));
  assert.equal(v?.mode, 'now');
  assert.equal(v?.focus?.id, 'church');
  assert.equal(v?.programme?.current?.id, 's1');
});

test('after the funeral ends, guests are pointed to the refreshments, then the after-tears', () => {
  const early = stageView(journey, programme, FUNERAL_ENDED, at('2026-10-03', '12:40'));
  assert.equal(early?.mode, 'after');
  assert.equal(early?.focus?.id, 'home');
  assert.equal(early?.arrived, false);
  assert.equal(early?.after?.id, 'tears');
  const eating = stageView(journey, programme, FUNERAL_ENDED, at('2026-10-03', '14:00'));
  assert.equal(eating?.arrived, true);
  const tears = stageView(journey, programme, FUNERAL_ENDED, at('2026-10-03', '18:00'));
  assert.equal(tears?.focus?.id, 'tears');
  assert.equal(tears?.after, null);
});

test('a started item is broadcast even with no journey stop on right now', () => {
  const v = stageView([], programme, 's1', at('2026-10-03', '09:00'));
  assert.equal(v?.mode, 'broadcast');
  assert.equal(v?.programme?.current?.id, 's1');
});

test('each part of the programme shows its date and start time', async () => {
  const { partStart, partStartLabel } = await import('../src/lib/memorial.ts');
  assert.deepEqual(partStart(journey, programme.items, 'vigil'), { date: '2026-10-02', time: '18:00', place: 'vigil' });
  assert.equal(partStart(journey, programme.items, 'graveside')?.time, '11:30');
  // No vigil stop: the vigil is the evening before the funeral, at its first item's time.
  const noVigilStop = journey.filter((s) => s.type !== 'vigil');
  assert.deepEqual(partStart(noVigilStop, programme.items, 'vigil'), { date: '2026-10-02', time: '18:00', place: '' });
  assert.match(partStartLabel(partStart(journey, programme.items, 'service')), /3 October · from 09:00 · church/);
});

test('the journey timeline follows the day: past, now, and the road between', async () => {
  const { journeyProgress } = await import('../src/lib/stage.ts');
  const day = '2026-10-03';
  const s = (id: string, type: string, time: string, departTime: string, lat: number, lng: number) =>
    ({ id, type, title: id, date: day, time, departTime, address: '', landmark: '', parking: '', transport: '', notes: '', lat, lng }) as never;
  const journey = [s('church', 'church', '08:00', '10:30', -26.0, 28.0), s('grave', 'cemetery', '11:00', '12:00', -26.1, 28.0), s('home', 'reception', '13:00', '', -26.2, 28.0)];
  const at = (hhmm: string) => new Date(`${day}T${hhmm}:00`);

  const service = journeyProgress(journey, at('09:00'));
  assert.equal(service.now, 'church');
  assert.equal(service.moving, null);

  const road = journeyProgress(journey, at('10:45'));
  assert.deepEqual(road.moving?.from, 'church');
  assert.equal(road.moving?.to, 'grave');
  assert.ok(road.past.has('church'));
  assert.ok(Math.abs((road.moving?.progress ?? 0) - 0.5) < 0.05, 'halfway by the clock');

  // A shared procession wins, and fills the line by distance.
  const shared = journeyProgress(journey, at('10:00'), { state: 'moving', toStopId: 'grave', lat: -26.075, lng: 28.0 });
  assert.equal(shared.now, null);
  assert.equal(shared.moving?.to, 'grave');
  assert.ok(Math.abs((shared.moving?.progress ?? 0) - 0.75) < 0.05, 'three quarters of the way');

  const done = journeyProgress(journey, at('23:30'));
  assert.ok(done.past.has('home') || done.now === 'home');
});
