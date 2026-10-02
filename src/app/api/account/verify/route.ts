import { maskPhone, cleanCode, type Channel } from '@/lib/verify';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { channels, checkCode, codesOn, confirmedAt, markConfirmed, phoneOf, sendCode, tooManyFrom } from '@/lib/server/verify';

/** Is my number confirmed, and how can a code reach me? */
export async function GET(request: Request) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const admin = getAdminSupabase();
  const phone = phoneOf(auth.user.email);
  if (!admin || !phone) return json({ phone: false, on: codesOn(), channels: channels(), confirmed: null });
  const { data } = await admin.auth.admin.getUserById(auth.user.id);
  return json({ phone: true, masked: maskPhone(phone), on: codesOn(), channels: channels(), confirmed: confirmedAt(data?.user) });
}

/** Send me a code ({ action: 'send', channel }), or check the one I got ({ action: 'check', code }). */
export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const admin = getAdminSupabase();
  if (!admin) return fail('Memora isn’t fully set up yet.', 503);
  const phone = phoneOf(auth.user.email);
  if (!phone) return fail('This account logs in with an email, so there’s no number to confirm.', 400);
  if (tooManyFrom(request, 30)) return fail('Too many tries from this connection. Please wait a while.', 429);
  const body = (await request.json().catch(() => null)) as { action?: string; channel?: Channel; code?: string } | null;

  if (body?.action === 'send') {
    const out = await sendCode(admin, { phone, userId: auth.user.id, purpose: 'confirm', channel: body.channel === 'sms' ? 'sms' : body.channel === 'whatsapp' ? 'whatsapp' : undefined });
    return out.ok ? json({ sent: true, channel: out.channel, masked: maskPhone(phone) }) : fail(out.error, out.status, { waitSeconds: out.waitSeconds });
  }
  if (body?.action === 'check') {
    const code = cleanCode(body.code);
    if (!code) return fail('Enter the 6 numbers from the message.', 400);
    const out = await checkCode(admin, { phone, purpose: 'confirm', code });
    if (!out.ok) return fail(out.error, out.status);
    if (out.userId !== auth.user.id) return fail('That code was for another account. Ask for a new one.', 409);
    if (!(await markConfirmed(admin, auth.user.id, 'code'))) return fail('Could not save that. Please try again.', 500);
    await admin.from('memora_activity_log').insert({ actor_user_id: auth.user.id, action: 'PHONE_CONFIRMED', metadata: { how: 'code' } });
    return json({ confirmed: true });
  }
  return fail('Unknown request.', 400);
}
