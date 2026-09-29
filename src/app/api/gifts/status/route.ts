import { getAdminSupabase } from '@/lib/supabase/admin';
import { buyerGiftView } from '@/lib/server/gifts';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { verifyGiftToken } from '@/lib/server/links';

/** The buyer's view of their gift, authorised by the signed link in their receipt. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  if (!admin) return fail('Not configured.', 503);
  const { token } = ((await request.json().catch(() => ({}))) ?? {}) as { token?: string };
  const giftId = verifyGiftToken('buyer', token);
  if (!giftId) return fail('This link is not valid.', 404);
  const view = await buyerGiftView(admin, giftId);
  if (!view) return fail('Gift not found.', 404);
  return json(view);
}
