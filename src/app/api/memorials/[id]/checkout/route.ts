import { pricing, siteUrl } from '@/lib/config';
import { readiness } from '@/lib/memorial';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isCasePaid, loadOwnedCase } from '@/lib/server/cases';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { initializeTransaction, paystackSecret } from '@/lib/server/paystack';

type Ctx = { params: Promise<{ id: string }> };

const simulationAllowed = () => process.env.MEMORA_SIMULATE_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';

/** Starts checkout. Amount and currency are server-owned; the browser never sends them. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  const admin = getAdminSupabase();
  if (!admin) return fail('Payments are not configured on this deployment yet.', 503);

  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded) return fail('Memorial not found.', 404);
  if (loaded.meta.status !== 'DRAFT') return fail('This memorial is already published.', 409);
  const r = readiness(loaded.draft);
  if (!r.complete) return fail(r.missing[0] ?? 'The memorial is not complete yet.', 409);
  if (await isCasePaid(admin, id)) return json({ paid: true });

  const { amountMinor, currency } = pricing;

  if (simulationAllowed()) {
    const { data: order } = await admin
      .from('memora_orders')
      .insert({ case_id: id, created_by: user.id, amount_minor: amountMinor, currency, status: 'PAID', provider: 'simulated', provider_reference: `sim-${crypto.randomUUID()}` })
      .select('id')
      .single();
    if (!order) return fail('Could not simulate payment.', 500);
    await admin.from('memora_payments').insert({
      order_id: order.id, provider: 'simulated', provider_payment_id: order.id, status: 'CONFIRMED',
      amount_minor: amountMinor, currency, verified_at: new Date().toISOString(), raw_event: { simulated: true },
    });
    return json({ paid: true, simulated: true });
  }

  if (!paystackSecret()) return fail('Checkout is not switched on yet. Please try again soon.', 503);

  const { data: order, error } = await admin
    .from('memora_orders')
    .insert({ case_id: id, created_by: user.id, amount_minor: amountMinor, currency, status: 'PENDING', provider: 'paystack' })
    .select('id')
    .single();
  if (error || !order) return fail('Could not start the order.', 500);

  // Paystack references may contain only alphanumerics, '-', '.' and '='.
  const reference = `memora-${String(order.id).replaceAll('-', '')}`;
  await admin.from('memora_orders').update({ provider_reference: reference }).eq('id', order.id);

  try {
    const url = await initializeTransaction({
      email: user.email || 'billing@memora.app',
      amountMinor,
      currency,
      reference,
      callbackUrl: `${siteUrl()}/memorials/${id}?step=publish&payment=return`,
    });
    return json({ url });
  } catch (err) {
    console.error('Paystack initialize error', err);
    await admin.from('memora_orders').update({ status: 'FAILED', updated_at: new Date().toISOString() }).eq('id', order.id);
    return fail('Could not open checkout with Paystack. Please try again.', 502);
  }
}
