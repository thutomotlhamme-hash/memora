import 'server-only';

import { can, type Principal } from '../rbac';
import { getAdminSupabase } from '../supabase/admin';
import { getSessionUser, type SessionUser } from '../supabase/server';
import { loadPrincipal, ownerEmails } from './access';

// Who may open the command centre: anyone whose roles grant ops.view.
// The owners in MEMORA_ADMIN_EMAILS always can. Access requires the account's
// sign-in address to be confirmed, so a look-alike sign-up never gets in.

export { ownerEmails };

export type AdminAccess =
  | { state: 'not_configured' }
  | { state: 'signed_out' }
  | { state: 'unconfirmed'; email: string }
  | { state: 'denied'; email: string }
  | { state: 'ok'; user: SessionUser; principal: Principal };

export async function getAdminAccess(): Promise<AdminAccess> {
  const admin = getAdminSupabase();
  if (!admin || ownerEmails().length === 0) return { state: 'not_configured' };
  const user = await getSessionUser();
  if (!user) return { state: 'signed_out' };
  const principal = await loadPrincipal(admin, user);
  if (!can(principal, 'ops.view')) return { state: 'denied', email: user.email };
  const { data } = await admin.auth.admin.getUserById(user.id);
  if (!data?.user?.email_confirmed_at || data.user.email?.toLowerCase() !== user.email.toLowerCase()) {
    return { state: 'unconfirmed', email: user.email };
  }
  return { state: 'ok', user, principal };
}

export async function getAdminUser(): Promise<{ user: SessionUser; principal: Principal } | null> {
  const access = await getAdminAccess();
  return access.state === 'ok' ? { user: access.user, principal: access.principal } : null;
}
