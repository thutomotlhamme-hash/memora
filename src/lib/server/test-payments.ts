import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../config';
import { isPaidStatus } from '../ikhokha-signature';
import { createPaylink, fetchPaylink, ikhokhaOn } from './ikhokha';

// A small real payment (e.g. R5) the team makes to itself, to prove iKhokha is
// plugged in end to end: the payment page opens, the money goes through,
// iKhokha's callback reaches Memora, and a signed status lookup says PAID.
// It touches no memorial, order or gift; it lives only in the audit log.

export const TEST_MIN_MINOR = 200;
export const TEST_MAX_MINOR = 5000;

type Row = Record<string, any>;

export interface TestPayment {
  reference: string;
  paylinkId: string;
  amountMinor: number;
  startedAt: string;
  callbackAt: string | null;
  checked: { at: string; status: string; paid: boolean; amountMinor: number | null } | null;
}

const started = (admin: SupabaseClient) =>
  admin.from('memora_activity_log').select('created_at,metadata').eq('action', 'ADMIN_TEST_PAYMENT_STARTED').order('created_at', { ascending: false });

export async function startTestPayment(admin: SupabaseClient, actorId: string, amountMinor: number): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  if (!ikhokhaOn()) return { ok: false, error: 'Add IKHOKHA_APP_ID and IKHOKHA_APP_SECRET in Netlify and redeploy first.', status: 503 };
  if (!Number.isInteger(amountMinor) || amountMinor < TEST_MIN_MINOR || amountMinor > TEST_MAX_MINOR) return { ok: false, error: 'Choose an amount from R2 to R50.', status: 400 };
  const reference = `test-${crypto.randomUUID()}`;
  const back = `${siteUrl()}/admin?tab=payments&testpay=${reference}`;
  let link: { id: string; url: string };
  try {
    link = await createPaylink({
      amountMinor,
      currency: 'ZAR',
      reference,
      description: 'Memora test payment',
      callbackUrl: `${siteUrl()}/api/ikhokha/webhook`,
      successUrl: `${back}&result=success`,
      failureUrl: `${back}&result=failed`,
      cancelUrl: `${back}&result=cancelled`,
      requesterUrl: siteUrl(),
    });
  } catch (err) {
    console.error('iKhokha test payment failed', err);
    return { ok: false, error: `iKhokha refused the request: ${err instanceof Error ? err.message : 'unknown error'}. Check the App ID and Secret in Netlify (no spaces), then redeploy.`, status: 502 };
  }
  await admin.from('memora_activity_log').insert({ actor_user_id: actorId, action: 'ADMIN_TEST_PAYMENT_STARTED', metadata: { reference, paylink_id: link.id, amount_minor: amountMinor, provider: 'ikhokha' } });
  return { ok: true, url: link.url };
}

/** iKhokha's callback for a test paylink: noted, so the panel can show the callback reaches Memora. */
export async function noteTestCallback(admin: SupabaseClient, paylinkId: string, body: unknown): Promise<boolean> {
  const { data } = await started(admin).eq('metadata->>paylink_id', paylinkId).limit(1);
  const row = (data ?? [])[0] as Row | undefined;
  if (!row) return false;
  await admin.from('memora_activity_log').insert({ action: 'ADMIN_TEST_PAYMENT_CALLBACK', metadata: { reference: row.metadata.reference, paylink_id: paylinkId, callback: body } });
  return true;
}

/** Asks iKhokha (signed lookup) about a test payment, and records the answer. */
export async function checkTestPayment(admin: SupabaseClient, reference: string): Promise<TestPayment | null> {
  if (!/^test-[0-9a-f-]{36}$/.test(reference)) return null;
  const { data } = await started(admin).eq('metadata->>reference', reference).limit(1);
  const row = (data ?? [])[0] as Row | undefined;
  if (!row || !ikhokhaOn()) return null;
  let checked: TestPayment['checked'] = null;
  try {
    const p = await fetchPaylink(String(row.metadata.paylink_id));
    checked = { at: new Date().toISOString(), status: String(p?.status ?? 'unknown'), paid: isPaidStatus(p?.status), amountMinor: Number.isFinite(Number(p?.amount)) ? Number(p.amount) : null };
  } catch (err) {
    checked = { at: new Date().toISOString(), status: `lookup failed: ${err instanceof Error ? err.message : 'error'}`, paid: false, amountMinor: null };
  }
  await admin.from('memora_activity_log').insert({ action: 'ADMIN_TEST_PAYMENT_CHECKED', metadata: { reference, paylink_id: row.metadata.paylink_id, ...checked } });
  return { ...(await describe(admin, row)), checked };
}

async function describe(admin: SupabaseClient, row: Row): Promise<TestPayment> {
  const { data: cb } = await admin.from('memora_activity_log').select('created_at').eq('action', 'ADMIN_TEST_PAYMENT_CALLBACK').eq('metadata->>reference', row.metadata.reference).limit(1);
  return {
    reference: row.metadata.reference,
    paylinkId: row.metadata.paylink_id,
    amountMinor: row.metadata.amount_minor,
    startedAt: row.created_at,
    callbackAt: (cb ?? [])[0]?.created_at ?? null,
    checked: null,
  };
}

export async function recentTestPayments(admin: SupabaseClient): Promise<TestPayment[]> {
  const { data } = await started(admin).limit(5);
  return Promise.all(((data ?? []) as Row[]).map((r) => describe(admin, r)));
}
