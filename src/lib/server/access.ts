import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { normaliseCellphone, phoneLoginEmail } from '../account-id';
import { principalFrom, type GroupGrant, type Principal, type Role, type Structure } from '../rbac';
import { getAdminSupabase } from '../supabase/admin';
import { getSessionUser, type SessionUser } from '../supabase/server';

// Works out what a signed-in person may do, once per request:
//   the owners in MEMORA_ADMIN_PHONES / MEMORA_ADMIN_EMAILS (numbers or emails) are administrators
//   (they can't be locked out);
//   everyone else gets the roles of the groups they're in (memora_groups);
//   people on the older Team list (memora_admins) keep Operations access.

/** The owners' sign-in addresses. A cellphone number means that number's account. */
export function ownerEmails(): string[] {
  return [process.env.MEMORA_ADMIN_PHONES, process.env.MEMORA_ADMIN_EMAILS]
    .join(',')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((e) => {
      if (e.includes('@')) return e;
      const digits = normaliseCellphone(e);
      return digits ? phoneLoginEmail(digits) : '';
    })
    .filter(Boolean);
}

type GroupRow = { roles: string[] | null; org_id: string | null; branch_id: string | null; account_id: string | null; region_id: string | null; active: boolean | null };

export async function loadPrincipal(admin: SupabaseClient, user: { id: string; email: string }): Promise<Principal> {
  const email = user.email.trim().toLowerCase();
  const [memberships, legacy] = await Promise.all([
    admin.from('memora_group_members').select('memora_groups(roles, org_id, branch_id, account_id, region_id, active)').eq('user_id', user.id),
    admin.from('memora_admins').select('email').eq('email', email).maybeSingle(),
  ]);
  const groups: GroupGrant[] = ((memberships.data ?? []) as { memora_groups: GroupRow | GroupRow[] | null }[])
    .flatMap((m) => (Array.isArray(m.memora_groups) ? m.memora_groups : m.memora_groups ? [m.memora_groups] : []))
    .map((g) => ({ roles: (g.roles ?? []) as Role[], orgId: g.org_id, branchId: g.branch_id ?? null, accountId: g.account_id ?? null, regionId: g.region_id ?? null, active: g.active !== false }));
  if (legacy.data) groups.push({ roles: ['ops'], orgId: null });

  // Enterprise groups: which homes and branches their roles reach.
  const accountIds = [...new Set(groups.map((g) => g.accountId).filter((id): id is string => Boolean(id)))];
  const regionIds = [...new Set(groups.map((g) => g.regionId).filter((id): id is string => Boolean(id)))];
  const [accounts, groupOrgs, regionBranches] = await Promise.all([
    accountIds.length ? admin.from('memora_accounts').select('id,status').in('id', accountIds) : Promise.resolve({ data: [] as { id: string; status: string }[] }),
    accountIds.length ? admin.from('memora_orgs').select('id,account_id').in('account_id', accountIds) : Promise.resolve({ data: [] as { id: string; account_id: string }[] }),
    regionIds.length ? admin.from('memora_branches').select('id,org_id,region_id').in('region_id', regionIds) : Promise.resolve({ data: [] as { id: string; org_id: string; region_id: string }[] }),
  ]);
  const structure: Structure = { accountOrgs: new Map(), regionBranches: new Map(), inactiveAccounts: new Set() };
  for (const a of (accounts.data ?? []) as { id: string; status: string }[]) if (a.status === 'suspended' || a.status === 'closed') structure.inactiveAccounts!.add(a.id);
  for (const o of (groupOrgs.data ?? []) as { id: string; account_id: string }[]) structure.accountOrgs.set(o.account_id, [...(structure.accountOrgs.get(o.account_id) ?? []), o.id]);
  for (const b of (regionBranches.data ?? []) as { id: string; org_id: string; region_id: string }[])
    structure.regionBranches.set(b.region_id, [...(structure.regionBranches.get(b.region_id) ?? []), { orgId: b.org_id, branchId: b.id }]);

  const orgIds = [...new Set([...groups.map((g) => g.orgId), ...[...structure.accountOrgs.values()].flat()].filter((id): id is string => Boolean(id)))];
  const disabledOrgs = new Set<string>();
  if (orgIds.length) {
    // A disabled home, or any home of a suspended or closed group, grants nothing. Published memorials stay up.
    const { data } = await admin.from('memora_orgs').select('id,status,memora_accounts(status)').in('id', orgIds);
    for (const o of (data ?? []) as { id: string; status: string; memora_accounts: { status: string } | { status: string }[] | null }[]) {
      const acc = Array.isArray(o.memora_accounts) ? o.memora_accounts[0] : o.memora_accounts;
      if (o.status === 'disabled' || acc?.status === 'suspended' || acc?.status === 'closed') disabledOrgs.add(o.id);
    }
  }
  return principalFrom(user.id, groups, { owner: ownerEmails().includes(email), disabledOrgs, structure });
}

/** The signed-in person and what they may do; null when signed out or Supabase isn't configured. */
export const getAccess = cache(async (): Promise<{ user: SessionUser; principal: Principal } | null> => {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const user = await getSessionUser();
  if (!user) return null;
  return { user, principal: await loadPrincipal(admin, user) };
});
