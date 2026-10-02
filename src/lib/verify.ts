// Confirming a cellphone number with a one-time code (by WhatsApp, or SMS as a
// backup). The pure rules live here so they can be tested; sending and storing
// codes is in lib/server/verify.ts.

export const CODE_LENGTH = 6;
export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
/** Wait this long before another code to the same number. */
export const RESEND_SECONDS = 60;
export const HOURLY_LIMIT = 5;
export const DAILY_LIMIT = 10;

export type Channel = 'whatsapp' | 'sms';
export type Purpose = 'confirm' | 'reset';
export type Channels = { whatsapp: boolean; sms: boolean };

export const channelLabel = (c: Channel) => (c === 'whatsapp' ? 'WhatsApp' : 'SMS');

/** A code of six digits from random bytes (leading zeros allowed). */
export function codeFrom(random: Uint32Array): string {
  return String(random[0] % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, '0');
}

/** Only digits, as people paste or type them ("123 456" → "123456"). */
export function cleanCode(input: unknown): string | null {
  const digits = String(input ?? '').replace(/\D/g, '');
  return digits.length === CODE_LENGTH ? digits : null;
}

/**
 * May we send another code to this number now? `sent` is when earlier codes
 * went to it (any purpose). Spreads out retries and caps what one number can
 * cost us or receive in an hour and a day.
 */
export function sendAllowed(sent: Date[], now: Date): { ok: true } | { ok: false; waitSeconds: number; message: string } {
  const t = now.getTime();
  const ages = sent.map((d) => t - d.getTime()).filter((a) => a >= 0);
  const newest = Math.min(Infinity, ...ages);
  if (newest < RESEND_SECONDS * 1000) {
    const wait = Math.ceil((RESEND_SECONDS * 1000 - newest) / 1000);
    return { ok: false, waitSeconds: wait, message: `We’ve just sent a code. You can ask for another in ${wait} seconds.` };
  }
  if (ages.filter((a) => a < 3_600_000).length >= HOURLY_LIMIT) {
    const oldest = Math.max(...ages.filter((a) => a < 3_600_000));
    return { ok: false, waitSeconds: Math.ceil((3_600_000 - oldest) / 1000), message: 'That’s a lot of codes for one number. Please wait an hour, or message us for help.' };
  }
  if (ages.filter((a) => a < 86_400_000).length >= DAILY_LIMIT) {
    return { ok: false, waitSeconds: 86_400, message: 'That number has had today’s codes. Please try again tomorrow, or message us for help.' };
  }
  return { ok: true };
}

export function smsText(code: string): string {
  return `Your Memora code is ${code}. It expires in ${CODE_MINUTES} minutes. Don't share it: Memora will never ask you for it.`; // plain ASCII keeps it one SMS
}

/** 27721234567 → "072 *** 4567", so a screen never shows the whole number to someone looking over a shoulder. */
export function maskPhone(digits: string): string {
  if (digits.startsWith('27') && digits.length === 11) return `0${digits.slice(2, 4)} *** ${digits.slice(7)}`;
  return `+${digits.slice(0, 2)} *** ${digits.slice(-4)}`;
}
