import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseDraft, programmeParts, programmeReleased, sortByPart, type ProgrammeItem } from '../src/lib/memorial.ts';

const item = (id: string, part?: ProgrammeItem['part']): ProgrammeItem => ({ id, part, type: 'prayer', time: '', title: id, presenter: '', detail: '' });

test('older programmes without parts are the main service', () => {
  const d = normaliseDraft({ programme: { mode: 'formal', items: [{ id: 'a', type: 'prayer', title: 'Prayer' }, { id: 'b', part: 'nonsense', type: 'hymn', title: 'Hymn' }] } });
  assert.deepEqual(d.programme.items.map((i) => i.part), ['service', 'service']);
});

test('the programme reads vigil → service → graveside, each part in its own order', () => {
  const items = [item('s1'), item('g1', 'graveside'), item('v1', 'vigil'), item('s2'), item('v2', 'vigil'), item('g2', 'graveside')];
  assert.deepEqual(programmeParts(items).map((g) => [g.part, g.items.map((i) => i.id)]), [
    ['vigil', ['v1', 'v2']],
    ['service', ['s1', 's2']],
    ['graveside', ['g1', 'g2']],
  ]);
  assert.deepEqual(sortByPart(items).map((i) => i.id), ['v1', 'v2', 's1', 's2', 'g1', 'g2']);
  assert.deepEqual(programmeParts([item('s1')]).map((g) => g.part), ['service']);
});

test('the family can hold the programme back until a set time', () => {
  const now = new Date('2026-10-03T03:00:00Z');
  assert.equal(programmeReleased({ releaseAt: '' }, now), true);
  assert.equal(programmeReleased({ releaseAt: '2026-10-03T04:00:00Z' }, now), false, 'before 06:00 SAST');
  assert.equal(programmeReleased({ releaseAt: '2026-10-03T04:00:00Z' }, new Date('2026-10-03T04:00:00Z')), true);
  const d = normaliseDraft({ programme: { mode: 'formal', releaseAt: 'not a date', items: [] } });
  assert.equal(d.programme.releaseAt, '');
  assert.equal(normaliseDraft({ programme: { releaseAt: '2026-10-03T06:00:00+02:00' } }).programme.releaseAt, '2026-10-03T04:00:00.000Z');
});

test('the vigil never shows as "now" on the service day, and vice versa', async () => {
  const { liveProgrammeState } = await import('../src/lib/live.ts');
  const t = (hhmm: string) => new Date(`2026-10-03T${hhmm}:00`);
  const programme = {
    mode: 'formal' as const,
    items: [
      { ...item('Candle lighting', 'vigil'), time: '19:20' },
      { ...item('Opening prayer'), time: '10:00' },
      { ...item('Eulogy'), time: '11:00' },
      { ...item('Committal', 'graveside'), time: '12:30' },
    ],
  };
  assert.equal(liveProgrammeState(programme, t('10:12'))?.current?.id, 'Opening prayer');
  assert.equal(liveProgrammeState(programme, t('12:40'))?.current?.id, 'Committal');
  assert.equal(liveProgrammeState(programme, t('19:30'))?.current?.id, 'Committal', 'service day evening: vigil items ignored');
  assert.equal(liveProgrammeState(programme, t('19:30'), null, ['vigil'])?.current?.id, 'Candle lighting');
});
