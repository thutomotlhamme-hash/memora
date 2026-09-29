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
  assert.match(journeyGate(d).message, /cemetery/);
  d.disposition.type = 'cremation';
  assert.match(journeyGate(d).message, /crematorium/);
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
  const last = liveFuneralState(j, at('15:30'));
  assert.equal(last.phase, 'at_stop', 'the reception is still on');
  assert.equal(last.phase === 'at_stop' && last.nextStop, null);
  assert.equal(liveFuneralState(j, at('17:30')).phase, 'concluded_today');
});

test('a night vigil on its own is live for the evening', () => {
  const vigil = { ...complete().journey[0], id: 'v', date: '2026-09-01', type: 'vigil' as const, title: 'Night vigil', time: '18:00', departTime: '' };
  assert.equal(liveFuneralState([vigil], at('17:00')).phase, 'before_start');
  assert.equal(liveFuneralState([vigil], at('19:30')).phase, 'at_stop');
  assert.equal(liveFuneralState([vigil], at('23:30')).phase, 'at_stop', 'vigils run late');
  assert.equal(liveFuneralState([{ ...vigil, departTime: '21:00' }], at('22:30')).phase, 'concluded_today');
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

import { signYocoPayload, verifyYocoSignature } from '../src/lib/yoco-signature.ts';

test('Yoco webhook signatures: valid, tampered, stale and multi-signature headers', async () => {
  const secret = `whsec_${Buffer.from('memora-test-secret-32-bytes-long!').toString('base64')}`;
  const body = JSON.stringify({ type: 'payment.succeeded', payload: { metadata: { checkoutId: 'ch_123' } } });
  const now = 1_790_000_000;
  const ts = String(now);
  const sig = await signYocoPayload(secret, 'msg_1', ts, body);
  const h = (signature: string, timestamp = ts) => ({ id: 'msg_1', timestamp, signature });

  assert.equal(await verifyYocoSignature(secret, h(`v1,${sig}`), body, now), true);
  assert.equal(await verifyYocoSignature(secret, h(`v1,bogus v1,${sig}`), body, now), true);
  assert.equal(await verifyYocoSignature(secret, h(`v1,${sig}`), body.replace('ch_123', 'ch_999'), now), false);
  assert.equal(await verifyYocoSignature(secret, h(`v1,${sig}`), body, now + 600), false);
  assert.equal(await verifyYocoSignature('whsec_b3RoZXI=', h(`v1,${sig}`), body, now), false);
  assert.equal(await verifyYocoSignature(secret, { id: null, timestamp: ts, signature: `v1,${sig}` }, body, now), false);
});

import { PRICE_LABEL, PRODUCT, archiveDate } from '../src/lib/plans.ts';

test('single product: price and one-year public period', () => {
  assert.equal(PRICE_LABEL, 'R899');
  assert.equal(PRODUCT.publicDays, 365);
  assert.equal(archiveDate(new Date('2026-10-01T00:00:00Z')), '2027-10-01T00:00:00.000Z');
});

import { daysUntil, splitName, validateGift } from '../src/lib/gift.ts';
import { formatWhatsApp, normaliseWhatsApp } from '../src/lib/phone.ts';

test('WhatsApp numbers normalise to international digits', () => {
  assert.equal(normaliseWhatsApp('082 123 4567'), '27821234567');
  assert.equal(normaliseWhatsApp('+27 (82) 123-4567'), '27821234567');
  assert.equal(normaliseWhatsApp('0027821234567'), '27821234567');
  assert.equal(normaliseWhatsApp('+44 7700 900123'), '447700900123');
  assert.equal(normaliseWhatsApp('12345'), null);
  assert.equal(normaliseWhatsApp('+27 82 123 45'), null);
  assert.equal(formatWhatsApp('27821234567'), '+27 82 123 4567');
});

test('gift form validation', () => {
  const today = new Date('2026-10-01T09:00:00');
  const good = {
    buyerName: 'Thabo', buyerEmail: 'THABO@example.com', recipientName: 'Lerato', recipientEmail: '', recipientWhatsapp: '0821234567',
    lovedOneName: 'Naledi Mokoena', message: 'Thinking of you', funeralDate: '2026-10-05', funeralDateUnsure: false,
  };
  const ok = validateGift(good, today);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.gift.buyerEmail, 'thabo@example.com');
    assert.equal(ok.gift.recipientWhatsapp, '27821234567');
    assert.equal(ok.gift.recipientEmail, null);
  }
  const noContact = validateGift({ ...good, recipientWhatsapp: '' }, today);
  assert.equal(noContact.ok, false);
  assert.ok(!noContact.ok && noContact.errors.recipientWhatsapp);
  const past = validateGift({ ...good, funeralDate: '2026-09-20' }, today);
  assert.ok(!past.ok && past.errors.funeralDate);
  const unsure = validateGift({ ...good, funeralDate: '', funeralDateUnsure: true }, today);
  assert.ok(unsure.ok && unsure.gift.funeralDate === null);
  const noDate = validateGift({ ...good, funeralDate: '' }, today);
  assert.ok(!noDate.ok && noDate.errors.funeralDate);
});

test('gift helpers', () => {
  assert.deepEqual(splitName('Naledi Grace Mokoena'), { firstName: 'Naledi Grace', lastName: 'Mokoena' });
  assert.deepEqual(splitName('Naledi'), { firstName: 'Naledi', lastName: '' });
  assert.equal(daysUntil('2026-10-04', new Date('2026-10-01T22:00:00')), 3);
  assert.equal(daysUntil(null), null);
});

test('stops must follow in time order', async () => {
  const { journeyOrderProblem } = await import('../src/lib/memorial.ts');
  const s = (title: string, date: string, time: string, departTime = '') => ({ title, date, time, departTime });
  assert.equal(journeyOrderProblem([s('Home', '2026-10-03', '08:00', '09:00'), s('Church', '2026-10-03', '10:00', '11:45'), s('Cemetery', '2026-10-03', '12:30')]), null);
  // Starts before the previous stop ends.
  assert.match(journeyOrderProblem([s('Church', '2026-10-03', '10:00', '11:45'), s('Cemetery', '2026-10-03', '11:30')]) ?? '', /Cemetery.*11:30.*ends at 11:45/);
  // Earlier than the previous start.
  assert.ok(journeyOrderProblem([s('Church', '2026-10-03', '10:00'), s('Home', '2026-10-03', '08:00')]));
  // A later day is fine even with an earlier clock time.
  assert.equal(journeyOrderProblem([s('Vigil', '2026-10-02', '19:00', '22:00'), s('Church', '2026-10-03', '08:00')]), null);
  // An earlier day is not.
  assert.ok(journeyOrderProblem([s('Church', '2026-10-03', '10:00'), s('Vigil', '2026-10-02', '19:00')]));
  // Touching is fine: the next stop may start exactly when the last one ends.
  assert.equal(journeyOrderProblem([s('Church', '2026-10-03', '10:00', '12:00'), s('Cemetery', '2026-10-03', '12:00')]), null);
  const d = complete();
  d.journey = [...d.journey].reverse();
  assert.equal(journeyGate(d).ready, false);
});
