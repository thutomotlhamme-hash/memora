import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../config';
import { daysUntil } from '../gift';
import { localDateKey } from '../memorial';
import { normaliseWhatsApp } from '../phone';
import { PRODUCT } from '../plans';
import type { AdminRole } from './admin-auth';
import { ownerEmails } from './admin-auth';
import { confirmGiftWithYoco, markGiftContacted } from './gifts';
import { confirmOrderWithYoco, yocoSecret } from './yoco';

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

export type AdminActionInput = { action: string; id?: string; email?: string; reason?: string; whatsapp?: string; name?: string };
type Result = { ok: true; message: string } | { ok: false; error: string; status: number };

const uuidOk = (id?: string): id is string => Boolean(id && /^[0-9a-f-]{36}$/i.test(id));
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function log(admin: SupabaseClient, actorId: string, action: string, caseId: string | null, metadata: Record<string, unknown>) {
  await admin.from('memora_activity_log').insert({ case_id: caseId, actor_user_id: actorId, action: `ADMIN_${action}`, metadata });
}

export async function performAdminAction(admin: SupabaseClient, actor: { id: string; email: string }, role: AdminRole, input: AdminActionInput): Promise<Result> {
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
      await log(admin, actor.id, 'CASE_RESTORED', input.id, {});
      return { ok: true, message: 'Restored. The public link works again.' };
    }

    // ---- Team (owners only) ----
    case 'team.add':
    case 'team.remove': {
      if (role !== 'owner') return { ok: false, error: 'Only owners can change the team.', status: 403 };
      const email = (input.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.', status: 400 };
      if (ownerEmails().includes(email)) return { ok: false, error: 'That person is already an owner (set in Netlify).', status: 409 };
      if (input.action === 'team.add') {
        const { error } = await admin.from('memora_admins').insert({ email, added_by: actor.email });
        if (error) return { ok: false, error: error.code === '23505' ? 'Already on the team.' : 'Could not add them.', status: 409 };
        await log(admin, actor.id, 'TEAM_ADDED', null, { email });
        return { ok: true, message: `Added. Send them the invite link.` };
      }
      await admin.from('memora_admins').delete().eq('email', email);
      await log(admin, actor.id, 'TEAM_REMOVED', null, { email });
      return { ok: true, message: 'Removed. Their access stops immediately.' };
    }
  }
  return { ok: false, error: 'Unknown action.', status: 400 };
}

export function teamInviteText(email: string): string {
  return `You've been added to the Memora team. Sign up (or log in) with ${email} — it must be this exact email — then confirm it from your inbox:\n${siteUrl()}/account/register?next=/admin\n\nAfter that, the Admin link appears at the top of the site.`;
}
