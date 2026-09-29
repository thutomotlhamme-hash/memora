import { roleForEmail } from '@/lib/server/admin-auth';
import { json } from '@/lib/server/http';
import { isSupabaseConfigured } from '@/lib/config';
import { getSessionUser } from '@/lib/supabase/server';

/** For the header: is the signed-in person on the Memora team? */
export async function GET() {
  const user = isSupabaseConfigured() ? await getSessionUser() : null;
  const team = user ? Boolean(await roleForEmail(user.email)) : false;
  return json({ signedIn: Boolean(user), team });
}
