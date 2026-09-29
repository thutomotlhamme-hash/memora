import 'server-only';

import { NextResponse } from 'next/server';

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (message: string, status: number, extra: Record<string, unknown> = {}) => json({ error: message, ...extra }, status);

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    const allowed = [
      new URL(request.url).host,
      request.headers.get('x-forwarded-host'),
      request.headers.get('host'),
      process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null,
    ];
    return allowed.includes(host);
  } catch {
    return false;
  }
}
