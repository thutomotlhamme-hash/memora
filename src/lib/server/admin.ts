import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../config';
import { daysUntil } from '../gift';
import { localDateKey } from '../memorial';
import { normaliseWhatsApp } from '../phone';
import { PRODUCT } from '../plans';
import { can, type Permission, type Principal } from '../rbac';
import { createResetLink, findAccountId, guardAccount, revokeResetLinks, setSuspended } from './accounts';
import { isProAction, performProAction } from './pro';
import { ENTERPRISE_ACTIONS, performEnterpriseAction } from './enterprise';
import { loadPrincipal } from './access';
import { accountLabel, isPhoneLogin, loginAddress } from '../account-id';
import { ownerEmails } from './admin-auth';
import { confirmGiftWithYoco, markGiftContacted } from './gifts';
import { confirmOrderWithYoco, yocoSecret } from './yoco';
import { refreshPublicPages } from './public-cache';

type Row = Record<string, any>;

export interface AdminCase {
  id: string;
  status: string;
  slug: string | null;
  ownerEmail: string;
  name: string;
  funeralDate: string | null;
  publishedAt: string | null;
  archiveAt: string | null;
  updatedAt: string;
  paid: boolean;
}

const nameOf = (r: Row) => [r.preferred_name || r.first_name, r.last_name].filter(Boolean).join(' ') || 'Untitled memorial';

export async function loadAdminCases(admin: SupabaseClient): Promise<AdminCase[]> {
  const { data, error } = await admin.rpc('memora_admin_cases', { p_limit: 300 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    status: r.status,
    slug: r.slug,
    ownerEmail: r.owner_email ?? '',
    name: nameOf(r),
    funeralDate: r.funeral_date,
    publishedAt: r.published_at,
    archiveAt: r.archive_at,
    updatedAt: r.updated_at,
    paid: Boolean(r.paid),
  }));
}

export interface AdminOrder {
  id: string;
  caseId: string;
  caseName: string;
  caseStatus: string;
  amountMinor: number;
  currency: string;
  status: string;
  provider: string;
  reference: string | null;
  createdAt: string;
}

export async function loadAdminOrders(admin: SupabaseClient): Promise<AdminOrder[]> {
  const { data } = await admin
    .from('memora_orders')
    .select('id,case_id,amount_minor,currency,status,provider,provider_reference,created_at,memora_cases(status,memora_people(first_name,last_name,preferred_name))')
    .order('created_at', { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).map((o) => {
    const c = Array.isArray(o.memora_cases) ? o.memora_cases[0] : o.memora_cases;
    const p = (Array.isArray(c?.memora_people) ? c.memora_people[0] : c?.memora_people) ?? {};
    return {
      id: o.id,
      caseId: o.case_id,
      caseName: nameOf(p),
      caseStatus: c?.status ?? '',
      amountMinor: o.amount_minor,
      currency: o.currency,
      status: o.status,
      provider: o.provider,
      reference: o.provider_reference,
      createdAt: o.created_at,
    };
  });
}

export async function loadTeam(admin: SupabaseClient): Promise<{ owners: string[]; staff: { email: string; addedBy: string; createdAt: string }[] }> {
  const { data } = await admin.from('memora_admins').select('email,added_by,created_at').order('created_at');
  return { owners: ownerEmails(), staff: (data ?? []).map((r) => ({ email: r.email, addedBy: r.added_by, createdAt: r.created_at })) };
}

export interface Overview {
  urgent: { kind: 'memorial' | 'gift'; id: string; name: string; date: string; days: number; detail: string; href: string }[];
  paidNotPublished: AdminCase[];
  stuckOrders: AdminOrder[];
  stuckGifts: Row[];
  giftsNotStarted: Row[];
  stats: { published: number; drafts: number; giftsOpen: number; revenueMonthMinor: number };
}

/** Everything that needs a human, soonest first. */
export async function loadOverview(admin: SupabaseClient, now = new Date()): Promise<Overview> {
  const [cases, orders, giftsR] = await Promise.all([
    loadAdminCases(admin),
    loadAdminOrders(admin),
    admin.from('memora_gifts').select('*').neq('status', 'CANCELLED').order('created_at', { ascending: false }).limit(300),
  ]);
  const gifts = (giftsR.data ?? []) as Row[];
  const today = localDateKey(now);
  const minsAgo = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 60_000;

  const urgent: Overview['urgent'] = [];
  for (const c of cases) {
    const d = daysUntil(c.funeralDate, now);
    if (c.status !== 'PUBLISHED' && c.funeralDate && c.funeralDate >= today && d != null && d <= 3) {
      urgent.push({ kind: 'memorial', id: c.id, name: c.name, date: c.funeralDate, days: d, detail: `${c.paid ? 'Paid' : 'Not paid'}, not published · ${c.ownerEmail}`, href: `/admin?tab=memorials#${c.id}` });
    }
  }
  for (const g of gifts) {
    const d = daysUntil(g.funeral_date_estimate, now);
    if (g.status === 'PAID' && d != null && d >= 0 && d <= 3) {
      urgent.push({ kind: 'gift', id: g.id, name: g.loved_one_name || g.recipient_name, date: g.funeral_date_estimate, days: d, detail: `Gift not started · ${g.recipient_name}`, href: `/admin?tab=gifts` });
    }
  }
  urgent.sort((a, b) => a.days - b.days);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const revenueMonthMinor =
    orders.filter((o) => o.status === 'PAID' && o.provider === 'yoco' && o.createdAt >= monthStart).reduce((s, o) => s + o.amountMinor, 0) +
    gifts.filter((g) => (g.status === 'PAID' || g.status === 'REDEEMED') && g.provider === 'yoco' && g.paid_at && g.paid_at >= monthStart).reduce((s, g) => s + g.amount_minor, 0);

  return {
    urgent,
    paidNotPublished: cases.filter((c) => c.paid && c.status === 'DRAFT'),
    stuckOrders: orders.filter((o) => o.status === 'PENDING' && o.provider === 'yoco' && o.reference && minsAgo(o.createdAt) > 15 && minsAgo(o.createdAt) < 7 * 1440),
    stuckGifts: gifts.filter((g) => g.status === 'PENDING' && g.provider === 'yoco' && g.provider_reference && minsAgo(g.created_at) > 15 && minsAgo(g.created_at) < 7 * 1440),
    giftsNotStarted: gifts.filter((g) => g.status === 'PAID' && g.paid_at && minsAgo(g.paid_at) > 24 * 60),
    stats: {
      published: cases.filter((c) => c.status === 'PUBLISHED').length,
      drafts: cases.filter((c) => c.status === 'DRAFT').length,
      giftsOpen: gifts.filter((g) => g.status === 'PAID').length,
      revenueMonthMinor,
    },
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AdminActionInput = Record<string, unknown> & { action: string; id?: string; email?: string; who?: string; reason?: string; whatsapp?: string; name?: string };
type Result = { ok: true; message: string; data?: Record<string, string> } | { ok: false; error: string; status: number };

const uuidOk = (id?: string): id is string => Boolean(id && /^[0-9a-f-]{36}$/i.test(id));
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function accountById(admin: SupabaseClient, id: string): Promise<{ id: string; email: string } | null> {
  const { data } = await admin.auth.admin.getUserById(id);
  return data?.user?.email ? { id, email: data.user.email } : null;
}

/** Finds an account by the cellphone number or email people sign in with. */
async function findAccount(admin: SupabaseClient, who: string): Promise<{ id: string; email: string } | null> {
  const login = loginAddress(who);
  if (!login) return null;
  const { data } = await admin.rpc('memora_find_account', { p_email: login.email });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? { id: String(row.id), email: String(row.email) } : null;
}

/** Easy to read out on the phone and to type: e.g. "Jacaranda-4821". */
function temporaryPassword(): string {
  const words = ['Jacaranda', 'Candle', 'Bloom', 'Petal', 'Lantern', 'Harvest', 'Morning', 'Willow'];
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return `${words[bytes[0] % words.length]}-${String(1000 + (bytes[1] % 9000))}`;
}

async function log(admin: SupabaseClient, actorId: string, action: string, caseId: string | null, metadata: Record<string, unknown>) {
  await admin.from('memora_activity_log').insert({ case_id: caseId, actor_user_id: actorId, action: `ADMIN_${action}`, metadata });
}

/** The permission each command-centre action needs. Anything not listed is refused. */
const ACTION_PERMISSION: Record<string, Permission> = {
  'gift.contacted': 'gifts.manage',
  'gift.recheck': 'gifts.manage',
  'gift.cancel': 'gifts.manage',
  'gift.updateContact': 'gifts.manage',
  'order.recheck': 'orders.manage',
  'order.refunded': 'orders.manage',
  'case.unpublish': 'memorials.takedown',
  'case.restore': 'memorials.takedown',
  'account.resetPassword': 'accounts.help',
  'account.resetLink': 'accounts.help',
  'account.revokeResetLinks': 'accounts.help',
  'account.suspend': 'accounts.suspend',
  'account.unsuspend': 'accounts.suspend',
  'team.add': 'access.manage',
  'team.remove': 'access.manage',
};

export async function performAdminAction(admin: SupabaseClient, actor: { id: string; email: string }, principal: Principal, input: AdminActionInput): Promise<Result> {
  if (ENTERPRISE_ACTIONS.has(input.action)) return performEnterpriseAction(admin, principal, input);
  if (isProAction(input.action)) return performProAction(admin, principal, input);
  const needed = ACTION_PERMISSION[input.action];
  if (!needed) return { ok: false, error: 'Unknown action.', status: 400 };
  if (!can(principal, needed)) return { ok: false, error: 'You don’t have permission to do that.', status: 403 };
  const now = new Date().toISOString();
  switch (input.action) {
    // ---- Gifts ----
    case 'gift.contacted': {
      if (!uuidOk(input.id) || !(await markGiftContacted(admin, input.id))) return { ok: false, error: 'Gift not found.', status: 404 };
      await log(admin, actor.id, 'GIFT_CONTACTED', null, { gift_id: input.id });
      return { ok: true, message: 'Marked as contacted.' };
    }
    case 'gift.recheck': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Gift not found.', status: 404 };
      if (!yocoSecret()) return { ok: false, error: 'Yoco isn’t configured.', status: 503 };
      const { data: g } = await admin.from('memora_gifts').select('status,provider_reference').eq('id', input.id).maybeSingle();
      if (!g?.provider_reference) return { ok: false, error: 'This gift never reached checkout.', status: 409 };
      const result = await confirmGiftWithYoco(admin, g.provider_reference);
      await log(admin, actor.id, 'GIFT_RECHECK', null, { gift_id: input.id, result });
      return { ok: true, message: result === 'confirmed' || result === 'already_paid' ? 'Payment confirmed by Yoco.' : result === 'pending' ? 'Yoco says it hasn’t been paid.' : `Yoco check: ${result}.` };
    }
    case 'gift.cancel': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Gift not found.', status: 404 };
      const { data } = await admin.from('memora_gifts').update({ status: 'CANCELLED', updated_at: now }).eq('id', input.id).in('status', ['PAID', 'PENDING']).select('id').maybeSingle();
      if (!data) return { ok: false, error: 'Only unused gifts can be cancelled.', status: 409 };
      await log(admin, actor.id, 'GIFT_CANCELLED', null, { gift_id: input.id, reason: input.reason ?? '' });
      return { ok: true, message: 'Gift cancelled. Its link no longer works. Refund the buyer in the Yoco portal.' };
    }
    case 'gift.updateContact': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Gift not found.', status: 404 };
      const whatsapp = normaliseWhatsApp(input.whatsapp ?? '');
      if (!whatsapp) return { ok: false, error: 'That WhatsApp number isn’t valid.', status: 400 };
      const patch: Row = { recipient_whatsapp: whatsapp, updated_at: now };
      if (input.name?.trim()) patch.recipient_name = input.name.trim().slice(0, 120);
      const { data } = await admin.from('memora_gifts').update(patch).eq('id', input.id).select('id').maybeSingle();
      if (!data) return { ok: false, error: 'Gift not found.', status: 404 };
      await log(admin, actor.id, 'GIFT_CONTACT_UPDATED', null, { gift_id: input.id });
      return { ok: true, message: 'Contact updated.' };
    }

    // ---- Payments ----
    case 'order.recheck': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Payment not found.', status: 404 };
      if (!yocoSecret()) return { ok: false, error: 'Yoco isn’t configured.', status: 503 };
      const { data: o } = await admin.from('memora_orders').select('case_id,provider,provider_reference').eq('id', input.id).maybeSingle();
      if (!o?.provider_reference || o.provider !== 'yoco') return { ok: false, error: 'This payment never reached Yoco checkout.', status: 409 };
      const result = await confirmOrderWithYoco(admin, o.provider_reference);
      await log(admin, actor.id, 'ORDER_RECHECK', o.case_id, { order_id: input.id, result });
      return { ok: true, message: result === 'confirmed' || result === 'already_paid' ? 'Payment confirmed by Yoco. The family can publish now.' : result === 'pending' ? 'Yoco says it hasn’t been paid.' : `Yoco check: ${result}.` };
    }
    case 'order.refunded': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Payment not found.', status: 404 };
      const { data: o } = await admin.from('memora_orders').update({ status: 'REFUNDED', updated_at: now }).eq('id', input.id).eq('status', 'PAID').select('case_id').maybeSingle();
      if (!o) return { ok: false, error: 'Only paid orders can be marked refunded.', status: 409 };
      await admin.from('memora_payments').update({ status: 'REFUNDED' }).eq('order_id', input.id);
      await log(admin, actor.id, 'ORDER_REFUNDED', o.case_id, { order_id: input.id, reason: input.reason ?? '' });
      return { ok: true, message: 'Marked as refunded. Make sure the money was returned in the Yoco portal.' };
    }

    // ---- Memorials ----
    case 'case.unpublish': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Memorial not found.', status: 404 };
      if (!input.reason?.trim()) return { ok: false, error: 'Give a reason (it’s kept in the log).', status: 400 };
      const { data } = await admin.from('memora_cases').update({ status: 'ARCHIVED', updated_at: now }).eq('id', input.id).eq('status', 'PUBLISHED').select('id').maybeSingle();
      if (!data) return { ok: false, error: 'Only published memorials can be taken down.', status: 409 };
      refreshPublicPages();
      await log(admin, actor.id, 'CASE_UNPUBLISHED', input.id, { reason: input.reason.trim().slice(0, 500) });
      return { ok: true, message: 'Taken down. The public link now shows “not public”.' };
    }
    case 'case.restore': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Memorial not found.', status: 404 };
      const { data: c } = await admin.from('memora_cases').select('status,published_at').eq('id', input.id).maybeSingle();
      if (!c || c.status !== 'ARCHIVED' || !c.published_at) return { ok: false, error: 'Only taken-down memorials can be restored.', status: 409 };
      const archiveAt = new Date(new Date(c.published_at).getTime() + PRODUCT.publicDays * 86_400_000);
      if (archiveAt.getTime() <= Date.now()) return { ok: false, error: 'Its public year has already ended.', status: 409 };
      await admin.from('memora_cases').update({ status: 'PUBLISHED', archive_at: archiveAt.toISOString(), updated_at: now }).eq('id', input.id);
      refreshPublicPages();
      await log(admin, actor.id, 'CASE_RESTORED', input.id, {});
      return { ok: true, message: 'Restored. The public link works again.' };
    }

    // ---- Helping someone log in ----
    case 'account.resetPassword': {
      const g = await guardAccount(admin, principal, uuidOk(input.id) ? await accountById(admin, input.id) : await findAccountId(admin, input.who ?? ''), 'reset');
      if (!g.ok) return g;
      const account = g.account;
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(account.id, { password });
      if (error) return { ok: false, error: 'Could not set a temporary password.', status: 500 };
      await revokeResetLinks(admin, account.id);
      await log(admin, actor.id, 'PASSWORD_RESET', null, { account: accountLabel(account.email) });
      const who = accountLabel(account.email);
      return {
        ok: true,
        message: `Temporary password set for ${who}.`,
        data: {
          password,
          who,
          whatsapp: isPhoneLogin(account.email) ? account.email.split('@')[0] : '',
          text: `Hi, it’s Memora. Your temporary password is ${password}\nLog in at ${siteUrl()}/account/login with ${who}, then choose a new password under Account.`,
        },
      };
    }
    case 'account.resetLink': {
      // Safer than a temporary password: nobody but the person ever knows the new one.
      const g = await guardAccount(admin, principal, uuidOk(input.id) ? await accountById(admin, input.id) : await findAccountId(admin, input.who ?? ''), 'reset');
      if (!g.ok) return g;
      let url: string;
      try {
        url = await createResetLink(admin, actor.id, g.account.id);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Could not make the link.', status: 503 };
      }
      const who = accountLabel(g.account.email);
      await log(admin, actor.id, 'PASSWORD_RESET_LINK_SENT', null, { account: who });
      return {
        ok: true,
        message: `Reset link ready for ${who}. It works once, for 24 hours.`,
        data: {
          url,
          who,
          whatsapp: isPhoneLogin(g.account.email) ? g.account.email.split('@')[0] : '',
          text: `Hi, it’s Memora. Here is your link to choose a new password. It works once, for 24 hours: ${url}`,
        },
      };
    }
    case 'account.revokeResetLinks': {
      if (!uuidOk(input.id)) return { ok: false, error: 'Account not found.', status: 404 };
      await revokeResetLinks(admin, input.id);
      await log(admin, actor.id, 'PASSWORD_RESET_LINKS_REVOKED', null, { account: input.id });
      return { ok: true, message: 'Their reset links no longer work.' };
    }
    case 'account.suspend':
    case 'account.unsuspend': {
      const suspend = input.action === 'account.suspend';
      const g = await guardAccount(admin, principal, uuidOk(input.id) ? await accountById(admin, input.id) : null, 'suspend');
      if (!g.ok) return g;
      if (suspend && !input.reason?.trim()) return { ok: false, error: 'Give a reason (it’s kept in the audit log).', status: 400 };
      if (!(await setSuspended(admin, g.account.id, suspend))) return { ok: false, error: 'Could not change the account.', status: 500 };
      await log(admin, actor.id, suspend ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_RESTORED', null, { account: accountLabel(g.account.email), reason: input.reason ?? '' });
      return {
        ok: true,
        message: suspend
          ? `${accountLabel(g.account.email)} is suspended: they can’t log in, and within the hour any open session ends. Their memorials stay up.`
          : `${accountLabel(g.account.email)} can log in again.`,
      };
    }

    // ---- Team (owners only) ----
    case 'team.add':
    case 'team.remove': {
      let email = (input.email ?? input.who ?? '').trim().toLowerCase();
      if (input.action === 'team.add') {
        // Only existing accounts can be added, so nobody can sign up with a
        // teammate's details after the fact and inherit their access.
        const account = await findAccount(admin, email);
        if (!account) return { ok: false, error: 'No account uses that number or email yet. Ask them to create their Memora account first, then add them.', status: 404 };
        email = account.email.toLowerCase();
      } else if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.', status: 400 };
      if (ownerEmails().includes(email)) return { ok: false, error: 'That person is already an owner (set in Netlify).', status: 409 };
      if (input.action === 'team.add') {
        const { error } = await admin.from('memora_admins').insert({ email, added_by: actor.email });
        if (error) return { ok: false, error: error.code === '23505' ? 'Already on the team.' : 'Could not add them.', status: 409 };
        await log(admin, actor.id, 'TEAM_ADDED', null, { email: accountLabel(email) });
        return { ok: true, message: `Added ${accountLabel(email)}. The Admin link now shows for them.` };
      }
      await admin.from('memora_admins').delete().eq('email', email);
      await log(admin, actor.id, 'TEAM_REMOVED', null, { email });
      return { ok: true, message: 'Removed. Their access stops immediately.' };
    }
  }
  return { ok: false, error: 'Unknown action.', status: 400 };
}

export function teamInviteText(email: string): string {
  return `You're on the Memora team. Log in with ${accountLabel(email)} at ${siteUrl()}/account/login?next=/admin and the Admin link appears at the top of the site.`;
}

/** What to send someone before adding them: create an account, then share the number. */
export function teamJoinText(): string {
  return `I'd like to add you to the Memora team. First create your account here with your cellphone number and a password:\n${siteUrl()}/account/register?next=/admin\n\nThen send me the number you used, and I'll add you.`;
}

/**
 * Settings the live site needs, checked on every admin visit, so a missing one
 * is visible here instead of quietly breaking a feature. Never shows values.
 */
export function setupChecks(): { name: string; ok: boolean; needed: string; fix: string }[] {
  const has = (k: string) => Boolean(process.env[k]);
  const checks = [
    { name: 'SUPABASE_SECRET_KEY', ok: has('SUPABASE_SECRET_KEY') || has('SUPABASE_SERVICE_ROLE_KEY'), needed: 'Accounts, publishing, admin, the run-sheet', fix: 'Supabase → Project Settings → API Keys → secret key' },
    { name: 'MEMORA_LINK_SECRET', ok: has('MEMORA_LINK_SECRET'), needed: 'Run-sheet links, procession sharing, gift links', fix: 'Any long random string' },
    { name: 'NEXT_PUBLIC_SITE_URL', ok: has('NEXT_PUBLIC_SITE_URL'), needed: 'Correct links in WhatsApp messages and QR codes', fix: 'https://memora-memorials.netlify.app' },
    { name: 'NEXT_PUBLIC_CONTACT_WHATSAPP', ok: has('NEXT_PUBLIC_CONTACT_WHATSAPP'), needed: 'Optional: “WhatsApp us” for password help (otherwise the contact form)', fix: 'Memora’s WhatsApp number, e.g. 27721234567' },
  ];
  if (process.env.NEXT_PUBLIC_MEMORA_PAYMENTS === 'on') {
    checks.push(
      { name: 'YOCO_SECRET_KEY', ok: has('YOCO_SECRET_KEY'), needed: 'Taking payments', fix: 'Yoco → Settings → Payment Gateway' },
      { name: 'YOCO_WEBHOOK_SECRET', ok: has('YOCO_WEBHOOK_SECRET'), needed: 'Confirming payments automatically', fix: 'Register the Yoco webhook' },
    );
  }
  return checks;
}
