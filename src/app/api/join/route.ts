import { acceptInvite } from '@/lib/server/invites';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';

/** Uses an onboarding or family link for the signed-in person. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  if (!admin) return fail('Memora isn’t fully set up yet.', 503);
  const user = await getSessionUser();
  if (!user) return fail('Please log in to continue.', 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body?.token !== 'string') return fail('This link isn’t valid. Ask for a new one.', 400);
  try {
    const out = await acceptInvite(admin, user, body.token, body);
    return out.ok ? json({ redirect: out.redirect }) : fail(out.error, out.status);
  } catch (err) {
    console.error('Join failed', err);
    return fail('Something went wrong. Please try again.', 500);
  }
}
