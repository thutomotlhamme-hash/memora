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
  // "R1,490" and "R14,500": comma thousands, as funeral homes write prices.
  const whole = amountMinor % 100 === 0;
  const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(Math.abs(amountMinor) / 100);
  return `${amountMinor < 0 ? '−' : ''}${currency === 'ZAR' ? 'R' : `${currency} `}${n}`;
}

export const PRICE_LABEL = formatMoney(PRODUCT.amountMinor);

// ---------------------------------------------------------------------------
// Memora Pro: the funeral-home engine, a separate proposition from families.
//
// Every plan is the same shape of contract: a monthly base fee, a number of
// published memorials included each month, a price for each one after that,
// and a once-off onboarding fee. Pay-as-you-go is simply "no base fee, nothing
// included". Enterprise uses the same shape with terms set per contract, so
// no plan needs code of its own.
// ---------------------------------------------------------------------------

export type ProPlan = 'payg' | 'pro' | 'pro_plus' | 'enterprise';

export const VAT_RATE = 0.15;

export type PlanDef = {
  name: string;
  /** The line the admin selector and invoices use. */
  short: string;
  forWho: string;
  monthlyMinor: number;
  /** Published memorials included each billing month. */
  includedMemorials: number;
  /** Each published memorial beyond the included ones (for PAYG: every memorial). */
  overageMinor: number;
  onboardingMinor: number;
  /** Branch allowance; null = set per contract. */
  branches: number | null;
  /** Priced by contract: not a checkout plan. */
  quoted?: boolean;
  agreementMonths: number | null;
  features: string[];
};

export const PRO_PLANS: Record<ProPlan, PlanDef> = {
  payg: {
    name: 'Pro Pay-as-you-go',
    short: 'Pro PAYG',
    forWho: 'For smaller funeral homes, and homes starting with Memora.',
    monthlyMinor: 0,
    includedMemorials: 0,
    overageMinor: 149000,
    onboardingMinor: 0,
    branches: 1,
    agreementMonths: null,
    features: ['Your branding on every memorial, programme and QR card', 'Funeral dashboard and calendar', 'Family intake links', 'Run-sheets for the day', 'No commitment: stop any time'],
  },
  pro: {
    name: 'Pro',
    short: 'Pro',
    forWho: 'One branch, a steady number of funerals.',
    monthlyMinor: 650000,
    includedMemorials: 5,
    overageMinor: 89900,
    onboardingMinor: 350000,
    branches: 1,
    agreementMonths: 12,
    features: [
      'Everything in Pay-as-you-go',
      'Owner, branch manager and arranger roles',
      'Team management',
      'Tradition templates',
      'Print and share centre',
      'Monthly reporting',
      'Priority support',
    ],
  },
  pro_plus: {
    name: 'Pro Plus',
    short: 'Pro Plus',
    forWho: 'Up to three branches under one owner.',
    monthlyMinor: 1450000,
    includedMemorials: 15,
    overageMinor: 69900,
    onboardingMinor: 650000,
    branches: 3,
    agreementMonths: 12,
    features: ['Everything in Pro', 'Up to three branches, each with its own team', 'Central owner view across branches', 'Branch-level reporting', 'Your own memorial web address, where supported'],
  },
  enterprise: {
    name: 'Enterprise',
    short: 'Enterprise',
    forWho: 'For groups, franchises, insurers and high-volume operators.',
    monthlyMinor: 3500000,
    includedMemorials: 50,
    overageMinor: 49900,
    onboardingMinor: 950000,
    branches: null,
    quoted: true,
    agreementMonths: 12,
    features: ['Custom structure: regions, brands and branches', 'Group control centre, reporting and audit', 'Brand and template governance', 'Central billing across every home', 'Contracted service levels and an account manager'],
  },
};

export const isProPlan = (v: unknown): v is ProPlan => typeof v === 'string' && v in PRO_PLANS;

/** "Pro · R6,500/mo · 5 included · R899 extra": how the command centre names a plan. */
export function planLabel(plan: ProPlan): string {
  const p = PRO_PLANS[plan];
  if (p.quoted) return `${p.short} · Custom contract · from ${formatMoney(p.monthlyMinor)}/mo`;
  if (!p.monthlyMinor) return `${p.short} · ${formatMoney(p.overageMinor)} / funeral`;
  return `${p.short} · ${formatMoney(p.monthlyMinor)}/mo · ${p.includedMemorials} included · ${formatMoney(p.overageMinor)} extra`;
}

/** The commercial terms an invoice is worked out from (a funeral home's, or an enterprise contract's). */
export type BillingTerms = {
  monthlyFeeMinor: number;
  includedMemorials: number;
  /** Price of each memorial beyond the allowance. */
  perMemorialMinor: number;
  onboardingFeeMinor: number;
  onboardingPaid: boolean;
};

export type InvoiceLines = {
  monthly: number;
  included: number;
  memorials: number;
  overageMemorials: number;
  overageRate: number;
  usage: number;
  onboarding: number;
  adjustments: number;
  /** Excluding VAT. */
  subtotal: number;
  vat: number;
  /** Including VAT. */
  totalInclVat: number;
  /** Excluding VAT (kept as "total" for the screens that already show it). */
  total: number;
};

/**
 * One month's invoice, worked out the same way everywhere. Only published
 * memorials count; the allowance resets each month; onboarding is charged once.
 * Whole cents only, so it is the same every time it is worked out.
 */
export function proInvoice(terms: BillingTerms, memorials: number, firstInvoice: boolean, adjustmentsMinor = 0): InvoiceLines {
  const used = Math.max(0, Math.floor(memorials));
  const included = Math.max(0, Math.floor(terms.includedMemorials ?? 0));
  const overageMemorials = Math.max(0, used - included);
  const usage = overageMemorials * terms.perMemorialMinor;
  const onboarding = firstInvoice && !terms.onboardingPaid ? terms.onboardingFeeMinor : 0;
  const subtotal = Math.max(0, terms.monthlyFeeMinor + usage + onboarding + adjustmentsMinor);
  const vat = Math.round(subtotal * VAT_RATE);
  return {
    monthly: terms.monthlyFeeMinor,
    included,
    memorials: used,
    overageMemorials,
    overageRate: terms.perMemorialMinor,
    usage,
    onboarding,
    adjustments: adjustmentsMinor,
    subtotal,
    vat,
    totalInclVat: subtotal + vat,
    total: subtotal,
  };
}

/** "2026-09" for the month containing this date, in South African time (what the business runs on). */
export function periodOf(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
}

/** The first moment of a billing month and of the next, in South African time. */
export function periodRange(period: string): [string, string] {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 2 * 3_600_000);
  const end = new Date(Date.UTC(y, m, 1) - 2 * 3_600_000);
  return [start.toISOString(), end.toISOString()];
}

/** A memorial becoming public under a funeral home (or a draft or preview, which never count). */
export type Publication = { caseId: string; orgId: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; publishedAt: string | null };

/**
 * Published memorials per funeral home in one billing month. Each memorial
 * counts once, in the month it was first published: drafts, previews and
 * never-published memorials don't count, and editing, re-publishing or a
 * takedown and restore never count it again.
 */
export function billableUsage(rows: Publication[], period: string): Map<string, number> {
  const first = new Map<string, Publication>();
  for (const r of rows) {
    if (!r.publishedAt || r.status === 'DRAFT') continue;
    const had = first.get(r.caseId);
    if (!had || r.publishedAt < had.publishedAt!) first.set(r.caseId, r);
  }
  const out = new Map<string, number>();
  for (const r of first.values()) if (periodOf(new Date(r.publishedAt!)) === period) out.set(r.orgId, (out.get(r.orgId) ?? 0) + 1);
  return out;
}

// ---------------------------------------------------------------------------
// The first year: a memorial stays public until its archive date, a year after
// publishing, so it is there for the tombstone unveiling. The last months are
// when families plan the unveiling, and when Memora (and their funeral home)
// can help with the next event.
// ---------------------------------------------------------------------------

export const UNVEILING_WINDOW_DAYS = 90;

export type YearPhase = 'first_months' | 'unveiling_soon' | 'last_days' | 'ended';

export function publicYear(publishedAt: string | null, archiveAt: string | null, now = new Date()): { phase: YearPhase; daysLeft: number; elapsed: number; until: string } | null {
  if (!publishedAt || !archiveAt) return null;
  const start = new Date(publishedAt).getTime();
  const end = new Date(archiveAt).getTime();
  const total = Math.max(1, end - start);
  const daysLeft = Math.ceil((end - now.getTime()) / 86_400_000);
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / total));
  const phase: YearPhase = daysLeft <= 0 ? 'ended' : daysLeft <= 14 ? 'last_days' : daysLeft <= UNVEILING_WINDOW_DAYS ? 'unveiling_soon' : 'first_months';
  return { phase, daysLeft: Math.max(0, daysLeft), elapsed, until: archiveAt.slice(0, 10) };
}
