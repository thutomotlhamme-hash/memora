import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liveProgrammeState } from '../src/lib/live.ts';
import type { ProgrammeItem, Stop } from '../src/lib/memorial.ts';
import { insertItem, isTimedSequence, moveItem, shiftFrom, shiftTodaysStops, startItem } from '../src/lib/runsheet.ts';

const item = (id: string, time: string): ProgrammeItem => ({ id, type: 'custom', time, title: id, presenter: '', detail: '' });
const service = () => [item('welcome', '10:00'), item('hymn', '10:10'), item('tribute', '10:15'), item('eulogy', '10:35')];
const times = (items: ProgrammeItem[]) => items.map((i) => `${i.id}@${i.time}`);

test('dragging an item re-times the programme so it still reads top to bottom', () => {
  // Tribute (20 min) moves before the hymn (5 min).
  const moved = moveItem(service(), 2, 1);
  assert.deepEqual(times(moved), ['welcome@10:00', 'tribute@10:10', 'hymn@10:30', 'eulogy@10:35']);
  assert.ok(isTimedSequence(moved));
});

test('moving an item in an untimed programme only changes the order', () => {
  const items = [item('a', ''), item('b', ''), item('c', '')];
  assert.deepEqual(
    moveItem(items, 0, 2).map((i) => i.id),
    ['b', 'c', 'a'],
  );
  assert.equal(moveItem(items, 0, 9), items);
});

test('starting an item late pushes everything after it', () => {
  const { items, delay } = startItem(service(), 'hymn', new Date('2026-09-29T10:22:00'), true);
  assert.equal(delay, 12);
  assert.deepEqual(times(items), ['welcome@10:00', 'hymn@10:22', 'tribute@10:27', 'eulogy@10:47']);
});

test('starting an item without shifting only records when it began', () => {
  const { items } = startItem(service(), 'hymn', new Date('2026-09-29T10:22:00'), false);
  assert.deepEqual(times(items), ['welcome@10:00', 'hymn@10:22', 'tribute@10:15', 'eulogy@10:35']);
});

test('running late moves only what is still to come', () => {
  assert.deepEqual(times(shiftFrom(service(), 2, 10)), ['welcome@10:00', 'hymn@10:10', 'tribute@10:25', 'eulogy@10:45']);
  assert.deepEqual(times(shiftFrom(service(), 3, -5)), ['welcome@10:00', 'hymn@10:10', 'tribute@10:15', 'eulogy@10:30']);
});

test('a new item without a time fits in after the item above', () => {
  const next = insertItem(service(), 1, item('poem', ''));
  assert.deepEqual(times(next), ['welcome@10:00', 'hymn@10:10', 'poem@10:15', 'tribute@10:15', 'eulogy@10:35']);
  assert.deepEqual(insertItem(service(), -1, item('prelude', '09:50')).map((i) => i.id)[0], 'prelude');
});

test('the coordinator’s live item wins over the clock for guests', () => {
  const programme = { mode: 'formal' as const, items: service() };
  const byClock = liveProgrammeState(programme, new Date('2026-09-29T10:20:00'));
  assert.equal(byClock?.current?.id, 'tribute');
  const byCoordinator = liveProgrammeState(programme, new Date('2026-09-29T10:20:00'), 'hymn');
  assert.equal(byCoordinator?.current?.id, 'hymn');
  assert.equal(byCoordinator?.next?.id, 'tribute');
  // An unknown key (item since deleted) falls back to the clock.
  assert.equal(liveProgrammeState(programme, new Date('2026-09-29T10:20:00'), 'gone')?.current?.id, 'tribute');
});

test('only today’s later stops move with the programme', () => {
  const stop = (id: string, date: string, time: string, departTime = ''): Stop => ({
    id, type: 'other', title: id, date, time, departTime, address: '', landmark: '', parking: '', transport: '', notes: '', lat: 0, lng: 0,
  });
  const journey = [stop('home', '2026-09-29', '08:00'), stop('church', '2026-09-29', '10:00', '12:00'), stop('cemetery', '2026-09-29', '12:30'), stop('tombstone', '2026-10-30', '09:00')];
  // 10:20, the service is under way: the church keeps its start but leaves later; the cemetery moves; other days don't.
  assert.deepEqual(shiftTodaysStops(journey, '2026-09-29', new Date('2026-09-29T10:20:00'), 15), [
    { id: 'church', time: '10:00', departTime: '12:15' },
    { id: 'cemetery', time: '12:45', departTime: '' },
  ]);
});

test('a start hours away from the plan does not drag everything to midnight', () => {
  const items = [
    { id: 'a', type: 'prayer' as const, time: '10:00', title: 'A', presenter: '', detail: '' },
    { id: 'b', type: 'hymn' as const, time: '10:20', title: 'B', presenter: '', detail: '' },
  ];
  const { items: next, delay } = startItem(items, 'a', new Date('2026-09-01T23:55:00'), true);
  assert.equal(delay, 0);
  assert.equal(next[1].time, '10:20');
});

test('a late vigil never moves the funeral service', () => {
  const items = [
    { id: 'v1', part: 'vigil' as const, type: 'arrival' as const, time: '18:00', title: 'Arrives', presenter: '', detail: '' },
    { id: 'v2', part: 'vigil' as const, type: 'prayer' as const, time: '18:30', title: 'Prayer', presenter: '', detail: '' },
    { id: 's1', type: 'prayer' as const, time: '10:00', title: 'Opening prayer', presenter: '', detail: '' },
  ];
  const { items: next } = startItem(items, 'v1', new Date('2026-09-01T18:20:00'), true);
  assert.deepEqual(next.map((i) => i.time), ['18:20', '18:50', '10:00']);
});

test('starting well ahead of plan pulls the rest earlier by at most half an hour', () => {
  const { items, delay } = startItem(service(), 'hymn', new Date('2026-09-29T09:10:00'), true);
  assert.equal(delay, -30);
  // hymn starts now; the rest move 30 min earlier but never before 09:10.
  assert.deepEqual(times(items), ['welcome@10:00', 'hymn@09:10', 'tribute@09:45', 'eulogy@10:05']);
});

test('after an early start nothing still to come is timed before it', () => {
  const { items } = startItem(service(), 'welcome', new Date('2026-09-29T09:00:00'), true);
  for (const t of times(items).slice(1)) assert.ok(t.split('@')[1] >= '09:00', t);
});
