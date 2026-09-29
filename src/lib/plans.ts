// Memora plans. One-off payments per memorial, no subscriptions.
// Plans differ only in how long the memorial stays public: every plan gets the full
// memorial, Live Funeral Mode, QR code and every download. Prices are server-owned:
// checkout reads them from here, never from the browser.

export type PlanId = 'essential' | 'complete' | 'forever';

export interface Plan {
  id: PlanId;
  name: string;
  amountMinor: number;
  /** Days the memorial stays public after publishing; null = permanently. */
  publicDays: number | null;
  tagline: string;
  features: string[];
}

export const CURRENCY = 'ZAR';

export const PLANS: Plan[] = [
  {
    id: 'essential',
    name: 'Essential',
    amountMinor: 49900,
    publicDays: 90,
    tagline: 'For the funeral and the weeks after.',
    features: ['Memorial page with Live Funeral Mode', 'Funeral journey with one-tap directions', 'QR code, WhatsApp cards and printable programme', 'Keepsake book PDF', 'Public for 3 months'],
  },
  {
    id: 'complete',
    name: 'Complete',
    amountMinor: 89900,
    publicDays: 365,
    tagline: 'Through the first year, to the unveiling.',
    features: ['Everything in Essential', 'Public for a full year', 'Update it for the tombstone unveiling or memorial service'],
  },
  {
    id: 'forever',
    name: 'Forever',
    amountMinor: 149900,
    publicDays: null,
    tagline: 'A permanent place to remember them.',
    features: ['Everything in Complete', 'Public permanently, with no renewals', 'For anniversaries, family and future generations'],
  },
];

export const DEFAULT_PLAN: PlanId = 'complete';
const RANK: Record<PlanId, number> = { essential: 1, complete: 2, forever: 3 };

export function getPlan(id: unknown): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}

/** The longest-lasting of several paid plans. */
export function bestPlan(ids: unknown[]): PlanId | null {
  return (ids.filter((id): id is PlanId => Boolean(getPlan(id))).sort((a, b) => RANK[b] - RANK[a])[0] ?? null);
}

export function archiveDate(plan: Plan, from: Date): string | null {
  return plan.publicDays == null ? null : new Date(from.getTime() + plan.publicDays * 86_400_000).toISOString();
}

export function formatMoney(amountMinor: number, currency = CURRENCY): string {
  const whole = amountMinor % 100 === 0;
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })
    .format(amountMinor / 100)
    .replace(/^R\s/, 'R')
    .replace(/ /g, ' ');
}

export function durationLabel(plan: Plan): string {
  if (plan.publicDays == null) return 'Public permanently';
  if (plan.publicDays >= 365) return `Public for ${Math.round(plan.publicDays / 365)} year${plan.publicDays >= 730 ? 's' : ''}`;
  return `Public for ${Math.round(plan.publicDays / 30)} months`;
}
