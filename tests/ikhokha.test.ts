import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { isPaidStatus, payloadToSign, signIkhokha } from '../src/lib/ikhokha-signature.ts';
import { matches, type Lookup } from '../src/lib/payment-match.ts';

// iKhokha's own sample (ik-pay-api-examples), with node's crypto in place of crypto-js.
function theirSign(secret: string, endpoint: string, body = ''): string {
  const payload = (new URL(endpoint).pathname + body).replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
  return createHmac('sha256', secret.trim()).update(payload).digest('hex');
}

test('payment-link requests are signed exactly as iKhokha’s examples sign them', async () => {
  const endpoint = 'https://api.ikhokha.com/public-api/v1/api/payment';
  const body = JSON.stringify({ entityID: 'APP', amount: 89900, currency: 'ZAR', description: "Thabo's memorial", urls: { callbackUrl: 'https://x.example/api/ikhokha/webhook' } });
  assert.equal(await signIkhokha('s3cret', endpoint, body), theirSign('s3cret', endpoint, body));
  assert.ok(payloadToSign(endpoint, body).startsWith('/public-api/v1/api/payment{\\"entityID\\"'), 'quotes are escaped');
  assert.ok(payloadToSign(endpoint, body).includes("Thabo\\'s"), 'apostrophes are escaped');
});

test('status lookups sign the path alone; a stray space around the secret changes nothing', async () => {
  const url = 'https://api.ikhokha.com/public-api/v1/api/getStatus/2iyxyzdh80';
  assert.equal(await signIkhokha('  s3cret ', url), theirSign('s3cret', url));
  assert.notEqual(await signIkhokha('other', url), theirSign('s3cret', url));
});

test('only PAID or SUCCESS counts as paid', () => {
  for (const s of ['PAID', 'paid', 'SUCCESS']) assert.equal(isPaidStatus(s), true, s);
  for (const s of ['FAILURE', 'PENDING', 'CREATED', '', undefined, null]) assert.equal(isPaidStatus(s), false, String(s));
});

test('a payment counts only if it is ours, to the cent, in rand', () => {
  const ik = (o: Partial<Lookup> = {}): Lookup => ({ paid: true, id: 'pl1', amountMinor: 89900, currency: null, paymentId: 'pl1', ref: {}, ...o });
  const order = { id: 'pl1', reference: 'order-1', kind: 'order' as const, amountMinor: 89900, currency: 'ZAR' };
  assert.equal(matches(ik(), order), true);
  assert.equal(matches(ik({ ref: { any: 'order-1' } }), order), true);
  assert.equal(matches(ik({ amountMinor: 100 }), order), false, 'a cheaper payment never unlocks');
  assert.equal(matches(ik({ id: 'pl2' }), order), false, 'another paylink');
  assert.equal(matches(ik({ ref: { any: 'order-2' } }), order), false, 'paid for something else');
  assert.equal(matches(ik(), { ...order, currency: 'USD' }), false, 'no currency means rand only');
  const yoco: Lookup = { paid: true, id: 'ch_1', amountMinor: 89900, currency: 'ZAR', paymentId: 'p_1', ref: { giftId: 'gift-1' } };
  assert.equal(matches(yoco, { id: 'ch_1', reference: 'gift-1', kind: 'gift', amountMinor: 89900, currency: 'ZAR' }), true);
  assert.equal(matches(yoco, { id: 'ch_1', reference: 'gift-2', kind: 'gift', amountMinor: 89900, currency: 'ZAR' }), false);
});
