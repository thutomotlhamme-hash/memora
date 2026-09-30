import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { accountLabel, loginAddress } from '../account-id';
import { slugify } from '../memorial';
import { PRO_PLANS, billableUsage, isProPlan, periodOf, proInvoice, type ProPlan } from '../plans';
import { ALL_ROLES, ROLES, can, canGrantRole, canIn, isRole, type Permission, type Principal, type Role } from '../rbac';
import { createInvite, revokeInvite } from './invites';
import { refreshPublicPages } from './public-cache';

type Row = Record<string, any>;
export type ProInput = Record<string, unknown> & { action: string };
export type ProResult = { ok: true; message: string; data?: Record<string, string> } | { ok: false; error: string; status: number };

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const rands = (v: unknown): number | null => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.round(n * 100) : null;
};
const deny = (why = 'You don’t have permission to do that.'): ProResult => ({ ok: false, error: why, status: 403 });

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: ProPlan;
  status: 'trial' | 'active' | 'disabled';
  monthlyFeeMinor: number;
  /** Published memorials included each month. */
  includedMemorials: number;
  /** Each published memorial beyond the allowance. */
  perMemorialMinor: number;
  onboardingFeeMinor: number;
  onboardingPaid: boolean;
  contractStart: string | null;
  contractEnd: string | null;
  branches: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  logoUrl: string;
  brandColour: string;
  notes: string;
  createdAt: string;
  memorials: number;
  publishedThisMonth: number;
}

const toOrg = (r: Row): Omit<Org, 'memorials' | 'publishedThisMonth'> => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  plan: r.plan,
  status: r.status,
  monthlyFeeMinor: r.monthly_fee_minor,
  includedMemorials: r.included_memorials ?? 0,
  perMemorialMinor: r.per_memorial_minor,
  onboardingFeeMinor: r.onboarding_fee_minor,
  onboardingPaid: r.onboarding_paid,
  contractStart: r.contract_start,
  contractEnd: r.contract_end,
  branches: r.branches,
  contactName: r.contact_name,
  contactPhone: r.contact_phone,
  contactEmail: r.contact_email,
  logoUrl: r.logo_url,
  brandColour: r.brand_colour,
  notes: r.notes,
  createdAt: r.created_at,
});

/**
 * Memorials each funeral home published in a month: what gets billed. Read from
 * the usage ledger (one row per memorial, written when it is first published),
 * so edits, re-publishing, takedowns and restores never count twice.
 */
export async function usageFor(admin: SupabaseClient, period: string, orgId?: string): Promise<Map<string, number>> {
  let q = admin.from('memora_org_usage').select('case_id,org_id,published_at').eq('period', period);
  if (orgId) q = q.eq('org_id', orgId);
  const { data } = await q;
  return billableUsage(((data ?? []) as Row[]).map((r) => ({ caseId: r.case_id, orgId: r.org_id, status: 'PUBLISHED', publishedAt: r.published_at })), period);
}

/** Credits and extra charges for a month, per funeral home. */
export async function adjustmentsFor(admin: SupabaseClient, period: string): Promise<Map<string, number>> {
  const { data } = await admin.from('memora_billing_adjustments').select('org_id,amount_minor').eq('period', period).not('org_id', 'is', null);
  const out = new Map<string, number>();
  for (const r of (data ?? []) as Row[]) out.set(r.org_id, (out.get(r.org_id) ?? 0) + Number(r.amount_minor));
  return out;
}

export function countBy(rows: Row[], key: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) if (r[key]) out.set(r[key], (out.get(r[key]) ?? 0) + 1);
  return out;
}

export async function loadOrgs(admin: SupabaseClient, onlyIds?: string[]): Promise<Org[]> {
  let q = admin.from('memora_orgs').select('*').order('name');
  if (onlyIds) q = q.in('id', onlyIds.length ? onlyIds : ['00000000-0000-0000-0000-000000000000']);
  const [{ data: orgs }, { data: cases }, usage] = await Promise.all([q, admin.from('memora_cases').select('org_id').not('org_id', 'is', null), usageFor(admin, periodOf())]);
  const totals = new Map<string, number>();
  for (const c of (cases ?? []) as Row[]) totals.set(c.org_id, (totals.get(c.org_id) ?? 0) + 1);
  return ((orgs ?? []) as Row[]).map((r) => ({ ...toOrg(r), memorials: totals.get(r.id) ?? 0, publishedThisMonth: usage.get(r.id) ?? 0 }));
}

export interface Group {
  id: string;
  name: string;
  description: string;
  orgId: string | null;
  branchId: string | null;
  roles: Role[];
  active: boolean;
  members: { userId: string; label: string; name: string; addedAt: string }[];
}

export async function loadGroups(admin: SupabaseClient, orgId?: string | null): Promise<Group[]> {
  let q = admin.from('memora_groups').select('*').order('name');
  if (orgId !== undefined) q = orgId === null ? q.is('org_id', null) : q.eq('org_id', orgId);
  const [{ data: groups }, { data: people }] = await Promise.all([q, admin.rpc('memora_group_people')]);
  const byGroup = new Map<string, Group['members']>();
  for (const p of (people ?? []) as Row[]) {
    const list = byGroup.get(p.group_id) ?? [];
    list.push({ userId: p.user_id, label: accountLabel(p.email), name: p.name ?? '', addedAt: p.added_at });
    byGroup.set(p.group_id, list);
  }
  return ((groups ?? []) as Row[]).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    orgId: g.org_id,
    branchId: g.branch_id ?? null,
    roles: ((g.roles ?? []) as string[]).filter(isRole),
    active: g.active,
    members: byGroup.get(g.id) ?? [],
  }));
}

export interface Invoice {
  id: string;
  orgId: string;
  period: string;
  memorials: number;
  includedMemorials: number;
  overageMemorials: number;
  monthlyFeeMinor: number;
  perMemorialMinor: number;
  onboardingMinor: number;
  adjustmentsMinor: number;
  /** Excluding VAT. */
  amountMinor: number;
  vatMinor: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'VOID';
  createdAt: string;
}

export async function loadInvoices(admin: SupabaseClient, orgId?: string): Promise<Invoice[]> {
  let q = admin.from('memora_org_invoices').select('*').order('period', { ascending: false }).limit(300);
  if (orgId) q = q.eq('org_id', orgId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    orgId: r.org_id,
    period: r.period,
    memorials: r.memorials,
    includedMemorials: r.included_memorials ?? 0,
    overageMemorials: r.overage_memorials ?? r.memorials,
    monthlyFeeMinor: r.monthly_fee_minor,
    perMemorialMinor: r.per_memorial_minor,
    onboardingMinor: r.onboarding_minor,
    adjustmentsMinor: r.adjustments_minor ?? 0,
    amountMinor: r.amount_minor,
    vatMinor: r.vat_minor ?? 0,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** The latest changes to access, funeral homes and billing, for the audit tab. */
export async function loadAudit(admin: SupabaseClient, limit = 150): Promise<{ at: string; actor: string; action: string; detail: string; caseId: string | null }[]> {
  const { data } = await admin.from('memora_activity_log').select('created_at,actor_user_id,action,metadata,case_id').like('action', 'ADMIN_%').order('created_at', { ascending: false }).limit(limit);
  const ids = [...new Set(((data ?? []) as Row[]).map((r) => r.actor_user_id).filter(Boolean))];
  const labels = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) labels.set(id, accountLabel(u.user.email));
    }),
  );
  return ((data ?? []) as Row[]).map((r) => ({
    at: r.created_at,
    actor: labels.get(r.actor_user_id) ?? 'System',
    action: String(r.action).replace(/^ADMIN_/, '').replace(/_/g, ' ').toLowerCase(),
    detail: Object.entries((r.metadata ?? {}) as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join(' · '),
    caseId: r.case_id,
  }));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function log(admin: SupabaseClient, actorId: string, action: string, metadata: Record<string, unknown>, caseId: string | null = null) {
  await admin.from('memora_activity_log').insert({ case_id: caseId, actor_user_id: actorId, action: `ADMIN_${action}`, metadata });
}

async function findAccount(admin: SupabaseClient, who: string): Promise<{ id: string; email: string } | null> {
  const login = loginAddress(who);
  if (!login) return null;
  const { data } = await admin.rpc('memora_find_account', { p_email: login.email });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? { id: String(row.id), email: String(row.email) } : null;
}

async function uniqueSlug(admin: SupabaseClient, name: string): Promise<string> {
  const base = (slugify(name) || 'funeral-home').slice(0, 50);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await admin.from('memora_orgs').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Every funeral home has one home-wide group: its owners. */
export const OWNERS_GROUP = { name: 'Owners', roles: ['org_owner'] as Role[], description: 'Own the funeral home’s Memora: branches, people, branding, billing, every memorial.' };

/** Every branch gets these two groups, so its people only need adding. */
export const BRANCH_GROUPS: { name: string; roles: Role[]; description: string }[] = [
  { name: 'Managers', roles: ['org_admin'], description: 'Run this branch: its arrangers and its funerals.' },
  { name: 'Arrangers', roles: ['org_staff'], description: 'Sit with families, prepare, publish and run this branch’s funerals.' },
];

export interface Branch {
  id: string;
  orgId: string;
  name: string;
  area: string;
  memorials: number;
}

export async function loadBranches(admin: SupabaseClient, orgId?: string): Promise<Branch[]> {
  let q = admin.from('memora_branches').select('*').order('created_at');
  if (orgId) q = q.eq('org_id', orgId);
  const [{ data }, { data: cases }] = await Promise.all([q, admin.from('memora_cases').select('branch_id').not('branch_id', 'is', null)]);
  const counts = new Map<string, number>();
  for (const c of (cases ?? []) as Row[]) counts.set(c.branch_id, (counts.get(c.branch_id) ?? 0) + 1);
  return ((data ?? []) as Row[]).map((b) => ({ id: b.id, orgId: b.org_id, name: b.name, area: b.area, memorials: counts.get(b.id) ?? 0 }));
}

/** A branch with its Managers and Arrangers groups. */
export async function createBranch(admin: SupabaseClient, orgId: string, name: string, area = ''): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  if (name.length < 2) return { ok: false, error: 'Name the branch, for example “Soweto”.', status: 400 };
  const { data, error } = await admin.from('memora_branches').insert({ org_id: orgId, name, area }).select('id').single();
  if (error || !data) return { ok: false, error: error?.code === '23505' ? 'There’s already a branch with that name.' : 'Could not add the branch.', status: 409 };
  await admin.from('memora_groups').insert(BRANCH_GROUPS.map((g) => ({ name: g.name, roles: g.roles, description: g.description, org_id: orgId, branch_id: data.id })));
  return { ok: true, id: data.id as string };
}

/**
 * Adds a funeral home in trial with its starting groups. Used by the command
 * centre and by a home setting itself up from an onboarding link.
 */
export async function createOrg(
  admin: SupabaseClient,
  actorId: string,
  input: Record<string, unknown>,
): Promise<{ ok: true; id: string; name: string; plan: ProPlan } | { ok: false; error: string; status: number }> {
  const name = text(input.name, 120);
  if (name.length < 2) return { ok: false, error: 'Give the funeral home a name.', status: 400 };
  const plan: ProPlan = isProPlan(input.plan) ? input.plan : 'pro';
  const p = PRO_PLANS[plan];
  const branches = Math.min(500, Math.max(1, Math.round(Number(input.branches) || p.branches || 1)));
  const slug = await uniqueSlug(admin, name);
  const { data, error } = await admin
    .from('memora_orgs')
    .insert({
      name,
      slug,
      plan,
      status: 'trial',
      monthly_fee_minor: p.monthlyMinor,
      included_memorials: p.includedMemorials,
      per_memorial_minor: p.overageMinor,
      onboarding_fee_minor: p.onboardingMinor,
      branches,
      contact_name: text(input.contactName),
      contact_phone: text(input.contactPhone, 40),
      contact_email: text(input.contactEmail, 200).toLowerCase(),
      notes: text(input.notes, 2000),
      created_by: actorId,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Could not add the funeral home.', status: 500 };
  await admin.from('memora_groups').insert({ ...OWNERS_GROUP, org_id: data.id });
  const area = text(input.area, 120);
  await createBranch(admin, data.id as string, text(input.branchName, 80) || (area ? area.split(',')[0].trim() : '') || 'Main branch', area);
  await log(admin, actorId, 'ORG_CREATED', { name, plan });
  return { ok: true, id: data.id as string, name, plan };
}

const PERMISSION_FOR: Record<string, Permission> = {
  'org.create': 'orgs.manage',
  'org.update': 'orgs.manage',
  'org.setStatus': 'orgs.manage',
  'org.setPlan': 'orgs.billing',
  'org.assignMemorial': 'memorials.assign',
  'invoice.generate': 'orgs.billing',
  'invoice.setStatus': 'orgs.billing',
  'billing.adjust': 'orgs.billing',
};

export function isProAction(action: string): boolean {
  return action in PERMISSION_FOR || /^(group|invite|branch)\./.test(action) || action === 'org.brand' || action === 'memorial.setBranch';
}

/** What a funeral home's own people may do from their dashboard (each still permission-checked). */
export const ORG_SELF_SERVICE = new Set(['group.addMember', 'group.removeMember', 'org.brand', 'invite.create', 'invite.revoke', 'branch.create', 'branch.rename', 'branch.delete', 'memorial.setBranch']);

export async function performProAction(admin: SupabaseClient, actor: Principal, input: ProInput): Promise<ProResult> {
  const needed = PERMISSION_FOR[input.action];
  if (needed && !can(actor, needed)) return deny();
  const now = new Date().toISOString();

  switch (input.action) {
    // ---- Funeral homes ----
    case 'org.create': {
      const out = await createOrg(admin, actor.userId, input);
      if (!out.ok) return out;
      return { ok: true, message: `${out.name} added on ${PRO_PLANS[out.plan].name}, in trial. Add their owner under Access, or send them an onboarding link.`, data: { id: out.id } };
    }
    case 'org.update': {
      if (!uuid(input.id)) return { ok: false, error: 'Funeral home not found.', status: 404 };
      const patch: Row = { updated_at: now };
      for (const [k, col, max] of [
        ['name', 'name', 120],
        ['contactName', 'contact_name', 200],
        ['contactPhone', 'contact_phone', 40],
        ['contactEmail', 'contact_email', 200],
        ['notes', 'notes', 2000],
      ] as const) {
        if (typeof input[k] === 'string') patch[col] = text(input[k], max);
      }
      if (typeof input.logoUrl === 'string') {
        const url = text(input.logoUrl, 500);
        if (url && !/^https:\/\//.test(url)) return { ok: false, error: 'The logo must be an https:// link.', status: 400 };
        patch.logo_url = url;
      }
      if (typeof input.brandColour === 'string') {
        const c = text(input.brandColour, 7);
        if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) return { ok: false, error: 'Use a colour like #5B3E8C.', status: 400 };
        patch.brand_colour = c;
      }
      const { error } = await admin.from('memora_orgs').update(patch).eq('id', input.id);
      if (error) return { ok: false, error: 'Could not save those details.', status: 400 };
      await log(admin, actor.userId, 'ORG_UPDATED', { org: input.id, fields: Object.keys(patch).filter((k) => k !== 'updated_at') });
      refreshPublicPages();
      return { ok: true, message: 'Saved.' };
    }
    case 'org.brand': {
      // A funeral home's own owner or manager: logo and colour only.
      if (!uuid(input.id) || !can(actor, 'org.branding', input.id)) return deny();
      const logo = text(input.logoUrl, 500);
      const colour = text(input.brandColour, 7);
      if (logo && !/^https:\/\//.test(logo)) return { ok: false, error: 'The logo must be an https:// link.', status: 400 };
      if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) return { ok: false, error: 'Use a colour like #5B3E8C.', status: 400 };
      await admin.from('memora_orgs').update({ logo_url: logo, brand_colour: colour, updated_at: now }).eq('id', input.id);
      await log(admin, actor.userId, 'ORG_BRANDING', { org: input.id });
      refreshPublicPages();
      return { ok: true, message: 'Branding saved. It shows on your memorials straight away.' };
    }
    case 'org.setStatus': {
      if (!uuid(input.id)) return { ok: false, error: 'Funeral home not found.', status: 404 };
      const status = input.status;
      if (status !== 'trial' && status !== 'active' && status !== 'disabled') return { ok: false, error: 'Unknown status.', status: 400 };
      if (status === 'disabled' && !text(input.reason)) return { ok: false, error: 'Give a reason (it’s kept in the log).', status: 400 };
      await admin.from('memora_orgs').update({ status, updated_at: now }).eq('id', input.id);
      await log(admin, actor.userId, status === 'disabled' ? 'ORG_DISABLED' : 'ORG_ENABLED', { org: input.id, status, reason: text(input.reason, 500) });
      return {
        ok: true,
        message: status === 'disabled' ? 'Disabled. Their staff lose access at once; published memorials stay up.' : status === 'active' ? 'Active. Billing applies from this month.' : 'Back in trial.',
      };
    }
    case 'org.setPlan': {
      if (!uuid(input.id)) return { ok: false, error: 'Funeral home not found.', status: 404 };
      if (!isProPlan(input.plan)) return { ok: false, error: 'Choose a plan.', status: 400 };
      // A new plan brings its list terms; anything filled in overrides them (a negotiated contract).
      const p = PRO_PLANS[input.plan];
      const { data: before } = await admin.from('memora_orgs').select('plan,monthly_fee_minor,included_memorials,per_memorial_minor,onboarding_fee_minor,branches').eq('id', input.id).maybeSingle();
      const changedPlan = before?.plan !== input.plan;
      // Switching plan: a field left at the old plan's value takes the new plan's list price.
      const pick = (v: number | null, list: number, prev: number | undefined) => (changedPlan && (v === null || v === prev) ? list : (v ?? prev ?? list));
      const monthly = pick(rands(input.monthly), p.monthlyMinor, before?.monthly_fee_minor);
      const per = pick(rands(input.perMemorial), p.overageMinor, before?.per_memorial_minor);
      const onboarding = pick(rands(input.onboarding), p.onboardingMinor, before?.onboarding_fee_minor);
      const includedRaw = Number(String(input.included ?? '').trim() || NaN);
      const included = pick(Number.isFinite(includedRaw) ? Math.max(0, Math.min(10_000, Math.round(includedRaw))) : null, p.includedMemorials, before?.included_memorials);
      const allowedBranches = Number(String(input.branches ?? '').trim() || NaN);
      const branchCap = pick(Number.isFinite(allowedBranches) ? Math.max(1, Math.min(500, Math.round(allowedBranches))) : null, p.branches ?? before?.branches ?? 1, before?.branches);
      if (per <= 0 && included === 0 && monthly === 0) return { ok: false, error: 'That would make every memorial free. Set a monthly fee or a price per memorial.', status: 400 };
      await admin
        .from('memora_orgs')
        .update({
          plan: input.plan,
          monthly_fee_minor: monthly,
          included_memorials: included,
          branches: branchCap,
          per_memorial_minor: per,
          onboarding_fee_minor: onboarding,
          onboarding_paid: input.onboardingPaid === true || input.onboardingPaid === 'true',
          contract_start: typeof input.contractStart === 'string' && input.contractStart ? input.contractStart : null,
          contract_end: typeof input.contractEnd === 'string' && input.contractEnd ? input.contractEnd : null,
          updated_at: now,
        })
        .eq('id', input.id);
      await log(admin, actor.userId, 'ORG_PLAN_SET', {
        org: input.id,
        before: before ? { plan: before.plan, monthly: before.monthly_fee_minor / 100, included: before.included_memorials, perMemorial: before.per_memorial_minor / 100, onboarding: before.onboarding_fee_minor / 100 } : null,
        after: { plan: input.plan, monthly: monthly / 100, included, perMemorial: per / 100, onboarding: onboarding / 100, branches: branchCap },
      });
      return { ok: true, message: `Plan set to ${p.name}.` };
    }
    case 'org.assignMemorial': {
      if (!uuid(input.caseId)) return { ok: false, error: 'Memorial not found.', status: 404 };
      const orgId = uuid(input.orgId) ? input.orgId : null;
      // Into a home: its first branch, so that branch's staff see it at once.
      const { data: first } = orgId ? await admin.from('memora_branches').select('id').eq('org_id', orgId).order('created_at').limit(1).maybeSingle() : { data: null };
      await admin.from('memora_cases').update({ org_id: orgId, branch_id: first?.id ?? null }).eq('id', input.caseId);
      await log(admin, actor.userId, 'MEMORIAL_ASSIGNED', { org: orgId ?? 'none' }, input.caseId);
      refreshPublicPages();
      return { ok: true, message: orgId ? 'Moved into the funeral home.' : 'Removed from the funeral home.' };
    }

    // ---- Billing ----
    case 'invoice.generate': {
      const period = typeof input.period === 'string' && /^\d{4}-\d{2}$/.test(input.period) ? input.period : periodOf();
      const { data: orgs } = await admin.from('memora_orgs').select('*').neq('status', 'disabled');
      const [usage, adjustments] = await Promise.all([usageFor(admin, period), adjustmentsFor(admin, period)]);
      const { data: existing } = await admin.from('memora_org_invoices').select('org_id,period,status');
      // Onboarding goes on a home's first invoice; re-making this month's draft keeps it there.
      const had = new Set(((existing ?? []) as Row[]).filter((r) => r.period < period).map((r) => r.org_id));
      const locked = new Set(((existing ?? []) as Row[]).filter((r) => r.period === period && r.status !== 'DRAFT').map((r) => r.org_id));
      let made = 0;
      for (const r of (orgs ?? []) as Row[]) {
        if (r.status === 'trial' || locked.has(r.id)) continue;
        const o = toOrg(r);
        const count = usage.get(o.id) ?? 0;
        const inv = proInvoice(o, count, !had.has(o.id), adjustments.get(o.id) ?? 0);
        await admin.from('memora_org_invoices').upsert(
          {
            org_id: o.id,
            period,
            memorials: count,
            included_memorials: inv.included,
            overage_memorials: inv.overageMemorials,
            monthly_fee_minor: inv.monthly,
            per_memorial_minor: o.perMemorialMinor,
            onboarding_minor: inv.onboarding,
            adjustments_minor: inv.adjustments,
            vat_minor: inv.vat,
            amount_minor: inv.subtotal,
            status: 'DRAFT',
            updated_at: now,
          },
          { onConflict: 'org_id,period' },
        );
        made++;
      }
      await log(admin, actor.userId, 'INVOICES_GENERATED', { period, invoices: made });
      return { ok: true, message: made ? `${made} draft invoice${made === 1 ? '' : 's'} for ${period}. Homes in trial aren’t billed.` : 'No active funeral homes to bill.' };
    }
    case 'billing.adjust': {
      if (!uuid(input.orgId)) return { ok: false, error: 'Funeral home not found.', status: 404 };
      const period = typeof input.period === 'string' && /^\d{4}-\d{2}$/.test(input.period) ? input.period : periodOf();
      const raw = String(input.amount ?? '').trim();
      const amount = rands(raw.replace(/^-/, ''));
      if (!amount) return { ok: false, error: 'Enter an amount in rand.', status: 400 };
      const signed = raw.startsWith('-') || input.kind === 'credit' ? -amount : amount;
      const reason = text(input.reason, 300);
      if (reason.length < 3) return { ok: false, error: 'Give a reason (it shows on the invoice record).', status: 400 };
      await admin.from('memora_billing_adjustments').insert({ org_id: input.orgId, period, amount_minor: signed, reason, created_by: actor.userId });
      await log(admin, actor.userId, 'BILLING_ADJUSTED', { org: input.orgId, period, amount: signed / 100, reason });
      return { ok: true, message: `${signed < 0 ? 'Credit' : 'Charge'} recorded for ${period}. Re-make the drafts to include it.` };
    }
    case 'invoice.setStatus': {
      if (!uuid(input.id)) return { ok: false, error: 'Invoice not found.', status: 404 };
      const status = input.status;
      if (status !== 'SENT' && status !== 'PAID' && status !== 'VOID' && status !== 'DRAFT') return { ok: false, error: 'Unknown status.', status: 400 };
      const { data } = await admin.from('memora_org_invoices').update({ status, updated_at: now }).eq('id', input.id).select('org_id,onboarding_minor').maybeSingle();
      if (status === 'PAID' && data?.onboarding_minor) await admin.from('memora_orgs').update({ onboarding_paid: true }).eq('id', data.org_id);
      await log(admin, actor.userId, 'INVOICE_' + status, { invoice: input.id });
      return { ok: true, message: `Marked ${status.toLowerCase()}.` };
    }

    // ---- Access: groups, roles and people ----
    case 'group.create': {
      const orgId = uuid(input.orgId) ? input.orgId : null;
      const branchId = orgId && uuid(input.branchId) ? input.branchId : null;
      if (branchId) {
        const { data: b } = await admin.from('memora_branches').select('org_id').eq('id', branchId).maybeSingle();
        if (b?.org_id !== orgId) return { ok: false, error: 'Branch not found.', status: 404 };
      }
      const name = text(input.name, 80);
      const roles = (Array.isArray(input.roles) ? input.roles : []).filter(isRole);
      if (name.length < 2) return { ok: false, error: 'Name the group.', status: 400 };
      if (!roles.length) return { ok: false, error: 'Give the group at least one role.', status: 400 };
      for (const r of roles)
        if (!canGrantRole(actor, r, orgId, branchId))
          return deny(`You can’t give the ${ROLES[r].label} role ${ROLES[r].scope === 'org' ? (branchId ? 'in this branch' : 'home-wide (managers and arrangers belong to a branch)') : ''}.`);
      const { error } = await admin.from('memora_groups').insert({ name, roles, org_id: orgId, branch_id: branchId, description: text(input.description, 300) });
      if (error) return { ok: false, error: error.code === '23505' ? 'A group with that name already exists.' : 'Could not create the group.', status: 409 };
      await log(admin, actor.userId, 'GROUP_CREATED', { name, roles, org: orgId ?? 'Memora' });
      return { ok: true, message: `Group “${name}” created. Add people to it.` };
    }
    case 'group.update':
    case 'group.delete':
    case 'group.addMember':
    case 'group.removeMember': {
      if (!uuid(input.groupId)) return { ok: false, error: 'Group not found.', status: 404 };
      const { data: g } = await admin.from('memora_groups').select('*').eq('id', input.groupId).maybeSingle();
      if (!g) return { ok: false, error: 'Group not found.', status: 404 };
      const current = ((g.roles ?? []) as string[]).filter(isRole);
      // Changing a group needs the right to give every role it holds (before and after).
      const mayManage = (roles: Role[]) => roles.every((r) => canGrantRole(actor, r, g.org_id, g.branch_id ?? null));
      if (!mayManage(current)) return deny('You can’t change a group that holds roles you can’t give.');

      if (input.action === 'group.update') {
        const roles = Array.isArray(input.roles) ? input.roles.filter(isRole) : current;
        if (!roles.length) return { ok: false, error: 'Keep at least one role, or delete the group.', status: 400 };
        if (!mayManage(roles)) return deny('You can’t give one of those roles.');
        const patch: Row = { roles, updated_at: now };
        if (typeof input.name === 'string' && text(input.name, 80).length >= 2) patch.name = text(input.name, 80);
        if (typeof input.description === 'string') patch.description = text(input.description, 300);
        if (typeof input.active === 'boolean') patch.active = input.active;
        await admin.from('memora_groups').update(patch).eq('id', g.id);
        await log(admin, actor.userId, 'GROUP_UPDATED', { group: g.name, roles, active: patch.active ?? g.active });
        return { ok: true, message: 'Group saved. Members’ access changes on their next page.' };
      }
      if (input.action === 'group.delete') {
        await admin.from('memora_groups').delete().eq('id', g.id);
        await log(admin, actor.userId, 'GROUP_DELETED', { group: g.name });
        return { ok: true, message: `Deleted “${g.name}”. Its members lost its roles.` };
      }
      if (input.action === 'group.addMember') {
        const account = await findAccount(admin, text(input.who, 200));
        if (!account) return { ok: false, error: 'No account uses that number or email. Ask them to create their Memora account first.', status: 404 };
        const { error } = await admin.from('memora_group_members').insert({ group_id: g.id, user_id: account.id, added_by: actor.userId });
        if (error) return { ok: false, error: error.code === '23505' ? 'Already in this group.' : 'Could not add them.', status: 409 };
        await log(admin, actor.userId, 'MEMBER_ADDED', { group: g.name, who: accountLabel(account.email) });
        return { ok: true, message: `Added ${accountLabel(account.email)} to ${g.name}.` };
      }
      if (!uuid(input.userId)) return { ok: false, error: 'Person not found.', status: 404 };
      if (input.userId === actor.userId && current.includes('platform_admin')) return { ok: false, error: 'You can’t remove yourself from the administrators.', status: 400 };
      await admin.from('memora_group_members').delete().eq('group_id', g.id).eq('user_id', input.userId);
      await log(admin, actor.userId, 'MEMBER_REMOVED', { group: g.name, who: input.userId });
      return { ok: true, message: 'Removed. Their access changes on their next page.' };
    }

    // ---- Branches (owners, and Memora operations) ----
    case 'branch.create': {
      if (!uuid(input.orgId) || !canIn(actor, 'org.branches', input.orgId, null)) return deny('Only the funeral home’s owner can add branches.');
      const [{ data: home }, { count: have }] = await Promise.all([
        admin.from('memora_orgs').select('branches,plan').eq('id', input.orgId).maybeSingle(),
        admin.from('memora_branches').select('id', { count: 'exact', head: true }).eq('org_id', input.orgId),
      ]);
      if (home && (have ?? 0) >= home.branches)
        return { ok: false, error: `Your plan includes ${home.branches} branch${home.branches === 1 ? '' : 'es'}. Talk to Memora to add more.`, status: 409 };
      const out = await createBranch(admin, input.orgId, text(input.name, 80), text(input.area, 120));
      if (!out.ok) return out;
      await log(admin, actor.userId, 'BRANCH_ADDED', { org: input.orgId, branch: text(input.name, 80) });
      return { ok: true, message: `${text(input.name, 80)} added, with its Managers and Arrangers groups. Appoint its people below.`, data: { id: out.id } };
    }
    case 'branch.rename':
    case 'branch.delete': {
      if (!uuid(input.id)) return { ok: false, error: 'Branch not found.', status: 404 };
      const { data: b } = await admin.from('memora_branches').select('*').eq('id', input.id).maybeSingle();
      if (!b || !canIn(actor, 'org.branches', b.org_id, null)) return deny('Only the funeral home’s owner can change branches.');
      if (input.action === 'branch.rename') {
        const name = text(input.name, 80);
        if (name.length < 2) return { ok: false, error: 'Name the branch.', status: 400 };
        const { error } = await admin.from('memora_branches').update({ name, area: typeof input.area === 'string' ? text(input.area, 120) : b.area }).eq('id', b.id);
        if (error) return { ok: false, error: error.code === '23505' ? 'There’s already a branch with that name.' : 'Could not rename it.', status: 409 };
        await log(admin, actor.userId, 'BRANCH_RENAMED', { from: b.name, to: name });
        return { ok: true, message: 'Saved.' };
      }
      const { count } = await admin.from('memora_branches').select('id', { count: 'exact', head: true }).eq('org_id', b.org_id);
      if ((count ?? 0) <= 1) return { ok: false, error: 'A funeral home needs at least one branch. Add another before removing this one.', status: 409 };
      // Its memorials move to another branch rather than disappear from everyone's view.
      const moveTo = uuid(input.moveTo) ? input.moveTo : null;
      const { data: target } = moveTo
        ? await admin.from('memora_branches').select('id,name').eq('id', moveTo).eq('org_id', b.org_id).neq('id', b.id).maybeSingle()
        : await admin.from('memora_branches').select('id,name').eq('org_id', b.org_id).neq('id', b.id).order('created_at').limit(1).maybeSingle();
      if (!target) return { ok: false, error: 'Choose the branch its memorials move to.', status: 400 };
      await admin.from('memora_cases').update({ branch_id: target.id }).eq('branch_id', b.id);
      await admin.from('memora_invites').update({ branch_id: target.id }).eq('branch_id', b.id);
      await admin.from('memora_branches').delete().eq('id', b.id);
      await log(admin, actor.userId, 'BRANCH_REMOVED', { branch: b.name, memorialsMovedTo: target.name });
      return { ok: true, message: `${b.name} removed. Its people lost that branch’s roles; its memorials moved to ${target.name}.` };
    }
    case 'memorial.setBranch': {
      if (!uuid(input.caseId) || !uuid(input.branchId)) return { ok: false, error: 'Memorial not found.', status: 404 };
      const [{ data: c }, { data: b }] = await Promise.all([
        admin.from('memora_cases').select('org_id').eq('id', input.caseId).maybeSingle(),
        admin.from('memora_branches').select('org_id,name').eq('id', input.branchId).maybeSingle(),
      ]);
      if (!b || !c?.org_id || c.org_id !== b.org_id || !canIn(actor, 'org.branches', c.org_id, null)) return deny('Only the funeral home’s owner can move memorials between branches.');
      await admin.from('memora_cases').update({ branch_id: input.branchId }).eq('id', input.caseId);
      await log(admin, actor.userId, 'MEMORIAL_BRANCH_SET', { branch: b.name }, input.caseId);
      return { ok: true, message: `Moved to ${b.name}.` };
    }

    // ---- Links: onboarding a funeral home, or a family starting under a home ----
    case 'invite.create':
      return createInvite(admin, actor, input);
    case 'invite.revoke':
      return revokeInvite(admin, actor, input);
  }
  return { ok: false, error: 'Unknown action.', status: 400 };
}

export { ALL_ROLES };
