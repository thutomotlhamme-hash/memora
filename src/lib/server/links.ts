import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

// Gift links are signed rather than stored: token = <giftId>.<HMAC(secret, purpose:giftId)>.
// Nothing secret sits in the database, and a gift's status (not the token) decides
// whether a link still works.

type Purpose = 'redeem' | 'buyer';

export function linkSecret(): string {
  return process.env.MEMORA_LINK_SECRET ?? '';
}

function mac(purpose: Purpose, id: string): string {
  return createHmac('sha256', linkSecret()).update(`${purpose}:${id}`).digest('base64url');
}

export function signGiftToken(purpose: Purpose, giftId: string): string {
  if (!linkSecret()) throw new Error('MEMORA_LINK_SECRET is not set');
  return `${giftId}.${mac(purpose, giftId)}`;
}

/** Returns the gift id when the token is genuine for this purpose, otherwise null. */
export function verifyGiftToken(purpose: Purpose, token: string | null | undefined): string | null {
  if (!linkSecret() || !token) return null;
  const [id, sig] = String(token).split('.');
  if (!id || !sig || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = Buffer.from(mac(purpose, id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}
