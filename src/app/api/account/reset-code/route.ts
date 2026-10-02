import { localCellphone, normaliseCellphone, phoneLoginEmail } from '@/lib/account-id';
import { cleanCode, type Channel } from '@/lib/verify';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { revokeResetLinks } from '@/lib/server/accounts';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { checkCode, codesOn, markConfirmed, sendCode, tooManyFrom } from '@/lib/server/verify';

/**
 * Forgot your password: a code to your number, then a new password. The answer
 * to "send" is the same whether or not the number has an account, so this
 * can't be used to find out who uses Memora.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  if (!admin || !codesOn()) return fail('Codes aren’t switched on yet. Message us and we’ll help.', 503);
  if (tooManyFrom(request)) return fail('Too many tries from this connection. Please wait a while.', 429);
  const body = (await request.json().catch(() => null)) as { action?: string; phone?: string; channel?: Channel; code?: string; password?: string } | null;
  const phone = normaliseCellphone(String(body?.phone ?? ''));
  if (!phone) return fail('Enter a cellphone number, like 072 123 4567.', 400);

  const { data: found } = await admin.rpc('memora_find_account', { p_email: phoneLoginEmail(phone) });
  const account = (Array.isArray(found) ? found[0] : found) as { id?: string } | null;

  if (body?.action === 'send') {
    const generic = { sent: true, message: `If ${localCellphone(phone)} has a Memora account, a code is on its way.` };
    if (!account?.id) return json(generic);
    const { data: u } = await admin.auth.admin.getUserById(account.id);
    if (u?.user?.banned_until && new Date(u.user.banned_until).getTime() > Date.now()) return json(generic);
    const out = await sendCode(admin, { phone, userId: account.id, purpose: 'reset', channel: body.channel === 'sms' ? 'sms' : body.channel === 'whatsapp' ? 'whatsapp' : undefined });
    // Limits and sending failures are about the number, not the account, so they're safe to say.
    return out.ok ? json({ ...generic, channel: out.channel }) : fail(out.error, out.status, { waitSeconds: out.waitSeconds });
  }

  if (body?.action === 'check') {
    const code = cleanCode(body.code);
    if (!code) return fail('Enter the 6 numbers from the message.', 400);
    const password = String(body.password ?? '');
    if (password.length < 8) return fail('Choose a password of at least 8 characters.', 400);
    if (password.length > 72) return fail('That password is too long. Use 72 characters or fewer.', 400);
    if (!account?.id) return fail('There’s no code waiting for this number. Ask for a new code.', 410);
    const out = await checkCode(admin, { phone, purpose: 'reset', code });
    if (!out.ok) return fail(out.error, out.status);
    if (out.userId !== account.id) return fail('That code doesn’t match this account. Ask for a new code.', 409);
    const { error } = await admin.auth.admin.updateUserById(account.id, { password });
    if (error) return fail(/password/i.test(error.message) ? 'Choose a stronger password: at least 8 characters, not a common word.' : 'Could not save the new password. Please try again.', 400);
    await revokeResetLinks(admin, account.id);
    await markConfirmed(admin, account.id, 'code');
    await admin.from('memora_activity_log').insert({ actor_user_id: account.id, action: 'PASSWORD_RESET_BY_CODE', metadata: {} });
    return json({ ok: true });
  }
  return fail('Unknown request.', 400);
}
