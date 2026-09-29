import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

const API = 'https://api.paystack.co';

export function paystackSecret(): string {
  return process.env.PAYSTACK_SECRET_KEY ?? '';
}

export async function initializeTransaction(input: {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
}): Promise<string> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${paystackSecret()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
    }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json?.status || !json?.data?.authorization_url) {
    throw new Error(json?.message || `Paystack initialize failed (${res.status})`);
  }
  return String(json.data.authorization_url);
}

export async function verifyTransaction(reference: string): Promise<any> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecret()}` },
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json?.status) throw new Error('Paystack verify request failed');
  return json.data;
}

/**
 * Verifies Paystack's HMAC-SHA512 signature over the *raw* request body (never a
 * re-serialised copy, which can change bytes) with a constant-time comparison.
 */
export async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  const secret = paystackSecret();
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export type ConfirmResult = 'confirmed' | 'already_paid' | 'pending' | 'mismatch' | 'no_order';

/**
 * Asks Paystack directly whether the order's transaction succeeded and, only if the
 * amount, currency and reference all match the server-owned order, records a
 * CONFIRMED payment and marks the order PAID. Idempotent: safe to call from both
 * the webhook and the browser's return-from-checkout poll.
 */
export async function confirmOrderWithPaystack(admin: SupabaseClient, reference: string, rawEvent?: unknown): Promise<ConfirmResult> {
  const { data: order } = await admin
    .from('memora_orders')
    .select('id,case_id,amount_minor,currency,status,provider_reference')
    .eq('provider', 'paystack')
    .eq('provider_reference', reference)
    .maybeSingle();
  if (!order) return 'no_order';

  const verified = await verifyTransaction(reference);
  if (verified?.status !== 'success') return 'pending';
  const matches =
    Number(verified.amount) === Number(order.amount_minor) &&
    String(verified.currency ?? '').toUpperCase() === String(order.currency).toUpperCase() &&
    String(verified.reference ?? '') === order.provider_reference;
  if (!matches) {
    console.error('Paystack verification mismatch', { orderId: order.id });
    return 'mismatch';
  }

  const providerPaymentId = String(verified.id ?? reference);
  const { error: paymentError } = await admin.from('memora_payments').upsert(
    {
      order_id: order.id,
      provider: 'paystack',
      provider_payment_id: providerPaymentId,
      status: 'CONFIRMED',
      amount_minor: order.amount_minor,
      currency: order.currency,
      verified_at: new Date().toISOString(),
      raw_event: rawEvent ?? { source: 'verify', reference },
    },
    { onConflict: 'provider,provider_payment_id', ignoreDuplicates: true },
  );
  if (paymentError) throw new Error(paymentError.message);

  if (order.status === 'PAID') return 'already_paid';
  await admin.from('memora_orders').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('id', order.id);
  await admin.from('memora_activity_log').insert({
    case_id: order.case_id,
    action: 'PAYMENT_CONFIRMED',
    metadata: { order_id: order.id, amount_minor: order.amount_minor, currency: order.currency },
  });
  return 'confirmed';
}
