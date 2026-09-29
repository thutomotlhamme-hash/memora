/** Only allow same-site relative redirects (blocks //evil.com and absolute URLs). */
export function safeNext(value: string | null | undefined, fallback = '/memorials'): string {
  const v = String(value ?? '');
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : fallback;
}
