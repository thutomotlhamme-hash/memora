/**
 * Normalises a WhatsApp number to international digits without "+", as the
 * WhatsApp API and wa.me links expect. South African local numbers
 * (0821234567) become 27821234567. Returns null when it can't be a phone number.
 */
export function normaliseWhatsApp(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const hadPlus = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/[^\d]/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);
  if (!hadPlus && digits.length === 10 && digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith('27') && digits.length !== 11) return null;
  return digits;
}

export function formatWhatsApp(digits: string): string {
  if (digits.startsWith('27') && digits.length === 11) return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}
