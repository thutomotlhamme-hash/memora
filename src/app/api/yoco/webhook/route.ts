import { getAdminSupabase } from '@/lib/supabase/admin';
import { json } from '@/lib/server/http';
import { confirmGiftWithYoco } from '@/lib/server/gifts';
import { confirmOrderWithYoco, yocoSecret } from '@/lib/server/yoco';
import { verifyYocoSignature } from '@/lib/yoco-signature';

/**
 * Yoco webhook. Register https://<site>/api/yoco/webhook with
 * `node scripts/register-yoco-webhook.mjs` (see README) and put the returned
 * `whsec_…` secret in YOCO_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const admin = getAdminSupabase();
  const webhookSecret = process.env.YOCO_WEBHOOK_SECRET ?? '';
  if (!yocoSecret() || !webhookSecret || !admin) return json({ error: 'Not configured' }, 503);

  const rawBody = await request.text();
  const valid = await verifyYocoSignature(
    webhookSecret,
    {
      id: request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    rawBody,
  );
  if (!valid) return json({ error: 'Invalid signature' }, 401);

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }
  // Acknowledge everything else (e.g. payment.failed) without acting, so Yoco stops retrying.
  const checkoutId = event?.payload?.metadata?.checkoutId;
  if (event?.type !== 'payment.succeeded' || !checkoutId) return json({ received: true });

  try {
    // A checkout pays either for a memorial (an order) or for a gift.
    let result: string = await confirmOrderWithYoco(admin, String(checkoutId), event);
    if (result === 'no_order') result = await confirmGiftWithYoco(admin, String(checkoutId));
    if (result === 'mismatch') return json({ error: 'Verification mismatch' }, 409);
    // Yoco retries non-2xx deliveries; ask it to try again if the checkout hasn't settled yet.
    if (result === 'pending') return json({ error: 'Checkout not completed yet' }, 503);
    return json({ received: true, result });
  } catch (error) {
    console.error('Yoco webhook error', error);
    return json({ error: 'Could not verify checkout' }, 502);
  }
}
