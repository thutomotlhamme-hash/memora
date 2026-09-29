// Runtime configuration. NEXT_PUBLIC_* values are safe for the browser; everything
// else is read only on the server.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const MEDIA_BUCKET = 'memora-media';

/** Memora can run without Supabase: guest drafts and /m/preview still work. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export const pricing = {
  get amountMinor(): number {
    const n = Number(process.env.MEMORA_PUBLISH_PRICE_MINOR ?? 29900);
    return Number.isInteger(n) && n > 0 ? n : 29900;
  },
  get currency(): string {
    return (process.env.MEMORA_CURRENCY || 'ZAR').toUpperCase();
  },
};

/** How long a published memorial stays public before it becomes private. */
export function publicDays(): number {
  const n = Number(process.env.MEMORA_PUBLIC_DAYS ?? 90);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export function formatMoney(amountMinor: number, currency: string): string {
  const whole = amountMinor % 100 === 0;
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })
    .format(amountMinor / 100)
    .replace(/^R\s/, 'R');
}
