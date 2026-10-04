import { getAdminSupabase } from '@/lib/supabase/admin';
import { json } from '@/lib/server/http';
import { ikhokhaOn } from '@/lib/server/ikhokha';
import { confirmGift, confirmOrder } from '@/lib/server/payments';
import { noteTestCallback } from '@/lib/server/test-payments';

/**
 * iKhokha's callback after a payment attempt: { paylinkID, status, externalTransactionID, responseCode }.
 * Its body is only a hint. We look the paylink up with iKhokha ourselves (a
 * signed request with our secret) and act only on that answer, so a forged or
 * replayed callback can't mark anything paid. Memora sends this address with
 * every payment; nothing to set up in the iKhokha dashboard.
 */
export async function POST(request: Request) {
  const admin = getAdminSupabase();
  if (!ikhokhaOn() || !admin) return json({ error: 'Not configured' }, 503);

  const body = (await request.json().catch(() => null)) as { paylinkID?: unknown } | null;
  const paylinkId = typeof body?.paylinkID === 'string' ? body.paylinkID.trim() : '';
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(paylinkId)) return json({ error: 'Invalid payload' }, 400);

  try {
    // A paylink pays either for a memorial (an order) or for a gift.
    let result: string = await confirmOrder(admin, 'ikhokha', paylinkId, { source: 'ikhokha-callback', callback: body });
    if (result === 'no_order') result = await confirmGift(admin, 'ikhokha', paylinkId);
    // The team's own test payment (command centre → Payments): just noted.
    if (result === 'no_gift' && (await noteTestCallback(admin, paylinkId, body))) result = 'test';
    if (result === 'mismatch') return json({ error: 'Verification mismatch' }, 409);
    // A failed or abandoned attempt: acknowledge it; nothing to do.
    return json({ received: true, result });
  } catch (error) {
    console.error('iKhokha callback error', error);
    return json({ error: 'Could not verify payment' }, 502);
  }
}
