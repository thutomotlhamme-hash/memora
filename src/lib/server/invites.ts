import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { accountLabel, isPhoneLogin } from '../account-id';
import { siteUrl } from '../config';
import { PRO_PLANS, isProPlan, type ProPlan } from '../plans';
import { can, canIn, type Principal } from '../rbac';
import { linkSecret, signGiftToken, verifyGiftToken } from './links';
import { createOrg, log, type ProInput, type ProResult } from './pro';

// Two kinds of link, both signed (token = <inviteId>.<hmac>) so nothing secret is stored:
//   org:    Memora sends a funeral home a link; whoever opens it sets the home up
//           and becomes its owner.
//   family: a funeral home sends a family a link; the family starts the memorial,
//           it belongs to the home, and the home's staff can edit, publish and run it.
// Each link works once, can be revoked, and expires.

export type InviteKind = 'org' | 'family';
export type InviteState = 'open' | 'used' | 'expired' | 'revoked';

export interface Invite {
  id: string;
  kind: InviteKind;
  orgId: string | null;
  orgName: string;
  branchId: string | null;
  plan: ProPlan | null;
  label: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string;
  caseId: string | null;
  state: InviteState;
  url: string;
}

const DAYS: Record<InviteKind, number> = { org: 14, family: 30 };
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const text = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
type Row = Record<string, any>;

export const inviteUrl = (id: string) => `${siteUrl()}/join/${signGiftToken('invite', id)}`;

function stateOf(r: Row): InviteState {
  if (r.revoked_at) return 'revoked';
  if (r.used_at) return 'used';
  if (new Date(r.expires_at).getTime() < Date.now()) return 'expired';
  return 'open';
}

function toInvite(r: Row, labels: Map<string, string>): Invite {
  const org = (Array.isArray(r.memora_orgs) ? r.memora_orgs[0] : r.memora_orgs) as Row | null;
  return {
    id: r.id,
    kind: r.kind,
    orgId: r.org_id,
    orgName: org?.name ?? '',
    branchId: r.branch_id ?? null,
    plan: isProPlan(r.plan) ? r.plan : null,
    label: r.label ?? '',
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    usedBy: r.used_by ? (labels.get(r.used_by) ?? '') : '',
    caseId: r.case_id,
    state: stateOf(r),
    url: linkSecret() ? inviteUrl(r.id) : '',
  };
}

/** Links of one kind, newest first; for family links, only one home's. */
export async function loadInvites(admin: SupabaseClient, kind: InviteKind, orgId?: string): Promise<Invite[]> {
  let q = admin.from('memora_invites').select('*, memora_orgs(name)').eq('kind', kind).order('created_at', { ascending: false }).limit(100);
  if (orgId) q = q.eq('org_id', orgId);
  const { data } = await q;
  const rows = (data ?? []) as Row[];
  const labels = new Map<string, string>();
  await Promise.all(
    [...new Set(rows.map((r) => r.used_by).filter(Boolean))].map(async (id: string) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) labels.set(id, accountLabel(u.user.email));
    }),
  );
  return rows.map((r) => toInvite(r, labels));
}

export async function createInvite(admin: SupabaseClient, actor: Principal, input: ProInput): Promise<ProResult> {
  if (!linkSecret()) return { ok: false, error: 'Links need MEMORA_LINK_SECRET set in Netlify first.', status: 503 };
  const kind: InviteKind = input.kind === 'org' ? 'org' : 'family';
  const label = text(input.label);
  let orgId: string | null = null;
  let branchId: string | null = null;
  let plan: ProPlan | null = null;
  if (kind === 'org') {
    if (!can(actor, 'orgs.manage')) return { ok: false, error: 'You don’t have permission to onboard funeral homes.', status: 403 };
    plan = isProPlan(input.plan) ? input.plan : 'pro';
    if (PRO_PLANS[plan].quoted) return { ok: false, error: 'Enterprise is set up with Create Enterprise account, not a self-serve link.', status: 400 };
  } else {
    if (!uuid(input.orgId) || !uuid(input.branchId) || !canIn(actor, 'org.memorials.create', input.orgId, input.branchId)) return { ok: false, error: 'You can’t send family links for this branch.', status: 403 };
    const { data: branch } = await admin.from('memora_branches').select('org_id').eq('id', input.branchId).maybeSingle();
    if (branch?.org_id !== input.orgId) return { ok: false, error: 'Branch not found.', status: 404 };
    branchId = input.branchId;
    const { data: org } = await admin.from('memora_orgs').select('status').eq('id', input.orgId).maybeSingle();
    if (!org || org.status === 'disabled') return { ok: false, error: 'This funeral home’s Memora is switched off. Contact Memora.', status: 403 };
    if (label.length < 2) return { ok: false, error: 'Who is it for? For example “Khumalo family”.', status: 400 };
    orgId = input.orgId;
  }
  const expires = new Date(Date.now() + DAYS[kind] * 86_400_000).toISOString();
  const { data, error } = await admin
    .from('memora_invites')
    .insert({ kind, org_id: orgId, branch_id: branchId, plan, label, created_by: actor.userId, expires_at: expires })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Could not make the link.', status: 500 };
  await log(admin, actor.userId, kind === 'org' ? 'ONBOARDING_LINK_CREATED' : 'FAMILY_LINK_CREATED', { for: label || 'a funeral home', ...(plan ? { plan } : {}), ...(orgId ? { org: orgId } : {}) });
  return {
    ok: true,
    message: kind === 'org' ? `Onboarding link ready (${PRO_PLANS[plan!].name}). Copy it or send it on WhatsApp below.` : `Link for ${label} ready. Send it on WhatsApp below.`,
    data: { id: data.id as string, url: inviteUrl(data.id as string) },
  };
}

export async function revokeInvite(admin: SupabaseClient, actor: Principal, input: ProInput): Promise<ProResult> {
  if (!uuid(input.id)) return { ok: false, error: 'Link not found.', status: 404 };
  const { data: r } = await admin.from('memora_invites').select('*').eq('id', input.id).maybeSingle();
  if (!r) return { ok: false, error: 'Link not found.', status: 404 };
  const allowed = r.kind === 'org' ? can(actor, 'orgs.manage') : canIn(actor, 'org.memorials.create', r.org_id, r.branch_id);
  if (!allowed) return { ok: false, error: 'You don’t have permission to do that.', status: 403 };
  if (r.used_at) return { ok: false, error: 'That link has already been used.', status: 409 };
  await admin.from('memora_invites').update({ revoked_at: new Date().toISOString() }).eq('id', r.id);
  await log(admin, actor.userId, 'LINK_REVOKED', { kind: r.kind, for: r.label || '—' });
  return { ok: true, message: 'Link switched off. It won’t work any more.' };
}

export type OpenedInvite =
  | { state: 'invalid' }
  | { state: 'used' | 'expired' | 'revoked'; invite: Invite }
  | { state: 'open'; invite: Invite; orgStatus: string | null };

/** What a link leads to. Never throws; a bad link is just "invalid". */
export async function openInvite(admin: SupabaseClient, token: string): Promise<OpenedInvite> {
  const id = verifyGiftToken('invite', token);
  if (!id) return { state: 'invalid' };
  const { data: r } = await admin.from('memora_invites').select('*, memora_orgs(name,status)').eq('id', id).maybeSingle();
  if (!r) return { state: 'invalid' };
  const invite = toInvite(r, new Map());
  if (invite.state !== 'open') return { state: invite.state, invite };
  const org = (Array.isArray(r.memora_orgs) ? r.memora_orgs[0] : r.memora_orgs) as Row | null;
  return { state: 'open', invite, orgStatus: org?.status ?? null };
}

type Accepted = { ok: true; redirect: string } | { ok: false; error: string; status: number };

/**
 * Uses a link for the signed-in person. Marking it used is conditional on it
 * still being open, so two people racing for one link can't both win.
 */
export async function acceptInvite(
  admin: SupabaseClient,
  user: { id: string; email: string },
  token: string,
  details: Record<string, unknown>,
): Promise<Accepted> {
  const opened = await openInvite(admin, token);
  if (opened.state === 'invalid') return { ok: false, error: 'This link isn’t valid. Ask for a new one.', status: 404 };
  if (opened.state === 'used' && opened.invite.kind === 'family' && opened.invite.caseId) {
    // Coming back to a link you already used takes you to your memorial.
    const { data: r } = await admin.from('memora_invites').select('used_by').eq('id', opened.invite.id).maybeSingle();
    if (r?.used_by === user.id) return { ok: true, redirect: `/memorials/${opened.invite.caseId}` };
  }
  if (opened.state !== 'open') return { ok: false, error: opened.state === 'used' ? 'This link has already been used. Ask for a new one.' : opened.state === 'expired' ? 'This link has expired. Ask for a new one.' : 'This link was switched off. Ask for a new one.', status: 410 };
  const invite = opened.invite;

  const claim = async (patch: Record<string, unknown>) => {
    const { data } = await admin
      .from('memora_invites')
      .update({ used_at: new Date().toISOString(), used_by: user.id, ...patch })
      .eq('id', invite.id)
      .is('used_at', null)
      .is('revoked_at', null)
      .select('id');
    return Boolean(data?.length);
  };

  if (invite.kind === 'family') {
    if (opened.orgStatus === 'disabled') return { ok: false, error: 'This funeral home’s Memora is switched off. Contact the funeral home.', status: 403 };
    if (!(await claim({}))) return { ok: false, error: 'This link has just been used. Ask for a new one.', status: 409 };
    const { data: created, error } = await admin.from('memora_cases').insert({ owner_id: user.id, org_id: invite.orgId, branch_id: invite.branchId }).select('id').single();
    if (error || !created) {
      await admin.from('memora_invites').update({ used_at: null, used_by: null }).eq('id', invite.id);
      return { ok: false, error: 'Could not start the memorial. Please try again.', status: 500 };
    }
    await admin.from('memora_invites').update({ case_id: created.id }).eq('id', invite.id);
    await admin.from('memora_activity_log').insert({ case_id: created.id, actor_user_id: user.id, action: 'CASE_CREATED_FROM_FAMILY_LINK', metadata: { org: invite.orgId, for: invite.label } });
    return { ok: true, redirect: `/memorials/${created.id}` };
  }

  // A funeral home setting itself up: its details, then this person as owner.
  const name = text(details.name) || invite.label;
  if (name.length < 2) return { ok: false, error: 'Enter your funeral home’s name.', status: 400 };
  if (!(await claim({}))) return { ok: false, error: 'This link has just been used. Ask Memora for a new one.', status: 409 };
  const area = text(details.area, 200);
  const made = await createOrg(admin, user.id, {
    name,
    plan: invite.plan ?? 'pro',
    contactName: details.contactName,
    contactPhone: text(details.contactPhone, 40) || (isPhoneLogin(user.email) ? accountLabel(user.email) : ''),
    contactEmail: details.contactEmail,
    branches: details.branches,
    notes: area ? `Area: ${area}` : '',
    area,
    branchName: details.branchName,
  });
  if (!made.ok) {
    await admin.from('memora_invites').update({ used_at: null, used_by: null }).eq('id', invite.id);
    return made;
  }
  await admin.from('memora_invites').update({ org_id: made.id }).eq('id', invite.id);
  const { data: owners } = await admin.from('memora_groups').select('id').eq('org_id', made.id).eq('name', 'Owners').maybeSingle();
  if (owners) await admin.from('memora_group_members').insert({ group_id: owners.id, user_id: user.id, added_by: user.id });
  return { ok: true, redirect: `/pro/dashboard?home=${made.id}&welcome=1` };
}
