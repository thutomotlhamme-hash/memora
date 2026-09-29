import 'server-only';

import { getSessionUser } from '../supabase/server';

/** Team members are the signed-in users whose email is listed in MEMORA_ADMIN_EMAILS. */
export function isAdminEmail(email: string): boolean {
  const list = (process.env.MEMORA_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(email) && list.includes(email.toLowerCase());
}

export async function getAdminUser() {
  const user = await getSessionUser();
  return user && isAdminEmail(user.email) ? user : null;
}
