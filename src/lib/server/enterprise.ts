import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountLabel, loginAddress } from '../account-id';
import { siteUrl } from '../config';
import {
  BLUEPRINTS,
  CONTRACT_STATUS,
  MODULES,
  SLA_TIERS,
  STARTER_TEMPLATES,
  SUPPORT_LEVELS,
  isBlueprint,
  isContractStatus,
  isModule,
  parsePeople,
  parseStructure,
  type BrandPart,
  type ContractStatus,
  type Module,
  type RegionKind,
} from '../enterprise';
import { newId } from '../memorial';
import { billableUsage, periodOf, periodRange, proInvoice, vatRateNow } from '../plans';
import { ROLES, canAccount, canGrantRole, isRole, regionScope, type Principal, type Role } from '../rbac';
import { linkSecret, signGiftToken } from './links';
import { BRANCH_GROUPS, OWNERS_GROUP, adjustmentsFor, createBranch, loadGroups, log, uniqueSlug, type Group, type ProInput, type ProResult } from './pro';
import { refreshPublicPages } from './public-cache';

// The Enterprise layer on the server: accounts (a group's contract and
// configuration), their structure, the provisioning wizard, group actions,
// reporting and account billing. Every action is permission-checked here.

type Row = Record<string, any>;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const rands = (v: unknown): number | null => {
  const raw = String(v ?? '').trim();
  const n = Number(raw.replace(/[^\d.]/g, ''));
  return raw !== '' && Number.isFinite(n) ? Math.round(n * 100) : null;
};
const whole = (v: unknown, min: number, max: number): number | null => {
  const raw = String(v ?? '').trim();
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : null;
};
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const deny = (why = 'You don’t have permission to do that.'): ProResult => ({ ok: false, error: why, status: 403 });

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface Account {
  id: string;
  name: string;
  slug: string;
  blueprint: keyof typeof BLUEPRINTS;
  status: ContractStatus;
  monthlyFeeMinor: number;
  includedMemorials: number;
  perMemorialMinor: number;
  onboardingFeeMinor: number;
  onboardingPaid: boolean;
  branchAllowance: number | null;
  contractStart: string | null;
  renewalDate: string | null;
  contractEnd: string | null;
  slaTier: keyof typeof SLA_TIERS;
  supportLevel: keyof typeof SUPPORT_LEVELS;
  primaryContact: string;
  billingContact: string;
  commercialContact: string;
  accountManager: string;
  modules: Module[];
  logoUrl: string;
  brandColour: string;
  brandFooter: string;
  brandLocks: BrandPart[];
  notes: string;
  createdAt: string;
}

export const toAccount = (r: Row): Account => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  blueprint: isBlueprint(r.blueprint) ? r.blueprint : 'standard',
  status: isContractStatus(r.status) ? r.status : 'onboarding',
  monthlyFeeMinor: r.monthly_fee_minor,
  includedMemorials: r.included_memorials,
  perMemorialMinor: r.per_memorial_minor,
  onboardingFeeMinor: r.onboarding_fee_minor,
  onboardingPaid: r.onboarding_paid,
  branchAllowance: r.branch_allowance ?? null,
  contractStart: r.contract_start,
  renewalDate: r.renewal_date,
  contractEnd: r.contract_end,
  slaTier: r.sla_tier in SLA_TIERS ? r.sla_tier : 'standard',
  supportLevel: r.support_level in SUPPORT_LEVELS ? r.support_level : 'business_hours',
  primaryContact: r.primary_contact,
  billingContact: r.billing_contact,
  commercialContact: r.commercial_contact,
  accountManager: r.account_manager,
  modules: ((r.modules ?? []) as string[]).filter(isModule),
  logoUrl: r.logo_url,
  brandColour: r.brand_colour,
  brandFooter: r.brand_footer,
  brandLocks: ((r.brand_locks ?? []) as string[]).filter((x): x is BrandPart => x === 'logo' || x === 'colour' || x === 'footer'),
  notes: r.notes,
  createdAt: r.created_at,
});

export const hasModule = (a: Pick<Account, 'modules'>, m: Module) => a.modules.includes(m);

export interface AccountSummary extends Account {
  homes: number;
  branches: number;
  publishedThisMonth: number;
}

/** Every Enterprise account, for the command centre. */
export async function loadAccounts(admin: SupabaseClient, onlyIds?: string[]): Promise<AccountSummary[]> {
  let q = admin.from('memora_accounts').select('*').order('name');
  if (onlyIds) q = q.in('id', onlyIds.length ? onlyIds : ['00000000-0000-0000-0000-000000000000']);
  const period = periodOf();
  const [{ data }, { data: orgs }, { data: branches }, { data: usage }] = await Promise.all([
    q,
    admin.from('memora_orgs').select('id,account_id').not('account_id', 'is', null),
    admin.from('memora_branches').select('id,org_id'),
    admin.from('memora_org_usage').select('case_id,org_id,published_at').eq('period', period),
  ]);
  const accountOf = new Map(((orgs ?? []) as Row[]).map((o) => [o.id as string, o.account_id as string]));
  const count = (rows: Row[], key: string) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const acc = accountOf.get(r[key]);
      if (acc) m.set(acc, (m.get(acc) ?? 0) + 1);
    }
    return m;
  };
  const homes = new Map<string, number>();
  for (const acc of accountOf.values()) homes.set(acc, (homes.get(acc) ?? 0) + 1);
  const branchCount = count((branches ?? []) as Row[], 'org_id');
  const used = new Map<string, number>();
  const byHome = billableUsage(((usage ?? []) as Row[]).map((u) => ({ caseId: u.case_id, orgId: u.org_id, status: 'PUBLISHED', publishedAt: u.published_at })), period);
  byHome.forEach((n, org) => {
    const acc = accountOf.get(org);
    if (acc) used.set(acc, (used.get(acc) ?? 0) + n);
  });
  return ((data ?? []) as Row[]).map((r) => ({ ...toAccount(r), homes: homes.get(r.id) ?? 0, branches: branchCount.get(r.id) ?? 0, publishedThisMonth: used.get(r.id) ?? 0 }));
}

export interface Region {
  id: string;
  name: string;
  kind: RegionKind;
}
export interface GroupHome {
  id: string;
  name: string;
  status: string;
  logoUrl: string;
  brandColour: string;
}
export interface GroupBranch {
  id: string;
  orgId: string;
  name: string;
  area: string;
  regionId: string | null;
  active: boolean;
}
export interface Funeral {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  slug: string | null;
  orgId: string;
  branchId: string | null;
  ownerId: string;
  funeralDate: string | null;
  createdAt: string;
  publishedAt: string | null;
  hasProgramme: boolean;
  fromFamilyLink: boolean;
}
export interface Template {
  id: string;
  name: string;
  kind: 'programme' | 'wording';
  tradition: string;
  items: { part: 'vigil' | 'service' | 'graveside'; type: string; title: string; minutes: number }[];
  wording: string;
  audience: 'all' | 'regions' | 'branches';
  audienceIds: string[];
  active: boolean;
  updatedAt: string;
}
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
export interface AccountInvoice {
  id: string;
  period: string;
  memorials: number;
  includedMemorials: number;
  overageMemorials: number;
  monthlyFeeMinor: number;
  perMemorialMinor: number;
  onboardingMinor: number;
  adjustmentsMinor: number;
  amountMinor: number;
  vatMinor: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'VOID';
}
export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
  before: string;
  after: string;
}

/** Everything the control centre shows for one group, cut down to what this person may see. */
export interface GroupWorld {
  account: Account;
  regions: Region[];
  homes: GroupHome[];
  branches: GroupBranch[];
  /** The branches this person sees (their regions, or all). */
  visibleBranchIds: string[];
  funerals: Funeral[];
  groups: Group[];
  people: Map<string, string>;
  usageByBranch: Map<string, number>;
  publishedThisMonth: number;
  invoices: AccountInvoice[];
  templates: Template[];
  keys: ApiKey[];
  invites: { id: string; label: string; group: string; url: string; state: string }[];
  audit: AuditEntry[];
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function loadGroupWorld(admin: SupabaseClient, accountId: string, p: Principal): Promise<GroupWorld | null> {
  const { data: acc } = await admin.from('memora_accounts').select('*').eq('id', accountId).maybeSingle();
  if (!acc) return null;
  const account = toAccount(acc);
  const period = periodOf();
  const [{ data: regions }, { data: homes }] = await Promise.all([
    admin.from('memora_regions').select('*').eq('account_id', accountId).order('name'),
    admin.from('memora_orgs').select('id,name,status,logo_url,brand_colour').eq('account_id', accountId).order('name'),
  ]);
  const homeIds = ((homes ?? []) as Row[]).map((h) => h.id as string);
  const none = ['00000000-0000-0000-0000-000000000000'];
  const ids = homeIds.length ? homeIds : none;
  const [{ data: branches }, { data: cases }, { data: usage }, groups, { data: invoices }, { data: templates }, { data: keys }, { data: invites }, audit] = await Promise.all([
    admin.from('memora_branches').select('*').in('org_id', ids).order('name'),
    admin
      .from('memora_cases')
      .select('id,status,slug,org_id,branch_id,owner_id,created_at,published_at,memora_people(first_name,last_name,preferred_name),memora_stops(event_date,sort_order),memora_programme_items(id)')
      .in('org_id', ids)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin.from('memora_org_usage').select('case_id,org_id,branch_id,published_at').in('org_id', ids).eq('period', period),
    loadGroups(admin, undefined, accountId),
    canAccount(p, 'group.billing', accountId) ? admin.from('memora_account_invoices').select('*').eq('account_id', accountId).order('period', { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
    admin.from('memora_templates').select('*').eq('account_id', accountId).order('name'),
    canAccount(p, 'group.integrations', accountId) ? admin.from('memora_api_keys').select('*').eq('account_id', accountId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    canAccount(p, 'group.people', accountId) ? admin.from('memora_invites').select('*, memora_groups(name)').eq('account_id', accountId).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    canAccount(p, 'group.audit', accountId) ? loadAccountAudit(admin, accountId) : Promise.resolve([]),
  ]);

  const allBranches: GroupBranch[] = ((branches ?? []) as Row[]).map((b) => ({ id: b.id, orgId: b.org_id, name: b.name, area: b.area ?? '', regionId: b.region_id ?? null, active: b.active !== false }));
  const scope = regionScope(p, accountId);
  const visible = scope === 'all' ? allBranches : allBranches.filter((b) => b.regionId && scope.includes(b.regionId));
  const visibleIds = new Set(visible.map((b) => b.id));
  const familyLinked = new Set<string>();
  const { data: linkRows } = homeIds.length ? await admin.from('memora_invites').select('case_id').eq('kind', 'family').in('org_id', homeIds).not('case_id', 'is', null) : { data: [] };
  for (const l of (linkRows ?? []) as Row[]) familyLinked.add(l.case_id);

  const funerals: Funeral[] = ((cases ?? []) as Row[])
    .filter((c) => scope === 'all' || (c.branch_id && visibleIds.has(c.branch_id)))
    .map((c) => {
      const person = one(c.memora_people) as Row | null;
      const stops = ((c.memora_stops ?? []) as Row[]).filter((s) => s.event_date).sort((a, b) => a.sort_order - b.sort_order);
      const name = [person?.preferred_name || person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'Untitled memorial';
      return {
        id: c.id,
        name,
        status: c.status,
        slug: c.slug,
        orgId: c.org_id,
        branchId: c.branch_id ?? null,
        ownerId: c.owner_id,
        funeralDate: stops.length ? stops.map((s) => s.event_date as string).sort().slice(-1)[0] : null,
        createdAt: c.created_at,
        publishedAt: c.published_at ?? null,
        hasProgramme: ((c.memora_programme_items ?? []) as Row[]).length > 0,
        fromFamilyLink: familyLinked.has(c.id),
      };
    });

  const usageRows = ((usage ?? []) as Row[]).filter((u) => scope === 'all' || (u.branch_id && visibleIds.has(u.branch_id)));
  const usageByBranch = new Map<string, number>();
  for (const u of usageRows) usageByBranch.set(u.branch_id ?? 'none', (usageByBranch.get(u.branch_id ?? 'none') ?? 0) + 1);
  const publishedThisMonth = [...billableUsage(usageRows.map((u) => ({ caseId: u.case_id, orgId: u.org_id, status: 'PUBLISHED', publishedAt: u.published_at })), period).values()].reduce((a, b) => a + b, 0);

  // People's labels for "volume by arranger".
  const people = new Map<string, string>();
  for (const g of groups) for (const m of g.members) people.set(m.userId, m.name || m.label);
  const unknown = [...new Set(funerals.map((f) => f.ownerId))].filter((id) => !people.has(id)).slice(0, 60);
  await Promise.all(
    unknown.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) people.set(id, String(data.user.user_metadata?.full_name || '') || accountLabel(data.user.email));
    }),
  );

  return {
    account,
    regions: ((regions ?? []) as Row[]).map((r) => ({ id: r.id, name: r.name, kind: r.kind })),
    homes: ((homes ?? []) as Row[]).map((h) => ({ id: h.id, name: h.name, status: h.status, logoUrl: h.logo_url, brandColour: h.brand_colour })),
    branches: allBranches,
    visibleBranchIds: [...visibleIds],
    funerals,
    groups,
    people,
    usageByBranch,
    publishedThisMonth,
    invoices: ((invoices ?? []) as Row[]).map((i) => ({
      id: i.id,
      period: i.period,
      memorials: i.memorials,
      includedMemorials: i.included_memorials,
      overageMemorials: i.overage_memorials,
      monthlyFeeMinor: i.monthly_fee_minor,
      perMemorialMinor: i.per_memorial_minor,
      onboardingMinor: i.onboarding_minor,
      adjustmentsMinor: i.adjustments_minor,
      amountMinor: i.amount_minor,
      vatMinor: i.vat_minor,
      status: i.status,
    })),
    templates: ((templates ?? []) as Row[]).map(toTemplate),
    keys: ((keys ?? []) as Row[]).map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes ?? [], createdAt: k.created_at, lastUsedAt: k.last_used_at, revokedAt: k.revoked_at })),
    invites: ((invites ?? []) as Row[]).map((i) => ({
      id: i.id,
      label: i.label ?? '',
      group: (one(i.memora_groups) as Row | null)?.name ?? '',
      url: linkSecret() && !i.used_at && !i.revoked_at ? `${siteUrl()}/join/${signGiftToken('invite', i.id)}` : '',
      state: i.revoked_at ? 'revoked' : i.used_at ? 'used' : new Date(i.expires_at).getTime() < Date.now() ? 'expired' : 'open',
    })),
    audit,
  };
}

const toTemplate = (t: Row): Template => ({
  id: t.id,
  name: t.name,
  kind: t.kind,
  tradition: t.tradition ?? '',
  items: Array.isArray(t.items) ? t.items : [],
  wording: t.wording ?? '',
  audience: t.audience,
  audienceIds: t.audience_ids ?? [],
  active: t.active,
  updatedAt: t.updated_at,
});

const pretty = (v: unknown): string =>
  v === null || v === undefined
    ? ''
    : typeof v === 'object'
      ? Object.entries(v as Record<string, unknown>)
          .map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : typeof x === 'object' && x ? JSON.stringify(x) : String(x)}`)
          .join(' · ')
      : String(v);

export async function loadAccountAudit(admin: SupabaseClient, accountId: string, limit = 200): Promise<AuditEntry[]> {
  const { data } = await admin.from('memora_activity_log').select('created_at,actor_user_id,action,metadata').eq('account_id', accountId).order('created_at', { ascending: false }).limit(limit);
  const rows = (data ?? []) as Row[];
  const labels = new Map<string, string>();
  await Promise.all(
    [...new Set(rows.map((r) => r.actor_user_id).filter(Boolean))].map(async (id: string) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) labels.set(id, accountLabel(u.user.email));
    }),
  );
  return rows.map((r) => {
    const { before, after, ...rest } = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      at: r.created_at,
      actor: labels.get(r.actor_user_id) ?? 'System',
      action: String(r.action).replace(/^ADMIN_/, '').replace(/_/g, ' ').toLowerCase(),
      detail: pretty(rest),
      before: pretty(before),
      after: pretty(after),
    };
  });
}

/** Templates a branch may use: its own home's, and its group's that reach it. */
export async function templatesForBranch(admin: SupabaseClient, orgId: string, branchId: string | null): Promise<Template[]> {
  const { data: org } = await admin.from('memora_orgs').select('account_id').eq('id', orgId).maybeSingle();
  const { data: branch } = branchId ? await admin.from('memora_branches').select('id,region_id').eq('id', branchId).maybeSingle() : { data: null };
  const q = admin.from('memora_templates').select('*').eq('active', true);
  const { data } = org?.account_id ? await q.or(`account_id.eq.${org.account_id},org_id.eq.${orgId}`) : await q.eq('org_id', orgId);
  return ((data ?? []) as Row[]).map(toTemplate).filter((t) => {
    if (t.audience === 'all') return true;
    if (!branch) return false;
    return t.audience === 'branches' ? t.audienceIds.includes(branch.id) : Boolean(branch.region_id && t.audienceIds.includes(branch.region_id));
  });
}

// ---------------------------------------------------------------------------
// Billing: one invoice per active account per month, across all its homes.
// ---------------------------------------------------------------------------

export async function generateAccountInvoices(admin: SupabaseClient, period: string, now: string): Promise<number> {
  const { data: accounts } = await admin.from('memora_accounts').select('*');
  const billable = ((accounts ?? []) as Row[]).map(toAccount).filter((a) => CONTRACT_STATUS[a.status].billed);
  if (!billable.length) return 0;
  const [{ data: orgs }, { data: usage }, { data: existing }, { data: adj }] = await Promise.all([
    admin.from('memora_orgs').select('id,account_id').not('account_id', 'is', null),
    admin.from('memora_org_usage').select('case_id,org_id,published_at').eq('period', period),
    admin.from('memora_account_invoices').select('account_id,period,status'),
    admin.from('memora_billing_adjustments').select('account_id,amount_minor').eq('period', period).not('account_id', 'is', null),
  ]);
  const accountOf = new Map(((orgs ?? []) as Row[]).map((o) => [o.id as string, o.account_id as string]));
  const byHome = billableUsage(((usage ?? []) as Row[]).map((u) => ({ caseId: u.case_id, orgId: u.org_id, status: 'PUBLISHED', publishedAt: u.published_at })), period);
  const used = new Map<string, number>();
  byHome.forEach((n, org) => {
    const acc = accountOf.get(org);
    if (acc) used.set(acc, (used.get(acc) ?? 0) + n);
  });
  const adjustments = new Map<string, number>();
  for (const a of (adj ?? []) as Row[]) adjustments.set(a.account_id, (adjustments.get(a.account_id) ?? 0) + Number(a.amount_minor));
  const had = new Set(((existing ?? []) as Row[]).filter((r) => r.period < period).map((r) => r.account_id));
  const locked = new Set(((existing ?? []) as Row[]).filter((r) => r.period === period && r.status !== 'DRAFT').map((r) => r.account_id));
  let made = 0;
  for (const a of billable) {
    if (locked.has(a.id)) continue;
    const inv = proInvoice(a, used.get(a.id) ?? 0, !had.has(a.id), adjustments.get(a.id) ?? 0, vatRateNow());
    await admin.from('memora_account_invoices').upsert(
      {
        account_id: a.id,
        period,
        memorials: inv.memorials,
        included_memorials: inv.included,
        overage_memorials: inv.overageMemorials,
        monthly_fee_minor: inv.monthly,
        per_memorial_minor: a.perMemorialMinor,
        onboarding_minor: inv.onboarding,
        adjustments_minor: inv.adjustments,
        amount_minor: inv.subtotal,
        vat_minor: inv.vat,
        status: 'DRAFT',
        updated_at: now,
      },
      { onConflict: 'account_id,period' },
    );
    made++;
  }
  return made;
}

// ---------------------------------------------------------------------------
// Provisioning: a serious Enterprise account in one step.
// ---------------------------------------------------------------------------

/** The group-level teams every account starts with (empty, ready for people). */
function starterTeams(modules: Module[]): { name: string; roles: Role[]; description: string }[] {
  return [
    { name: 'Group administrators', roles: ['group_admin'], description: ROLES.group_admin.summary },
    { name: 'Finance', roles: ['group_finance'], description: ROLES.group_finance.summary },
    { name: 'Brand and marketing', roles: ['group_brand'], description: ROLES.group_brand.summary },
    { name: 'Reporting and audit', roles: ['group_reporting'], description: ROLES.group_reporting.summary },
    ...(modules.includes('api_access') ? [{ name: 'Integrations', roles: ['group_integrations'] as Role[], description: ROLES.group_integrations.summary }] : []),
  ];
}

async function findPerson(admin: SupabaseClient, who: string): Promise<{ id: string; email: string } | null> {
  const login = loginAddress(who);
  if (!login) return null;
  const { data } = await admin.rpc('memora_find_account', { p_email: login.email });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? { id: String(row.id), email: String(row.email) } : null;
}

/** Adds someone who has an account to a team; otherwise makes them a one-time link to join it. */
async function addOrInvite(admin: SupabaseClient, actorId: string, accountId: string, groupId: string, who: string): Promise<{ added?: string; link?: string; bad?: string }> {
  if (!loginAddress(who)) return { bad: who };
  const person = await findPerson(admin, who);
  if (person) {
    await admin.from('memora_group_members').insert({ group_id: groupId, user_id: person.id, added_by: actorId });
    return { added: accountLabel(person.email) };
  }
  if (!linkSecret()) return { bad: who };
  const { data } = await admin
    .from('memora_invites')
    .insert({ kind: 'account', account_id: accountId, group_id: groupId, label: who.slice(0, 120), created_by: actorId, expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString() })
    .select('id')
    .single();
  return data ? { link: `${who}: ${siteUrl()}/join/${signGiftToken('invite', data.id as string)}` } : { bad: who };
}

export async function provisionAccount(admin: SupabaseClient, actor: Principal, input: ProInput): Promise<ProResult> {
  const name = text(input.name, 120);
  if (name.length < 2) return { ok: false, error: 'Name the group.', status: 400 };
  const blueprint = isBlueprint(input.blueprint) ? input.blueprint : 'standard';
  const bp = BLUEPRINTS[blueprint];
  const structure = parseStructure(text(input.structure, 20_000), name);
  if (structure.errors.length) return { ok: false, error: structure.errors.slice(0, 3).join(' '), status: 400 };
  if (!structure.branches.length) return { ok: false, error: 'List at least one branch, e.g. “Gauteng > Pretoria Central”.', status: 400 };
  const modules = Array.isArray(input.modules) ? input.modules.filter(isModule) : bp.modules;
  if (structure.regions.length && !modules.includes('regions')) modules.push('regions');
  const status: ContractStatus = isContractStatus(input.status) ? input.status : 'onboarding';
  const logo = text(input.logoUrl, 500);
  const colour = text(input.brandColour, 7);
  if (logo && !/^https:\/\//.test(logo)) return { ok: false, error: 'The logo must be an https:// link (or upload it later in the group’s Brand page).', status: 400 };
  if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) return { ok: false, error: 'Use a colour like #5B3E8C.', status: 400 };
  const allowance = whole(input.branchAllowance, 1, 5000) ?? bp.terms.branchAllowance;
  if (allowance && structure.branches.length > allowance) return { ok: false, error: `That’s ${structure.branches.length} branches, more than the ${allowance} in the contract.`, status: 400 };

  const { data: acc, error } = await admin
    .from('memora_accounts')
    .insert({
      name,
      slug: await uniqueSlug(admin, name, 'memora_accounts'),
      blueprint,
      status,
      monthly_fee_minor: rands(input.monthly) ?? bp.terms.monthlyFeeMinor,
      included_memorials: whole(input.included, 0, 100_000) ?? bp.terms.includedMemorials,
      per_memorial_minor: rands(input.perMemorial) ?? bp.terms.perMemorialMinor,
      onboarding_fee_minor: rands(input.onboarding) ?? bp.terms.onboardingFeeMinor,
      branch_allowance: allowance,
      contract_start: date(input.contractStart),
      renewal_date: date(input.renewalDate),
      contract_end: date(input.contractEnd),
      sla_tier: typeof input.slaTier === 'string' && input.slaTier in SLA_TIERS ? input.slaTier : 'standard',
      support_level: typeof input.supportLevel === 'string' && input.supportLevel in SUPPORT_LEVELS ? input.supportLevel : 'business_hours',
      primary_contact: text(input.primaryContact),
      billing_contact: text(input.billingContact),
      commercial_contact: text(input.commercialContact),
      account_manager: text(input.accountManager),
      modules,
      logo_url: logo,
      brand_colour: colour,
      brand_footer: text(input.brandFooter, 200),
      brand_locks: bp.brandLocks,
      notes: text(input.notes, 2000),
      created_by: actor.userId,
    })
    .select('id')
    .single();
  if (error || !acc) return { ok: false, error: error?.code === '23505' ? 'A group with that name already exists.' : 'Could not create the account.', status: 409 };
  const accountId = acc.id as string;

  try {
    // Regions.
    const regionKind: RegionKind = (['region', 'province', 'district', 'brand', 'division'] as const).find((k) => k === input.regionKind) ?? bp.regionKind;
    const regionIds = new Map<string, string>();
    if (structure.regions.length) {
      const { data: made } = await admin
        .from('memora_regions')
        .insert(structure.regions.map((r) => ({ account_id: accountId, name: r, kind: regionKind })))
        .select('id,name');
      for (const r of (made ?? []) as Row[]) regionIds.set(String(r.name).toLowerCase(), r.id);
    }
    // Homes (business units), each with its Owners team, then their branches.
    const homeIds = new Map<string, string>();
    for (const home of structure.homes) {
      const { data: org } = await admin
        .from('memora_orgs')
        .insert({
          name: home,
          slug: await uniqueSlug(admin, home),
          plan: 'enterprise',
          status: 'active',
          // Billed through the group's contract, never on its own.
          monthly_fee_minor: 0,
          included_memorials: 0,
          per_memorial_minor: 0,
          onboarding_fee_minor: 0,
          onboarding_paid: true,
          branches: 500,
          account_id: accountId,
          logo_url: bp.brandLocks.includes('logo') ? '' : '',
          created_by: actor.userId,
        })
        .select('id')
        .single();
      if (!org) throw new Error(`Could not add ${home}.`);
      homeIds.set(home.toLowerCase(), org.id as string);
      await admin.from('memora_groups').insert({ ...OWNERS_GROUP, org_id: org.id });
    }
    for (const b of structure.branches) {
      const orgId = homeIds.get(b.home.toLowerCase())!;
      const made = await createBranch(admin, orgId, b.branch, b.area);
      if (!made.ok) throw new Error(`${b.branch}: ${made.error}`);
      if (b.region) await admin.from('memora_branches').update({ region_id: regionIds.get(b.region.toLowerCase()) ?? null }).eq('id', made.id);
    }
    // Group teams, and one Regional managers team per region.
    const teams = starterTeams(modules);
    const { data: teamRows } = await admin
      .from('memora_groups')
      .insert([
        ...teams.map((t) => ({ name: t.name, roles: t.roles, description: t.description, account_id: accountId })),
        ...[...regionIds.entries()].map(([, id]) => ({
          name: `Regional managers · ${structure.regions.find((r) => regionIds.get(r.toLowerCase()) === id)}`,
          roles: ['regional_manager'],
          description: ROLES.regional_manager.summary,
          account_id: accountId,
          region_id: id,
        })),
      ])
      .select('id,name');
    const adminsTeam = ((teamRows ?? []) as Row[]).find((t) => t.name === 'Group administrators');
    // Starter templates.
    if (modules.includes('central_templates'))
      await admin.from('memora_templates').insert(
        STARTER_TEMPLATES.map((t) => ({ account_id: accountId, name: t.name, kind: t.kind, tradition: t.tradition, items: t.items ?? [], wording: t.wording ?? '', created_by: actor.userId, updated_by: actor.userId })),
      );
    // The group's administrators: added now, or a link each.
    const added: string[] = [];
    const links: string[] = [];
    const skipped: string[] = [];
    if (adminsTeam)
      for (const who of parsePeople(text(input.admins, 4000))) {
        const out = await addOrInvite(admin, actor.userId, accountId, adminsTeam.id, who);
        if (out.added) added.push(out.added);
        if (out.link) links.push(out.link);
        if (out.bad) skipped.push(out.bad);
      }
    await log(
      admin,
      actor.userId,
      'ACCOUNT_PROVISIONED',
      {
        name,
        blueprint,
        after: {
          monthly: (rands(input.monthly) ?? bp.terms.monthlyFeeMinor) / 100,
          included: whole(input.included, 0, 100_000) ?? bp.terms.includedMemorials,
          perMemorial: (rands(input.perMemorial) ?? bp.terms.perMemorialMinor) / 100,
          regions: structure.regions.length,
          homes: structure.homes.length,
          branches: structure.branches.length,
          modules,
        },
      },
      null,
      { accountId },
    );
    refreshPublicPages();
    return {
      ok: true,
      message: `${name} is set up: ${structure.regions.length ? `${structure.regions.length} region${structure.regions.length === 1 ? '' : 's'}, ` : ''}${structure.homes.length} home${structure.homes.length === 1 ? '' : 's'}, ${structure.branches.length} branch${structure.branches.length === 1 ? '' : 'es'}. ${added.length ? `${added.join(', ')} added as group administrator${added.length === 1 ? '' : 's'}. ` : ''}${links.length ? `${links.length} invite link${links.length === 1 ? '' : 's'} ready on the group’s People page. ` : ''}${skipped.length ? `Couldn’t use: ${skipped.join(', ')}.` : ''}`,
      data: { id: accountId, redirect: `/pro/group?account=${accountId}&tab=people` },
    };
  } catch (err) {
    // Half a group is worse than none: take it all back.
    await admin.from('memora_orgs').delete().eq('account_id', accountId);
    await admin.from('memora_accounts').delete().eq('id', accountId);
    return { ok: false, error: err instanceof Error ? `Nothing was created. ${err.message}` : 'Nothing was created. Please try again.', status: 500 };
  }
}

// ---------------------------------------------------------------------------
// Group actions (head office, regional managers and Memora), each permission-checked.
// ---------------------------------------------------------------------------

export const ENTERPRISE_ACTIONS = new Set([
  'account.provision',
  'account.update',
  'account.contract',
  'account.setStatus',
  'account.modules',
  'account.brand',
  'region.create',
  'region.rename',
  'region.delete',
  'home.create',
  'branch.setRegion',
  'branch.setActive',
  'branch.bulk',
  'people.bulk',
  'template.save',
  'template.archive',
  'apikey.create',
  'apikey.revoke',
  'account.invoiceStatus',
  'account.adjust',
]);

/** What a group's own people may do from the control centre (each still checked below). */
export const GROUP_SELF_SERVICE = new Set(['account.brand', 'region.create', 'region.rename', 'region.delete', 'home.create', 'branch.setRegion', 'branch.setActive', 'branch.bulk', 'people.bulk', 'template.save', 'template.archive', 'apikey.create', 'apikey.revoke']);

async function accountOf(admin: SupabaseClient, id: unknown): Promise<Account | null> {
  if (!uuid(id)) return null;
  const { data } = await admin.from('memora_accounts').select('*').eq('id', id).maybeSingle();
  return data ? toAccount(data) : null;
}

const needModule = (a: Account, m: Module): ProResult | null => (hasModule(a, m) ? null : { ok: false, error: `${MODULES[m].label} isn’t part of this group’s agreement. Talk to Memora to add it.`, status: 403 });

/** Branches a group may still add under its contract. */
async function branchRoom(admin: SupabaseClient, a: Account, adding: number): Promise<ProResult | null> {
  if (!a.branchAllowance) return null;
  const { data: homes } = await admin.from('memora_orgs').select('id').eq('account_id', a.id);
  const ids = ((homes ?? []) as Row[]).map((h) => h.id);
  const { count } = ids.length ? await admin.from('memora_branches').select('id', { count: 'exact', head: true }).in('org_id', ids) : { count: 0 };
  return (count ?? 0) + adding > a.branchAllowance ? { ok: false, error: `The agreement covers ${a.branchAllowance} branches (${count} in use). Talk to Memora to add more.`, status: 409 } : null;
}

export async function performEnterpriseAction(admin: SupabaseClient, actor: Principal, input: ProInput): Promise<ProResult> {
  const now = new Date().toISOString();
  if (input.action === 'account.provision') {
    if (!canAccount(actor, 'accounts.manage', null) || !canAccount(actor, 'orgs.billing', null)) return deny('Creating an Enterprise account needs both Operations and Finance rights (an administrator has both).');
    return provisionAccount(admin, actor, input);
  }
  const a = await accountOf(admin, input.accountId);
  if (!a) return { ok: false, error: 'Group not found.', status: 404 };
  const scope = { accountId: a.id };
  const is = (perm: Parameters<typeof canAccount>[1]) => canAccount(actor, perm, a.id);

  switch (input.action) {
    // ---- Memora: the contract and the account ----
    case 'account.contract': {
      if (!is('orgs.billing')) return deny('Only Memora finance can change the contract.');
      const before = { monthly: a.monthlyFeeMinor / 100, included: a.includedMemorials, perMemorial: a.perMemorialMinor / 100, onboarding: a.onboardingFeeMinor / 100, branches: a.branchAllowance, start: a.contractStart, renewal: a.renewalDate, end: a.contractEnd, sla: a.slaTier, support: a.supportLevel };
      const patch = {
        monthly_fee_minor: rands(input.monthly) ?? a.monthlyFeeMinor,
        included_memorials: whole(input.included, 0, 100_000) ?? a.includedMemorials,
        per_memorial_minor: rands(input.perMemorial) ?? a.perMemorialMinor,
        onboarding_fee_minor: rands(input.onboarding) ?? a.onboardingFeeMinor,
        onboarding_paid: input.onboardingPaid === undefined ? a.onboardingPaid : input.onboardingPaid === true || input.onboardingPaid === 'true',
        branch_allowance: String(input.branchAllowance ?? '').trim() === '' ? null : (whole(input.branchAllowance, 1, 5000) ?? a.branchAllowance),
        contract_start: input.contractStart === undefined ? a.contractStart : date(input.contractStart),
        renewal_date: input.renewalDate === undefined ? a.renewalDate : date(input.renewalDate),
        contract_end: input.contractEnd === undefined ? a.contractEnd : date(input.contractEnd),
        sla_tier: typeof input.slaTier === 'string' && input.slaTier in SLA_TIERS ? input.slaTier : a.slaTier,
        support_level: typeof input.supportLevel === 'string' && input.supportLevel in SUPPORT_LEVELS ? input.supportLevel : a.supportLevel,
        updated_at: now,
      };
      if (patch.monthly_fee_minor === 0 && patch.per_memorial_minor === 0) return { ok: false, error: 'That would make the group free. Set a monthly fee or a per-memorial rate.', status: 400 };
      await admin.from('memora_accounts').update(patch).eq('id', a.id);
      await log(
        admin,
        actor.userId,
        'CONTRACT_CHANGED',
        {
          group: a.name,
          before,
          after: {
            monthly: patch.monthly_fee_minor / 100,
            included: patch.included_memorials,
            perMemorial: patch.per_memorial_minor / 100,
            onboarding: patch.onboarding_fee_minor / 100,
            branches: patch.branch_allowance,
            start: patch.contract_start,
            renewal: patch.renewal_date,
            end: patch.contract_end,
            sla: patch.sla_tier,
            support: patch.support_level,
          },
        },
        null,
        scope,
      );
      return { ok: true, message: 'Contract saved. It applies from the next invoice run.' };
    }
    case 'account.update': {
      if (!is('accounts.manage')) return deny();
      const patch: Row = { updated_at: now };
      for (const [k, col, max] of [
        ['name', 'name', 120],
        ['primaryContact', 'primary_contact', 200],
        ['billingContact', 'billing_contact', 200],
        ['commercialContact', 'commercial_contact', 200],
        ['accountManager', 'account_manager', 200],
        ['notes', 'notes', 2000],
      ] as const)
        if (typeof input[k] === 'string') patch[col] = text(input[k], max);
      if (patch.name !== undefined && String(patch.name).length < 2) return { ok: false, error: 'Name the group.', status: 400 };
      await admin.from('memora_accounts').update(patch).eq('id', a.id);
      await log(admin, actor.userId, 'ACCOUNT_UPDATED', { group: a.name, fields: Object.keys(patch).filter((k) => k !== 'updated_at') }, null, scope);
      return { ok: true, message: 'Saved.' };
    }
    case 'account.setStatus': {
      if (!is('accounts.manage')) return deny();
      if (!isContractStatus(input.status)) return { ok: false, error: 'Unknown status.', status: 400 };
      if ((input.status === 'suspended' || input.status === 'closed') && text(input.reason).length < 3) return { ok: false, error: 'Give a reason (it’s kept in the audit log).', status: 400 };
      await admin.from('memora_accounts').update({ status: input.status, updated_at: now }).eq('id', a.id);
      await log(admin, actor.userId, 'ACCOUNT_STATUS', { group: a.name, before: { status: a.status }, after: { status: input.status }, reason: text(input.reason, 500) }, null, scope);
      refreshPublicPages();
      return { ok: true, message: `${CONTRACT_STATUS[input.status].label}. ${CONTRACT_STATUS[input.status].hint}` };
    }
    case 'account.modules': {
      if (!is('accounts.manage')) return deny();
      const modules = Array.isArray(input.modules) ? [...new Set(input.modules.filter(isModule))] : a.modules;
      await admin.from('memora_accounts').update({ modules, updated_at: now }).eq('id', a.id);
      await log(admin, actor.userId, 'MODULES_CHANGED', { group: a.name, before: { modules: a.modules }, after: { modules } }, null, scope);
      return { ok: true, message: 'Modules saved. The group sees the change on its next page.' };
    }
    case 'account.invoiceStatus': {
      if (!is('orgs.billing') || !uuid(input.id)) return deny();
      const status = input.status;
      if (status !== 'SENT' && status !== 'PAID' && status !== 'VOID' && status !== 'DRAFT') return { ok: false, error: 'Unknown status.', status: 400 };
      const { data } = await admin.from('memora_account_invoices').update({ status, updated_at: now }).eq('id', input.id).eq('account_id', a.id).select('onboarding_minor,period').maybeSingle();
      if (status === 'PAID' && data?.onboarding_minor) await admin.from('memora_accounts').update({ onboarding_paid: true }).eq('id', a.id);
      await log(admin, actor.userId, `INVOICE_${status}`, { group: a.name, period: data?.period ?? '' }, null, scope);
      return { ok: true, message: `Marked ${status.toLowerCase()}.` };
    }
    case 'account.adjust': {
      if (!is('orgs.billing')) return deny();
      const period = typeof input.period === 'string' && /^\d{4}-\d{2}$/.test(input.period) ? input.period : periodOf();
      const raw = String(input.amount ?? '').trim();
      const amount = rands(raw.replace(/^-/, ''));
      if (!amount) return { ok: false, error: 'Enter an amount in rand.', status: 400 };
      const signed = raw.startsWith('-') || input.kind === 'credit' ? -amount : amount;
      const reason = text(input.reason, 300);
      if (reason.length < 3) return { ok: false, error: 'Give a reason.', status: 400 };
      await admin.from('memora_billing_adjustments').insert({ account_id: a.id, period, amount_minor: signed, reason, created_by: actor.userId });
      await log(admin, actor.userId, 'BILLING_ADJUSTED', { group: a.name, period, amount: signed / 100, reason }, null, scope);
      return { ok: true, message: `${signed < 0 ? 'Credit' : 'Charge'} recorded for ${period}. Re-make the drafts to include it.` };
    }

    // ---- Head office: brand ----
    case 'account.brand': {
      if (!is('group.brand')) return deny();
      const gate = needModule(a, 'brand_governance');
      if (gate) return gate;
      const logo = typeof input.logoUrl === 'string' ? text(input.logoUrl, 500) : a.logoUrl;
      const colour = typeof input.brandColour === 'string' ? text(input.brandColour, 7) : a.brandColour;
      const footer = typeof input.brandFooter === 'string' ? text(input.brandFooter, 200) : a.brandFooter;
      if (logo && !/^https:\/\//.test(logo)) return { ok: false, error: 'The logo must be an https:// link.', status: 400 };
      if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) return { ok: false, error: 'Use a colour like #5B3E8C.', status: 400 };
      const locks = Array.isArray(input.locks) ? input.locks.filter((x): x is BrandPart => x === 'logo' || x === 'colour' || x === 'footer') : a.brandLocks;
      await admin.from('memora_accounts').update({ logo_url: logo, brand_colour: colour, brand_footer: footer, brand_locks: locks, updated_at: now }).eq('id', a.id);
      await log(
        admin,
        actor.userId,
        'BRAND_CHANGED',
        { group: a.name, before: { logo: a.logoUrl ? 'set' : 'none', colour: a.brandColour, footer: a.brandFooter, locked: a.brandLocks }, after: { logo: logo ? 'set' : 'none', colour, footer, locked: locks } },
        null,
        scope,
      );
      refreshPublicPages();
      return { ok: true, message: 'Brand saved. Every home’s memorials show it straight away.' };
    }

    // ---- Head office: structure ----
    case 'region.create': {
      if (!is('group.structure')) return deny();
      const gate = needModule(a, 'regions');
      if (gate) return gate;
      const name = text(input.name, 80);
      if (name.length < 2) return { ok: false, error: 'Name the region.', status: 400 };
      const kind = (['region', 'province', 'district', 'brand', 'division'] as const).find((k) => k === input.kind) ?? 'region';
      const { data, error } = await admin.from('memora_regions').insert({ account_id: a.id, name, kind }).select('id').single();
      if (error || !data) return { ok: false, error: error?.code === '23505' ? 'There’s already a region with that name.' : 'Could not add the region.', status: 409 };
      await admin.from('memora_groups').insert({ name: `Regional managers · ${name}`, roles: ['regional_manager'], description: ROLES.regional_manager.summary, account_id: a.id, region_id: data.id });
      await log(admin, actor.userId, 'REGION_ADDED', { group: a.name, region: name, kind }, null, scope);
      return { ok: true, message: `${name} added, with its Regional managers team. Move branches into it below.` };
    }
    case 'region.rename':
    case 'region.delete': {
      if (!is('group.structure') || !uuid(input.id)) return deny();
      const { data: r } = await admin.from('memora_regions').select('*').eq('id', input.id).eq('account_id', a.id).maybeSingle();
      if (!r) return { ok: false, error: 'Region not found.', status: 404 };
      if (input.action === 'region.rename') {
        const name = text(input.name, 80);
        if (name.length < 2) return { ok: false, error: 'Name the region.', status: 400 };
        await admin.from('memora_regions').update({ name }).eq('id', r.id);
        await admin.from('memora_groups').update({ name: `Regional managers · ${name}` }).eq('region_id', r.id).eq('name', `Regional managers · ${r.name}`);
        await log(admin, actor.userId, 'REGION_RENAMED', { group: a.name, before: { name: r.name }, after: { name } }, null, scope);
        return { ok: true, message: 'Saved.' };
      }
      if (text(input.confirm) !== r.name) return { ok: false, error: `Type the region’s name (${r.name}) to confirm.`, status: 400 };
      await admin.from('memora_regions').delete().eq('id', r.id);
      await log(admin, actor.userId, 'REGION_REMOVED', { group: a.name, region: r.name }, null, scope);
      return { ok: true, message: `${r.name} removed. Its branches stay, without a region; its regional managers lost that role.` };
    }
    case 'home.create': {
      if (!is('group.structure')) return deny();
      const name = text(input.name, 120);
      if (name.length < 2) return { ok: false, error: 'Name the funeral home.', status: 400 };
      const branch = text(input.branchName, 80) || 'Main branch';
      const room = await branchRoom(admin, a, 1);
      if (room) return room;
      const { data: org } = await admin
        .from('memora_orgs')
        .insert({ name, slug: await uniqueSlug(admin, name), plan: 'enterprise', status: 'active', monthly_fee_minor: 0, included_memorials: 0, per_memorial_minor: 0, onboarding_fee_minor: 0, onboarding_paid: true, branches: 500, account_id: a.id, created_by: actor.userId })
        .select('id')
        .single();
      if (!org) return { ok: false, error: 'Could not add the funeral home.', status: 500 };
      await admin.from('memora_groups').insert({ ...OWNERS_GROUP, org_id: org.id });
      const made = await createBranch(admin, org.id as string, branch, text(input.area, 120));
      if (made.ok && uuid(input.regionId)) await admin.from('memora_branches').update({ region_id: input.regionId }).eq('id', made.id);
      await log(admin, actor.userId, 'HOME_ADDED', { group: a.name, home: name, branch }, null, { accountId: a.id, orgId: org.id as string });
      return { ok: true, message: `${name} added with its first branch, ${branch}.` };
    }
    case 'branch.setRegion':
    case 'branch.setActive': {
      if (!is('group.structure')) return deny();
      const ids = (Array.isArray(input.ids) ? input.ids : [input.id]).filter(uuid).slice(0, 500);
      if (!ids.length) return { ok: false, error: 'Choose at least one branch.', status: 400 };
      const { data: homes } = await admin.from('memora_orgs').select('id').eq('account_id', a.id);
      const homeIds = ((homes ?? []) as Row[]).map((h) => h.id);
      const { data: mine } = await admin.from('memora_branches').select('id,name,region_id,active').in('id', ids).in('org_id', homeIds.length ? homeIds : ['00000000-0000-0000-0000-000000000000']);
      const rows = (mine ?? []) as Row[];
      if (rows.length !== ids.length) return { ok: false, error: 'Some of those branches aren’t in this group.', status: 404 };
      if (input.action === 'branch.setRegion') {
        const regionId = uuid(input.regionId) ? input.regionId : null;
        if (regionId) {
          const { data: r } = await admin.from('memora_regions').select('id').eq('id', regionId).eq('account_id', a.id).maybeSingle();
          if (!r) return { ok: false, error: 'Region not found.', status: 404 };
        }
        await admin.from('memora_branches').update({ region_id: regionId }).in('id', ids);
        await log(admin, actor.userId, 'BRANCH_REGION_SET', { group: a.name, branches: rows.map((b) => b.name), after: { region: regionId ?? 'none' } }, null, scope);
        return { ok: true, message: `${ids.length} branch${ids.length === 1 ? '' : 'es'} moved.` };
      }
      const active = input.active === true || input.active === 'true';
      if (!active && ids.length > 1 && text(input.confirm) !== `${ids.length}`) return { ok: false, error: `Type ${ids.length} to confirm switching off ${ids.length} branches.`, status: 400 };
      await admin.from('memora_branches').update({ active }).in('id', ids);
      await log(admin, actor.userId, active ? 'BRANCHES_ACTIVATED' : 'BRANCHES_DEACTIVATED', { group: a.name, branches: rows.map((b) => b.name) }, null, scope);
      return { ok: true, message: `${ids.length} branch${ids.length === 1 ? '' : 'es'} switched ${active ? 'on' : 'off'}. Published memorials are not affected.` };
    }
    case 'branch.bulk': {
      // CSV or lines: Region > Home > Branch | area
      if (!is('group.structure')) return deny();
      const gate = needModule(a, 'bulk_import');
      if (gate) return gate;
      const { data: homes } = await admin.from('memora_orgs').select('id,name').eq('account_id', a.id);
      const first = ((homes ?? []) as Row[])[0]?.name ?? a.name;
      const plan = parseStructure(text(input.lines, 50_000).replace(/,/g, ' | ').replace(/\s*\|\s*\|/g, ' |'), first);
      if (plan.errors.length) return { ok: false, error: plan.errors.slice(0, 3).join(' '), status: 400 };
      if (!plan.branches.length) return { ok: false, error: 'Nothing to import.', status: 400 };
      const room = await branchRoom(admin, a, plan.branches.length);
      if (room) return room;
      const homeIds = new Map(((homes ?? []) as Row[]).map((h) => [String(h.name).toLowerCase(), h.id as string]));
      const { data: regions } = await admin.from('memora_regions').select('id,name').eq('account_id', a.id);
      const regionIds = new Map(((regions ?? []) as Row[]).map((r) => [String(r.name).toLowerCase(), r.id as string]));
      const missing = plan.regions.filter((r) => !regionIds.has(r.toLowerCase()));
      if (missing.length && !hasModule(a, 'regions')) return { ok: false, error: 'Regions aren’t switched on for this group.', status: 403 };
      let added = 0;
      const problems: string[] = [];
      for (const r of missing) {
        const { data } = await admin.from('memora_regions').insert({ account_id: a.id, name: r, kind: 'region' }).select('id').single();
        if (data) {
          regionIds.set(r.toLowerCase(), data.id as string);
          await admin.from('memora_groups').insert({ name: `Regional managers · ${r}`, roles: ['regional_manager'], description: ROLES.regional_manager.summary, account_id: a.id, region_id: data.id });
        }
      }
      for (const b of plan.branches) {
        let orgId = homeIds.get(b.home.toLowerCase());
        if (!orgId) {
          const { data: org } = await admin
            .from('memora_orgs')
            .insert({ name: b.home, slug: await uniqueSlug(admin, b.home), plan: 'enterprise', status: 'active', monthly_fee_minor: 0, included_memorials: 0, per_memorial_minor: 0, onboarding_fee_minor: 0, onboarding_paid: true, branches: 500, account_id: a.id, created_by: actor.userId })
            .select('id')
            .single();
          if (!org) {
            problems.push(b.home);
            continue;
          }
          orgId = org.id as string;
          homeIds.set(b.home.toLowerCase(), orgId);
          await admin.from('memora_groups').insert({ ...OWNERS_GROUP, org_id: orgId });
        }
        const made = await createBranch(admin, orgId, b.branch, b.area);
        if (!made.ok) {
          problems.push(`${b.branch} (${made.error})`);
          continue;
        }
        if (b.region) await admin.from('memora_branches').update({ region_id: regionIds.get(b.region.toLowerCase()) ?? null }).eq('id', made.id);
        added++;
      }
      await log(admin, actor.userId, 'BRANCHES_IMPORTED', { group: a.name, added, problems }, null, scope);
      return { ok: added > 0, ...(added > 0 ? { message: `${added} branch${added === 1 ? '' : 'es'} added.${problems.length ? ` Skipped: ${problems.join(', ')}.` : ''}` } : { error: `Nothing added. ${problems.join(', ')}`, status: 400 }) } as ProResult;
    }
    case 'people.bulk': {
      // Lines: number or email, role, place (region, home or branch name)
      if (!is('group.people')) return deny();
      const gate = needModule(a, 'bulk_import');
      if (gate) return gate;
      const lines = text(input.lines, 50_000)
        .split(/\r?\n/)
        .map((l) => l.split(/[,;\t]/).map((x) => x.trim()))
        .filter((l) => l[0]);
      if (!lines.length) return { ok: false, error: 'Nothing to import.', status: 400 };
      if (lines.length > 300) return { ok: false, error: 'Up to 300 people at a time.', status: 400 };
      const groups = await loadGroups(admin, undefined, a.id);
      const { data: homes } = await admin.from('memora_orgs').select('id,name').eq('account_id', a.id);
      const homeIds = ((homes ?? []) as Row[]).map((h) => h.id as string);
      const [homeGroups, { data: branches }, { data: regions }] = await Promise.all([
        Promise.all(homeIds.map((id) => loadGroups(admin, id))).then((x) => x.flat()),
        admin.from('memora_branches').select('id,name,org_id').in('org_id', homeIds.length ? homeIds : ['00000000-0000-0000-0000-000000000000']),
        admin.from('memora_regions').select('id,name').eq('account_id', a.id),
      ]);
      const ROLE_WORDS: Record<string, Role> = {
        admin: 'group_admin',
        'group admin': 'group_admin',
        'group administrator': 'group_admin',
        finance: 'group_finance',
        brand: 'group_brand',
        marketing: 'group_brand',
        reporting: 'group_reporting',
        auditor: 'group_reporting',
        integrations: 'group_integrations',
        'regional manager': 'regional_manager',
        owner: 'org_owner',
        manager: 'org_admin',
        'branch manager': 'org_admin',
        arranger: 'org_staff',
      };
      const done: string[] = [];
      const links: string[] = [];
      const problems: string[] = [];
      for (const [who, roleWord = '', place = ''] of lines) {
        const role = ROLE_WORDS[roleWord.toLowerCase()] ?? (isRole(roleWord) ? roleWord : null);
        if (!role) {
          problems.push(`${who} (unknown role “${roleWord}”)`);
          continue;
        }
        const lc = place.toLowerCase();
        let target: Group | undefined;
        if (ROLES[role].scope === 'account') {
          const region = ((regions ?? []) as Row[]).find((r) => String(r.name).toLowerCase() === lc);
          target = groups.find((g) => g.roles.includes(role) && (role === 'regional_manager' ? g.regionId === region?.id : !g.regionId));
        } else if (role === 'org_owner') {
          const home = ((homes ?? []) as Row[]).find((h) => String(h.name).toLowerCase() === lc);
          target = homeGroups.find((g) => g.orgId === home?.id && !g.branchId && g.roles.includes('org_owner'));
        } else {
          const b = ((branches ?? []) as Row[]).find((x) => String(x.name).toLowerCase() === lc);
          target = homeGroups.find((g) => g.branchId === b?.id && g.roles.includes(role));
        }
        if (!target) {
          problems.push(`${who} (no ${ROLES[role].label.toLowerCase()} team for “${place}”)`);
          continue;
        }
        if (!canGrantRole(actor, role, target.orgId, target.branchId, { accountId: target.accountId, regionId: target.regionId })) {
          problems.push(`${who} (you can’t appoint a ${ROLES[role].label.toLowerCase()})`);
          continue;
        }
        const out = await addOrInvite(admin, actor.userId, a.id, target.id, who);
        if (out.added) done.push(`${out.added} → ${target.name}`);
        if (out.link) links.push(out.link);
        if (out.bad) problems.push(`${who} (not a cellphone number or email)`);
      }
      await log(admin, actor.userId, 'PEOPLE_IMPORTED', { group: a.name, added: done.length, invited: links.length, problems: problems.length }, null, scope);
      return {
        ok: true,
        message: `${done.length} added${links.length ? `, ${links.length} invite link${links.length === 1 ? '' : 's'} made (see below)` : ''}.${problems.length ? ` Not done: ${problems.slice(0, 6).join('; ')}${problems.length > 6 ? '…' : ''}.` : ''}`,
      };
    }

    // ---- Head office: templates ----
    case 'template.save': {
      if (!is('group.templates')) return deny();
      const gate = needModule(a, 'central_templates');
      if (gate) return gate;
      const name = text(input.name, 80);
      if (name.length < 2) return { ok: false, error: 'Name the template.', status: 400 };
      const kind = input.kind === 'wording' ? 'wording' : 'programme';
      const audience = input.audience === 'regions' || input.audience === 'branches' ? input.audience : 'all';
      const audienceIds = (Array.isArray(input.audienceIds) ? input.audienceIds : []).filter(uuid);
      if (audience !== 'all' && !audienceIds.length) return { ok: false, error: 'Choose who it’s published to.', status: 400 };
      // "Hymn | 5" per line: title and minutes, in the part named by a heading line ("# At the graveside").
      let part: 'vigil' | 'service' | 'graveside' = 'service';
      const items =
        kind === 'programme'
          ? text(input.itemsText, 8000)
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
              .flatMap((l) => {
                if (l.startsWith('#')) {
                  const h = l.toLowerCase();
                  part = h.includes('grave') ? 'graveside' : h.includes('vigil') ? 'vigil' : 'service';
                  return [];
                }
                const [title, mins] = l.split('|').map((x) => x.trim());
                return title.length >= 2 ? [{ part, type: 'custom', title: title.slice(0, 120), minutes: Math.max(1, Math.min(180, Number(mins) || 5)) }] : [];
              })
          : [];
      if (kind === 'programme' && !items.length) return { ok: false, error: 'Add at least one programme item, one per line.', status: 400 };
      const row = { account_id: a.id, name, kind, tradition: text(input.tradition, 80), items, wording: kind === 'wording' ? text(input.wording, 4000) : '', audience, audience_ids: audience === 'all' ? [] : audienceIds, active: true, updated_by: actor.userId, updated_at: now };
      if (uuid(input.id)) {
        const { data: old } = await admin.from('memora_templates').select('*').eq('id', input.id).eq('account_id', a.id).maybeSingle();
        if (!old) return { ok: false, error: 'Template not found.', status: 404 };
        await admin.from('memora_templates').update(row).eq('id', old.id);
        await log(admin, actor.userId, 'TEMPLATE_CHANGED', { group: a.name, template: name, before: { items: (old.items ?? []).length, audience: old.audience }, after: { items: items.length, audience } }, null, scope);
        return { ok: true, message: 'Template saved. Branches see the new version straight away.' };
      }
      await admin.from('memora_templates').insert({ ...row, created_by: actor.userId });
      await log(admin, actor.userId, 'TEMPLATE_PUBLISHED', { group: a.name, template: name, audience }, null, scope);
      return { ok: true, message: `“${name}” published${audience === 'all' ? ' to every branch' : ''}.` };
    }
    case 'template.archive': {
      if (!is('group.templates') || !uuid(input.id)) return deny();
      const active = input.active === true || input.active === 'true';
      const { data: t } = await admin.from('memora_templates').update({ active, updated_by: actor.userId, updated_at: now }).eq('id', input.id).eq('account_id', a.id).select('name').maybeSingle();
      if (!t) return { ok: false, error: 'Template not found.', status: 404 };
      await log(admin, actor.userId, active ? 'TEMPLATE_RESTORED' : 'TEMPLATE_WITHDRAWN', { group: a.name, template: t.name }, null, scope);
      return { ok: true, message: active ? 'Published again.' : 'Withdrawn. Branches no longer see it; memorials already made keep their programme.' };
    }

    // ---- Integrations ----
    case 'apikey.create': {
      if (!is('group.integrations')) return deny();
      const gate = needModule(a, 'api_access');
      if (gate) return gate;
      const name = text(input.name, 80);
      if (name.length < 2) return { ok: false, error: 'Name the key after the system that will use it.', status: 400 };
      const scopes = (Array.isArray(input.scopes) ? input.scopes : ['read:funerals']).filter((x): x is string => typeof x === 'string' && API_SCOPES.includes(x as ApiScope));
      if (!scopes.length) return { ok: false, error: 'Choose what the key may do.', status: 400 };
      const secret = `mem_live_${randomBytes(24).toString('base64url')}`;
      await admin.from('memora_api_keys').insert({ account_id: a.id, name, prefix: secret.slice(0, 13), key_hash: hashKey(secret), scopes, created_by: actor.userId });
      await log(admin, actor.userId, 'API_KEY_CREATED', { group: a.name, key: name, scopes }, null, scope);
      // The key is shown once, now; only its hash is kept.
      return { ok: true, message: 'Key made. Copy it now: it won’t be shown again.', data: { secret } };
    }
    case 'apikey.revoke': {
      if (!is('group.integrations') || !uuid(input.id)) return deny();
      const { data: k } = await admin.from('memora_api_keys').update({ revoked_at: now }).eq('id', input.id).eq('account_id', a.id).is('revoked_at', null).select('name').maybeSingle();
      if (!k) return { ok: false, error: 'Key not found, or already revoked.', status: 404 };
      await log(admin, actor.userId, 'API_KEY_REVOKED', { group: a.name, key: k.name }, null, scope);
      return { ok: true, message: 'Revoked. Anything using it stops working at once.' };
    }
  }
  return { ok: false, error: 'Unknown action.', status: 400 };
}

export type ApiScope = 'read:funerals' | 'read:reports' | 'write:memorials';
export const API_SCOPES: ApiScope[] = ['read:funerals', 'read:reports', 'write:memorials'];
export const hashKey = (secret: string) => createHash('sha256').update(secret).digest('hex');

export { buildReport, type ReportFilters, type ReportRow } from '../enterprise';

export { periodRange, adjustmentsFor, BRANCH_GROUPS };
