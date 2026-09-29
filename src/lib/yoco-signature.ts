// Yoco signs webhooks with the Standard Webhooks scheme:
//   signed content = `${webhook-id}.${webhook-timestamp}.${raw body}`
//   webhook-signature = space-separated "v1,<base64 HMAC-SHA256>" entries
//   key = base64-decoded webhook secret without its "whsec_" prefix
// Pure Web Crypto so it runs in Next.js and in `npm test`.

const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signYocoPayload(secret: string, id: string, timestamp: string, rawBody: string): Promise<string> {
  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ''));
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  return bytesToBase64(new Uint8Array(sig));
}

export async function verifyYocoSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  // Reject stale or future-dated deliveries so a captured webhook can't be replayed.
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  let expected: string;
  try {
    expected = await signYocoPayload(secret, headers.id, headers.timestamp, rawBody);
  } catch {
    return false;
  }
  return headers.signature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean)
    .some((candidate) => constantTimeEqual(candidate, expected));
}
