import Link from 'next/link';
import { ActionForm } from '@/components/admin/ActionForm';
import { AdminAction } from '@/components/admin/AdminAction';
import { RoleCard } from '@/components/admin/CommandPanels';
import { Brand } from '@/components/Brand';
import { InviteList } from '@/components/pro/InviteList';
import { NewHomeMemorial, PublishForHome, RunSheetFor } from '@/components/pro/ProButtons';
import { PRO_PLANS, formatMoney, proInvoice } from '@/lib/plans';
import { ALL_ROLES, ROLES, can, canGrantRole, canIn, type Permission, type Principal, type Role } from '@/lib/rbac';
import type { Invite } from '@/lib/server/invites';
import type { Branch, Group as TeamGroup, Invoice, Org } from '@/lib/server/pro';
import { BrandingEditor } from './BrandingEditor';
import { Constellation } from './Constellation';
import * as I from './icons';

// The funeral home's workspace. One layout, three ways of working:
//   owner    — the business across every branch
//   manager  — one branch: its funerals and its arrangers
//   arranger — the families they are looking after, and the next thing to do
// Every panel still checks the permission it needs; the persona only decides
// what comes first.

const SELF = '/api/pro/actions';

export type Persona = 'owner' | 'manager' | 'arranger';
export type Stage = 'soon' | 'drafts' | 'upcoming' | 'past';

export interface StudioFuneral {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  slug: string | null;
  funeralDate: string | null;
  time: string;
  venue: string;
  branchId: string | null;
  madeBy: string;
  own: boolean;
  family: string | null;
  updatedAt: string;
  stage: Stage;
}

export interface StudioData {
  p: Principal;
  persona: Persona;
  org: Org;
  homes: { id: string; name: string }[];
  visiting: boolean;
  canPreview: boolean;
  preview: { key: string; label: string } | null;
  previewOptions: { key: string; label: string }[];
  branches: Branch[];
  myBranches: Branch[];
  allBranchesInScope: boolean;
  onlyBranch: string | null;
  funerals: StudioFuneral[];
  groups: TeamGroup[];
  invoices: Invoice[];
  families: Invite[];
  user: { id: string; firstName: string };
  tab: StudioTab;
  today: string;
  welcome: boolean;
}

export type StudioTab = 'today' | 'funerals' | 'families' | 'print' | 'team' | 'branding' | 'billing' | 'roles';

const NAV: { tab: StudioTab; label: (p: Persona) => string; perm: Permission; icon: React.ReactNode; hideFor?: Persona[] }[] = [
  { tab: 'today', label: () => 'Today', perm: 'org.view', icon: <I.IconToday /> },
  { tab: 'funerals', label: (p) => (p === 'arranger' ? 'My funerals' : 'Funerals'), perm: 'org.view', icon: <I.IconFunerals /> },
  { tab: 'families', label: () => 'Family links', perm: 'org.memorials.create', icon: <I.IconFamily /> },
  { tab: 'print', label: () => 'Print & share', perm: 'org.memorials.edit', icon: <I.IconPrint /> },
  { tab: 'team', label: (p) => (p === 'owner' ? 'Branches & people' : 'My team'), perm: 'org.team', icon: <I.IconTeam /> },
  { tab: 'branding', label: () => 'Branding', perm: 'org.branding', icon: <I.IconBrand /> },
  { tab: 'billing', label: () => 'Plan & billing', perm: 'org.billing.view', icon: <I.IconBilling /> },
  { tab: 'roles', label: () => 'Who can do what', perm: 'org.view', icon: <I.IconRoles /> },
];

const ORG_ROLES = ALL_ROLES.filter((r) => ROLES[r].scope === 'org');
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-ZA', { ...o, timeZone: 'UTC' }).format(day(iso));
const addDays = (iso: string, n: number) => {
  const d = day(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((day(b).getTime() - day(a).getTime()) / 86_400_000);
const relative = (today: string, iso: string) => {
  const n = daysBetween(today, iso);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 && n < 7 ? fmt(iso, { weekday: 'long' }) : n < 0 ? `${-n} day${n === -1 ? '' : 's'} ago` : `In ${n} days`;
};
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-ZA', { hour: 'numeric', hour12: false, timeZone: 'Africa/Johannesburg' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

export function Studio(d: StudioData) {
  const { p, org, persona, tab } = d;
  const live = org.status !== 'disabled';
  const base = `/pro/dashboard?home=${org.id}${d.preview ? `&as=${encodeURIComponent(d.preview.key)}` : ''}`;
  const href = (t: StudioTab, extra = '') => `${base}&tab=${t}${d.onlyBranch && (t === 'today' || t === 'funerals' || t === 'families' || t === 'print') ? `&branch=${d.onlyBranch}` : ''}${extra}`;
  const nav = NAV.filter((n) => can(p, n.perm, org.id) && !n.hideFor?.includes(persona));
  const branchName = new Map(d.branches.map((b) => [b.id, b.name]));
  const edit = (branchId: string | null) => Boolean(p.orgWide.get(org.id)?.has('org.memorials.edit') || (branchId && p.branches.get(org.id)?.get(branchId)?.has('org.memorials.edit')));
  const createIn = d.myBranches.filter((b) => canIn(p, 'org.memorials.create', org.id, b.id));
  const roleLabel = d.preview
    ? `Previewing ${d.preview.label}`
    : persona === 'owner'
      ? d.visiting
        ? 'Memora support'
        : 'Owner'
      : persona === 'manager'
        ? `Branch manager · ${d.myBranches.map((b) => b.name).join(', ')}`
        : `Arranger · ${d.myBranches.map((b) => b.name).join(', ')}`;
  const accent = /^#[0-9a-f]{6}$/i.test(org.brandColour) ? org.brandColour : undefined;
  const title = nav.find((n) => n.tab === tab)?.label(persona) ?? 'Today';
  const soon = d.funerals.filter((f) => f.stage === 'soon');

  return (
    <div className="st" style={accent ? ({ ['--home' as string]: accent } as React.CSSProperties) : undefined}>
      <aside className="st-side" aria-label="Funeral home">
        <div className="st-mark">
          <Brand />
        </div>
        <div className="st-home">
          <HomeMark org={org} />
          <div>
            <strong>{org.name}</strong>
            <span>
              {PRO_PLANS[org.plan].name}
              {org.status === 'trial' ? ' · Trial' : org.status === 'disabled' ? ' · Off' : ''}
            </span>
          </div>
        </div>
        {d.homes.length > 1 && (
          <details className="st-menu st-homes">
            <summary>Switch funeral home</summary>
            <div className="st-menu-list">
              {d.homes.map((h) => (
                <Link key={h.id} href={`/pro/dashboard?home=${h.id}`} aria-current={h.id === org.id ? 'true' : undefined}>
                  {h.name}
                </Link>
              ))}
            </div>
          </details>
        )}
        <nav className="st-nav" aria-label="Sections">
          {nav.map((n) => (
            <Link key={n.tab} href={href(n.tab)} aria-current={n.tab === tab ? 'page' : undefined}>
              {n.icon}
              <span>{n.label(persona)}</span>
              {n.tab === 'funerals' && soon.length > 0 && <em>{soon.length}</em>}
            </Link>
          ))}
        </nav>
        <div className="st-side-foot">
          <span className="st-you">{roleLabel}</span>
          <div className="st-side-links">
            {can(d.p, 'ops.view') || d.visiting ? <Link href={`/admin?tab=homes#${org.id}`}>Command centre</Link> : null}
            <Link href="/account">Account</Link>
            <Link href="/memorials">My memorials</Link>
          </div>
        </div>
      </aside>

      <div className="st-main">
        <header className="st-top">
          <div className="st-top-title">
            <span className="st-eyebrow">{d.onlyBranch ? `${org.name} · ${branchName.get(d.onlyBranch)}` : org.name}</span>
            <h1>{title}</h1>
          </div>
          <div className="st-top-actions">
            {d.myBranches.length > 1 && (tab === 'today' || tab === 'funerals' || tab === 'families' || tab === 'print') && (
              <details className="st-menu">
                <summary>{d.onlyBranch ? branchName.get(d.onlyBranch) : d.allBranchesInScope ? 'All branches' : 'My branches'}</summary>
                <div className="st-menu-list">
                  <Link href={`${base}&tab=${tab}`} aria-current={!d.onlyBranch ? 'true' : undefined}>
                    {d.allBranchesInScope ? 'All branches' : 'My branches'}
                  </Link>
                  {d.myBranches.map((b) => (
                    <Link key={b.id} href={`${base}&tab=${tab}&branch=${b.id}`} aria-current={d.onlyBranch === b.id ? 'true' : undefined}>
                      {b.name}
                    </Link>
                  ))}
                </div>
              </details>
            )}
            {d.canPreview && (
              <details className="st-menu">
                <summary>{d.preview ? d.preview.label : 'See as…'}</summary>
                <div className="st-menu-list">
                  <span className="st-menu-note">Preview exactly what each role sees here.</span>
                  <Link href={`/pro/dashboard?home=${org.id}&tab=${tab}`} aria-current={!d.preview ? 'true' : undefined}>
                    {d.visiting ? 'Memora support (you)' : 'You'}
                  </Link>
                  {d.previewOptions.map((o) => (
                    <Link key={o.key} href={`/pro/dashboard?home=${org.id}&tab=${tab}&as=${encodeURIComponent(o.key)}`} aria-current={d.preview?.key === o.key ? 'true' : undefined}>
                      {o.label}
                    </Link>
                  ))}
                </div>
              </details>
            )}
            {live && createIn.length > 0 && <NewHomeMemorial orgId={org.id} branches={createIn.map((b) => ({ id: b.id, name: b.name }))} />}
          </div>
        </header>

        <div className="st-body">
          {d.visiting && !d.preview && (
            <Banner tone="info">
              <strong>Support view.</strong> You’re looking at {org.name} as Memora’s team. Anything you change is written to the audit log.
            </Banner>
          )}
          {d.preview && (
            <Banner tone="warn">
              <strong>Previewing as {d.preview.label}.</strong> This is what they see. Anything you press still uses your own access.
            </Banner>
          )}
          {!live && <Banner tone="warn">This funeral home’s Memora is switched off. Published memorials stay up. Contact Memora to switch it back on.</Banner>}

          {tab === 'today' && <Today />}
          {tab === 'funerals' && <Funerals />}
          {tab === 'families' && <Families />}
          {tab === 'print' && <Print />}
          {tab === 'team' && <Team />}
          {tab === 'branding' && <BrandingEditor orgId={org.id} name={org.name} logoUrl={org.logoUrl} colour={org.brandColour} />}
          {tab === 'billing' && <Billing />}
          {tab === 'roles' && <Roles />}
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------- Today

  function Today() {
    const next = d.funerals.filter((f) => f.funeralDate && f.funeralDate >= d.today && f.status !== 'ARCHIVED').sort((a, b) => (a.funeralDate! + a.time).localeCompare(b.funeralDate! + b.time))[0];
    const drafts = d.funerals.filter((f) => f.status === 'DRAFT');
    const toPublish = drafts.filter((f) => canIn(p, 'org.memorials.publish', org.id, f.branchId));
    const waitingLinks = d.families.filter((f) => f.state === 'open');
    const mine = d.funerals.filter((f) => f.own && f.stage !== 'past');
    const publishedThisMonth = org.publishedThisMonth;
    return (
      <>
        {d.welcome && (
          <Banner tone="ok">
            <strong>Welcome to Memora Pro.</strong> {org.name} is ready. Four small steps below and your first family can have their memorial today.
          </Banner>
        )}
        {persona === 'owner' && !d.visiting && !d.preview && <Setup />}

        <section className="st-stage" aria-label="Today">
          <Constellation seed={org.name.length * 7 + 3} />
          <div className="st-stage-copy">
            <span className="st-spark">{fmt(d.today, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <p className="st-greet">
              {greeting()}
              {d.user.firstName && !d.visiting && !d.preview ? `, ${d.user.firstName}` : ''}.
            </p>
            <p className="st-stage-sub">
              {soon.length === 0 ? 'No funerals in the next seven days.' : `${soon.length} funeral${soon.length === 1 ? '' : 's'} this week.`}{' '}
              {toPublish.length > 0 ? `${toPublish.length} memorial${toPublish.length === 1 ? ' is' : 's are'} waiting for you to publish.` : persona === 'arranger' ? 'Everything you’re preparing is below.' : 'Nothing is waiting on you.'}
            </p>
          </div>
          <div className="st-stage-next">{next ? <NextFuneral f={next} /> : <EmptyNext />}</div>
        </section>

        <section className="st-week" aria-label="This week">
          <header className="st-sec-head">
            <h2>The week ahead</h2>
            <Link href={href('funerals')} className="st-link">
              All funerals <I.IconChevron size={14} />
            </Link>
          </header>
          <Week />
        </section>

        <div className="st-widgets">
          <Widget label="Funerals this week" value={soon.length} note={soon.length ? `Next: ${relative(d.today, soon[0].funeralDate!)}` : 'A quiet week'} />
          <Widget label="Being prepared" value={drafts.length} note={toPublish.length ? `${toPublish.length} ready for you to publish` : 'Nothing waiting'} />
          {persona === 'arranger' ? (
            <Widget label="Made by you" value={mine.length} note="Still to come" />
          ) : (
            <Widget label="Published this month" value={publishedThisMonth} note={`${d.funerals.filter((f) => f.stage === 'upcoming').length} more coming up`} />
          )}
          {can(p, 'org.billing.view', org.id) ? (
            <Widget label="This month (excl. VAT)" value={org.status === 'trial' ? 'Trial' : formatMoney(proInvoice(org, org.publishedThisMonth, false).total)} note={org.status === 'trial' ? 'Nothing billed yet' : `${formatMoney(org.perMemorialMinor)} per memorial`} />
          ) : (
            <Widget label="Family links waiting" value={waitingLinks.length} note={waitingLinks.length ? 'Sent, not used yet' : 'None out'} />
          )}
        </div>

        {toPublish.length > 0 && (
          <section className="st-sec">
            <header className="st-sec-head">
              <h2>Needs you</h2>
              <span className="st-sub">Check each one, then publish. Publishing is billed to {org.name}.</span>
            </header>
            <div className="st-list">
              {toPublish.map((f) => (
                <FuneralRow key={f.id} f={f} />
              ))}
            </div>
          </section>
        )}

        {persona === 'owner' && d.branches.length > 0 && <BranchesAtAGlance />}
        {persona === 'manager' && <MyArrangers />}
        {persona === 'arranger' && <QuickActions waiting={waitingLinks.length} />}
      </>
    );
  }

  function Setup() {
    const members = d.groups.reduce((n, g) => n + g.members.length, 0);
    const steps = [
      { done: Boolean(org.logoUrl), label: 'Add your logo and colour', note: 'It prints on every programme and QR card.', to: href('branding') },
      { done: members > 1, label: 'Appoint your team', note: 'Managers and arrangers for each branch.', to: href('team') },
      { done: d.families.length > 0, label: 'Send your first family a link', note: 'They fill it in from their phone.', to: href('families') },
      { done: d.funerals.some((f) => f.status !== 'DRAFT'), label: 'Publish your first memorial', note: 'Then print its programme.', to: href('funerals') },
    ];
    const done = steps.filter((s) => s.done).length;
    if (done === steps.length) return null;
    return (
      <section className="st-setup" aria-label="Getting set up">
        <header>
          <div>
            <span className="st-eyebrow">Getting set up</span>
            <h2>
              {done} of {steps.length} done
            </h2>
          </div>
          <div className="st-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
            <span style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
        </header>
        <ol>
          {steps.map((s) => (
            <li key={s.label} className={s.done ? 'done' : ''}>
              <Link href={s.to}>
                <span className="st-step-dot">{s.done ? <I.IconCheck size={14} /> : null}</span>
                <span>
                  <strong>{s.label}</strong>
                  <small>{s.note}</small>
                </span>
                <I.IconChevron size={14} />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  function NextFuneral({ f }: { f: StudioFuneral }) {
    const days = daysBetween(d.today, f.funeralDate!);
    return (
      <article className="st-next-card">
        <div className="st-next-top">
          <span className="st-live">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}</span>
          <span className="st-next-branch">{branchName.get(f.branchId ?? '') ?? ''}</span>
        </div>
        <div className="st-next-person">
          <span className="st-arch" aria-hidden="true">
            {initials(f.name)}
          </span>
          <div>
            <span className="st-next-label">Next funeral</span>
            <h2>{f.name}</h2>
            <p>
              {fmt(f.funeralDate!, { weekday: 'long', day: 'numeric', month: 'long' })}
              {f.time ? ` · ${f.time}` : ''}
            </p>
            {f.venue && (
              <p className="st-next-venue">
                <I.IconPin size={14} /> {f.venue}
              </p>
            )}
          </div>
        </div>
        <div className="st-next-actions">
          {f.status === 'PUBLISHED' && live && canIn(p, 'org.runsheet', org.id, f.branchId) && <RunSheetFor caseId={f.id} />}
          {f.status === 'PUBLISHED' && (f.own || edit(f.branchId)) && (
            <Link className="btn sm on-night" href={`/memorials/${f.id}/artifacts`}>
              <I.IconPrint size={16} /> Print programme
            </Link>
          )}
          {f.status === 'PUBLISHED' && f.slug && (
            <a className="btn sm on-night ghost" href={`/m/${f.slug}`} target="_blank" rel="noopener noreferrer">
              <I.IconEye size={16} /> View
            </a>
          )}
          {f.status === 'DRAFT' && (f.own || edit(f.branchId)) && (
            <Link className="btn sm on-night" href={`/memorials/${f.id}`}>
              Finish the memorial
            </Link>
          )}
        </div>
      </article>
    );
  }

  function EmptyNext() {
    return (
      <article className="st-next-card empty">
        <span className="st-next-label">Next funeral</span>
        <h2>Nothing booked yet</h2>
        <p>When a family chooses you, start their memorial here, or send them a link to start it themselves.</p>
        <div className="st-next-actions">
          {can(p, 'org.memorials.create', org.id) && (
            <Link className="btn sm on-night" href={href('families')}>
              <I.IconLink size={16} /> Send a family a link
            </Link>
          )}
        </div>
      </article>
    );
  }

  function Week() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(d.today, i));
    return (
      <ol className="st-days">
        {days.map((iso) => {
          const on = d.funerals.filter((f) => f.funeralDate === iso && f.status !== 'ARCHIVED');
          return (
            <li key={iso} className={`${iso === d.today ? 'is-today' : ''}${on.length ? ' has' : ''}`}>
              <span className="st-dow">{iso === d.today ? 'Today' : fmt(iso, { weekday: 'short' })}</span>
              <span className="st-dom">{fmt(iso, { day: 'numeric' })}</span>
              <div className="st-day-items">
                {on.map((f) => (
                  <span key={f.id} className={`st-day-item ${f.status === 'DRAFT' ? 'draft' : ''}`} title={f.name}>
                    {f.time && <b>{f.time}</b>}
                    {f.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  function BranchesAtAGlance() {
    return (
      <section className="st-sec">
        <header className="st-sec-head">
          <h2>Branches</h2>
          {can(p, 'org.team', org.id) && (
            <Link href={href('team')} className="st-link">
              Manage <I.IconChevron size={14} />
            </Link>
          )}
        </header>
        <div className="st-branches">
          {d.branches.map((b) => {
            const fs = d.funerals.filter((f) => f.branchId === b.id);
            const people = d.groups.filter((g) => g.branchId === b.id).reduce((n, g) => n + g.members.length, 0);
            return (
              <Link key={b.id} className="st-branch" href={`${base}&tab=funerals&branch=${b.id}`}>
                <span className="st-branch-name">{b.name}</span>
                <span className="st-branch-area">{b.area || '—'}</span>
                <span className="st-branch-stats">
                  <span>
                    <b>{fs.filter((f) => f.stage === 'soon').length}</b> this week
                  </span>
                  <span>
                    <b>{fs.filter((f) => f.status === 'DRAFT').length}</b> preparing
                  </span>
                  <span>
                    <b>{people}</b> staff
                  </span>
                </span>
                {people === 0 && <span className="st-branch-warn">No one appointed yet</span>}
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  function MyArrangers() {
    const mine = d.groups.filter((g) => g.branchId && d.myBranches.some((b) => b.id === g.branchId) && g.roles.includes('org_staff'));
    const people = mine.flatMap((g) => g.members);
    return (
      <section className="st-sec">
        <header className="st-sec-head">
          <h2>Your arrangers</h2>
          <Link href={href('team')} className="st-link">
            Appoint <I.IconChevron size={14} />
          </Link>
        </header>
        <div className="st-list">
          {people.length === 0 && <p className="st-empty">No arrangers yet. Appoint them under My team.</p>}
          {people.map((m) => (
            <div key={m.userId} className="st-row">
              <span className="st-avatar">{initials(m.name || m.label)}</span>
              <span className="st-row-main">
                <strong>{m.name || m.label}</strong>
                <small>{m.name ? m.label : 'Arranger'}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function QuickActions({ waiting }: { waiting: number }) {
    return (
      <section className="st-sec">
        <header className="st-sec-head">
          <h2>Quick actions</h2>
        </header>
        <div className="st-quick">
          <Link href={href('families')} className="st-quick-item">
            <I.IconLink />
            <strong>Send a family a link</strong>
            <small>{waiting ? `${waiting} waiting` : 'They fill it in from their phone'}</small>
          </Link>
          <Link href={href('print')} className="st-quick-item">
            <I.IconPrint />
            <strong>Print a programme</strong>
            <small>A5 booklet, A4, QR cards</small>
          </Link>
          <Link href={href('funerals')} className="st-quick-item">
            <I.IconFunerals />
            <strong>My funerals</strong>
            <small>Everything you’re preparing</small>
          </Link>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------- Funerals

  function Funerals() {
    const groups: [Stage, string, string][] = [
      ['soon', 'This week', 'Get the run-sheet to run the day.'],
      ['drafts', 'Being prepared', 'Drafts by families or your arrangers.'],
      ['upcoming', 'Coming up', 'Published, more than a week away.'],
      ['past', 'Done', 'The memorials stay up for the family.'],
    ];
    const list = persona === 'arranger' ? [...d.funerals].sort((a, b) => Number(b.own) - Number(a.own)) : d.funerals;
    if (!list.length)
      return (
        <div className="st-blank">
          <I.IconFunerals size={32} />
          <h2>No funerals yet</h2>
          <p>Start a memorial with the button above, or send a family a link to start it themselves.</p>
        </div>
      );
    return (
      <>
        {groups.map(([stage, title, sub]) => {
          const rows = list.filter((f) => f.stage === stage);
          if (!rows.length) return null;
          return (
            <section key={stage} className="st-sec">
              <header className="st-sec-head">
                <h2>
                  {title} <span className="st-count">{rows.length}</span>
                </h2>
                <span className="st-sub">{sub}</span>
              </header>
              <div className="st-list">
                {rows.map((f) => (
                  <FuneralRow key={f.id} f={f} />
                ))}
              </div>
            </section>
          );
        })}
      </>
    );
  }

  function FuneralRow({ f }: { f: StudioFuneral }) {
    const canEdit = f.own || edit(f.branchId);
    const step = f.status === 'DRAFT' ? 1 : f.stage === 'past' || f.status === 'ARCHIVED' ? 3 : 2;
    return (
      <article className={`st-funeral stage-${f.stage}`}>
        <div className="st-date" aria-hidden={!f.funeralDate}>
          {f.funeralDate ? (
            <>
              <span>{fmt(f.funeralDate, { month: 'short' })}</span>
              <b>{fmt(f.funeralDate, { day: 'numeric' })}</b>
              <span>{fmt(f.funeralDate, { weekday: 'short' })}</span>
            </>
          ) : (
            <span className="st-nodate">No date</span>
          )}
        </div>
        <div className="st-funeral-main">
          <h3>{f.name}</h3>
          <p className="st-meta">
            {f.funeralDate && <span>{relative(d.today, f.funeralDate)}</span>}
            {f.time && (
              <span>
                <I.IconClock size={13} /> {f.time}
              </span>
            )}
            {f.venue && (
              <span>
                <I.IconPin size={13} /> {f.venue}
              </span>
            )}
          </p>
          <p className="st-meta muted">
            {d.branches.length > 1 && f.branchId && <span>{branchName.get(f.branchId)}</span>}
            <span>{f.own ? 'Made by you' : f.family ? `Started by the family · ${f.family}` : `Made by ${f.madeBy}`}</span>
          </p>
          <ol className="st-steps" aria-label="Progress">
            <li className={step >= 1 ? 'on' : ''}>Prepared</li>
            <li className={step >= 2 ? 'on' : ''}>Published</li>
            <li className={step >= 3 ? 'on' : ''}>Laid to rest</li>
          </ol>
        </div>
        <div className="st-funeral-actions">
          {f.status === 'DRAFT' && live && canIn(p, 'org.memorials.publish', org.id, f.branchId) && <PublishForHome caseId={f.id} />}
          {f.status === 'PUBLISHED' && f.stage !== 'past' && live && canIn(p, 'org.runsheet', org.id, f.branchId) && <RunSheetFor caseId={f.id} />}
          {canEdit && (
            <Link className="btn sm" href={`/memorials/${f.id}`}>
              {f.status === 'DRAFT' ? 'Open' : 'Edit'}
            </Link>
          )}
          {f.status === 'PUBLISHED' && canEdit && (
            <Link className="btn sm" href={`/memorials/${f.id}/artifacts`}>
              Print
            </Link>
          )}
          {f.status === 'PUBLISHED' && f.slug && (
            <a className="btn sm ghost" href={`/m/${f.slug}`} target="_blank" rel="noopener noreferrer">
              View ↗
            </a>
          )}
          {canIn(p, 'org.branches', org.id, null) && live && d.branches.length > 1 && (
            <details className="st-menu st-more">
              <summary aria-label="More">•••</summary>
              <div className="st-menu-list right">
                <span className="st-menu-note">Move to another branch</span>
                <div className="cc-assign">
                  <ActionForm
                    endpoint={SELF}
                    action="memorial.setBranch"
                    extra={{ caseId: f.id }}
                    compact
                    variant=""
                    submit="Move"
                    fields={[{ name: 'branchId', label: 'Branch', type: 'select', value: f.branchId ?? '', options: d.branches.map((b) => ({ value: b.id, label: b.name })) }]}
                  />
                </div>
              </div>
            </details>
          )}
        </div>
      </article>
    );
  }

  // ---------------------------------------------------------------- Families

  function Families() {
    const branches = createIn;
    return (
      <div className="st-split">
        <section className="st-panel st-panel-hero">
          <span className="st-eyebrow">Family links</span>
          <h2>Let the family tell the story.</h2>
          <p>
            They open the link on their phone, sign up with their number, and add the photo, story and programme. The memorial belongs to {org.name}: your arrangers
            can edit it, publish it and run the day. The family pays nothing.
          </p>
          {live && branches.length > 0 ? (
            <ActionForm
              endpoint={SELF}
              action="invite.create"
              extra={{ kind: 'family', orgId: org.id, ...(branches.length === 1 ? { branchId: branches[0].id } : {}) }}
              reset
              submit="Make the link"
              fields={[
                { name: 'label', label: 'Who is it for?', type: 'text', required: true, placeholder: 'e.g. Khumalo family', hint: 'Only your team sees this.' },
                ...(branches.length > 1
                  ? [{ name: 'branchId', label: 'Branch', type: 'select' as const, value: d.onlyBranch ?? branches[0].id, options: branches.map((b) => ({ value: b.id, label: b.name })) }]
                  : []),
              ]}
            />
          ) : (
            <p className="st-empty">You can’t make family links here.</p>
          )}
          <p className="st-fine">Each link works once, for 30 days. You can switch it off any time.</p>
        </section>
        <section className="st-panel">
          <header className="st-sec-head">
            <h2>Links you’ve sent</h2>
          </header>
          <InviteList invites={d.families} endpoint={SELF} from={org.name} branches={branchName} empty="No links yet. Your first one takes ten seconds." />
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------- Print & share

  function Print() {
    const printable = d.funerals.filter((f) => f.status === 'PUBLISHED' && (f.own || edit(f.branchId))).sort((a, b) => (a.funeralDate ?? '9').localeCompare(b.funeralDate ?? '9'));
    const upcoming = printable.filter((f) => f.stage !== 'past');
    const drafts = d.funerals.filter((f) => f.status === 'DRAFT' && (f.own || edit(f.branchId)));
    return (
      <>
        <section className="st-print-hero">
          <Constellation seed={23} count={46} />
          <div className="st-print-copy">
            <span className="st-spark">Print & share</span>
            <h2>The programme is already done.</h2>
            <p>
              Every published memorial turns into a print-ready A5 booklet, an A4 programme, QR cards for the entrance and WhatsApp cards, with {org.name}’s name
              {org.logoUrl ? ' and logo' : ''} on the back. No designer, no retyping, no late-night corrections.
            </p>
            {!org.logoUrl && can(p, 'org.branding', org.id) && (
              <Link className="btn sm on-night" href={href('branding')}>
                Add your logo first
              </Link>
            )}
          </div>
          <div className="st-print-art" aria-hidden="true">
            <div className="st-booklet">
              <span className="st-arch sm" />
              <b>Order of service</b>
              <i>In loving memory</i>
            </div>
            <div className="st-booklet back">
              <span className="st-qr" />
              <small>Arranged with care by</small>
              <b>{org.name}</b>
            </div>
          </div>
        </section>
        <section className="st-sec">
          <header className="st-sec-head">
            <h2>Ready to print</h2>
            <span className="st-sub">Downloads are made fresh from the live memorial, so a changed time is always right.</span>
          </header>
          <div className="st-list">
            {upcoming.length === 0 && <p className="st-empty">Publish a memorial to unlock its programme.</p>}
            {upcoming.map((f) => (
              <div key={f.id} className="st-row">
                <span className="st-avatar">{initials(f.name)}</span>
                <span className="st-row-main">
                  <strong>{f.name}</strong>
                  <small>{f.funeralDate ? `${relative(d.today, f.funeralDate)} · ${fmt(f.funeralDate, { day: 'numeric', month: 'long' })}` : 'No date yet'}</small>
                </span>
                <Link className="btn sm primary" href={`/memorials/${f.id}/artifacts`}>
                  <I.IconPrint size={16} /> Print studio
                </Link>
              </div>
            ))}
          </div>
        </section>
        {drafts.length > 0 && (
          <section className="st-sec">
            <header className="st-sec-head">
              <h2>Not yet printable</h2>
              <span className="st-sub">Publish these first.</span>
            </header>
            <div className="st-list">
              {drafts.map((f) => (
                <div key={f.id} className="st-row">
                  <span className="st-avatar muted">{initials(f.name)}</span>
                  <span className="st-row-main">
                    <strong>{f.name}</strong>
                    <small>Draft</small>
                  </span>
                  <Link className="btn sm" href={`/memorials/${f.id}`}>
                    Open
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------- Team

  function Team() {
    const owners = d.groups.filter((g) => !g.branchId);
    const branches = persona === 'owner' ? d.branches : d.myBranches;
    const canBranches = canIn(p, 'org.branches', org.id, null);
    return (
      <>
        {persona === 'owner' && (
          <section className="st-sec">
            <header className="st-sec-head">
              <h2>Whole funeral home</h2>
              <span className="st-sub">Owners run every branch.</span>
            </header>
            {owners.map((g) => (
              <GroupPanel key={g.id} g={g} />
            ))}
          </section>
        )}
        {branches.map((b) => {
          const others = d.branches.filter((x) => x.id !== b.id);
          return (
            <section key={b.id} className="st-sec st-branch-sec" id={`branch-${b.id}`}>
              <header className="st-sec-head">
                <div>
                  <h2>{b.name}</h2>
                  <span className="st-sub">
                    {[b.area, `${b.memorials} memorial${b.memorials === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {canBranches && live && (
                  <details className="st-menu st-more">
                    <summary aria-label="Branch options">•••</summary>
                    <div className="st-menu-list right wide">
                      <span className="st-menu-note">Rename or change the area</span>
                      <ActionForm
                        endpoint={SELF}
                        action="branch.rename"
                        extra={{ id: b.id }}
                        compact
                        submit="Save"
                        fields={[
                          { name: 'name', label: 'Branch name', type: 'text', value: b.name },
                          { name: 'area', label: 'Area or address', type: 'text', value: b.area },
                        ]}
                      />
                      {others.length > 0 && (
                        <AdminAction
                          endpoint={SELF}
                          action="branch.delete"
                          id={b.id}
                          extra={{ moveTo: others[0].id }}
                          label="Remove branch"
                          variant="danger"
                          confirm={`Remove ${b.name}? Its managers and arrangers lose this branch, and its memorials move to ${others[0].name}.`}
                        />
                      )}
                    </div>
                  </details>
                )}
              </header>
              <div className="st-groups">
                {d.groups
                  .filter((g) => g.branchId === b.id)
                  .map((g) => (
                    <GroupPanel key={g.id} g={g} />
                  ))}
              </div>
            </section>
          );
        })}
        {canBranches && live && (
          <section className="st-panel st-add">
            <h2>Add a branch</h2>
            <p className="st-sub">It gets its own Managers and Arrangers, and its own funerals.</p>
            <ActionForm
              endpoint={SELF}
              action="branch.create"
              extra={{ orgId: org.id }}
              reset
              compact
              submit="Add branch"
              fields={[
                { name: 'name', label: 'Branch name', type: 'text', required: true, placeholder: 'e.g. Pimville' },
                { name: 'area', label: 'Area or address', type: 'text', placeholder: 'e.g. 12 Koma Road, Pimville' },
              ]}
            />
          </section>
        )}
      </>
    );
  }

  function GroupPanel({ g }: { g: TeamGroup }) {
    const manage = live && g.roles.every((r) => canGrantRole(p, r, org.id, g.branchId));
    const role = g.roles[0] as Role | undefined;
    return (
      <div className="st-group">
        <header>
          <strong>{g.name}</strong>
          {role && <span className="st-pill">{ROLES[role].label}</span>}
        </header>
        <div className="st-list flat">
          {g.members.length === 0 && <p className="st-empty">No one yet.</p>}
          {g.members.map((m) => (
            <div key={m.userId} className="st-row">
              <span className="st-avatar">{initials(m.name || m.label)}</span>
              <span className="st-row-main">
                <strong>
                  {m.name || m.label}
                  {m.userId === d.user.id ? ' (you)' : ''}
                </strong>
                <small>{m.name ? m.label : ''}</small>
              </span>
              {manage && m.userId !== d.user.id && (
                <AdminAction endpoint={SELF} action="group.removeMember" extra={{ groupId: g.id, userId: m.userId }} label="Remove" variant="ghost" confirm={`Remove ${m.name || m.label} from ${g.name}?`} />
              )}
            </div>
          ))}
        </div>
        {manage && (
          <ActionForm
            endpoint={SELF}
            action="group.addMember"
            extra={{ groupId: g.id }}
            compact
            reset
            submit="Appoint"
            fields={[{ name: 'who', label: `Appoint ${role === 'org_owner' ? 'an owner' : role === 'org_admin' ? 'a manager' : 'an arranger'} by cellphone number`, type: 'tel', placeholder: '072 123 4567', hint: 'They create a Memora account first.' }]}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- Billing & roles

  function Billing() {
    const plan = PRO_PLANS[org.plan];
    const bill = proInvoice(org, org.publishedThisMonth, false);
    return (
      <div className="st-split">
        <section className="st-panel st-plan">
          <span className="st-eyebrow">Your plan</span>
          <h2>{plan.name}</h2>
          <p className="st-plan-price">
            {org.monthlyFeeMinor ? `${formatMoney(org.monthlyFeeMinor)} a month + ` : ''}
            {formatMoney(org.perMemorialMinor)} per published memorial
          </p>
          <p className="st-sub">Excluding VAT. {org.status === 'trial' ? 'You’re in your trial: nothing is billed yet.' : 'To change plan, talk to Memora.'}</p>
          <div className="st-bill">
            <div>
              <span>Published this month</span>
              <b>{org.publishedThisMonth}</b>
            </div>
            <div>
              <span>So far this month</span>
              <b>{org.status === 'trial' ? 'R0' : formatMoney(bill.total)}</b>
            </div>
          </div>
        </section>
        <section className="st-panel">
          <header className="st-sec-head">
            <h2>Invoices</h2>
          </header>
          <div className="st-list flat">
            {d.invoices.length === 0 && <p className="st-empty">No invoices yet.</p>}
            {d.invoices.map((i) => (
              <div key={i.id} className="st-row">
                <span className="st-row-main">
                  <strong>{fmt(`${i.period}-15`, { month: 'long', year: 'numeric' })}</strong>
                  <small>
                    {i.memorials} memorial{i.memorials === 1 ? '' : 's'}
                    {i.onboardingMinor ? ' · includes onboarding' : ''}
                  </small>
                </span>
                <b className="st-amount">{formatMoney(i.amountMinor)}</b>
                <span className={`st-pill ${i.status === 'PAID' ? 'ok' : i.status === 'VOID' ? 'muted' : ''}`}>{i.status === 'DRAFT' ? 'Being prepared' : i.status.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function Roles() {
    const mine = new Set([...(p.orgRoles.get(org.id) ?? [])]);
    return (
      <>
        <p className="st-lede">
          Everyone at {org.name} has one role. The role decides what they can do; anything not listed isn’t allowed. Nobody sees another funeral home, and branch
          staff only see their own branch.
        </p>
        <div className="cc-role-grid">
          {ORG_ROLES.map((r) => (
            <RoleCard key={r} role={r} yours={mine.has(r)} />
          ))}
        </div>
      </>
    );
  }
}

function HomeMark({ org }: { org: Org }) {
  return org.logoUrl ? (
    <img className="st-logo" src={org.logoUrl} alt="" />
  ) : (
    <span className="st-logo mono" aria-hidden="true">
      {org.name.slice(0, 1)}
    </span>
  );
}

function Widget({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="st-widget">
      <span>{label}</span>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'warn' | 'ok'; children: React.ReactNode }) {
  return (
    <div className={`st-banner ${tone}`} role="status">
      <span>{children}</span>
    </div>
  );
}

