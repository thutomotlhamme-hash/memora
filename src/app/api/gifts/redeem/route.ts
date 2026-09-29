import { getAdminSupabase } from '@/lib/supabase/admin';
import { redeemGift } from '@/lib/server/gifts';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { verifyGiftToken } from '@/lib/server/links';

/** Claims a gift for the signed-in user and creates their paid memorial. */
export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const admin = getAdminSupabase();
  if (!admin) return fail('Not configured.', 503);
  const { token } = ((await request.json().catch(() => ({}))) ?? {}) as { token?: string };
  const giftId = verifyGiftToken('redeem', token);
  if (!giftId) return fail('This gift link is not valid.', 404);
  const result = await redeemGift(auth.user, auth.supabase, admin, giftId);
  if ('error' in result) return fail(result.error, result.status);
  return json({ id: result.caseId }, 201);
}
