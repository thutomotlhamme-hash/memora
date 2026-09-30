import { redeemResetLink } from '@/lib/server/accounts';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { getAdminSupabase } from '@/lib/supabase/admin';

/** Chooses a new password with a one-time link from Memora. No login needed: the link is the proof. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  if (!admin) return fail('Memora isn’t fully set up yet.', 503);
  const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  if (typeof body?.token !== 'string' || typeof body.password !== 'string') return fail('This link isn’t valid. Ask Memora for a new one.', 400);
  const out = await redeemResetLink(admin, body.token, body.password);
  return out.ok ? json({ label: out.label }) : fail(out.error, out.status);
}
