import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../config';
import { daysUntil, splitName, type CleanGift } from '../gift';
import { emptyDraft, fmtDate, readiness } from '../memorial';
import { formatWhatsApp } from '../phone';
import { CURRENCY, PRICE_LABEL, PRODUCT } from '../plans';
import { loadOwnedCase, saveOwnedDraft } from './cases';
import { signGiftToken } from './links';
import { emailLayout, escapeHtml, sendEmail, sendWhatsAppTemplate } from './notify';
import { createCheckout, fetchCheckout } from './yoco';

export type GiftRow = Record<string, any>;

export const redeemUrl = (giftId: string) => `${siteUrl()}/gift/r/${signGiftToken('redeem', giftId)}`;
export const buyerUrl = (giftId: string) => `${siteUrl()}/gift/thanks/${signGiftToken('buyer', giftId)}`;

const simulationAllowed = () => process.env.MEMORA_SIMULATE_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';

function funeralLine(g: GiftRow): string {
  return g.funeral_date_estimate ? `around ${fmtDate(g.funeral_date_estimate)}` : 'date not yet known';
}

/** Creates a pending gift and a Yoco checkout for it. Returns where to send the buyer. */
export async function startGiftCheckout(admin: SupabaseClient, gift: CleanGift, buyerUserId: string | null): Promise<string> {
  const { data: row, error } = await admin
    .from('memora_gifts')
    .insert({
      amount_minor: PRODUCT.amountMinor,
      currency: CURRENCY,
      provider: simulationAllowed() ? 'simulated' : 'yoco',
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

  if (simulationAllowed()) {
    await admin.from('memora_gifts').update({ status: 'PAID', paid_at: new Date().toISOString(), provider_reference: `sim-${row.id}` }).eq('id', row.id);
    await deliverGift(admin, row.id);
    return buyerUrl(row.id);
  }

  const thanks = buyerUrl(row.id);
  try {
    const checkout = await createCheckout({
      amountMinor: PRODUCT.amountMinor,
      currency: CURRENCY,
      successUrl: thanks,
      cancelUrl: `${siteUrl()}/gift?payment=cancelled`,
      failureUrl: `${siteUrl()}/gift?payment=failed`,
      idempotencyKey: `gift-${row.id}`,
      metadata: { giftId: row.id, kind: 'gift' },
    });
    await admin.from('memora_gifts').update({ provider_reference: checkout.id, updated_at: new Date().toISOString() }).eq('id', row.id);
    return checkout.redirectUrl;
  } catch (err) {
    await admin.from('memora_gifts').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', row.id);
    throw err;
  }
}

/**
 * Confirms a gift payment by fetching the checkout from Yoco (never trusting a
 * redirect or webhook body), then delivers the gift. Idempotent.
 */
export async function confirmGiftWithYoco(admin: SupabaseClient, checkoutId: string): Promise<'confirmed' | 'already_paid' | 'pending' | 'mismatch' | 'no_gift'> {
  const { data: gift } = await admin.from('memora_gifts').select('id,status,amount_minor,currency,provider_reference').eq('provider', 'yoco').eq('provider_reference', checkoutId).maybeSingle();
  if (!gift) return 'no_gift';
  if (gift.status === 'PAID' || gift.status === 'REDEEMED') {
    await deliverGift(admin, gift.id);
    return 'already_paid';
  }
  const checkout = await fetchCheckout(checkoutId);
  if (String(checkout?.status).toLowerCase() !== 'completed') return 'pending';
  const matches =
    String(checkout.id) === gift.provider_reference &&
    Number(checkout.amount) === Number(gift.amount_minor) &&
    String(checkout.currency ?? '').toUpperCase() === String(gift.currency).toUpperCase() &&
    (!checkout.metadata?.giftId || checkout.metadata.giftId === gift.id);
  if (!matches) {
    console.error('Yoco gift verification mismatch', { giftId: gift.id });
    return 'mismatch';
  }
  await admin
    .from('memora_gifts')
    .update({ status: 'PAID', paid_at: new Date().toISOString(), provider_payment_id: String(checkout.paymentId || checkout.id), updated_at: new Date().toISOString() })
    .eq('id', gift.id)
    .eq('status', 'PENDING');
  await deliverGift(admin, gift.id);
  return 'confirmed';
}

async function sendRecipientLink(g: GiftRow, kind: 'first' | 'reminder' | 'urgent') {
  const link = redeemUrl(g.id);
  const who = escapeHtml(g.buyer_name);
  const forWhom = g.loved_one_name ? ` for ${escapeHtml(g.loved_one_name)}` : '';
  const subject =
    kind === 'first'
      ? `${g.buyer_name} has given you a Memora memorial`
      : kind === 'urgent'
        ? `The funeral is close: finish the memorial${g.loved_one_name ? ` for ${g.loved_one_name}` : ''}`
        : `A reminder: your Memora memorial is ready to start`;
  const intro =
    kind === 'first'
      ? `${who} has paid for a Memora memorial${forWhom}, so you don’t have to. With it you can tell their story, map every stop of the funeral with directions, build the programme, and share one link and QR code with everyone.`
      : kind === 'urgent'
        ? `The funeral${forWhom} is ${escapeHtml(funeralLine(g))}. The memorial ${escapeHtml(g.buyer_name)} gave you is still waiting. Guests will need the directions and programme, so it’s worth finishing it now.`
        : `${who} gave you a Memora memorial${forWhom}. It’s paid for and waiting whenever you’re ready. It only takes a few minutes to start, and you can finish it bit by bit.`;
  const paragraphs = [`Dear ${escapeHtml(g.recipient_name)},`, intro];
  if (kind === 'first' && g.message) paragraphs.push(`<em>“${escapeHtml(g.message)}”</em> <br>— ${who}`);
  paragraphs.push('Everything stays private until you choose to publish it.');
  const html = emailLayout({ preheader: subject, heading: kind === 'first' ? 'A gift, to help you remember.' : 'Your memorial is waiting.', paragraphs, cta: { label: 'Start the memorial', href: link } });
  const text = `${paragraphs.map((p) => p.replace(/<[^>]+>/g, '')).join('\n\n')}\n\nStart the memorial: ${link}`;
  const [email, whatsapp] = await Promise.all([
    sendEmail(g.recipient_email, subject, html, text),
    sendWhatsAppTemplate(g.recipient_whatsapp, [g.recipient_name, g.buyer_name, link]),
  ]);
  return { email, whatsapp };
}

async function alertTeam(subject: string, g: GiftRow, extra: string[] = []) {
  const to = process.env.MEMORA_TEAM_EMAIL;
  if (!to) return;
  const lines = [
    `<strong>Funeral:</strong> ${escapeHtml(funeralLine(g))}`,
    `<strong>Loved one:</strong> ${escapeHtml(g.loved_one_name || '—')}`,
    `<strong>Recipient:</strong> ${escapeHtml(g.recipient_name)} · ${escapeHtml(g.recipient_email || '')} ${g.recipient_whatsapp ? escapeHtml(formatWhatsApp(g.recipient_whatsapp)) : ''}`,
    `<strong>From:</strong> ${escapeHtml(g.buyer_name)} · ${escapeHtml(g.buyer_email)}`,
    ...extra,
  ];
  await sendEmail(to, subject, emailLayout({ preheader: subject, heading: subject, paragraphs: lines, cta: { label: 'Open the gifts board', href: `${siteUrl()}/admin` } }), lines.join('\n').replace(/<[^>]+>/g, ''));
}

/**
 * Sends the gift link to the recipient (email + WhatsApp), a receipt to the buyer
 * and an alert to the team, exactly once: the first caller claims delivery with a
 * conditional update, so the webhook and the thank-you page can't both send it.
 */
export async function deliverGift(admin: SupabaseClient, giftId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: g } = await admin
    .from('memora_gifts')
    .update({ delivery_started_at: now, updated_at: now })
    .eq('id', giftId)
    .in('status', ['PAID', 'REDEEMED'])
    .is('delivery_started_at', null)
    .select('*')
    .maybeSingle();
  if (!g) return;

  const { email, whatsapp } = await sendRecipientLink(g, 'first');
  await admin
    .from('memora_gifts')
    .update({ email_sent_at: email.sent ? now : null, whatsapp_sent_at: whatsapp.sent ? now : null, updated_at: new Date().toISOString() })
    .eq('id', g.id);
  if (!email.sent && g.recipient_email) console.warn('Gift email not sent', { giftId, error: email.error });
  if (!whatsapp.sent && g.recipient_whatsapp) console.warn('Gift WhatsApp not sent', { giftId, error: whatsapp.error });

  const receipt = [
    `Thank you, ${escapeHtml(g.buyer_name)}. Your gift of ${PRICE_LABEL}${g.loved_one_name ? ` for ${escapeHtml(g.loved_one_name)}` : ''} is paid.`,
    email.sent || whatsapp.sent
      ? `We’ve sent ${escapeHtml(g.recipient_name)} their private link${email.sent && whatsapp.sent ? ' by email and WhatsApp' : email.sent ? ' by email' : ' on WhatsApp'}. We’ll send gentle reminders if they haven’t started, and our team is watching the funeral date.`
      : `Use the page below to send ${escapeHtml(g.recipient_name)} their private link on WhatsApp.`,
  ];
  await sendEmail(
    g.buyer_email,
    `Your Memora gift for ${g.recipient_name}`,
    emailLayout({ preheader: 'Your gift is on its way', heading: 'Your gift is on its way.', paragraphs: receipt, cta: { label: 'View your gift', href: buyerUrl(g.id) } }),
    `${receipt.join('\n\n').replace(/<[^>]+>/g, '')}\n\n${buyerUrl(g.id)}`,
  );
  await alertTeam(`New gift: funeral ${funeralLine(g)}`, g, [
    `<strong>Link sent by:</strong> ${[email.sent && 'email', whatsapp.sent && 'WhatsApp'].filter(Boolean).join(' + ') || 'not sent automatically, buyer must share it'}`,
  ]);
}

export interface BuyerView {
  status: string;
  paid: boolean;
  recipientName: string;
  lovedOneName: string;
  funeralDate: string | null;
  emailSent: boolean;
  whatsappSent: boolean;
  recipientWhatsapp: string | null;
  redeemed: boolean;
  redeemLink: string | null;
}

/** What the buyer's thank-you page may see. Confirms with Yoco if still pending. */
export async function buyerGiftView(admin: SupabaseClient, giftId: string): Promise<BuyerView | null> {
  let { data: g } = await admin.from('memora_gifts').select('*').eq('id', giftId).maybeSingle();
  if (!g) return null;
  if (g.status === 'PENDING' && g.provider === 'yoco' && g.provider_reference) {
    try {
      await confirmGiftWithYoco(admin, g.provider_reference);
    } catch {
      /* Yoco unreachable: the page polls again */
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
    emailSent: Boolean(g.email_sent_at),
    whatsappSent: Boolean(g.whatsapp_sent_at),
    recipientWhatsapp: g.recipient_whatsapp,
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

/**
 * Hourly job. (1) Gifts paid but not started: remind the recipient daily, up to 3
 * times. (2) Funeral within 3 days and memorial not yet published: nudge the
 * recipient and alert the team, once a day.
 */
export async function runGiftReminders(admin: SupabaseClient): Promise<{ reminders: number; urgent: number }> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  let reminders = 0;
  let urgent = 0;

  const { data: waiting } = await admin
    .from('memora_gifts')
    .select('*')
    .eq('status', 'PAID')
    .lt('paid_at', dayAgo)
    .lt('reminder_count', 3)
    .or(`last_reminder_at.is.null,last_reminder_at.lt."${dayAgo}"`)
    .limit(100);
  for (const g of waiting ?? []) {
    await sendRecipientLink(g, 'reminder');
    await admin.from('memora_gifts').update({ reminder_count: g.reminder_count + 1, last_reminder_at: now.toISOString() }).eq('id', g.id);
    reminders++;
  }

  const soon = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const { data: close } = await admin
    .from('memora_gifts')
    .select('*, memora_cases(status)')
    .in('status', ['PAID', 'REDEEMED'])
    .gte('funeral_date_estimate', today)
    .lte('funeral_date_estimate', soon)
    .or(`last_urgent_alert_at.is.null,last_urgent_alert_at.lt."${dayAgo}"`)
    .limit(100);
  for (const g of close ?? []) {
    const caseStatus = (Array.isArray(g.memora_cases) ? g.memora_cases[0] : g.memora_cases)?.status;
    if (caseStatus === 'PUBLISHED') continue;
    const days = daysUntil(g.funeral_date_estimate, now);
    await sendRecipientLink(g, 'urgent');
    await alertTeam(`Funeral in ${days} day${days === 1 ? '' : 's'}: memorial not published`, g, [
      `<strong>Status:</strong> ${g.status === 'PAID' ? 'gift not started yet' : 'memorial started, not published'}`,
    ]);
    await admin.from('memora_gifts').update({ last_urgent_alert_at: now.toISOString() }).eq('id', g.id);
    urgent++;
  }
  return { reminders, urgent };
}

export interface BoardRow {
  g: GiftRow;
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
    return { g, p, days, stage, urgent, published };
  });
}
