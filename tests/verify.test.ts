import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CODE_LENGTH, DAILY_LIMIT, HOURLY_LIMIT, RESEND_SECONDS, cleanCode, codeFrom, maskPhone, sendAllowed, smsText } from '../src/lib/verify.ts';

test('codes are always six digits, leading zeros kept', () => {
  assert.equal(codeFrom(new Uint32Array([42])), '000042');
  assert.equal(codeFrom(new Uint32Array([4_294_967_295])).length, CODE_LENGTH);
  for (let i = 0; i < 200; i++) assert.match(codeFrom(crypto.getRandomValues(new Uint32Array(1))), /^\d{6}$/);
});

test('typed or pasted codes are cleaned; anything else is refused', () => {
  assert.equal(cleanCode('123 456'), '123456');
  assert.equal(cleanCode(' 12-34-56 '), '123456');
  assert.equal(cleanCode('12345'), null);
  assert.equal(cleanCode('1234567'), null);
  assert.equal(cleanCode(undefined), null);
});

test('sending: a minute between codes, then hourly and daily caps per number', () => {
  const now = new Date('2026-10-02T10:00:00Z');
  const ago = (s: number) => new Date(now.getTime() - s * 1000);
  assert.deepEqual(sendAllowed([], now), { ok: true });
  const soon = sendAllowed([ago(20)], now);
  assert.equal(soon.ok, false);
  assert.equal(!soon.ok && soon.waitSeconds, RESEND_SECONDS - 20);
  assert.deepEqual(sendAllowed([ago(RESEND_SECONDS + 1)], now), { ok: true });
  const hour = Array.from({ length: HOURLY_LIMIT }, (_, i) => ago(120 + i * 300));
  assert.equal(sendAllowed(hour, now).ok, false, 'five in the last hour is enough');
  const day = Array.from({ length: DAILY_LIMIT }, (_, i) => ago(3_700 + i * 3_600));
  assert.equal(sendAllowed(day, now).ok, false, 'ten in a day is enough');
  assert.deepEqual(sendAllowed(day.slice(0, DAILY_LIMIT - 1), now), { ok: true });
});

test('the SMS says what it is and warns never to share it; numbers are masked on screen', () => {
  const text = smsText('123456');
  assert.match(text, /123456/);
  assert.match(text, /never ask/i);
  assert.ok(text.length <= 160 && /^[\x20-\x7e]+$/.test(text), 'plain text under 160 characters: one SMS, one charge');
  assert.equal(maskPhone('27721234567'), '072 *** 4567');
  assert.ok(!maskPhone('27721234567').includes('123'));
});
