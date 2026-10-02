import Link from 'next/link';
import { ActionForm } from '@/components/admin/ActionForm';
import { AdminAction } from '@/components/admin/AdminAction';
import { RoleCard } from '@/components/admin/CommandPanels';
import { Brand } from '@/components/Brand';
import { NotificationBell } from '@/components/NotificationBell';
import { MenuGuard } from '@/components/pro/MenuGuard';
import { Banner, Widget } from '@/components/pro/studio/Studio';
import * as I from '@/components/pro/studio/icons';
import { BLUEPRINTS, CONTRACT_STATUS, SLA_TIERS, SUPPORT_LEVELS, resolveBrand, type Module } from '@/lib/enterprise';
import { fmtDate } from '@/lib/memorial';
import { formatMoney, proInvoice } from '@/lib/plans';
import { ALL_ROLES, ROLES, canAccount, canGrantRole, type Permission, type Principal, type Role } from '@/lib/rbac';
import { API_SCOPES, buildReport, type GroupWorld, type ReportFilters } from '@/lib/server/enterprise';
import type { Group } from '@/lib/server/pro';
import { GroupLogoUpload } from './GroupLogoUpload';

// The group control centre: Memora as the operating layer behind a funeral
// group. What someone sees follows their role: head office sees the whole
// group and its configuration; a regional manager their region; finance the
// contract and usage; brand the brand and templates; Memora's team a clearly
// marked support view. Every panel checks its own permission.

const SELF = '/api/group/actions';

export type GroupTab = 'overview' | 'structure' | 'people' | 'reports' | 'billing' | 'brand' | 'templates' | 'audit' | 'integrations' | 'roles';

const NAV: { tab: GroupTab; label: string; perm: Permission; module?: Module; icon: React.ReactNode }[] = [
  { tab: 'overview', label: 'Overview', perm: 'group.view', icon: <I.IconToday /> },
  { tab: 'structure', label: 'Regions & branches', perm: 'group.view', icon: <I.IconTeam /> },
  { tab: 'people', label: 'People', perm: 'group.people', icon: <I.IconFamily /> },
  { tab: 'reports', label: 'Reports', perm: 'group.reports', icon: <I.IconPrint /> },
  { tab: 'billing', label: 'Contract & usage', perm: 'group.billing', icon: <I.IconBilling /> },
  { tab: 'brand', label: 'Brand', perm: 'group.brand', module: 'brand_governance', icon: <I.IconBrand /> },
  { tab: 'templates', label: 'Templates', perm: 'group.templates', module: 'central_templates', icon: <I.IconFunerals /> },
  { tab: 'audit', label: 'Audit log', perm: 'group.audit', module: 'audit_log', icon: <I.IconEye /> },
  { tab: 'integrations', label: 'Integrations', perm: 'group.integrations', module: 'api_access', icon: <I.IconLink /> },
  { tab: 'roles', label: 'Roles', perm: 'group.view', icon: <I.IconRoles /> },
];

export const groupTabs = (p: Principal, w: Pick<GroupWorld, 'account'>) => NAV.filter((n) => canAccount(p, n.perm, w.account.id) && (!n.module || w.account.modules.includes(n.module)));

const R = (minor: number) => formatMoney(minor);
const when = (iso: string | null | undefined) => (iso ? fmtDate(String(iso).slice(0, 10)) : '—');
const day = (iso: string) => new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' }).format(new Date(iso));

export function GroupCentre({
  w,
  p,
  tab,
  support,
  today,
  filters,
  homeGroups,
  accounts,
}: {
  w: GroupWorld;
  p: Principal;
  tab: GroupTab;
  /** Memora's team looking in, not a member of the group. */
  support: boolean;
  today: string;
  filters: ReportFilters;
  homeGroups: Group[];
  accounts: { id: string; name: string }[];
}) {
  const a = w.account;
  const nav = groupTabs(p, w);
  const is = (perm: Permission) => canAccount(p, perm, a.id);
  const base = `/pro/group?account=${a.id}`;
  const regionName = new Map(w.regions.map((r) => [r.id, r.name]));
  const homeName = new Map(w.homes.map((h) => [h.id, h.name]));
  const branchName = new Map(w.branches.map((b) => [b.id, b.name]));
  const visible = new Set(w.visibleBranchIds);
  const myBranches = w.branches.filter((b) => visible.has(b.id));
  const roles = [...(p.accountRoles.get(a.id) ?? [])];
  const regionsHeld = p.accountRegions.get(a.id);
  const roleLabel = support
    ? 'Memora support view'
    : roles.length
      ? roles
          .map((r) => (r === 'regional_manager' && regionsHeld && regionsHeld !== 'all' ? `${ROLES[r].label} · ${[...regionsHeld].map((id) => regionName.get(id)).join(', ')}` : ROLES[r].label))
          .join(' · ')
      : 'Group';
  const accent = /^#[0-9a-f]{6}$/i.test(a.brandColour) ? a.brandColour : undefined;
  const title = nav.find((n) => n.tab === tab)?.label ?? 'Overview';
  const status = CONTRACT_STATUS[a.status];

  return (
    <div className="st gc" style={accent ? ({ ['--home' as string]: accent } as React.CSSProperties) : undefined}>
      <MenuGuard />
      <aside className="st-side" aria-label="Group">
        <div className="st-mark">
          <Brand />
        </div>
        <div className="st-home">
          {a.logoUrl ? (
            <img className="st-logo" src={a.logoUrl} alt="" />
          ) : (
            <span className="st-logo mono" aria-hidden="true">
              {a.name.slice(0, 1)}
            </span>
          )}
          <div>
            <strong>{a.name}</strong>
            <span>
              Enterprise · {w.homes.length} home{w.homes.length === 1 ? '' : 's'} · {w.branches.length} branch{w.branches.length === 1 ? '' : 'es'}
            </span>
          </div>
        </div>
        {accounts.length > 1 && (
          <details className="st-menu st-homes">
            <summary>Switch group</summary>
            <div className="st-menu-list">
              {accounts.map((x) => (
                <Link key={x.id} href={`/pro/group?account=${x.id}`} aria-current={x.id === a.id ? 'true' : undefined}>
                  {x.name}
                </Link>
              ))}
            </div>
          </details>
        )}
        <nav className="st-nav" aria-label="Sections">
          {nav.map((n) => (
            <Link key={n.tab} href={`${base}&tab=${n.tab}`} aria-current={n.tab === tab ? 'page' : undefined}>
              {n.icon}
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="st-side-foot">
          <span className="st-you">{roleLabel}</span>
          <div className="st-side-links">
            {support && <Link href="/admin?tab=enterprise">Command centre</Link>}
            {w.homes.length > 0 && <Link href={`/pro/dashboard?home=${w.homes[0].id}`}>Funeral homes</Link>}
            <Link href="/account">Account</Link>
          </div>
        </div>
      </aside>

      <div className="st-main">
        <header className="st-top">
          <div className="st-top-title">
            <span className="st-eyebrow">{a.name}</span>
            <h1>{title}</h1>
          </div>
          <div className="st-top-actions">
            <NotificationBell tone="studio" />
          </div>
        </header>
        <div className="st-body">
          {support && (
            <Banner tone="info">
              <strong>Memora Support View.</strong> You’re looking at {a.name} as Memora’s team, not as one of their staff. Everything you change is written to their audit log.
            </Banner>
          )}
          {!status.access && <Banner tone="warn">{status.hint}</Banner>}
          {(a.status === 'onboarding' || a.status === 'trial' || a.status === 'ending') && <Banner tone="info">{status.hint}</Banner>}

          {tab === 'overview' && <Overview />}
          {tab === 'structure' && <Structure />}
          {tab === 'people' && is('group.people') && <People />}
          {tab === 'reports' && is('group.reports') && <Reports />}
          {tab === 'billing' && is('group.billing') && <Billing />}
          {tab === 'brand' && is('group.brand') && <BrandTab />}
          {tab === 'templates' && is('group.templates') && <Templates />}
          {tab === 'audit' && is('group.audit') && <Audit />}
          {tab === 'integrations' && is('group.integrations') && <Integrations />}
          {tab === 'roles' && <Roles />}
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------- Overview

  function Overview() {
    const addDays = (n: number) => {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const week = addDays(7);
    const month = today.slice(0, 7);
    const live = w.funerals.filter((f) => f.status !== 'ARCHIVED' || (f.funeralDate ?? '') >= today);
    const todays = live.filter((f) => f.funeralDate === today);
    const thisWeek = live.filter((f) => f.funeralDate && f.funeralDate >= today && f.funeralDate <= week);
    const thisMonth = w.funerals.filter((f) => (f.funeralDate ?? '').startsWith(month));
    const drafts = w.funerals.filter((f) => f.status === 'DRAFT');
    const soonUnpublished = drafts.filter((f) => f.funeralDate && f.funeralDate >= today && f.funeralDate <= addDays(2));
    const activeBranches = myBranches.filter((b) => b.active);
    const since = addDays(-30);
    const quiet = activeBranches.filter((b) => !w.funerals.some((f) => f.branchId === b.id && (f.publishedAt ?? f.createdAt).slice(0, 10) >= since));
    const offWithFunerals = myBranches.filter((b) => !b.active && live.some((f) => f.branchId === b.id && (f.funeralDate ?? '') >= today));
    const inv = proInvoice(a, w.publishedThisMonth, false);
    const where = (branchId: string | null) => (branchId ? [branchName.get(branchId), homeName.get(w.branches.find((b) => b.id === branchId)?.orgId ?? '')].filter(Boolean).join(' · ') : '—');
    const exceptions = [
      ...soonUnpublished.map((f) => ({ key: f.id, tone: 'warn', text: `${f.name} — funeral ${f.funeralDate === today ? 'today' : `on ${when(f.funeralDate)}`}, memorial not published`, where: where(f.branchId) })),
      ...offWithFunerals.map((b) => ({ key: b.id, tone: 'warn', text: `${b.name} is switched off but has funerals coming up`, where: homeName.get(b.orgId) ?? '' })),
      ...(a.includedMemorials && w.publishedThisMonth > a.includedMemorials && is('group.billing')
        ? [{ key: 'over', tone: 'info', text: `${w.publishedThisMonth - a.includedMemorials} memorials beyond this month’s allowance`, where: `${R(a.perMemorialMinor)} each` }]
        : []),
      ...quiet.slice(0, 5).map((b) => ({ key: `q${b.id}`, tone: 'info', text: `${b.name}: no memorials in 30 days`, where: homeName.get(b.orgId) ?? '' })),
    ];
    const regions = w.regions.length ? [...w.regions.filter((r) => myBranches.some((b) => b.regionId === r.id)), { id: '', name: 'No region', kind: 'region' as const }] : [{ id: '', name: '', kind: 'region' as const }];
    return (
      <>
        <section className="st-hero gc-hero">
          <div>
            <span className="st-spark">{regionsHeld && regionsHeld !== 'all' ? `Your region${regionsHeld.size === 1 ? '' : 's'}` : 'The whole group'}</span>
            <h2>
              {todays.length ? `${todays.length} funeral${todays.length === 1 ? '' : 's'} today` : 'No funerals today'}
              {thisWeek.length > todays.length ? `, ${thisWeek.length - todays.length} more this week.` : '.'}
            </h2>
            <p>
              {activeBranches.length} branch{activeBranches.length === 1 ? '' : 'es'} working · {drafts.length} memorial{drafts.length === 1 ? '' : 's'} being prepared
            </p>
          </div>
        </section>
        <div className="st-widgets">
          <Widget label="Funerals this week" value={thisWeek.length} note={todays.length ? `${todays.length} today` : 'None today'} />
          <Widget label="Funerals this month" value={thisMonth.length} note={`${thisMonth.filter((f) => f.status !== 'DRAFT').length} published`} />
          <Widget label="Being prepared" value={drafts.length} note={soonUnpublished.length ? `${soonUnpublished.length} due within two days` : 'None urgent'} />
          {is('group.billing') ? (
            <Widget
              label="Allowance this month"
              value={`${w.publishedThisMonth} of ${a.includedMemorials}`}
              note={CONTRACT_STATUS[a.status].billed ? `Estimated ${R(inv.subtotal)} excl. VAT` : 'Not billed yet'}
            />
          ) : (
            <Widget label="Published this month" value={w.publishedThisMonth} note={`${activeBranches.length} branches working`} />
          )}
        </div>

        <section className="gc-section">
          <header className="st-sec-head">
            <h2>Needs attention</h2>
            <span className="muted small">{exceptions.length ? `${exceptions.length} item${exceptions.length === 1 ? '' : 's'}` : 'All clear'}</span>
          </header>
          <div className="st-list">
            {exceptions.length === 0 && <p className="st-empty">Nothing needs head office right now.</p>}
            {exceptions.map((x) => (
              <div key={x.key} className={`st-row gc-exception ${x.tone}`}>
                <span className="st-row-main">
                  <strong>{x.text}</strong>
                  <small>{x.where}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        {todays.length > 0 && (
          <section className="gc-section">
            <header className="st-sec-head">
              <h2>Today</h2>
            </header>
            <div className="st-list">
              {todays.map((f) => (
                <div key={f.id} className="st-row">
                  <span className="st-row-main">
                    <strong>{f.name}</strong>
                    <small>{where(f.branchId)}</small>
                  </span>
                  <span className={`st-pill ${f.status === 'PUBLISHED' ? 'ok' : ''}`}>{f.status === 'DRAFT' ? 'Not published' : 'Live'}</span>
                  {f.slug && (
                    <Link className="btn sm" href={`/m/${f.slug}`}>
                      Open
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="gc-section">
          <header className="st-sec-head">
            <h2>Branches this month</h2>
            <Link className="link chev" href={`${base}&tab=reports`}>
              Reports
            </Link>
          </header>
          {regions.map((r) => {
            const bs = myBranches.filter((b) => (r.id ? b.regionId === r.id : !b.regionId || !w.regions.length));
            if (!bs.length) return null;
            return (
              <div key={r.id || 'none'} className="gc-region">
                {r.name && <h3 className="gc-region-name">{r.name}</h3>}
                <div className="gc-branch-grid">
                  {bs.map((b) => {
                    const mine = thisMonth.filter((f) => f.branchId === b.id);
                    return (
                      <Link key={b.id} href={`/pro/dashboard?home=${b.orgId}&branch=${b.id}&tab=funerals`} className={`gc-branch${b.active ? '' : ' off'}`}>
                        <span>
                          <strong>{b.name}</strong>
                          <small>{homeName.get(b.orgId)}</small>
                        </span>
                        <b>{mine.length}</b>
                        <small>
                          {b.active ? `${mine.filter((f) => f.status !== 'DRAFT').length} published · ${mine.filter((f) => f.status === 'DRAFT').length} drafts` : 'Switched off'}
                        </small>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </>
    );
  }

  // ---------------------------------------------------------------- Structure

  function Structure() {
    const edit = is('group.structure');
    const regionsOn = a.modules.includes('regions');
    return (
      <>
        <p className="st-lede">
          {regionsOn ? 'Regions group branches for reporting and for regional managers. ' : ''}Funeral homes are the business units families see; branches are where the work happens.
          {edit ? ' Switching a branch off stops new work there; its published memorials stay up.' : ''}
        </p>
        {regionsOn && (
          <section className="gc-section">
            <header className="st-sec-head">
              <h2>{w.regions.length ? 'Regions' : 'No regions yet'}</h2>
            </header>
            <div className="st-list">
              {w.regions.map((r) => {
                const n = w.branches.filter((b) => b.regionId === r.id).length;
                return (
                  <div key={r.id} className="st-row">
                    <span className="st-row-main">
                      <strong>{r.name}</strong>
                      <small>
                        {r.kind} · {n} branch{n === 1 ? '' : 'es'}
                      </small>
                    </span>
                    {edit && (
                      <details className="st-menu">
                        <summary>Change</summary>
                        <div className="st-menu-list gc-menu-form">
                          <ActionForm endpoint={SELF} action="region.rename" extra={{ accountId: a.id, id: r.id }} compact submit="Rename" fields={[{ name: 'name', label: 'Name', type: 'text', value: r.name }]} />
                          <ActionForm
                            endpoint={SELF}
                            action="region.delete"
                            extra={{ accountId: a.id, id: r.id }}
                            compact
                            variant="danger"
                            submit="Remove"
                            fields={[{ name: 'confirm', label: `Type “${r.name}” to remove`, type: 'text' }]}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {edit && (
              <ActionForm
                endpoint={SELF}
                action="region.create"
                extra={{ accountId: a.id }}
                reset
                compact
                submit="Add region"
                fields={[
                  { name: 'name', label: 'New region', type: 'text', placeholder: 'e.g. KwaZulu-Natal' },
                  { name: 'kind', label: 'Kind', type: 'select', value: w.regions[0]?.kind ?? 'region', options: ['region', 'province', 'district', 'brand', 'division'].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })) },
                ]}
              />
            )}
          </section>
        )}

        {w.homes.map((h) => {
          const bs = myBranches.filter((b) => b.orgId === h.id);
          if (!bs.length && !edit) return null;
          return (
            <section key={h.id} className="gc-section">
              <header className="st-sec-head">
                <h2>{h.name}</h2>
                <Link className="link chev" href={`/pro/dashboard?home=${h.id}`}>
                  Open home
                </Link>
              </header>
              <div className="st-list">
                {bs.map((b) => (
                  <div key={b.id} className={`st-row${b.active ? '' : ' gc-off'}`}>
                    <span className="st-row-main">
                      <strong>{b.name}</strong>
                      <small>
                        {[b.area, b.regionId ? regionName.get(b.regionId) : regionsOn ? 'No region' : ''].filter(Boolean).join(' · ') || '—'}
                        {b.active ? '' : ' · switched off'}
                      </small>
                    </span>
                    {edit && regionsOn && w.regions.length > 0 && (
                      <ActionForm
                        endpoint={SELF}
                        action="branch.setRegion"
                        extra={{ accountId: a.id, id: b.id }}
                        compact
                        variant=""
                        submit="Move"
                        fields={[{ name: 'regionId', label: 'Region', type: 'select', value: b.regionId ?? '', options: [{ value: '', label: 'No region' }, ...w.regions.map((r) => ({ value: r.id, label: r.name }))] }]}
                      />
                    )}
                    {edit && (
                      <AdminAction
                        endpoint={SELF}
                        action="branch.setActive"
                        extra={{ accountId: a.id, id: b.id, active: b.active ? 'false' : 'true' }}
                        label={b.active ? 'Switch off' : 'Switch on'}
                        variant={b.active ? 'danger' : ''}
                        confirm={b.active ? `Switch ${b.name} off? No new work there; its published memorials stay up.` : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {edit && (
          <details className="st-panel gc-add">
            <summary>
              <strong>+ Add a funeral home</strong>
              <span className="muted small"> A new business unit with its first branch.</span>
            </summary>
            <ActionForm
              endpoint={SELF}
              action="home.create"
              extra={{ accountId: a.id }}
              reset
              submit="Add funeral home"
              fields={[
                { name: 'name', label: 'Funeral home', type: 'text', required: true },
                { name: 'branchName', label: 'First branch', type: 'text', placeholder: 'Main branch' },
                { name: 'area', label: 'Area', type: 'text' },
                ...(regionsOn && w.regions.length ? [{ name: 'regionId', label: 'Region', type: 'select' as const, value: '', options: [{ value: '', label: 'No region' }, ...w.regions.map((r) => ({ value: r.id, label: r.name }))] }] : []),
              ]}
            />
          </details>
        )}
        {edit && (
          <details className="st-panel gc-add">
            <summary>
              <strong>+ Add a branch to a home</strong>
            </summary>
            <ActionForm
              endpoint={SELF}
              action="branch.create"
              reset
              submit="Add branch"
              fields={[
                { name: 'orgId', label: 'Funeral home', type: 'select', value: w.homes[0]?.id ?? '', options: w.homes.map((h) => ({ value: h.id, label: h.name })) },
                { name: 'name', label: 'Branch', type: 'text', required: true },
                { name: 'area', label: 'Area', type: 'text' },
              ]}
            />
          </details>
        )}
        {edit && a.modules.includes('bulk_import') && (
          <details className="st-panel gc-add">
            <summary>
              <strong>Import branches</strong>
              <span className="muted small"> Paste from a spreadsheet: one branch per line.</span>
            </summary>
            <ActionForm
              endpoint={SELF}
              action="branch.bulk"
              extra={{ accountId: a.id }}
              reset
              submit="Import branches"
              confirm="Add these branches now?"
              fields={[
                {
                  name: 'lines',
                  label: 'Branches',
                  type: 'textarea',
                  rows: 6,
                  placeholder: 'Gauteng > Motheo Pretoria > Hatfield | Hatfield\nLimpopo > Motheo North > Polokwane',
                  hint: '“Region > Home > Branch | area”. New regions and homes are created as needed.',
                },
              ]}
            />
          </details>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------- People

  function People() {
    const groupTeams = w.groups.filter((g) => !g.regionId);
    const regionTeams = w.groups.filter((g) => g.regionId);
    const Team = ({ g }: { g: Group }) => {
      const manage = g.roles.every((r) => canGrantRole(p, r, g.orgId, g.branchId, { accountId: g.accountId, regionId: g.regionId }));
      return (
        <article className="st-group">
          <header>
            <div>
              <strong>{g.name}</strong>
              <small>{g.roles.map((r) => ROLES[r].label).join(', ')}</small>
            </div>
            <span className="muted small">
              {g.members.length} {g.members.length === 1 ? 'person' : 'people'}
            </span>
          </header>
          <ul className="st-people">
            {g.members.map((m) => (
              <li key={m.userId}>
                <span>
                  {m.name || m.label}
                  {m.name && <small> · {m.label}</small>}
                </span>
                {manage && (
                  <AdminAction
                    endpoint={SELF}
                    action="group.removeMember"
                    extra={{ groupId: g.id, userId: m.userId }}
                    label="Remove"
                    variant="danger"
                    confirm={`Remove ${m.name || m.label} from ${g.name}? They lose its access at once.`}
                  />
                )}
              </li>
            ))}
            {g.members.length === 0 && <li className="muted small">Nobody yet.</li>}
          </ul>
          {manage && (
            <ActionForm endpoint={SELF} action="group.addMember" extra={{ groupId: g.id }} reset compact submit="Add" fields={[{ name: 'who', label: 'Cellphone number or email', type: 'text', placeholder: '082 123 4567' }]} />
          )}
        </article>
      );
    };
    const owners = homeGroups.filter((g) => !g.branchId);
    const branchTeams = homeGroups.filter((g) => g.branchId && visible.has(g.branchId));
    return (
      <>
        <p className="st-lede">Head office and regional teams are appointed here. Each home’s owners, branch managers and arrangers are shown below; add them here or from the home itself.</p>
        <section className="gc-section">
          <header className="st-sec-head">
            <h2>Head office</h2>
          </header>
          <div className="st-groups">
            {groupTeams.map((g) => (
              <Team key={g.id} g={g} />
            ))}
          </div>
        </section>
        {regionTeams.length > 0 && (
          <section className="gc-section">
            <header className="st-sec-head">
              <h2>Regional managers</h2>
            </header>
            <div className="st-groups">
              {regionTeams.map((g) => (
                <Team key={g.id} g={g} />
              ))}
            </div>
          </section>
        )}
        {w.homes.map((h) => {
          const teams = [...owners.filter((g) => g.orgId === h.id), ...branchTeams.filter((g) => g.orgId === h.id)];
          if (!teams.length) return null;
          return (
            <details key={h.id} className="st-panel gc-add">
              <summary>
                <strong>{h.name}</strong>
                <span className="muted small">
                  {' '}
                  {teams.reduce((n, g) => n + g.members.length, 0)} people in {teams.length} teams
                </span>
              </summary>
              <div className="st-groups">
                {teams.map((g) => (
                  <Team key={g.id} g={{ ...g, name: g.branchId ? `${branchName.get(g.branchId)} · ${g.name}` : g.name }} />
                ))}
              </div>
            </details>
          );
        })}
        {a.modules.includes('bulk_import') && (
          <details className="st-panel gc-add">
            <summary>
              <strong>Invite many people at once</strong>
              <span className="muted small"> Paste from a spreadsheet.</span>
            </summary>
            <ActionForm
              endpoint={SELF}
              action="people.bulk"
              extra={{ accountId: a.id }}
              reset
              submit="Add and invite"
              confirm="Add these people now? Anyone without an account gets a one-time link."
              fields={[
                {
                  name: 'lines',
                  label: 'People',
                  type: 'textarea',
                  rows: 6,
                  placeholder: '082 123 4567, arranger, Pretoria Central\n083 555 0101, branch manager, Centurion\nlerato@motheo.co.za, regional manager, Gauteng\n071 222 3333, finance',
                  hint: 'Number or email, role, and where: a branch (arranger, branch manager), a home (owner) or a region (regional manager). Group roles need no place.',
                },
              ]}
            />
          </details>
        )}
        {w.invites.length > 0 && (
          <section className="gc-section">
            <header className="st-sec-head">
              <h2>Invite links</h2>
              <span className="muted small">Send each on WhatsApp. Each works once, for 14 days.</span>
            </header>
            <div className="st-list">
              {w.invites.map((i) => (
                <div key={i.id} className="st-row">
                  <span className="st-row-main">
                    <strong>{i.label}</strong>
                    <small>
                      {i.group} · {i.state}
                    </small>
                  </span>
                  {i.url && i.state === 'open' && (
                    <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(`You’re invited to ${a.name} on Memora (${i.group}). Open this link to join: ${i.url}`)}`} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  )}
                  {i.state === 'open' && <AdminAction endpoint={SELF} action="invite.revoke" id={i.id} label="Switch off" variant="danger" />}
                </div>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------- Reports

  function Reports() {
    const { rows, byArranger } = buildReport(w, filters);
    const totals = rows.reduce((t, r) => ({ funerals: t.funerals + r.funerals, published: t.published + r.published, drafts: t.drafts + r.drafts }), { funerals: 0, published: 0, drafts: 0 });
    const advanced = a.modules.includes('advanced_reporting');
    const qs = new URLSearchParams({ account: a.id, from: filters.from, to: filters.to, ...(filters.regionId ? { region: filters.regionId } : {}), ...(filters.homeId ? { home: filters.homeId } : {}), ...(filters.branchId ? { branch: filters.branchId } : {}), status: filters.status ?? 'all' });
    const byRegion = w.regions
      .map((r) => {
        const rs = rows.filter((x) => x.region === r.name);
        return { name: r.name, funerals: rs.reduce((s, x) => s + x.funerals, 0), published: rs.reduce((s, x) => s + x.published, 0), branches: rs.length };
      })
      .filter((r) => r.branches);
    return (
      <>
        <form className="gc-filters" method="get" action="/pro/group">
          <input type="hidden" name="account" value={a.id} />
          <input type="hidden" name="tab" value="reports" />
          <label className="field">
            <span>From</span>
            <input className="input" type="date" name="from" defaultValue={filters.from} />
          </label>
          <label className="field">
            <span>To</span>
            <input className="input" type="date" name="to" defaultValue={filters.to} />
          </label>
          {w.regions.length > 0 && (
            <label className="field">
              <span>Region</span>
              <select className="select" name="region" defaultValue={filters.regionId ?? ''}>
                <option value="">All regions</option>
                {w.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {w.homes.length > 1 && (
            <label className="field">
              <span>Funeral home</span>
              <select className="select" name="home" defaultValue={filters.homeId ?? ''}>
                <option value="">All homes</option>
                {w.homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Branch</span>
            <select className="select" name="branch" defaultValue={filters.branchId ?? ''}>
              <option value="">All branches</option>
              {myBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select className="select" name="status" defaultValue={filters.status ?? 'all'}>
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
          </label>
          <button className="btn primary" type="submit">
            Show
          </button>
          {advanced && (
            <a className="btn" href={`/api/group/report?${qs.toString()}`}>
              Download CSV
            </a>
          )}
        </form>

        <div className="st-widgets">
          <Widget label="Funerals" value={totals.funerals} note={`${when(filters.from)} – ${when(filters.to)}`} />
          <Widget label="Published" value={totals.published} note={totals.funerals ? `${Math.round((totals.published / totals.funerals) * 100)}% of funerals` : '—'} />
          <Widget label="Drafts" value={totals.drafts} note="Not yet published" />
          <Widget label="Branches with funerals" value={rows.filter((r) => r.funerals > 0).length} note={`of ${rows.length}`} />
        </div>

        {byRegion.length > 1 && (
          <section className="gc-section">
            <header className="st-sec-head">
              <h2>By region</h2>
            </header>
            <div className="board-wrap">
              <table className="board">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Branches</th>
                    <th>Funerals</th>
                    <th>Published</th>
                  </tr>
                </thead>
                <tbody>
                  {byRegion.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.branches}</td>
                      <td>{r.funerals}</td>
                      <td>{r.published}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="gc-section">
          <header className="st-sec-head">
            <h2>By branch</h2>
          </header>
          <div className="board-wrap">
            <table className="board">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Funerals</th>
                  <th>Published</th>
                  <th>Drafts</th>
                  {advanced && <th>With programme</th>}
                  {advanced && <th>From family links</th>}
                  {advanced && <th>Avg lead (days)</th>}
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.branchId} className={r.active ? '' : 'gc-off'}>
                    <td>
                      {r.branch}
                      <span className="sub">{[r.home, r.region].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>{r.funerals}</td>
                    <td>{r.published}</td>
                    <td>{r.drafts}</td>
                    {advanced && <td>{r.withProgramme}</td>}
                    {advanced && <td>{r.fromFamilyLinks}</td>}
                    {advanced && <td>{r.avgLeadDays ?? '—'}</td>}
                    <td>{r.lastActivity ? day(r.lastActivity) : r.active ? 'None' : 'Off'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {advanced && byArranger.length > 0 && (
          <section className="gc-section">
            <header className="st-sec-head">
              <h2>By arranger</h2>
              <span className="muted small">Who started each memorial (family links count under the family).</span>
            </header>
            <div className="st-list">
              {byArranger.slice(0, 25).map((x) => (
                <div key={x.ownerId} className="st-row">
                  <span className="st-row-main">
                    <strong>{w.people.get(x.ownerId) ?? 'Someone'}</strong>
                  </span>
                  <span className="muted small">
                    {x.funerals} funeral{x.funerals === 1 ? '' : 's'} · {x.published} published
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------- Billing

  function Billing() {
    const inv = proInvoice(a, w.publishedThisMonth, false);
    const pct = a.includedMemorials ? Math.min(100, (w.publishedThisMonth / a.includedMemorials) * 100) : 0;
    const byHome = w.homes.map((h) => ({ h, n: w.branches.filter((b) => b.orgId === h.id).reduce((s, b) => s + (w.usageByBranch.get(b.id) ?? 0), 0) })).filter((x) => x.n > 0);
    return (
      <div className="st-split">
        <section className="st-panel st-plan">
          <span className="st-eyebrow">Your agreement</span>
          <h2>Enterprise · {BLUEPRINTS[a.blueprint].label}</h2>
          <p className="st-plan-price">
            {R(a.monthlyFeeMinor)} a month · {a.includedMemorials} memorials included · {R(a.perMemorialMinor)} each after that
          </p>
          <p className="st-sub">Excluding VAT. A memorial counts once, when it’s first published. The allowance resets on the 1st. To change the agreement, talk to your account manager.</p>
          <div className="st-allowance" role="img" aria-label={`${w.publishedThisMonth} of ${a.includedMemorials} included memorials used`}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="st-bill">
            <div>
              <span>Published this month</span>
              <b>
                {w.publishedThisMonth}
                <small> of {a.includedMemorials}</small>
              </b>
            </div>
            <div>
              <span>Estimated invoice</span>
              <b>{CONTRACT_STATUS[a.status].billed ? R(inv.subtotal) : 'R0'}</b>
              {inv.overageMemorials > 0 && (
                <small>
                  incl. {inv.overageMemorials} × {R(inv.overageRate)}
                </small>
              )}
            </div>
          </div>
          <dl className="gc-contract">
            <div>
              <dt>Status</dt>
              <dd>{CONTRACT_STATUS[a.status].label}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>{a.contractStart ? `${when(a.contractStart)} → ${when(a.contractEnd)}` : 'Dates to be confirmed'}</dd>
            </div>
            <div>
              <dt>Renewal</dt>
              <dd>{when(a.renewalDate)}</dd>
            </div>
            <div>
              <dt>Branches</dt>
              <dd>
                {w.branches.length}
                {a.branchAllowance ? ` of ${a.branchAllowance}` : ' (no limit)'}
              </dd>
            </div>
            <div>
              <dt>Service level</dt>
              <dd>
                {SLA_TIERS[a.slaTier]} · {SUPPORT_LEVELS[a.supportLevel]}
              </dd>
            </div>
            <div>
              <dt>Account manager</dt>
              <dd>{a.accountManager || '—'}</dd>
            </div>
            <div>
              <dt>Billing contact</dt>
              <dd>{a.billingContact || '—'}</dd>
            </div>
          </dl>
        </section>
        <div className="gc-stack">
          {a.modules.includes('advanced_finance') && (
            <section className="st-panel">
              <header className="st-sec-head">
                <h2>This month by home</h2>
              </header>
              <div className="st-list flat">
                {byHome.length === 0 && <p className="st-empty">Nothing published yet this month.</p>}
                {byHome.map(({ h, n }) => (
                  <div key={h.id} className="st-row">
                    <span className="st-row-main">
                      <strong>{h.name}</strong>
                    </span>
                    <b className="st-amount">{n}</b>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="st-panel">
            <header className="st-sec-head">
              <h2>Invoices</h2>
            </header>
            <div className="st-list flat">
              {w.invoices.length === 0 && <p className="st-empty">No invoices yet.</p>}
              {w.invoices.map((i) => (
                <div key={i.id} className="st-row">
                  <span className="st-row-main">
                    <strong>{fmtDate(`${i.period}-15`).replace(/^\d+\s/, '')}</strong>
                    <small>
                      {i.memorials} memorials{i.overageMemorials ? ` · ${i.overageMemorials} beyond the allowance` : ''}
                      {i.onboardingMinor ? ' · includes onboarding' : ''}
                      {i.adjustmentsMinor ? ` · ${i.adjustmentsMinor < 0 ? 'credit' : 'charge'} ${R(Math.abs(i.adjustmentsMinor))}` : ''}
                    </small>
                  </span>
                  <b className="st-amount">
                    {R(i.amountMinor + i.vatMinor)}
                    <small>{i.vatMinor ? 'incl. VAT' : 'no VAT charged'}</small>
                  </b>
                  <span className={`st-pill ${i.status === 'PAID' ? 'ok' : i.status === 'VOID' ? 'muted' : ''}`}>{i.status === 'DRAFT' ? 'Being prepared' : i.status.toLowerCase()}</span>
                  {canAccount(p, 'orgs.billing', null) && i.status !== 'PAID' && i.status !== 'VOID' && (
                    <AdminAction action="account.invoiceStatus" extra={{ accountId: a.id, id: i.id, status: i.status === 'DRAFT' ? 'SENT' : 'PAID' }} label={i.status === 'DRAFT' ? 'Mark sent' : 'Mark paid'} />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- Brand

  function BrandTab() {
    const master = { logoUrl: a.logoUrl, brandColour: a.brandColour, footer: a.brandFooter, locks: a.brandLocks };
    return (
      <div className="st-split">
        <section className="st-panel st-brand-controls">
          <span className="st-eyebrow">Master brand</span>
          <h2>One brand, every home.</h2>
          <p className="st-sub">Locked parts are the same on every memorial, programme and QR card in the group. Unlocked parts start from the master brand; homes may set their own.</p>
          <GroupLogoUpload accountId={a.id} logoUrl={a.logoUrl} />
          <ActionForm
            endpoint={SELF}
            action="account.brand"
            extra={{ accountId: a.id }}
            submit="Save brand"
            fields={[
              { name: 'brandColour', label: 'Colour', type: 'text', value: a.brandColour, placeholder: '#5B3E8C' },
              { name: 'brandFooter', label: 'Footer line on memorials', type: 'text', value: a.brandFooter, placeholder: 'e.g. A Motheo Funeral Group home' },
              {
                name: 'locks',
                label: 'Homes may not change',
                type: 'multi',
                value: a.brandLocks,
                options: [
                  { value: 'logo', label: 'The logo', hint: 'Every home shows the group’s logo.' },
                  { value: 'colour', label: 'The colour', hint: 'Every home uses the group’s colour.' },
                  { value: 'footer', label: 'The footer line', hint: 'Shown under every home’s name.' },
                ],
              },
            ]}
          />
        </section>
        <section className="st-panel">
          <header className="st-sec-head">
            <h2>What guests see</h2>
            <span className="muted small">Each home, with the group’s rules applied</span>
          </header>
          <div className="gc-brand-previews">
            {w.homes.map((h) => {
              const b = resolveBrand({ name: h.name, logoUrl: h.logoUrl, brandColour: h.brandColour }, master);
              return (
                <div key={h.id} className="m-brand gc-brand-preview" style={b.brandColour ? ({ ['--home' as string]: b.brandColour } as React.CSSProperties) : undefined}>
                  {b.logoUrl && <img src={b.logoUrl} alt="" />}
                  <span>
                    Arranged with care by <strong>{b.name}</strong>
                    {b.footer ? <small className="m-brand-footer">{b.footer}</small> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------- Templates

  function Templates() {
    const audienceOptions = (kind: 'regions' | 'branches') => (kind === 'regions' ? w.regions.map((r) => ({ value: r.id, label: r.name })) : w.branches.map((b) => ({ value: b.id, label: `${b.name} · ${homeName.get(b.orgId)}` })));
    const toText = (items: GroupWorld['templates'][number]['items']) => {
      let part = '';
      return items
        .flatMap((it) => {
          const head = it.part !== part ? [`# ${it.part === 'graveside' ? 'At the graveside' : it.part === 'vigil' ? 'Night vigil' : 'The service'}`] : [];
          part = it.part;
          return [...head, `${it.title} | ${it.minutes}`];
        })
        .join('\n');
    };
    const who = (t: GroupWorld['templates'][number]) =>
      t.audience === 'all' ? 'Every branch' : t.audience === 'regions' ? t.audienceIds.map((id) => regionName.get(id)).filter(Boolean).join(', ') : `${t.audienceIds.length} branch${t.audienceIds.length === 1 ? '' : 'es'}`;
    const form = (t?: GroupWorld['templates'][number]) => (
      <ActionForm
        endpoint={SELF}
        action="template.save"
        extra={{ accountId: a.id, ...(t ? { id: t.id } : {}) }}
        reset={!t}
        submit={t ? 'Save changes' : 'Publish template'}
        fields={[
          { name: 'name', label: 'Name', type: 'text', value: t?.name ?? '', required: true, placeholder: 'e.g. Zion Christian Church service' },
          { name: 'kind', label: 'Kind', type: 'select', value: t?.kind ?? 'programme', options: [{ value: 'programme', label: 'Programme' }, { value: 'wording', label: 'Wording' }] },
          { name: 'tradition', label: 'Tradition (optional)', type: 'text', value: t?.tradition ?? '' },
          {
            name: 'itemsText',
            label: 'Programme items (for a programme)',
            type: 'textarea',
            rows: 8,
            value: t ? toText(t.items) : '',
            placeholder: '# The service\nOpening prayer | 5\nHymn | 5\nObituary | 10\n# At the graveside\nCommittal | 10',
            hint: 'One item per line: “Title | minutes”. A line starting with # starts a part: The service, At the graveside, Night vigil.',
          },
          { name: 'wording', label: 'Wording (for wording)', type: 'textarea', rows: 3, value: t?.wording ?? '', hint: '{name} is replaced with the person’s name.' },
          {
            name: 'audience',
            label: 'Published to',
            type: 'select',
            value: t?.audience ?? 'all',
            options: [{ value: 'all', label: 'Every branch' }, ...(w.regions.length ? [{ value: 'regions', label: 'Chosen regions' }] : []), { value: 'branches', label: 'Chosen branches' }],
          },
          ...(w.regions.length ? [{ name: 'audienceIds', label: 'Regions or branches (when chosen)', type: 'multi' as const, value: t?.audienceIds ?? [], options: [...audienceOptions('regions'), ...audienceOptions('branches')] }] : [{ name: 'audienceIds', label: 'Branches (when chosen)', type: 'multi' as const, value: t?.audienceIds ?? [], options: audienceOptions('branches') }]),
        ]}
      />
    );
    return (
      <>
        <p className="st-lede">Head office’s templates appear for arrangers when they build a programme. Branches can use them but can’t change or delete them. Withdrawing a template hides it; programmes already made keep their items.</p>
        <div className="st-list">
          {w.templates.length === 0 && <p className="st-empty">No templates yet.</p>}
          {w.templates.map((t) => (
            <details key={t.id} className="gc-template">
              <summary className="st-row">
                <span className="st-row-main">
                  <strong>
                    {t.name}
                    {!t.active && ' · withdrawn'}
                  </strong>
                  <small>
                    {t.kind === 'programme' ? `${t.items.length} items` : 'Wording'}
                    {t.tradition ? ` · ${t.tradition}` : ''} · {who(t)} · updated {day(t.updatedAt)}
                  </small>
                </span>
                <span className={`st-pill ${t.active ? 'ok' : 'muted'}`}>{t.active ? 'Published' : 'Withdrawn'}</span>
              </summary>
              <div className="gc-template-body">
                {form(t)}
                <AdminAction
                  endpoint={SELF}
                  action="template.archive"
                  extra={{ accountId: a.id, id: t.id, active: t.active ? 'false' : 'true' }}
                  label={t.active ? 'Withdraw' : 'Publish again'}
                  variant={t.active ? 'danger' : ''}
                  confirm={t.active ? `Withdraw “${t.name}”? Branches stop seeing it.` : undefined}
                />
              </div>
            </details>
          ))}
        </div>
        <details className="st-panel gc-add">
          <summary>
            <strong>+ New template</strong>
          </summary>
          {form()}
        </details>
      </>
    );
  }

  // ---------------------------------------------------------------- Audit

  function Audit() {
    return (
      <>
        <p className="st-lede">Every change to people, roles, branches, brand, templates, integrations and the contract, with who made it and what it was before.</p>
        <div className="board-wrap">
          <table className="board">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {w.audit.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Nothing yet.
                  </td>
                </tr>
              )}
              {w.audit.map((e, i) => (
                <tr key={i}>
                  <td>{new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }).format(new Date(e.at))}</td>
                  <td>{e.actor}</td>
                  <td>
                    {e.action}
                    {e.detail && <span className="sub">{e.detail}</span>}
                  </td>
                  <td className="gc-diff">{e.before || '—'}</td>
                  <td className="gc-diff">{e.after || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------- Integrations

  function Integrations() {
    return (
      <>
        <p className="st-lede">
          A key lets one of your systems (a funeral-management system, a CRM, an insurer’s platform) talk to Memora with only the permissions you give it. Keys are shown once;
          Memora keeps only a fingerprint. Revoke a key and anything using it stops at once.
        </p>
        <div className="st-list">
          {w.keys.length === 0 && <p className="st-empty">No keys yet.</p>}
          {w.keys.map((k) => (
            <div key={k.id} className={`st-row${k.revokedAt ? ' gc-off' : ''}`}>
              <span className="st-row-main">
                <strong>{k.name}</strong>
                <small>
                  {k.prefix}… · {k.scopes.join(', ')} · made {day(k.createdAt)}
                  {k.lastUsedAt ? ` · last used ${day(k.lastUsedAt)}` : ' · never used'}
                  {k.revokedAt ? ` · revoked ${day(k.revokedAt)}` : ''}
                </small>
              </span>
              {!k.revokedAt && (
                <AdminAction endpoint={SELF} action="apikey.revoke" extra={{ accountId: a.id, id: k.id }} label="Revoke" variant="danger" confirm={`Revoke “${k.name}”? Anything using it stops working at once.`} />
              )}
            </div>
          ))}
        </div>
        <section className="st-panel gc-section">
          <h2>New key</h2>
          <ActionForm
            endpoint={SELF}
            action="apikey.create"
            extra={{ accountId: a.id }}
            reset
            submit="Make key"
            fields={[
              { name: 'name', label: 'Which system is it for?', type: 'text', required: true, placeholder: 'e.g. Policy admin system' },
              {
                name: 'scopes',
                label: 'It may',
                type: 'multi',
                value: ['read:funerals'],
                options: API_SCOPES.map((s) => ({
                  value: s,
                  label: s === 'read:funerals' ? 'Read funerals' : s === 'read:reports' ? 'Read reports' : 'Create memorials',
                  hint: s === 'read:funerals' ? 'Dates, branches and status. No family stories.' : s === 'read:reports' ? 'The numbers on the Reports page.' : 'Start a memorial for a branch (coming).',
                })),
              },
            ]}
          />
          {!a.modules.includes('webhooks') ? null : <p className="muted small">Webhooks (Memora telling your system when a memorial is published) are coming. Your account manager will set them up with you.</p>}
        </section>
      </>
    );
  }

  // ---------------------------------------------------------------- Roles

  function Roles() {
    const groupRoles = ALL_ROLES.filter((r) => ROLES[r].scope === 'account');
    const homeRoles = ALL_ROLES.filter((r) => ROLES[r].scope === 'org');
    const mine = new Set<Role>(roles);
    return (
      <>
        <p className="st-lede">Everyone has a role, and the role decides what they can do. Head office roles cover the whole group; a regional manager covers their region; home roles work inside one home or branch.</p>
        <h2 className="h4 gc-h">Group roles</h2>
        <div className="cc-role-grid">
          {groupRoles.map((r) => (
            <RoleCard key={r} role={r} yours={mine.has(r)} />
          ))}
        </div>
        <h2 className="h4 gc-h">In each home</h2>
        <div className="cc-role-grid">
          {homeRoles.map((r) => (
            <RoleCard key={r} role={r} />
          ))}
        </div>
      </>
    );
  }
}

