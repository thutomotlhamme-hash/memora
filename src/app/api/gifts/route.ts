import { paymentsOn } from '@/lib/config';
import { validateGift } from '@/lib/gift';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';
import { startGiftCheckout } from '@/lib/server/gifts';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { linkSecret } from '@/lib/server/links';
import { checkoutProvider } from '@/lib/server/payments';

/** Buy a memorial as a gift. No account needed; the price comes from the server. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  if (!paymentsOn) return fail('Gifting opens soon. For now, anyone can create and publish a memorial for free.', 503);
  const admin = getAdminSupabase();
  const simulate = process.env.MEMORA_SIMULATE_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';
  if (!admin || !linkSecret() || (!checkoutProvider() && !simulate)) return fail('Gifting isn’t switched on yet. Please try again soon.', 503);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.website) return fail('Invalid request.', 400); // `website` is a honeypot field bots fill in
  const result = validateGift(body);
  if (!result.ok) return fail('Please check the highlighted fields.', 400, { errors: result.errors });

  const user = await getSessionUser();
  try {
    const url = await startGiftCheckout(admin, result.gift, user?.id ?? null);
    return json({ url });
  } catch (err) {
    console.error('Gift checkout error', err);
    return fail('Could not open checkout. Please try again.', 502);
  }
}
