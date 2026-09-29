import { localCellphone, normaliseCellphone, phoneLoginEmail } from '@/lib/account-id';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { fail, json, sameOrigin } from '@/lib/server/http';

// Best-effort brake on scripted sign-ups (per server instance).
const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 12;
}

/**
 * Creates a cellphone account: number + password, no SMS, no email. The account
 * is ready at once; the browser then logs in with the same number and password.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  if (!admin) return fail('Accounts aren’t switched on yet. Please try again soon.', 503);
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (tooMany(ip)) return fail('Too many new accounts from this connection. Please wait a while and try again.', 429);

  const body = (await request.json().catch(() => null)) as { phone?: string; password?: string; name?: string } | null;
  const digits = normaliseCellphone(String(body?.phone ?? ''));
  if (!digits) return fail('Enter a cellphone number, like 072 123 4567.', 400);
  const password = String(body?.password ?? '');
  if (password.length < 8) return fail('Choose a password of at least 8 characters.', 400);
  if (password.length > 72) return fail('That password is too long. Use 72 characters or fewer.', 400);
  const name = String(body?.name ?? '').trim().slice(0, 120);

  const { error } = await admin.auth.admin.createUser({
    email: phoneLoginEmail(digits),
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone: `+${digits}`, signup: 'phone' },
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message) || error.code === 'email_exists') {
      return fail(`${localCellphone(digits)} already has a Memora account. Log in instead, or WhatsApp us if it isn’t yours.`, 409, { code: 'EXISTS' });
    }
    if (/password/i.test(error.message)) return fail('Choose a stronger password: at least 8 characters, not a common word.', 400);
    return fail('We couldn’t create the account just now. Please try again.', 500);
  }
  await admin.from('memora_activity_log').insert({ action: 'ACCOUNT_CREATED_PHONE', metadata: {} });
  return json({ ok: true }, 201);
}
