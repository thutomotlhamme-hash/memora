import 'server-only';

import { getAdminSupabase } from '../supabase/admin';
import { getSessionUser, type SessionUser } from '../supabase/server';

// Who runs Memora.
//   Owners: emails in MEMORA_ADMIN_EMAILS (Netlify env). Can't be removed from the app.
//   Staff:  emails an owner adds on /admin → Team (memora_admins table).
// Access requires being signed in with that exact email, and the email must be
// confirmed, so a forwarded link or a look-alike sign-up never grants access.

export type AdminRole = 'owner' | 'staff';

export type AdminAccess =
  | { state: 'not_configured' }
  | { state: 'signed_out' }
  | { state: 'unconfirmed'; email: string }
  | { state: 'denied'; email: string }
  | { state: 'ok'; user: SessionUser; role: AdminRole };

export function ownerEmails(): string[] {
  return (process.env.MEMORA_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Role for an email, without checking sign-in (used for the header link). */
export async function roleForEmail(email: string): Promise<AdminRole | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  if (ownerEmails().includes(e)) return 'owner';
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin.from('memora_admins').select('email').eq('email', e).maybeSingle();
  return data ? 'staff' : null;
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const admin = getAdminSupabase();
  if (!admin || ownerEmails().length === 0) return { state: 'not_configured' };
  const user = await getSessionUser();
  if (!user) return { state: 'signed_out' };
  const role = await roleForEmail(user.email);
  if (!role) return { state: 'denied', email: user.email };
  const { data } = await admin.auth.admin.getUserById(user.id);
  if (!data?.user?.email_confirmed_at || data.user.email?.toLowerCase() !== user.email.toLowerCase()) {
    return { state: 'unconfirmed', email: user.email };
  }
  return { state: 'ok', user, role };
}

export async function getAdminUser(): Promise<{ user: SessionUser; role: AdminRole } | null> {
  const access = await getAdminAccess();
  return access.state === 'ok' ? { user: access.user, role: access.role } : null;
}
