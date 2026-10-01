// Notifications: who hears about what. Recipients are worked out from the
// role definitions (src/lib/rbac.ts), so a notification can never reach
// someone whose role doesn't cover the situation.

import { ROLES, type Permission, type Role } from './rbac.ts';

export type Tone = 'info' | 'action' | 'warn' | 'good';

export type Notice = {
  kind: string;
  tone: Tone;
  title: string;
  body?: string;
  href?: string;
  /** One per person per key: the same event never shows twice. */
  key: string;
};

/** Funeral-home roles that hold this permission in a home or branch. */
export function homeRolesWith(perm: Permission): Role[] {
  return (Object.keys(ROLES) as Role[]).filter((r) => ROLES[r].scope === 'org' && (ROLES[r].permissions as readonly Permission[]).includes(perm));
}

/** Group roles that reach this permission inside the group's homes (group admins everywhere, regional managers in their region). */
export function groupRolesWith(perm: Permission): Role[] {
  return (Object.keys(ROLES) as Role[]).filter((r) => {
    const def = ROLES[r] as { scope: string; permissions: readonly Permission[]; orgGrants?: readonly Permission[] };
    return def.scope === 'account' && (def.permissions.includes(perm) || Boolean(def.orgGrants?.includes(perm)));
  });
}

/** Memora's own roles that hold this permission. */
export function platformRolesWith(perm: Permission): Role[] {
  return (Object.keys(ROLES) as Role[]).filter((r) => ROLES[r].scope === 'platform' && (ROLES[r].permissions as readonly Permission[]).includes(perm));
}

const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
const when = (days: number) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

export type CaseFacts = {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  funeralDate: string | null;
  /** Days left in the public year (published only). */
  yearDaysLeft: number | null;
  branch?: string;
};

/**
 * Situations worth a nudge, for the memorials someone looks after. Staff hear
 * about unpublished memorials close to the funeral; families also hear when
 * the first year is ending. Keys include the date, so a situation nudges once.
 */
export function situationalNotices(cases: CaseFacts[], today: string, as: 'staff' | 'family', open: (c: CaseFacts) => string): Notice[] {
  const out: Notice[] = [];
  for (const c of cases) {
    const days = c.funeralDate ? daysBetween(today, c.funeralDate) : null;
    if (c.status === 'DRAFT' && days !== null && days >= 0 && days <= 2)
      out.push({
        kind: 'due_unpublished',
        tone: 'warn',
        title: `${c.name}: the funeral is ${when(days)} and the memorial isn’t published`,
        body: as === 'staff' ? `${c.branch ? `${c.branch}. ` : ''}Check it with the family and publish, so guests have the times and directions.` : 'Finish the last details and publish, so guests have the times and directions.',
        href: open(c),
        key: `due:${c.id}:${c.funeralDate}`,
      });
    if (c.status === 'PUBLISHED' && days === 0)
      out.push({
        kind: 'funeral_today',
        tone: 'action',
        title: `${c.name}: the funeral is today`,
        body: as === 'staff' ? 'Open the run-sheet to move the programme on and share the procession.' : 'Guests see the live programme and directions on the memorial.',
        href: open(c),
        key: `today:${c.id}:${c.funeralDate}`,
      });
    if (as === 'family' && c.status === 'PUBLISHED' && c.yearDaysLeft !== null && c.yearDaysLeft > 0 && c.yearDaysLeft <= 90)
      out.push({
        kind: 'year_ending',
        tone: 'info',
        title: `${c.name}’s memorial is public for ${c.yearDaysLeft} more days`,
        body: 'Most families unveil the tombstone around the first anniversary. Tell us if you’d like help with the unveiling.',
        href: '/memorials',
        key: `year:${c.id}`,
      });
  }
  return out;
}

/** The allowance thresholds that warn a home or group (once each per month). */
export function allowanceNotice(used: number, included: number, period: string, scopeId: string, href: string): Notice | null {
  if (included <= 0) return null;
  if (used === included)
    return { kind: 'allowance_full', tone: 'warn', title: `All ${included} included funerals used this month`, body: 'Funerals published from now until the 1st are charged at your plan’s price per extra funeral.', href, key: `allowance:${scopeId}:${period}:full` };
  if (used === Math.ceil(included * 0.8) && used < included)
    return { kind: 'allowance_80', tone: 'info', title: `${used} of ${included} included funerals used this month`, body: `${included - used} left before extra funerals are charged.`, href, key: `allowance:${scopeId}:${period}:80` };
  return null;
}
