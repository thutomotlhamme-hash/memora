import { siteUrl } from '@/lib/config';
import { CURRENCY, getPlan } from '@/lib/plans';
import { readiness } from '@/lib/memorial';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { loadOwnedCase, paidPlan } from '@/lib/server/cases';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { createCheckout, yocoSecret } from '@/lib/server/yoco';

type Ctx = { params: Promise<{ id: string }> };

const simulationAllowed = () => process.env.MEMORA_SIMULATE_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';

/** Starts checkout for a plan. The browser only names the plan; amount and currency come from the server. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  const admin = getAdminSupabase();
  if (!admin) return fail('Payments are not configured on this deployment yet.', 503);

  const body = (await request.json().catch(() => ({}))) as { plan?: unknown };
  const plan = getPlan(body?.plan);
  if (!plan) return fail('Choose a plan.', 400);

  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded) return fail('Memorial not found.', 404);
  if (loaded.meta.status !== 'DRAFT') return fail('This memorial is already published.', 409);
  const r = readiness(loaded.draft);
  if (!r.complete) return fail(r.missing[0] ?? 'The memorial is not complete yet.', 409);
  const existing = await paidPlan(admin, id);
  if (existing) return json({ paid: true, plan: existing });

  const amountMinor = plan.amountMinor;
  const currency = CURRENCY;

  if (simulationAllowed()) {
    const { data: order } = await admin
      .from('memora_orders')
      .insert({ case_id: id, created_by: user.id, plan: plan.id, amount_minor: amountMinor, currency, status: 'PAID', provider: 'simulated', provider_reference: `sim-${crypto.randomUUID()}` })
      .select('id')
      .single();
    if (!order) return fail('Could not simulate payment.', 500);
    await admin.from('memora_payments').insert({
      order_id: order.id, provider: 'simulated', provider_payment_id: order.id, status: 'CONFIRMED',
      amount_minor: amountMinor, currency, verified_at: new Date().toISOString(), raw_event: { simulated: true },
    });
    return json({ paid: true, plan: plan.id, simulated: true });
  }

  if (!yocoSecret()) return fail('Checkout is not switched on yet. Please try again soon.', 503);

  const { data: order, error } = await admin
    .from('memora_orders')
    .insert({ case_id: id, created_by: user.id, plan: plan.id, amount_minor: amountMinor, currency, status: 'PENDING', provider: 'yoco' })
    .select('id')
    .single();
  if (error || !order) return fail('Could not start the order.', 500);

  const back = `${siteUrl()}/memorials/${id}?step=publish&payment=`;
  try {
    const checkout = await createCheckout({
      amountMinor,
      currency,
      successUrl: `${back}return`,
      cancelUrl: `${back}cancelled`,
      failureUrl: `${back}failed`,
      idempotencyKey: order.id,
      metadata: { orderId: order.id, caseId: id, plan: plan.id },
    });
    await admin.from('memora_orders').update({ provider_reference: checkout.id, updated_at: new Date().toISOString() }).eq('id', order.id);
    return json({ url: checkout.redirectUrl });
  } catch (err) {
    console.error('Yoco checkout error', err);
    await admin.from('memora_orders').update({ status: 'FAILED', updated_at: new Date().toISOString() }).eq('id', order.id);
    return fail('Could not open checkout with Yoco. Please try again.', 502);
  }
}
