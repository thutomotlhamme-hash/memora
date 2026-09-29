// Cellphone accounts. Families sign up with their number and a password; no
// SMS or email is ever sent. Supabase Auth stores the account under an internal
// address derived from the number (27721234567@phone.memora.local), which no
// one can receive mail at and which we never show to people.

import { formatWhatsApp, normaliseWhatsApp } from './phone.ts';

export const PHONE_LOGIN_DOMAIN = 'phone.memora.local';

/** A cellphone number in international digits (27721234567), or null. */
export function normaliseCellphone(input: string): string | null {
  const digits = normaliseWhatsApp(input);
  if (!digits) return null;
  // South African numbers must be mobiles (06x, 07x, 08x); landlines can't log in on a phone.
  if (digits.startsWith('27') && !/^27[678]\d{8}$/.test(digits)) return null;
  return digits;
}

export const phoneLoginEmail = (digits: string) => `${digits}@${PHONE_LOGIN_DOMAIN}`;

export function isPhoneLogin(email: string | null | undefined): boolean {
  return String(email ?? '').toLowerCase().endsWith(`@${PHONE_LOGIN_DOMAIN}`);
}

/** How to show an account to a person: the formatted number, or the email. */
export function accountLabel(email: string | null | undefined): string {
  const e = String(email ?? '');
  if (!isPhoneLogin(e)) return e;
  return formatWhatsApp(e.split('@')[0]);
}

/** A local-style number for display in South Africa: 072 123 4567. */
export function localCellphone(digits: string): string {
  if (digits.startsWith('27') && digits.length === 11) return `0${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return formatWhatsApp(digits);
}

/**
 * What someone typed in "Cellphone or email" → the address Supabase knows.
 * Returns null when it's neither a valid email nor a valid cellphone number.
 */
export function loginAddress(input: string): { email: string; kind: 'phone' | 'email' } | null {
  const raw = String(input ?? '').trim();
  if (raw.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? { email: raw.toLowerCase(), kind: 'email' } : null;
  const digits = normaliseCellphone(raw);
  return digits ? { email: phoneLoginEmail(digits), kind: 'phone' } : null;
}
