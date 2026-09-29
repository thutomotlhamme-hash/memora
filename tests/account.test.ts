import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountLabel, isPhoneLogin, localCellphone, loginAddress, normaliseCellphone, phoneLoginEmail } from '../src/lib/account-id.ts';

test('South African cellphones in every common format become one account', () => {
  for (const v of ['072 123 4567', '0721234567', '+27 72 123 4567', '27721234567', '072-123-4567', '0027721234567']) {
    assert.equal(normaliseCellphone(v), '27721234567', v);
  }
  assert.equal(normaliseCellphone('060 123 4567'), '27601234567');
  assert.equal(normaliseCellphone('083 123 4567'), '27831234567');
});

test('landlines, short numbers and nonsense are refused', () => {
  assert.equal(normaliseCellphone('012 345 6789'), null, 'Pretoria landline');
  assert.equal(normaliseCellphone('011 123 4567'), null, 'Johannesburg landline');
  assert.equal(normaliseCellphone('072 123'), null);
  assert.equal(normaliseCellphone('hello'), null);
  assert.equal(normaliseCellphone(''), null);
});

test('login accepts a cellphone number or an email', () => {
  assert.deepEqual(loginAddress('072 123 4567'), { email: '27721234567@phone.memora.local', kind: 'phone' });
  assert.deepEqual(loginAddress(' Thuto@Example.com '), { email: 'thuto@example.com', kind: 'email' });
  assert.equal(loginAddress('not an email@'), null);
  assert.equal(loginAddress('12345'), null);
});

test('phone accounts are shown as numbers, never as the internal address', () => {
  const email = phoneLoginEmail('27721234567');
  assert.ok(isPhoneLogin(email));
  assert.equal(accountLabel(email), '+27 72 123 4567');
  assert.equal(accountLabel('someone@example.com'), 'someone@example.com');
  assert.equal(localCellphone('27721234567'), '072 123 4567');
  assert.ok(!isPhoneLogin('someone@example.com'));
});
