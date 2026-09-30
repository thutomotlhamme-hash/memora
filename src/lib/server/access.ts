import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { principalFrom, type GroupGrant, type Principal, type Role } from '../rbac';
import { getAdminSupabase } from '../supabase/admin';
import { getSessionUser, type SessionUser } from '../supabase/server';

// Works out what a signed-in person may do, once per request:
//   the owners in MEMORA_ADMIN_EMAILS are administrators (they can't be locked out);
//   everyone else gets the roles of the groups they're in (memora_groups);
//   people on the older Team list (memora_admins) keep Operations access.

export function ownerEmails(): string[] {
  return (process.env.MEMORA_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type GroupRow = { roles: string[] | null; org_id: string | null; active: boolean | null };

export async function loadPrincipal(admin: SupabaseClient, user: { id: string; email: string }): Promise<Principal> {
  const email = user.email.trim().toLowerCase();
  const [memberships, legacy] = await Promise.all([
    admin.from('memora_group_members').select('memora_groups(roles, org_id, active)').eq('user_id', user.id),
    admin.from('memora_admins').select('email').eq('email', email).maybeSingle(),
  ]);
  const groups: GroupGrant[] = ((memberships.data ?? []) as { memora_groups: GroupRow | GroupRow[] | null }[])
    .flatMap((m) => (Array.isArray(m.memora_groups) ? m.memora_groups : m.memora_groups ? [m.memora_groups] : []))
    .map((g) => ({ roles: (g.roles ?? []) as Role[], orgId: g.org_id, active: g.active !== false }));
  if (legacy.data) groups.push({ roles: ['ops'], orgId: null });

  const orgIds = [...new Set(groups.map((g) => g.orgId).filter((id): id is string => Boolean(id)))];
  const disabledOrgs = new Set<string>();
  if (orgIds.length) {
    const { data } = await admin.from('memora_orgs').select('id').in('id', orgIds).eq('status', 'disabled');
    (data ?? []).forEach((o) => disabledOrgs.add(o.id as string));
  }
  return principalFrom(user.id, groups, { owner: ownerEmails().includes(email), disabledOrgs });
}

/** The signed-in person and what they may do; null when signed out or Supabase isn't configured. */
export const getAccess = cache(async (): Promise<{ user: SessionUser; principal: Principal } | null> => {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const user = await getSessionUser();
  if (!user) return null;
  return { user, principal: await loadPrincipal(admin, user) };
});
