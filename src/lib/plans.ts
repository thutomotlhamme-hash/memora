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

// ---------------------------------------------------------------------------
// Memora Pro: the funeral-home engine, priced separately from families.
// A funeral home never pays less per memorial than a family does.
// ---------------------------------------------------------------------------

export type ProPlan = 'payg' | 'pro' | 'pro_plus' | 'enterprise';

export const PRO_PLANS: Record<
  ProPlan,
  { name: string; forWho: string; monthlyMinor: number; perMemorialMinor: number; branches: number; quoted?: boolean; features: string[] }
> = {
  payg: {
    name: 'Pro Pay-as-you-go',
    forWho: 'Smaller homes starting out',
    monthlyMinor: 0,
    perMemorialMinor: 149000,
    branches: 1,
    features: ['Your branding on every memorial and keepsake', 'Funeral-home dashboard', 'Run-sheets for your arrangers'],
  },
  pro: {
    name: 'Pro',
    forWho: 'One branch',
    monthlyMinor: 650000,
    perMemorialMinor: 99900,
    branches: 1,
    features: ['Everything in Pay-as-you-go', 'Branches, with owner, branch manager and arranger roles', 'Tradition templates', 'Monthly report: funerals and guests reached', 'Priority WhatsApp support'],
  },
  pro_plus: {
    name: 'Pro Plus',
    forWho: 'Up to three branches',
    monthlyMinor: 1450000,
    perMemorialMinor: 99900,
    branches: 3,
    features: ['Everything in Pro', 'Up to three branches', 'Your own memorial web address', 'Branch-level reports'],
  },
  enterprise: {
    name: 'Enterprise',
    forWho: 'Groups and insurers',
    monthlyMinor: 3500000,
    perMemorialMinor: 99900,
    branches: 50,
    quoted: true,
    features: ['Everything in Pro Plus', 'Unlimited branches', 'Service-level agreement', 'Integration with your systems', 'Dedicated account manager'],
  },
};

export const PRO_ONBOARDING_MINOR = 950000;

export const isProPlan = (v: unknown): v is ProPlan => typeof v === 'string' && v in PRO_PLANS;

/** A month's invoice for a funeral home: the plan fee, each published memorial, and onboarding if still owed. */
export function proInvoice(org: { monthlyFeeMinor: number; perMemorialMinor: number; onboardingFeeMinor: number; onboardingPaid: boolean }, memorials: number, firstInvoice: boolean) {
  const onboarding = firstInvoice && !org.onboardingPaid ? org.onboardingFeeMinor : 0;
  const usage = Math.max(0, memorials) * org.perMemorialMinor;
  return { monthly: org.monthlyFeeMinor, usage, onboarding, total: org.monthlyFeeMinor + usage + onboarding };
}

/** "2026-09" for the month containing this date (South African time is what the business runs on). */
export function periodOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
