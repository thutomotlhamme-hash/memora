// Memora sells one product: Memora Complete, a one-off payment per memorial.
// The price is server-owned: checkout reads it from here, never from the browser.

export const CURRENCY = 'ZAR';

export const PRODUCT = {
  name: 'Memora Complete',
  amountMinor: 89900,
  /** Days the memorial stays public after publishing. */
  publicDays: 365,
  tagline: 'Through the first year, to the unveiling.',
  features: [
    'Memorial page with Live Funeral Mode',
    'Funeral journey with one-tap directions',
    'QR code, WhatsApp cards and printable programme',
    'Keepsake book and keepsake card',
    'Public for a full year, so it can be updated for the tombstone unveiling',
  ],
} as const;

export function archiveDate(from: Date): string {
  return new Date(from.getTime() + PRODUCT.publicDays * 86_400_000).toISOString();
}

export function formatMoney(amountMinor: number, currency = CURRENCY): string {
  const whole = amountMinor % 100 === 0;
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })
    .format(amountMinor / 100)
    .replace(/^R\s/, 'R')
    .replace(/ /g, ' ');
}

export const PRICE_LABEL = formatMoney(PRODUCT.amountMinor);
