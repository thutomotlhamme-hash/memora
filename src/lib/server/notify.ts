import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { allowanceNotice, groupRolesWith, homeRolesWith, platformRolesWith, situationalNotices, type CaseFacts, type Notice } from '../notifications';
import { periodOf, publicYear } from '../plans';
import { canIn, type Permission, type Principal } from '../rbac';
import { ownerEmails } from './access';

// Delivering notifications. Every notice goes to the people whose role covers
// the situation (worked out from rbac.ts), never to the person who caused it,
// and never twice (one row per person per key). Failing to notify never breaks
// the action that triggered it.

type Row = Record<string, any>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function notify(admin: SupabaseClient, userIds: Iterable<string>, n: Notice, except?: string | null): Promise<void> {
  const ids = [...new Set(userIds)].filter((id) => id && id !== except).slice(0, 500);
  if (!ids.length) return;
  try {
    await admin
      .from('memora_notifications')
      .upsert(
        ids.map((user_id) => ({ user_id, kind: n.kind, tone: n.tone, title: n.title.slice(0, 200), body: (n.body ?? '').slice(0, 600), href: n.href ?? '', key: n.key.slice(0, 200) })),
        { onConflict: 'user_id,key', ignoreDuplicates: true },
      );
  } catch (err) {
    console.error('Notify failed', n.kind, err);
  }
}

const overlap = (a: string[] | null | undefined, b: string[]) => (a ?? []).some((x) => b.includes(x));

async function membersOf(admin: SupabaseClient, groupIds: string[]): Promise<string[]> {
  if (!groupIds.length) return [];
  const { data } = await admin.from('memora_group_members').select('user_id').in('group_id', groupIds);
  return ((data ?? []) as Row[]).map((m) => m.user_id as string);
}

/**
 * The people who hold a permission for a home (and, when given, one branch):
 * the home's own teams, plus its group's administrators and the regional
 * managers of the branch's region.
 */
export async function homeAudience(admin: SupabaseClient, orgId: string, branchId: string | null, perm: Permission, opts: { evenIfOff?: boolean } = {}): Promise<string[]> {
  const [{ data: org }, { data: branch }] = await Promise.all([
    admin.from('memora_orgs').select('account_id,status').eq('id', orgId).maybeSingle(),
    branchId ? admin.from('memora_branches').select('region_id').eq('id', branchId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!org || (org.status === 'disabled' && !opts.evenIfOff)) return [];
  const homeRoles = homeRolesWith(perm);
  const { data: homeGroups } = await admin.from('memora_groups').select('id,roles,branch_id,active').eq('org_id', orgId);
  const ids = ((homeGroups ?? []) as Row[])
    .filter((g) => g.active !== false && overlap(g.roles, homeRoles) && (g.branch_id === null || (branchId && g.branch_id === branchId)))
    .map((g) => g.id as string);
  if (org.account_id) {
    const groupRoles = groupRolesWith(perm);
    const { data: accountGroups } = await admin.from('memora_groups').select('id,roles,region_id,active').eq('account_id', org.account_id);
    for (const g of (accountGroups ?? []) as Row[])
      if (g.active !== false && overlap(g.roles, groupRoles) && (g.region_id === null || (branch?.region_id && g.region_id === branch.region_id))) ids.push(g.id);
  }
  return membersOf(admin, ids);
}

/** The people in an Enterprise group who hold a group permission (e.g. group.billing). */
export async function accountAudience(admin: SupabaseClient, accountId: string, perm: Permission): Promise<string[]> {
  const roles = groupRolesWith(perm);
  const { data } = await admin.from('memora_groups').select('id,roles,region_id,active').eq('account_id', accountId);
  return membersOf(
    admin,
    ((data ?? []) as Row[]).filter((g) => g.active !== false && g.region_id === null && overlap(g.roles, roles)).map((g) => g.id),
  );
}

/** Memora's own team who hold a permission, including the owners set in the server settings. */
export async function platformAudience(admin: SupabaseClient, perm: Permission): Promise<string[]> {
  const roles = platformRolesWith(perm);
  const { data } = await admin.from('memora_groups').select('id,roles,active').is('org_id', null).is('account_id', null);
  const ids = await membersOf(
    admin,
    ((data ?? []) as Row[]).filter((g) => g.active !== false && overlap(g.roles, roles)).map((g) => g.id),
  );
  for (const email of ownerEmails()) {
    const { data: found } = await admin.rpc('memora_find_account', { p_email: email });
    const row = Array.isArray(found) ? found[0] : found;
    if (row?.id) ids.push(String(row.id));
  }
  return ids;
}

/** After a home publishes: warn its owners (or the group's finance) as the allowance runs out. */
export async function notifyAllowance(admin: SupabaseClient, orgId: string, actorId: string): Promise<void> {
  const period = periodOf();
  const { data: org } = await admin.from('memora_orgs').select('included_memorials,account_id,memora_accounts(included_memorials)').eq('id', orgId).maybeSingle();
  if (!org) return;
  if (org.account_id) {
    const acc = one(org.memora_accounts as Row | Row[] | null);
    const { data: homes } = await admin.from('memora_orgs').select('id').eq('account_id', org.account_id);
    const { count } = await admin
      .from('memora_org_usage')
      .select('case_id', { count: 'exact', head: true })
      .eq('period', period)
      .in('org_id', ((homes ?? []) as Row[]).map((h) => h.id));
    const n = allowanceNotice(count ?? 0, Number(acc?.included_memorials ?? 0), period, org.account_id, `/pro/group?account=${org.account_id}&tab=billing`);
    if (n) await notify(admin, await accountAudience(admin, org.account_id, 'group.billing'), n, actorId);
    return;
  }
  const { count } = await admin.from('memora_org_usage').select('case_id', { count: 'exact', head: true }).eq('period', period).eq('org_id', orgId);
  const n = allowanceNotice(count ?? 0, Number(org.included_memorials ?? 0), period, orgId, `/pro/dashboard?home=${orgId}&tab=billing`);
  if (n) await notify(admin, await homeAudience(admin, orgId, null, 'org.billing.view'), n, actorId);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type NotificationRow = { id: string; kind: string; tone: string; title: string; body: string; href: string; createdAt: string; read: boolean };

export async function listNotifications(admin: SupabaseClient, userId: string, limit = 40): Promise<{ items: NotificationRow[]; unread: number }> {
  const [{ data }, { count }] = await Promise.all([
    admin.from('memora_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    admin.from('memora_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
  ]);
  return {
    unread: count ?? 0,
    items: ((data ?? []) as Row[]).map((r) => ({ id: r.id, kind: r.kind, tone: r.tone, title: r.title, body: r.body, href: r.href, createdAt: r.created_at, read: Boolean(r.read_at) })),
  };
}

export async function markRead(admin: SupabaseClient, userId: string, id: string | 'all'): Promise<void> {
  let q = admin.from('memora_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (id !== 'all') q = q.eq('id', id);
  await q;
}

/**
 * Situations worked out when someone opens their notifications: for staff, the
 * memorials in the branches they work in; for families, their own memorials.
 */
export async function syncSituations(admin: SupabaseClient, userId: string, p: Principal): Promise<void> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
  const facts = (c: Row, branchName?: string): CaseFacts => {
    const person = one(c.memora_people as Row | Row[] | null);
    const stops = ((c.memora_stops ?? []) as Row[]).filter((s) => s.event_date).sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: c.id,
      name: [person?.preferred_name || person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'A memorial',
      status: c.status,
      funeralDate: stops[0]?.event_date ?? null,
      yearDaysLeft: c.status === 'PUBLISHED' ? (publicYear(c.published_at ?? null, c.archive_at ?? null)?.daysLeft ?? null) : null,
      branch: branchName,
    };
  };
  const cols = 'id,status,org_id,branch_id,owner_id,published_at,archive_at,memora_people(first_name,last_name,preferred_name),memora_stops(event_date,sort_order)';
  const notices: Notice[] = [];

  // Families: their own memorials.
  const { data: own } = await admin.from('memora_cases').select(cols).eq('owner_id', userId).neq('status', 'ARCHIVED').limit(50);
  notices.push(...situationalNotices(((own ?? []) as Row[]).map((c) => facts(c)), today, 'family', (c) => `/memorials/${c.id}`));

  // Staff: the homes and branches they work in (not Memora's support view of everyone).
  const homes = [...p.orgs.keys()];
  if (homes.length) {
    const { data: cases } = await admin.from('memora_cases').select(cols).in('org_id', homes).in('status', ['DRAFT', 'PUBLISHED']).neq('owner_id', userId).limit(800);
    const branchIds = [...new Set(((cases ?? []) as Row[]).map((c) => c.branch_id).filter(Boolean))];
    const { data: branches } = branchIds.length ? await admin.from('memora_branches').select('id,name').in('id', branchIds) : { data: [] };
    const name = new Map(((branches ?? []) as Row[]).map((b) => [b.id as string, b.name as string]));
    const mine = ((cases ?? []) as Row[]).filter((c) => canIn(p, 'org.memorials.edit', c.org_id, c.branch_id));
    notices.push(...situationalNotices(mine.map((c) => facts(c, name.get(c.branch_id))), today, 'staff', (c) => `/memorials/${c.id}`));
  }
  for (const n of notices) await notify(admin, [userId], n);
}

/** Where someone goes to see what a team gives them. */
export function teamHref(g: { org_id?: string | null; account_id?: string | null; branch_id?: string | null }): string {
  if (g.account_id) return `/pro/group?account=${g.account_id}`;
  if (g.org_id) return `/pro/dashboard?home=${g.org_id}${g.branch_id ? `&branch=${g.branch_id}` : ''}`;
  return '/admin';
}
