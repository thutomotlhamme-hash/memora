// Memora Enterprise, as configuration. A group is described by a blueprint
// (sensible defaults), a contract (terms), modules (what's switched on), a
// master brand (with locks) and a structure (regions → homes → branches).
// Nothing here is specific to one customer: every group runs the same code.

import type { BillingTerms } from './plans';
import type { Role } from './rbac';

export type Module = 'regions' | 'advanced_reporting' | 'audit_log' | 'central_templates' | 'brand_governance' | 'api_access' | 'custom_domain' | 'sla_controls' | 'sso' | 'bulk_import' | 'advanced_finance' | 'webhooks';

export const MODULES: Record<Module, { label: string; hint: string; ready: boolean }> = {
  regions: { label: 'Regions', hint: 'Group branches into regions, provinces, brands or divisions, each with its own managers.', ready: true },
  advanced_reporting: { label: 'Advanced reporting', hint: 'Reports by region, home, branch and arranger, with CSV export.', ready: true },
  audit_log: { label: 'Audit log', hint: 'Who changed what, when, with before and after.', ready: true },
  central_templates: { label: 'Central templates', hint: 'Head office publishes programme templates and wording to branches.', ready: true },
  brand_governance: { label: 'Brand governance', hint: 'A master brand, with parts homes may not change.', ready: true },
  api_access: { label: 'API access', hint: 'Service accounts with scoped keys for the group’s own systems.', ready: true },
  bulk_import: { label: 'Bulk import', hint: 'Add branches and invite staff from a CSV.', ready: true },
  advanced_finance: { label: 'Advanced finance', hint: 'Usage by home and branch against the contracted allowance.', ready: true },
  sla_controls: { label: 'SLA and support controls', hint: 'Service levels and support hours on the contract.', ready: true },
  custom_domain: { label: 'Custom domain', hint: 'Memorials on the group’s own web address (set up by Memora).', ready: false },
  webhooks: { label: 'Webhooks', hint: 'Tell the group’s systems when a memorial is published (coming).', ready: false },
  sso: { label: 'Single sign-on', hint: 'Sign in with the group’s own identity provider (coming).', ready: false },
};
export const ALL_MODULES = Object.keys(MODULES) as Module[];
export const isModule = (v: unknown): v is Module => typeof v === 'string' && v in MODULES;

export type Blueprint = 'standard' | 'franchise' | 'insurer' | 'network';
export type RegionKind = 'region' | 'province' | 'district' | 'brand' | 'division';

export const BLUEPRINTS: Record<
  Blueprint,
  {
    label: string;
    summary: string;
    modules: Module[];
    regionKind: RegionKind;
    /** Parts of the brand homes may not change. */
    brandLocks: BrandPart[];
    /** Group-level teams created empty, ready for people. */
    teams: { name: string; roles: Role[]; description: string }[];
    terms: Omit<BillingTerms, 'onboardingPaid'> & { branchAllowance: number | null };
  }
> = {
  standard: {
    label: 'Standard group',
    summary: 'One company, regions and branches, with central reporting.',
    modules: ['regions', 'advanced_reporting', 'audit_log', 'central_templates', 'brand_governance', 'advanced_finance', 'sla_controls'],
    regionKind: 'region',
    brandLocks: ['logo', 'colour', 'footer'],
    teams: [],
    terms: { monthlyFeeMinor: 3500000, includedMemorials: 50, perMemorialMinor: 49900, onboardingFeeMinor: 950000, branchAllowance: null },
  },
  franchise: {
    label: 'Franchise',
    summary: 'A corporate brand over franchised branches, with restrained central control.',
    modules: ['regions', 'advanced_reporting', 'audit_log', 'central_templates', 'brand_governance', 'bulk_import'],
    regionKind: 'region',
    brandLocks: ['logo', 'footer'],
    teams: [],
    terms: { monthlyFeeMinor: 3500000, includedMemorials: 50, perMemorialMinor: 49900, onboardingFeeMinor: 950000, branchAllowance: null },
  },
  insurer: {
    label: 'Insurer or policy provider',
    summary: 'High volume through partner homes, integrations and reporting.',
    modules: ['advanced_reporting', 'audit_log', 'api_access', 'bulk_import', 'advanced_finance', 'sla_controls', 'webhooks'],
    regionKind: 'province',
    brandLocks: ['footer'],
    teams: [],
    terms: { monthlyFeeMinor: 5500000, includedMemorials: 100, perMemorialMinor: 44900, onboardingFeeMinor: 1500000, branchAllowance: null },
  },
  network: {
    label: 'Funeral network',
    summary: 'Independent homes under one contract, each keeping its own brand.',
    modules: ['regions', 'advanced_reporting', 'central_templates', 'advanced_finance'],
    regionKind: 'region',
    brandLocks: [],
    teams: [],
    terms: { monthlyFeeMinor: 3500000, includedMemorials: 50, perMemorialMinor: 49900, onboardingFeeMinor: 950000, branchAllowance: null },
  },
};
export const isBlueprint = (v: unknown): v is Blueprint => typeof v === 'string' && v in BLUEPRINTS;

export type ContractStatus = 'onboarding' | 'trial' | 'active' | 'suspended' | 'ending' | 'closed';
export const CONTRACT_STATUS: Record<ContractStatus, { label: string; access: boolean; billed: boolean; hint: string }> = {
  onboarding: { label: 'Onboarding', access: true, billed: false, hint: 'Being set up. Staff can work; nothing is billed yet.' },
  trial: { label: 'Trial', access: true, billed: false, hint: 'Trying Memora. Nothing is billed.' },
  active: { label: 'Active', access: true, billed: true, hint: 'Billed monthly on the contract terms.' },
  ending: { label: 'Ending', access: true, billed: true, hint: 'Notice given: works and is billed until the end date.' },
  suspended: { label: 'Suspended', access: false, billed: false, hint: 'Staff can’t sign in to the group. Published memorials stay up for families.' },
  closed: { label: 'Closed', access: false, billed: false, hint: 'The contract has ended. Published memorials stay up until they expire.' },
};
export const isContractStatus = (v: unknown): v is ContractStatus => typeof v === 'string' && v in CONTRACT_STATUS;

export const SLA_TIERS = { standard: 'Standard', priority: 'Priority', premium: 'Premium' } as const;
export const SUPPORT_LEVELS = { business_hours: 'Business hours', extended: 'Extended hours (07:00–21:00, 7 days)', always_on: 'Always on (24/7 for funeral days)' } as const;

// ---------------------------------------------------------------------------
// Brand: the group's master brand, what homes may change, and what guests see.
// ---------------------------------------------------------------------------

export type BrandPart = 'logo' | 'colour' | 'footer';
export type Brand = { name: string; logoUrl: string; brandColour: string; footer: string };

/**
 * What guests see for a home in a group: locked parts always come from the
 * group; the rest from the home, falling back to the group's.
 */
export function resolveBrand(home: { name: string; logoUrl: string; brandColour: string }, group: { logoUrl: string; brandColour: string; footer: string; locks: BrandPart[] } | null): Brand {
  if (!group) return { name: home.name, logoUrl: home.logoUrl, brandColour: home.brandColour, footer: '' };
  const locked = (part: BrandPart) => group.locks.includes(part);
  return {
    name: home.name,
    logoUrl: locked('logo') ? group.logoUrl || home.logoUrl : home.logoUrl || group.logoUrl,
    brandColour: locked('colour') ? group.brandColour || home.brandColour : home.brandColour || group.brandColour,
    footer: group.footer,
  };
}

/** Which brand changes a home may make under its group's locks. */
export function lockedParts(change: { logoUrl?: string; brandColour?: string }, current: { logoUrl: string; brandColour: string }, locks: BrandPart[]): BrandPart[] {
  const out: BrandPart[] = [];
  if (locks.includes('logo') && change.logoUrl !== undefined && change.logoUrl !== current.logoUrl) out.push('logo');
  if (locks.includes('colour') && change.brandColour !== undefined && change.brandColour !== current.brandColour) out.push('colour');
  return out;
}

// ---------------------------------------------------------------------------
// Templates: published to all branches, some regions, or some branches.
// ---------------------------------------------------------------------------

export type Audience = { audience: 'all' | 'regions' | 'branches'; audienceIds: string[] };

export function templateReaches(t: Audience, branch: { id: string; regionId: string | null }): boolean {
  if (t.audience === 'all') return true;
  if (t.audience === 'branches') return t.audienceIds.includes(branch.id);
  return Boolean(branch.regionId && t.audienceIds.includes(branch.regionId));
}

// ---------------------------------------------------------------------------
// The provisioning wizard's structure box: one branch per line.
//   "Gauteng > Motheo Pretoria > Pretoria Central"   (region > home > branch)
//   "Motheo Pretoria > Centurion"                    (home > branch)
//   "Soweto"                                          (branch of the first home)
// ---------------------------------------------------------------------------

export type PlannedBranch = { region: string | null; home: string; branch: string; area: string };

export function parseStructure(text: string, defaultHome: string): { branches: PlannedBranch[]; regions: string[]; homes: string[]; errors: string[] } {
  const branches: PlannedBranch[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .forEach((line, i) => {
      const [path, area = ''] = line.split('|').map((x) => x.trim());
      const parts = path
        .split(/\s*[>›/]\s*/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (!parts.length || parts.length > 3) return errors.push(`Line ${i + 1}: use “Region > Home > Branch”, “Home > Branch” or just “Branch”.`);
      if (parts.some((x) => x.length < 2 || x.length > 80)) return errors.push(`Line ${i + 1}: names need 2 to 80 characters.`);
      const [region, home, branch] = parts.length === 3 ? parts : parts.length === 2 ? [null, parts[0], parts[1]] : [null, defaultHome, parts[0]];
      if (branches.some((b) => b.home.toLowerCase() === home!.toLowerCase() && b.branch.toLowerCase() === branch!.toLowerCase()))
        return errors.push(`Line ${i + 1}: ${branch} is listed twice under ${home}.`);
      branches.push({ region, home: home!, branch: branch!, area: area.slice(0, 120) });
    });
  const uniq = (xs: string[]) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()];
  return { branches, regions: uniq(branches.map((b) => b.region).filter((r): r is string => Boolean(r))), homes: uniq(branches.map((b) => b.home)), errors };
}

/** Cellphone numbers or emails, one per line or comma-separated. */
export function parsePeople(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,;]+/)
        .map((x) => x.trim())
        .filter((x) => x.length >= 5),
    ),
  ].slice(0, 50);
}

/** A CSV cell, quoted when it needs to be. */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Formula injection: a cell starting with = + - @ is read as text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// The templates a new group starts with (head office edits or replaces them).
// ---------------------------------------------------------------------------

type TemplateItem = { part: 'vigil' | 'service' | 'graveside'; type: string; title: string; minutes: number };

export const STARTER_TEMPLATES: { name: string; kind: 'programme' | 'wording'; tradition: string; items?: TemplateItem[]; wording?: string }[] = [
  {
    name: 'Funeral service',
    kind: 'programme',
    tradition: 'Christian',
    items: [
      { part: 'service', type: 'arrival', title: 'Arrival of the deceased', minutes: 5 },
      { part: 'service', type: 'prayer', title: 'Opening prayer', minutes: 5 },
      { part: 'service', type: 'hymn', title: 'Hymn', minutes: 5 },
      { part: 'service', type: 'scripture', title: 'Scripture reading', minutes: 5 },
      { part: 'service', type: 'obituary', title: 'Obituary', minutes: 10 },
      { part: 'service', type: 'tribute', title: 'Tribute from the family', minutes: 10 },
      { part: 'service', type: 'sermon', title: 'Sermon', minutes: 20 },
      { part: 'service', type: 'viewing', title: 'Final viewing', minutes: 15 },
      { part: 'graveside', type: 'committal', title: 'Committal', minutes: 10 },
      { part: 'graveside', type: 'wreath', title: 'Laying of wreaths', minutes: 10 },
      { part: 'graveside', type: 'thanks', title: 'Vote of thanks', minutes: 5 },
    ],
  },
  {
    name: 'Obituary opening',
    kind: 'wording',
    tradition: '',
    wording: 'It is with great sadness that the family announces the passing of their beloved {name}. {name} will be remembered for their warmth, their faith and the love they gave so freely.',
  },
];

/** Template items as programme items, timed one after another from a start time. */
export function templateToProgramme(items: TemplateItem[], start = '10:00', newId: () => string): { id: string; part: TemplateItem['part']; type: string; time: string; title: string; presenter: string; detail: string }[] {
  let [h, m] = start.split(':').map(Number);
  return items.map((it) => {
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    m += it.minutes;
    h = (h + Math.floor(m / 60)) % 24;
    m %= 60;
    return { id: newId(), part: it.part, type: it.type, time, title: it.title, presenter: '', detail: '' };
  });
}

// ---------------------------------------------------------------------------
// Reporting: the numbers head office and regions actually run on.
// ---------------------------------------------------------------------------

export type ReportFilters = { from: string; to: string; regionId?: string; homeId?: string; branchId?: string; status?: 'all' | 'published' | 'draft' };

export type ReportRow = {
  branchId: string;
  branch: string;
  home: string;
  region: string;
  active: boolean;
  funerals: number;
  published: number;
  drafts: number;
  withProgramme: number;
  fromFamilyLinks: number;
  avgLeadDays: number | null;
  lastActivity: string | null;
};

/** Funerals in a period (by funeral date, or created date when there isn't one yet), per branch. */
type ReportWorld = {
  branches: { id: string; orgId: string; name: string; regionId: string | null; active: boolean }[];
  homes: { id: string; name: string }[];
  regions: { id: string; name: string }[];
  funerals: { branchId: string | null; ownerId: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; funeralDate: string | null; createdAt: string; publishedAt: string | null; hasProgramme: boolean; fromFamilyLink: boolean }[];
  visibleBranchIds: string[];
};

export function buildReport(world: ReportWorld, f: ReportFilters): { rows: ReportRow[]; byArranger: { ownerId: string; funerals: number; published: number }[] } {
  const home = new Map(world.homes.map((h) => [h.id, h.name]));
  const region = new Map(world.regions.map((r) => [r.id, r.name]));
  const visible = new Set(world.visibleBranchIds);
  const branches = world.branches.filter((b) => visible.has(b.id) && (!f.regionId || b.regionId === f.regionId) && (!f.homeId || b.orgId === f.homeId) && (!f.branchId || b.id === f.branchId));
  const keep = new Set(branches.map((b) => b.id));
  const inRange = world.funerals.filter((x) => {
    const day = (x.funeralDate ?? x.createdAt.slice(0, 10)).slice(0, 10);
    if (day < f.from || day > f.to) return false;
    if (!x.branchId || !keep.has(x.branchId)) return false;
    if (f.status === 'published') return x.status !== 'DRAFT';
    if (f.status === 'draft') return x.status === 'DRAFT';
    return true;
  });
  const rows = branches.map((b) => {
    const mine = inRange.filter((x) => x.branchId === b.id);
    const leads = mine.filter((x) => x.publishedAt && x.funeralDate).map((x) => (new Date(`${x.funeralDate}T12:00:00Z`).getTime() - new Date(x.publishedAt!).getTime()) / 86_400_000);
    const last = mine.map((x) => x.publishedAt ?? x.createdAt).sort().slice(-1)[0] ?? null;
    return {
      branchId: b.id,
      branch: b.name,
      home: home.get(b.orgId) ?? '',
      region: b.regionId ? (region.get(b.regionId) ?? '') : '',
      active: b.active,
      funerals: mine.length,
      published: mine.filter((x) => x.status !== 'DRAFT').length,
      drafts: mine.filter((x) => x.status === 'DRAFT').length,
      withProgramme: mine.filter((x) => x.hasProgramme).length,
      fromFamilyLinks: mine.filter((x) => x.fromFamilyLink).length,
      avgLeadDays: leads.length ? Math.round((leads.reduce((s, d) => s + d, 0) / leads.length) * 10) / 10 : null,
      lastActivity: last,
    };
  });
  const arr = new Map<string, { funerals: number; published: number }>();
  for (const x of inRange) {
    const e = arr.get(x.ownerId) ?? { funerals: 0, published: 0 };
    e.funerals++;
    if (x.status !== 'DRAFT') e.published++;
    arr.set(x.ownerId, e);
  }
  return { rows, byArranger: [...arr.entries()].map(([ownerId, v]) => ({ ownerId, ...v })).sort((a, b) => b.funerals - a.funerals) };
}

