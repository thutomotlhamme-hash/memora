// iKhokha (iK Pay API) request signing, as in iKhokha's own examples:
//   IK-SIGN = hex HMAC-SHA256(AppSecret, escape(path + body))
// where path is the URL's path (with any query string), body is the exact JSON
// sent (empty for GET), and escape() puts a backslash before \ " ' and turns
// NUL into \0. Pure Web Crypto so it runs in Next.js and in `npm test`.

export function payloadToSign(url: string, body = ''): string {
  const u = new URL(url, 'https://api.ikhokha.com');
  return `${u.pathname}${u.search}${body}`.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

export async function signIkhokha(secret: string, url: string, body = ''): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.trim()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadToSign(url, body)));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** What a paylink's status means for us. iKhokha reports PAID (status lookups) or SUCCESS (callbacks). */
export function isPaidStatus(status: unknown): boolean {
  return ['PAID', 'SUCCESS', 'COMPLETED'].includes(String(status ?? '').toUpperCase());
}
