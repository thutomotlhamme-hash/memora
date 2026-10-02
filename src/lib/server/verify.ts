import 'server-only';

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isPhoneLogin } from '../account-id';
import { CODE_MINUTES, MAX_ATTEMPTS, codeFrom, sendAllowed, smsText, type Channel, type Channels, type Purpose } from '../verify';

// One-time codes to a cellphone number. WhatsApp first (Meta's Cloud API: the
// cheapest way to reach a South African phone), SMS through BulkSMS as the
// backup for people without WhatsApp or data. Only a hash of each code is
// stored; codes expire after 10 minutes, allow 5 tries and work once.
//
// Whether a number is confirmed lives in the account's app_metadata, which only
// the server can change: phone_confirmed_at, phone_confirmed_how ('code' or
// 'staff'), and for staff, phone_confirmed_by.

const env = (k: string) => process.env[k]?.trim() ?? '';

export function channels(): Channels {
  return {
    whatsapp: Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID')),
    sms: Boolean(env('BULKSMS_TOKEN_ID') && env('BULKSMS_TOKEN_SECRET')),
  };
}

/** Codes are switched on once at least one way of sending them is set up. */
export const codesOn = () => {
  const c = channels();
  return c.whatsapp || c.sms;
};

export const phoneOf = (email: string | null | undefined) => (isPhoneLogin(email) ? String(email).split('@')[0] : '');

export function confirmedAt(user: Pick<User, 'app_metadata'> | null | undefined): string | null {
  const v = user?.app_metadata?.phone_confirmed_at;
  return typeof v === 'string' && v ? v : null;
}

/**
 * Does this person still need to confirm their number before something that
 * matters (publishing)? Not while codes are off, and never for email logins.
 */
export async function needsConfirming(admin: SupabaseClient, userId: string): Promise<boolean> {
  if (!codesOn()) return false;
  const { data } = await admin.auth.admin.getUserById(userId);
  const u = data?.user;
  if (!u || !isPhoneLogin(u.email)) return false;
  return !confirmedAt(u);
}

export async function markConfirmed(admin: SupabaseClient, userId: string, how: 'code' | 'staff', by?: string): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data?.user) return false;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, phone_confirmed_at: new Date().toISOString(), phone_confirmed_how: how, ...(by ? { phone_confirmed_by: by } : {}) },
  });
  return !error;
}

const hashCode = (id: string, code: string) => createHash('sha256').update(`${id}:${code}:${env('MEMORA_LINK_SECRET')}`).digest('hex');

async function viaWhatsApp(phone: string, code: string): Promise<boolean> {
  // An approved "authentication" template with a copy-code button; the code is
  // both the body parameter and the button's.
  const res = await fetch(`https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: env('WHATSAPP_CODE_TEMPLATE') || 'memora_code',
        language: { code: env('WHATSAPP_CODE_LANGUAGE') || 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) console.error('WhatsApp code not sent', res?.status, await res?.text().catch(() => ''));
  return Boolean(res?.ok);
}

async function viaSms(phone: string, code: string): Promise<boolean> {
  const auth = Buffer.from(`${env('BULKSMS_TOKEN_ID')}:${env('BULKSMS_TOKEN_SECRET')}`).toString('base64');
  const res = await fetch('https://api.bulksms.com/v1/messages', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: `+${phone}`, body: smsText(code) }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) console.error('SMS code not sent', res?.status);
  return Boolean(res?.ok);
}

export type SendResult = { ok: true; channel: Channel } | { ok: false; error: string; status: number; waitSeconds?: number };

/** Sends a fresh code (any earlier open one for the number and purpose stops working). */
export async function sendCode(admin: SupabaseClient, input: { phone: string; userId: string; purpose: Purpose; channel?: Channel }): Promise<SendResult> {
  const on = channels();
  const channel: Channel | null = input.channel && on[input.channel] ? input.channel : on.whatsapp ? 'whatsapp' : on.sms ? 'sms' : null;
  if (!channel) return { ok: false, error: 'Codes aren’t switched on yet. Message us and we’ll help.', status: 503 };

  const now = new Date();
  const { data: recent } = await admin
    .from('memora_phone_codes')
    .select('created_at')
    .eq('phone', input.phone)
    .gte('created_at', new Date(now.getTime() - 86_400_000).toISOString());
  const allowed = sendAllowed((recent ?? []).map((r) => new Date(r.created_at as string)), now);
  if (!allowed.ok) return { ok: false, error: allowed.message, status: 429, waitSeconds: allowed.waitSeconds };

  await admin.from('memora_phone_codes').update({ used_at: now.toISOString() }).eq('phone', input.phone).eq('purpose', input.purpose).is('used_at', null);
  const id = randomUUID();
  const code = codeFrom(crypto.getRandomValues(new Uint32Array(1)));
  const { error } = await admin.from('memora_phone_codes').insert({
    id,
    phone: input.phone,
    user_id: input.userId,
    purpose: input.purpose,
    channel,
    code_hash: hashCode(id, code),
    expires_at: new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
  });
  if (error) return { ok: false, error: 'We couldn’t make a code just now. Please try again.', status: 500 };

  const sent = channel === 'whatsapp' ? await viaWhatsApp(input.phone, code) : await viaSms(input.phone, code);
  if (!sent) {
    await admin.from('memora_phone_codes').update({ used_at: now.toISOString(), failed: true }).eq('id', id);
    const other = channel === 'whatsapp' && on.sms ? ' Try SMS instead.' : channel === 'sms' && on.whatsapp ? ' Try WhatsApp instead.' : '';
    return { ok: false, error: `We couldn’t send the code by ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.${other}`, status: 502 };
  }
  return { ok: true, channel };
}

export type CheckResult = { ok: true; userId: string } | { ok: false; error: string; status: number };

/** Checks a code; the right one works once, and five wrong tries use it up. */
export async function checkCode(admin: SupabaseClient, input: { phone: string; purpose: Purpose; code: string }): Promise<CheckResult> {
  const now = new Date();
  const { data: row } = await admin
    .from('memora_phone_codes')
    .select('id,user_id,code_hash,attempts,expires_at')
    .eq('phone', input.phone)
    .eq('purpose', input.purpose)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const again = 'Ask for a new code.';
  if (!row) return { ok: false, error: `There’s no code waiting for this number. ${again}`, status: 410 };
  if (new Date(row.expires_at as string).getTime() < now.getTime()) return { ok: false, error: `That code has expired. ${again}`, status: 410 };
  if ((row.attempts as number) >= MAX_ATTEMPTS) return { ok: false, error: `Too many wrong tries. ${again}`, status: 429 };

  const expected = Buffer.from(row.code_hash as string);
  const given = Buffer.from(hashCode(row.id as string, input.code));
  const right = expected.length === given.length && timingSafeEqual(expected, given);
  if (!right) {
    const attempts = (row.attempts as number) + 1;
    await admin.from('memora_phone_codes').update({ attempts, ...(attempts >= MAX_ATTEMPTS ? { used_at: now.toISOString() } : {}) }).eq('id', row.id);
    const left = MAX_ATTEMPTS - attempts;
    return { ok: false, error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : `Too many wrong tries. ${again}`, status: 400 };
  }
  const { data: claimed } = await admin.from('memora_phone_codes').update({ used_at: now.toISOString() }).eq('id', row.id).is('used_at', null).select('id');
  if (!claimed?.length) return { ok: false, error: `That code has just been used. ${again}`, status: 409 };
  return { ok: true, userId: row.user_id as string };
}

/** Best-effort brake per connection (per server instance), on top of the per-number limits. */
const hits = new Map<string, number[]>();
export function tooManyFrom(request: Request, max = 20): boolean {
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

/** For a page: does this person have a number to confirm, and have they? ('off' when codes aren't on or they log in by email.) */
export async function confirmState(admin: SupabaseClient | null, user: { id: string; email: string }): Promise<'off' | 'confirmed' | 'needed'> {
  if (!admin || !codesOn() || !isPhoneLogin(user.email)) return 'off';
  const { data } = await admin.auth.admin.getUserById(user.id);
  return confirmedAt(data?.user) ? 'confirmed' : 'needed';
}
