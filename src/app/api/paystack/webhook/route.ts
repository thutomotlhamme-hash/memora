import { getAdminSupabase } from '@/lib/supabase/admin';
import { json } from '@/lib/server/http';
import { confirmOrderWithPaystack, paystackSecret, verifySignature } from '@/lib/server/paystack';

/**
 * Paystack webhook. Set this URL in Paystack → Settings → API Keys & Webhooks
 * (separately for Test and Live mode): https://<site>/api/paystack/webhook
 */
export async function POST(request: Request) {
  const admin = getAdminSupabase();
  if (!paystackSecret() || !admin) return json({ error: 'Not configured' }, 503);

  const rawBody = await request.text();
  const valid = await verifySignature(rawBody, request.headers.get('x-paystack-signature') ?? '');
  if (!valid) return json({ error: 'Invalid signature' }, 401);

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }
  // Acknowledge every other signed event without acting, so Paystack stops retrying.
  if (event?.event !== 'charge.success' || !event?.data?.reference) return json({ received: true });

  try {
    const result = await confirmOrderWithPaystack(admin, String(event.data.reference), event);
    if (result === 'mismatch') return json({ error: 'Verification mismatch' }, 409);
    return json({ received: true, result });
  } catch (error) {
    console.error('Paystack webhook error', error);
    return json({ error: 'Could not verify transaction' }, 502);
  }
}
