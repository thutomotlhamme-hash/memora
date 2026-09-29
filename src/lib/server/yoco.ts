import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

const API = 'https://payments.yoco.com/api';

export function yocoSecret(): string {
  return process.env.YOCO_SECRET_KEY ?? '';
}

async function yocoFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${yocoSecret()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.displayMessage || json?.description || json?.message || `Yoco request failed (${res.status})`);
  return json;
}

/** Creates a hosted Yoco checkout and returns its id and the page to send the buyer to. */
export async function createCheckout(input: {
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; redirectUrl: string }> {
  const json = await yocoFetch('/checkouts', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: input.currency,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      failureUrl: input.failureUrl,
      metadata: input.metadata,
    }),
  });
  if (!json?.id || !json?.redirectUrl) throw new Error('Yoco did not return a checkout page.');
  return { id: String(json.id), redirectUrl: String(json.redirectUrl) };
}

export async function fetchCheckout(checkoutId: string): Promise<any> {
  return yocoFetch(`/checkouts/${encodeURIComponent(checkoutId)}`);
}

export type ConfirmResult = 'confirmed' | 'already_paid' | 'pending' | 'mismatch' | 'no_order';

/**
 * Asks Yoco directly for the checkout behind an order and, only if it completed
 * for exactly the server-owned amount and currency, records a CONFIRMED payment
 * and marks the order PAID. Never trusts a redirect or webhook payload on its
 * own. Idempotent: the webhook and the return-from-checkout poll can both call it.
 */
export async function confirmOrderWithYoco(admin: SupabaseClient, checkoutId: string, rawEvent?: unknown): Promise<ConfirmResult> {
  const { data: order } = await admin
    .from('memora_orders')
    .select('id,case_id,amount_minor,currency,status,provider_reference')
    .eq('provider', 'yoco')
    .eq('provider_reference', checkoutId)
    .maybeSingle();
  if (!order) return 'no_order';

  const checkout = await fetchCheckout(checkoutId);
  if (String(checkout?.status).toLowerCase() !== 'completed') return 'pending';
  const matches =
    String(checkout.id) === order.provider_reference &&
    Number(checkout.amount) === Number(order.amount_minor) &&
    String(checkout.currency ?? '').toUpperCase() === String(order.currency).toUpperCase() &&
    (!checkout.metadata?.orderId || checkout.metadata.orderId === order.id);
  if (!matches) {
    console.error('Yoco verification mismatch', { orderId: order.id });
    return 'mismatch';
  }

  const providerPaymentId = String(checkout.paymentId || checkout.id);
  const { error: paymentError } = await admin.from('memora_payments').upsert(
    {
      order_id: order.id,
      provider: 'yoco',
      provider_payment_id: providerPaymentId,
      status: 'CONFIRMED',
      amount_minor: order.amount_minor,
      currency: order.currency,
      verified_at: new Date().toISOString(),
      raw_event: rawEvent ?? { source: 'checkout-fetch', checkoutId },
    },
    { onConflict: 'provider,provider_payment_id', ignoreDuplicates: true },
  );
  if (paymentError) throw new Error(paymentError.message);

  if (order.status === 'PAID') return 'already_paid';
  await admin.from('memora_orders').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('id', order.id);
  await admin.from('memora_activity_log').insert({
    case_id: order.case_id,
    action: 'PAYMENT_CONFIRMED',
    metadata: { order_id: order.id, provider: 'yoco', amount_minor: order.amount_minor, currency: order.currency },
  });
  return 'confirmed';
}
