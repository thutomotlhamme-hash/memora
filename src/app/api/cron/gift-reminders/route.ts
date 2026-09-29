import { timingSafeEqual } from 'node:crypto';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { runGiftReminders } from '@/lib/server/gifts';
import { fail, json } from '@/lib/server/http';

/** Called hourly by the Netlify scheduled function in netlify/functions/gift-reminders.mts. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return fail('Unauthorised.', 401);
  const admin = getAdminSupabase();
  if (!admin) return fail('Not configured.', 503);
  return json(await runGiftReminders(admin));
}
