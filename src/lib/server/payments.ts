import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../config';
import { isPaidStatus } from '../ikhokha-signature';
import { matches, type Lookup } from '../payment-match';
import { createPaylink, fetchPaylink, ikhokhaOn } from './ikhokha';
import { createCheckout, fetchCheckout, yocoSecret } from './yoco';

// One door for card payments. iKhokha is used when its keys are set, otherwise
// Yoco. Every payment is confirmed by asking the provider directly; a redirect
// or a callback on its own never marks anything paid. Orders and gifts started
// with one provider are always confirmed with that same provider.

export type Provider = 'ikhokha' | 'yoco';
export const PROVIDERS: Provider[] = ['ikhokha', 'yoco'];

export function checkoutProvider(): Provider | null {
  if (ikhokhaOn()) return 'ikhokha';
  if (yocoSecret()) return 'yoco';
  return null;
}

export const providerOn = (p: string): p is Provider => (p === 'ikhokha' ? ikhokhaOn() : p === 'yoco' ? Boolean(yocoSecret()) : false);
export const providerLabel = (p: string) => (p === 'ikhokha' ? 'iKhokha' : p === 'yoco' ? 'Yoco' : p);

export async function openCheckout(
  provider: Provider,
  input: { amountMinor: number; currency: string; reference: string; kind: 'order' | 'gift'; description: string; successUrl: string; cancelUrl: string; failureUrl: string; metadata: Record<string, string> },
): Promise<{ id: string; url: string }> {
  if (provider === 'ikhokha') {
    return createPaylink({
      amountMinor: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      description: input.description,
      callbackUrl: `${siteUrl()}/api/ikhokha/webhook`,
      successUrl: input.successUrl,
      failureUrl: input.failureUrl,
      cancelUrl: input.cancelUrl,
      requesterUrl: siteUrl(),
    });
  }
  const c = await createCheckout({
    amountMinor: input.amountMinor,
    currency: input.currency,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    failureUrl: input.failureUrl,
    idempotencyKey: input.kind === 'gift' ? `gift-${input.reference}` : input.reference,
    metadata: input.metadata,
  });
  return { id: c.id, url: c.redirectUrl };
}

export async function lookup(provider: Provider, id: string): Promise<Lookup> {
  if (provider === 'ikhokha') {
    const p = await fetchPaylink(id);
    return {
      paid: isPaidStatus(p?.status),
      id: String(p?.paylinkID ?? p?.paymentLinkId ?? id),
      amountMinor: Number(p?.amount),
      currency: p?.currency ? String(p.currency).toUpperCase() : null,
      paymentId: String(p?.paylinkID ?? id),
      ref: { any: p?.externalTransactionID ? String(p.externalTransactionID) : undefined },
    };
  }
  const c = await fetchCheckout(id);
  return {
    paid: String(c?.status).toLowerCase() === 'completed',
    id: String(c?.id),
    amountMinor: Number(c?.amount),
    currency: String(c?.currency ?? '').toUpperCase(),
    paymentId: String(c?.paymentId || c?.id),
    ref: { orderId: c?.metadata?.orderId, giftId: c?.metadata?.giftId },
  };
}

export type ConfirmResult = 'confirmed' | 'already_paid' | 'pending' | 'mismatch' | 'no_order';

/**
 * Asks the provider about the checkout behind an order and, only if it was paid
 * for exactly the server-owned amount and currency, records a CONFIRMED payment
 * and marks the order PAID. Idempotent: callbacks, the return-from-checkout
 * poll and the command centre's "Check" can all call it.
 */
export async function confirmOrder(admin: SupabaseClient, provider: Provider, checkoutId: string, rawEvent?: unknown): Promise<ConfirmResult> {
  const { data: order } = await admin
    .from('memora_orders')
    .select('id,case_id,amount_minor,currency,status,provider_reference')
    .eq('provider', provider)
    .eq('provider_reference', checkoutId)
    .maybeSingle();
  if (!order) return 'no_order';

  const l = await lookup(provider, checkoutId);
  if (!l.paid) return 'pending';
  if (!matches(l, { id: order.provider_reference, reference: order.id, kind: 'order', amountMinor: order.amount_minor, currency: order.currency })) {
    console.error('Payment verification mismatch', { provider, orderId: order.id });
    return 'mismatch';
  }

  const { error: paymentError } = await admin.from('memora_payments').upsert(
    {
      order_id: order.id,
      provider,
      provider_payment_id: l.paymentId,
      status: 'CONFIRMED',
      amount_minor: order.amount_minor,
      currency: order.currency,
      verified_at: new Date().toISOString(),
      raw_event: rawEvent ?? { source: 'provider-lookup', checkoutId },
    },
    { onConflict: 'provider,provider_payment_id', ignoreDuplicates: true },
  );
  if (paymentError) throw new Error(paymentError.message);

  if (order.status === 'PAID') return 'already_paid';
  await admin.from('memora_orders').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('id', order.id);
  await admin.from('memora_activity_log').insert({
    case_id: order.case_id,
    action: 'PAYMENT_CONFIRMED',
    metadata: { order_id: order.id, provider, amount_minor: order.amount_minor, currency: order.currency },
  });
  return 'confirmed';
}

/** The same for a gift. Idempotent. */
export async function confirmGift(admin: SupabaseClient, provider: Provider, checkoutId: string): Promise<'confirmed' | 'already_paid' | 'pending' | 'mismatch' | 'no_gift'> {
  const { data: gift } = await admin.from('memora_gifts').select('id,status,amount_minor,currency,provider_reference').eq('provider', provider).eq('provider_reference', checkoutId).maybeSingle();
  if (!gift) return 'no_gift';
  if (gift.status === 'PAID' || gift.status === 'REDEEMED') return 'already_paid';
  const l = await lookup(provider, checkoutId);
  if (!l.paid) return 'pending';
  if (!matches(l, { id: gift.provider_reference, reference: gift.id, kind: 'gift', amountMinor: gift.amount_minor, currency: gift.currency })) {
    console.error('Gift payment verification mismatch', { provider, giftId: gift.id });
    return 'mismatch';
  }
  await admin
    .from('memora_gifts')
    .update({ status: 'PAID', paid_at: new Date().toISOString(), provider_payment_id: l.paymentId, updated_at: new Date().toISOString() })
    .eq('id', gift.id)
    .eq('status', 'PENDING');
  return 'confirmed';
}
