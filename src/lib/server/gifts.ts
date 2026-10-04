import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../config';
import { daysUntil, splitName, type CleanGift } from '../gift';
import { emptyDraft, readiness } from '../memorial';
import { CURRENCY, PRODUCT } from '../plans';
import { loadOwnedCase, saveOwnedDraft } from './cases';
import { signGiftToken } from './links';
import { checkoutProvider, confirmGift, openCheckout, providerOn, type Provider } from './payments';

export type GiftRow = Record<string, any>;

export const redeemUrl = (giftId: string) => `${siteUrl()}/gift/r/${signGiftToken('redeem', giftId)}`;
export const buyerUrl = (giftId: string) => `${siteUrl()}/gift/thanks/${signGiftToken('buyer', giftId)}`;

const simulationAllowed = () => process.env.MEMORA_SIMULATE_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';

/** Creates a pending gift and a card checkout for it. Returns where to send the buyer. */
export async function startGiftCheckout(admin: SupabaseClient, gift: CleanGift, buyerUserId: string | null): Promise<string> {
  const provider = simulationAllowed() ? 'simulated' : checkoutProvider();
  if (!provider) throw new Error('No payment provider is set up.');
  const { data: row, error } = await admin
    .from('memora_gifts')
    .insert({
      amount_minor: PRODUCT.amountMinor,
      currency: CURRENCY,
      provider,
      buyer_name: gift.buyerName,
      buyer_email: gift.buyerEmail,
      buyer_user_id: buyerUserId,
      recipient_name: gift.recipientName,
      recipient_email: gift.recipientEmail,
      recipient_whatsapp: gift.recipientWhatsapp,
      loved_one_name: gift.lovedOneName,
      message: gift.message,
      funeral_date_estimate: gift.funeralDate,
      funeral_date_unsure: gift.funeralDateUnsure,
    })
    .select('id')
    .single();
  if (error || !row) throw new Error('Could not save the gift.');

  if (provider === 'simulated') {
    await admin.from('memora_gifts').update({ status: 'PAID', paid_at: new Date().toISOString(), provider_reference: `sim-${row.id}` }).eq('id', row.id);
    return buyerUrl(row.id);
  }

  const thanks = buyerUrl(row.id);
  try {
    const checkout = await openCheckout(provider, {
      amountMinor: PRODUCT.amountMinor,
      currency: CURRENCY,
      reference: row.id,
      kind: 'gift',
      description: `${PRODUCT.name}, a gift`,
      successUrl: thanks,
      cancelUrl: `${siteUrl()}/gift?payment=cancelled`,
      failureUrl: `${siteUrl()}/gift?payment=failed`,
      metadata: { giftId: row.id, kind: 'gift' },
    });
    await admin.from('memora_gifts').update({ provider_reference: checkout.id, updated_at: new Date().toISOString() }).eq('id', row.id);
    return checkout.url;
  } catch (err) {
    await admin.from('memora_gifts').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', row.id);
    throw err;
  }
}

export interface BuyerView {
  status: string;
  paid: boolean;
  recipientName: string;
  lovedOneName: string;
  funeralDate: string | null;
  recipientWhatsapp: string;
  message: string;
  buyerName: string;
  redeemed: boolean;
  redeemLink: string | null;
}

/** What the buyer's thank-you page may see. Confirms with the payment provider if still pending. */
export async function buyerGiftView(admin: SupabaseClient, giftId: string): Promise<BuyerView | null> {
  let { data: g } = await admin.from('memora_gifts').select('*').eq('id', giftId).maybeSingle();
  if (!g) return null;
  if (g.status === 'PENDING' && providerOn(g.provider) && g.provider_reference) {
    try {
      await confirmGift(admin, g.provider as Provider, g.provider_reference);
    } catch {
      /* Provider unreachable: the page polls again */
    }
    ({ data: g } = await admin.from('memora_gifts').select('*').eq('id', giftId).maybeSingle());
    if (!g) return null;
  }
  const paid = g.status === 'PAID' || g.status === 'REDEEMED';
  return {
    status: g.status,
    paid,
    recipientName: g.recipient_name,
    lovedOneName: g.loved_one_name,
    funeralDate: g.funeral_date_estimate,
    recipientWhatsapp: g.recipient_whatsapp,
    message: g.message,
    buyerName: g.buyer_name,
    redeemed: g.status === 'REDEEMED',
    redeemLink: paid ? redeemUrl(g.id) : null,
  };
}

/**
 * Turns a paid gift into a paid memorial owned by the signed-in user. The gift is
 * claimed atomically (PAID → REDEEMED), so a link can only be used once.
 */
export async function redeemGift(user: { id: string }, userClient: SupabaseClient, admin: SupabaseClient, giftId: string): Promise<{ caseId: string } | { error: string; status: number }> {
  const { data: existing } = await admin.from('memora_gifts').select('id,status,redeemed_by,case_id').eq('id', giftId).maybeSingle();
  if (!existing) return { error: 'This gift link is not valid.', status: 404 };
  if (existing.status === 'REDEEMED') {
    if (existing.redeemed_by === user.id && existing.case_id) return { caseId: existing.case_id };
    return { error: 'This gift has already been used.', status: 409 };
  }
  if (existing.status !== 'PAID') return { error: 'This gift hasn’t been paid for yet.', status: 409 };

  const now = new Date().toISOString();
  const { data: g } = await admin
    .from('memora_gifts')
    .update({ status: 'REDEEMED', redeemed_by: user.id, redeemed_at: now, updated_at: now })
    .eq('id', giftId)
    .eq('status', 'PAID')
    .select('*')
    .maybeSingle();
  if (!g) return { error: 'This gift has already been used.', status: 409 };

  const rollback = () => admin.from('memora_gifts').update({ status: 'PAID', redeemed_by: null, redeemed_at: null, updated_at: new Date().toISOString() }).eq('id', giftId);

  const { data: created, error } = await userClient.from('memora_cases').insert({ owner_id: user.id }).select('id').single();
  if (error || !created) {
    await rollback();
    return { error: 'Could not create the memorial. Please try again.', status: 500 };
  }
  if (g.loved_one_name) {
    const draft = emptyDraft();
    Object.assign(draft.person, splitName(g.loved_one_name));
    await saveOwnedDraft(userClient, created.id, draft).catch(() => undefined);
  }

  // The gift pays for this memorial: record it the same way a direct payment is
  // recorded, so publishing needs no special case.
  const { data: order, error: orderError } = await admin
    .from('memora_orders')
    .insert({ case_id: created.id, created_by: user.id, amount_minor: g.amount_minor, currency: g.currency, status: 'PAID', provider: 'gift', provider_reference: `gift-${g.id}` })
    .select('id')
    .single();
  if (orderError || !order) {
    await userClient.from('memora_cases').delete().eq('id', created.id);
    await rollback();
    return { error: 'Could not apply the gift. Please try again.', status: 500 };
  }
  await admin.from('memora_payments').insert({
    order_id: order.id, provider: 'gift', provider_payment_id: g.id, status: 'CONFIRMED',
    amount_minor: g.amount_minor, currency: g.currency, verified_at: now, raw_event: { gift_id: g.id },
  });
  await admin.from('memora_gifts').update({ case_id: created.id }).eq('id', g.id);
  await admin.from('memora_activity_log').insert({ case_id: created.id, actor_user_id: user.id, action: 'GIFT_REDEEMED', metadata: { gift_id: g.id } });
  return { caseId: created.id };
}

/** Gift details shown in the editor of a memorial that came from a gift. */
export async function giftForCase(admin: SupabaseClient, caseId: string): Promise<{ buyerName: string; funeralDate: string | null } | null> {
  const { data } = await admin.from('memora_gifts').select('buyer_name,funeral_date_estimate').eq('case_id', caseId).maybeSingle();
  return data ? { buyerName: data.buyer_name, funeralDate: data.funeral_date_estimate } : null;
}

export interface BoardRow {
  g: GiftRow;
  redeemLink: string | null;
  p: { status: string; pct: number; slug: string } | undefined;
  days: number | null;
  stage: string;
  urgent: boolean;
  published: boolean;
}

/** Everything the team's gifts board shows, soonest funeral first. */
export async function loadGiftBoard(admin: SupabaseClient, now = new Date()): Promise<BoardRow[]> {
  const since = new Date(now.getTime() - 2 * 86_400_000).toISOString();
  const { data } = await admin
    .from('memora_gifts')
    .select('*')
    .neq('status', 'CANCELLED')
    .or(`status.neq.PENDING,created_at.gt."${since}"`)
    .order('funeral_date_estimate', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);
  const gifts = (data ?? []) as GiftRow[];

  const progress = new Map<string, { status: string; pct: number; slug: string }>();
  await Promise.all(
    gifts
      .filter((g) => g.case_id)
      .map(async (g) => {
        const c = await loadOwnedCase(admin, g.case_id).catch(() => null);
        if (c) progress.set(g.case_id, { status: c.meta.status, pct: readiness(c.draft).pct, slug: c.meta.slug });
      }),
  );

  return gifts.map((g) => {
    const p = g.case_id ? progress.get(g.case_id) : undefined;
    const days = daysUntil(g.funeral_date_estimate, now);
    const published = p?.status === 'PUBLISHED';
    const stage =
      g.status === 'PENDING' ? 'Awaiting payment' : g.status === 'PAID' ? 'Link sent · not started' : published ? 'Published' : `In progress · ${p?.pct ?? 0}%`;
    const urgent = g.status !== 'PENDING' && !published && days != null && days >= 0 && days <= 3;
    return { g, p, days, stage, urgent, published, redeemLink: g.status === 'PAID' ? redeemUrl(g.id) : null };
  });
}

/** The team records a manual follow-up from the gifts board. */
export async function markGiftContacted(admin: SupabaseClient, giftId: string): Promise<boolean> {
  const { data: g } = await admin.from('memora_gifts').select('team_contact_count').eq('id', giftId).maybeSingle();
  if (!g) return false;
  const now = new Date().toISOString();
  await admin.from('memora_gifts').update({ team_contact_count: g.team_contact_count + 1, team_contacted_at: now, updated_at: now }).eq('id', giftId);
  return true;
}

/** A WhatsApp message with the private link, ready for the buyer or the team to send. */
export function giftWhatsAppText(g: { recipient_name: string; buyer_name: string; loved_one_name?: string }, link: string): string {
  return `Hi ${g.recipient_name}, ${g.buyer_name} has arranged a Memora memorial${g.loved_one_name ? ` for ${g.loved_one_name}` : ''} for your family, and it's already paid for. You can create it here: ${link}\n\nIt stays private until you choose to publish it.`;
}
