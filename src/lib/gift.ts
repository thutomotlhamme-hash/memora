// Gift form rules, shared by the browser form and the server route.

import { localDateKey } from './memorial.ts';
import { normaliseWhatsApp } from './phone.ts';

export interface GiftInput {
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  recipientEmail: string;
  recipientWhatsapp: string;
  lovedOneName: string;
  message: string;
  funeralDate: string;
  funeralDateUnsure: boolean;
}

export interface CleanGift {
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientWhatsapp: string;
  lovedOneName: string;
  message: string;
  funeralDate: string | null;
  funeralDateUnsure: boolean;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_FUTURE_DAYS = 180;

export function emptyGift(): GiftInput {
  return { buyerName: '', buyerEmail: '', recipientName: '', recipientEmail: '', recipientWhatsapp: '', lovedOneName: '', message: '', funeralDate: '', funeralDateUnsure: false };
}

/** Returns the cleaned gift, or a map of field → message for the form. */
export function validateGift(input: Partial<GiftInput>, today = new Date()): { ok: true; gift: CleanGift } | { ok: false; errors: Partial<Record<keyof GiftInput, string>> } {
  const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const errors: Partial<Record<keyof GiftInput, string>> = {};

  const buyerName = s(input.buyerName, 120);
  const buyerEmail = s(input.buyerEmail, 200).toLowerCase();
  const recipientName = s(input.recipientName, 120);
  const recipientEmail = s(input.recipientEmail, 200).toLowerCase();
  const whatsappRaw = s(input.recipientWhatsapp, 40);
  const recipientWhatsapp = whatsappRaw ? normaliseWhatsApp(whatsappRaw) : null;
  const funeralDateUnsure = Boolean(input.funeralDateUnsure);
  const funeralDate = /^\d{4}-\d{2}-\d{2}$/.test(s(input.funeralDate, 10)) ? s(input.funeralDate, 10) : '';

  if (!buyerName) errors.buyerName = 'Add your name so the family knows who the gift is from.';
  if (!EMAIL.test(buyerEmail)) errors.buyerEmail = 'Add your email so we can reach you about the gift.';
  if (!recipientName) errors.recipientName = 'Who should receive the gift?';
  if (recipientEmail && !EMAIL.test(recipientEmail)) errors.recipientEmail = 'This email address doesn’t look right.';
  if (!whatsappRaw) errors.recipientWhatsapp = 'Add their WhatsApp number. It’s how the link reaches them, and how we help if they get stuck.';
  else if (!recipientWhatsapp) errors.recipientWhatsapp = 'Use a number like 082 123 4567 or +27 82 123 4567.';

  if (!funeralDateUnsure) {
    if (!funeralDate) errors.funeralDate = 'Add a rough date, or tick “not sure yet”.';
    else {
      const todayKey = localDateKey(today);
      const max = new Date(today.getTime() + MAX_FUTURE_DAYS * 86_400_000);
      if (funeralDate < todayKey) errors.funeralDate = 'The funeral date can’t be in the past.';
      else if (funeralDate > localDateKey(max)) errors.funeralDate = 'That’s more than six months away. Tick “not sure yet” instead.';
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    gift: {
      buyerName,
      buyerEmail,
      recipientName,
      recipientEmail: recipientEmail || null,
      recipientWhatsapp: recipientWhatsapp as string,
      lovedOneName: s(input.lovedOneName, 120),
      message: s(input.message, 1000),
      funeralDate: funeralDateUnsure ? null : funeralDate,
      funeralDateUnsure,
    },
  };
}

/** Splits "Naledi Grace Mokoena" into first name and surname for the memorial draft. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** Days from today until the estimated funeral (negative once it has passed), or null. */
export function daysUntil(dateKey: string | null | undefined, today = new Date()): number | null {
  if (!dateKey) return null;
  const a = new Date(`${localDateKey(today)}T00:00:00`).getTime();
  const b = new Date(`${dateKey}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}
