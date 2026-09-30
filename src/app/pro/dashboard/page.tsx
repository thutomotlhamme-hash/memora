import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/admin/ActionForm';
import { AdminAction } from '@/components/admin/AdminAction';
import { RoleCard } from '@/components/admin/CommandPanels';
import { StatusScreen } from '@/components/MemorialView';
import { InviteList } from '@/components/pro/InviteList';
import { NewHomeMemorial, PublishForHome, RunSheetFor } from '@/components/pro/ProButtons';
import { SiteHeader } from '@/components/SiteHeader';
import { accountLabel } from '@/lib/account-id';
import { fmtDate } from '@/lib/memorial';
import { PRO_PLANS, formatMoney, proInvoice } from '@/lib/plans';
import { ALL_ROLES, ROLES, can, canGrantRole, orgsOf, type Permission, type Role } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { loadAdminCases, type AdminCase } from '@/lib/server/admin';
import { loadInvites } from '@/lib/server/invites';
import { loadGroups, loadInvoices, loadOrgs } from '@/lib/server/pro';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Funeral home', robots: { index: false } };

const SELF = '/api/pro/actions';

/** The funeral home's own command centre. Each tab shows only to roles that may use it. */
const TABS = [
  ['today', 'Today', 'org.view'],
  ['funerals', 'Funerals', 'org.view'],
  ['families', 'Family links', 'org.memorials.create'],
  ['team', 'Team', 'org.view'],
  ['roles', 'Who can do what', 'org.view'],
  ['branding', 'Branding', 'org.branding'],
  ['billing', 'Plan & invoices', 'org.billing.view'],
] as const satisfies readonly (readonly [string, string, Permission])[];
type Tab = (typeof TABS)[number][0];

const ORG_ROLES = ALL_ROLES.filter((r) => ROLES[r].scope === 'org');
const saToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Group = 'soon' | 'drafts' | 'upcoming' | 'past';
const GROUP_TITLE: Record<Group, [string, string]> = {
  soon: ['This week', 'Funerals in the next seven days.'],
  drafts: ['Being prepared', 'Drafts, by families or your staff. A director publishes them.'],
  upcoming: ['Coming up', 'Published, with the funeral more than a week away.'],
  past: ['Done', 'Funerals that have passed. Memorials stay up for the family.'],
};

function groupOf(c: AdminCase, today: string, weekEnd: string): Group {
  const d = c.funeralDate;
  if (c.status === 'ARCHIVED' || (d && d < today)) return 'past';
  if (d && d <= weekEnd) return 'soon';
  if (c.status === 'DRAFT') return 'drafts';
  return 'upcoming';
}

export default async function ProDashboard({ searchParams }: { searchParams: Promise<{ home?: string; tab?: string; welcome?: string }> }) {
  const access = await getAccess();
  const admin = getAdminSupabase();
  if (!admin) return <StatusScreen eyebrow="Memora Pro" title="Not switched on yet." body="The site owner needs to finish setup." />;
  if (!access) redirect('/account/login?next=/pro/dashboard');
  const p = access.principal;

  // Staff see their own homes; Memora's team can open any home to help.
  const mine = orgsOf(p);
  const allOrgs = p.anyOrg.has('org.view') ? await loadOrgs(admin) : await loadOrgs(admin, mine);
  if (!allOrgs.length) {
    return (
      <>
        <SiteHeader />
        <StatusScreen
          eyebrow="Memora Pro"
          title="You’re not part of a funeral home yet."
          body={`You’re signed in as ${accountLabel(access.user.email)}. Ask your funeral home’s owner or manager to add this number to their team.`}
          action={
            <Link className="btn" href="/pro">
              About Memora Pro
            </Link>
          }
        />
      </>
    );
  }
  const sp = await searchParams;
  const org = allOrgs.find((o) => o.id === sp.home) ?? allOrgs.find((o) => mine.includes(o.id)) ?? allOrgs[0];
  if (!can(p, 'org.view', org.id)) redirect('/pro/dashboard');
  const tabs = TABS.filter(([, , perm]) => can(p, perm, org.id));
  const tab: Tab = (tabs.find(([t]) => t === sp.tab)?.[0] ?? 'today') as Tab;
  const href = (t: Tab) => `/pro/dashboard?home=${org.id}&tab=${t}`;

  const [{ data: links }, cases, groups, invoices, families] = await Promise.all([
    admin.from('memora_cases').select('id').eq('org_id', org.id),
    loadAdminCases(admin),
    loadGroups(admin, org.id),
    can(p, 'org.billing.view', org.id) ? loadInvoices(admin, org.id) : Promise.resolve([]),
    can(p, 'org.memorials.create', org.id) ? loadInvites(admin, 'family', org.id) : Promise.resolve([]),
  ]);
  const ids = new Set(((links ?? []) as { id: string }[]).map((l) => l.id));
  const memorials = cases.filter((c) => ids.has(c.id));
  const fromLink = new Map(families.filter((f) => f.caseId).map((f) => [f.caseId!, f.label]));
  const bill = proInvoice(org, org.publishedThisMonth, false);
  const plan = PRO_PLANS[org.plan];
  const live = org.status !== 'disabled';
  // Editing opens the family's draft directly; that works for the home's own staff (the database checks the same roles).
  const edits = p.orgs.get(org.id)?.has('org.memorials.edit') ?? false;
  const myRoles = [...(p.orgRoles.get(org.id) ?? [])] as Role[];
  const platformRoles = [...p.roles].filter((r) => ROLES[r].scope === 'platform');
  const youAre = myRoles.length ? myRoles.map((r) => ROLES[r].label).join(', ') : platformRoles.length ? `Memora ${ROLES[platformRoles[0]].label}` : 'Viewer';

  const today = saToday();
  const weekEnd = addDays(today, 7);
  const grouped: Record<Group, AdminCase[]> = { soon: [], drafts: [], upcoming: [], past: [] };
  for (const c of memorials) grouped[groupOf(c, today, weekEnd)].push(c);
  const byDate = (a: AdminCase, b: AdminCase) => (a.funeralDate ?? '9999').localeCompare(b.funeralDate ?? '9999');
  grouped.soon.sort(byDate);
  grouped.upcoming.sort(byDate);
  grouped.drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  grouped.past.sort((a, b) => byDate(b, a));
  const waitingToPublish = memorials.filter((c) => c.status === 'DRAFT');
  const openLinks = families.filter((f) => f.state === 'open');

  return (
    <>
      <SiteHeader />
      <main className="container">
        {sp.welcome && (
          <div className="note ok" style={{ marginTop: 24 }}>
            <span>
              <strong>Welcome to Memora Pro.</strong> {org.name} is set up and you’re its owner. Next: add your team, then send your first family a link.
            </span>
          </div>
        )}
        <div className="page-head">
          <div className="pro-org-head">
            {org.logoUrl ? <img src={org.logoUrl} alt="" /> : <span className="cc-org-mono" style={org.brandColour ? { background: org.brandColour } : undefined}>{org.name.slice(0, 1)}</span>}
            <div>
              <span className="eyebrow">
                Memora Pro · {plan.name} plan{org.status === 'trial' ? ' · Trial' : org.status === 'disabled' ? ' · Switched off' : ''} · You: {youAre}
              </span>
              <h1 className="h1" style={{ marginTop: 6 }}>
                {org.name}
              </h1>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {can(p, 'ops.view') && (
              <Link className="btn" href={`/admin?tab=homes#${org.id}`}>
                ← Command centre
              </Link>
            )}
            {live && can(p, 'org.memorials.create', org.id) && <NewHomeMemorial orgId={org.id} name={org.name} />}
          </div>
        </div>
        {allOrgs.length > 1 && (
          <nav className="row pro-homes" aria-label="Funeral homes">
            {allOrgs.map((o) => (
              <Link key={o.id} className={`chip${o.id === org.id ? ' on' : ''}`} href={`/pro/dashboard?home=${o.id}&tab=${tab}`}>
                {o.name}
              </Link>
            ))}
          </nav>
        )}
        {!live && (
          <div className="note warn" style={{ marginBottom: 16 }}>
            <span>This funeral home’s Memora is switched off. Published memorials stay up. Contact Memora to switch it back on.</span>
          </div>
        )}
        <nav className="admin-tabs" aria-label="Funeral home sections">
          {tabs.map(([t, label]) => (
            <Link key={t} href={href(t)} aria-current={t === tab ? 'page' : undefined}>
              {label}
              {t === 'funerals' && grouped.soon.length > 0 && <span className="tab-count">{grouped.soon.length}</span>}
            </Link>
          ))}
        </nav>

        {tab === 'today' && (
          <>
            <div className="stat-row" style={{ marginBottom: 20 }}>
              <div className="stat">
                <span>Funerals this week</span>
                <strong>{grouped.soon.length}</strong>
              </div>
              <div className="stat">
                <span>Being prepared</span>
                <strong>{waitingToPublish.length}</strong>
              </div>
              <div className="stat">
                <span>Published this month</span>
                <strong>{org.publishedThisMonth}</strong>
              </div>
              {can(p, 'org.billing.view', org.id) && (
                <div className="stat">
                  <span>This month so far (excl. VAT)</span>
                  <strong>{org.status === 'trial' ? 'Trial' : formatMoney(bill.total)}</strong>
                </div>
              )}
            </div>
            <FuneralSection title="This week" hint="Funerals in the next seven days. Get the run-sheet link to run the day." rows={grouped.soon} empty="No funerals in the next seven days." />
            {can(p, 'org.memorials.publish', org.id) && (
              <FuneralSection title="Waiting to be published" hint="Check each one, then publish. Publishing is billed to the funeral home." rows={waitingToPublish} empty="Nothing waiting." />
            )}
            {can(p, 'org.memorials.create', org.id) && (
              <section className="card" style={{ marginBottom: 20 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <h2 className="h3">Family links</h2>
                    <p className="small muted">{openLinks.length ? `${openLinks.length} sent and not used yet.` : 'Let a family fill in the memorial themselves, from their own phone.'}</p>
                  </div>
                  <Link className="btn" href={href('families')}>
                    Send a family a link
                  </Link>
                </div>
              </section>
            )}
          </>
        )}

        {tab === 'funerals' &&
          (memorials.length === 0 ? (
            <p className="muted">No memorials yet. Start one above, or send a family a link.</p>
          ) : (
            (['soon', 'drafts', 'upcoming', 'past'] as Group[]).map((g) => <FuneralSection key={g} title={GROUP_TITLE[g][0]} hint={GROUP_TITLE[g][1]} rows={grouped[g]} empty="" />)
          ))}

        {tab === 'families' && (
          <>
            <section className="card" style={{ marginBottom: 20 }}>
              <h2 className="h3">Send a family a link</h2>
              <p className="small muted">
                The family opens it on their phone, makes an account with their number, and fills in the memorial: photo, story, programme. It belongs to {org.name}: your
                staff can edit it, and a director publishes and runs it. The family pays nothing. Each link works once, for 30 days.
              </p>
              {live && (
                <ActionForm
                  endpoint={SELF}
                  action="invite.create"
                  extra={{ kind: 'family', orgId: org.id }}
                  reset
                  compact
                  submit="Make the link"
                  fields={[{ name: 'label', label: 'Who is it for?', type: 'text', required: true, placeholder: 'e.g. Khumalo family', hint: 'Only your team sees this.' }]}
                />
              )}
            </section>
            <section className="card" style={{ marginBottom: 64 }}>
              <h2 className="h3">Links you’ve sent</h2>
              <InviteList invites={families} endpoint={SELF} from={org.name} empty="No links yet." />
            </section>
          </>
        )}

        {tab === 'team' && (
          <section style={{ marginBottom: 64 }}>
            <p className="small muted" style={{ marginTop: 0 }}>
              People join a group; the group’s role decides what they can do. They need a Memora account first (their cellphone number). See “Who can do what” for each role.
            </p>
            <div className="cc-groups">
              {groups.map((g) => {
                const manage = live && g.roles.every((r) => canGrantRole(p, r, org.id));
                return (
                  <article key={g.id} className="card cc-group">
                    <header className="cc-group-head">
                      <h3 className="h4">{g.name}</h3>
                      <div className="cc-roles">
                        {g.roles.map((r) => (
                          <span key={r} className="pill" title={ROLES[r].summary}>
                            {ROLES[r].label}
                          </span>
                        ))}
                      </div>
                    </header>
                    <p className="small muted">{g.description}</p>
                    <ul className="cc-members">
                      {g.members.length === 0 && <li className="muted small">No one yet.</li>}
                      {g.members.map((m) => (
                        <li key={m.userId}>
                          <span>
                            <strong>{m.name || m.label}</strong>
                            {m.name && <span className="muted small"> · {m.label}</span>}
                            {m.userId === access.user.id && <span className="muted small"> · you</span>}
                          </span>
                          {manage && m.userId !== access.user.id && (
                            <AdminAction endpoint={SELF} action="group.removeMember" extra={{ groupId: g.id, userId: m.userId }} label="Remove" variant="ghost" confirm={`Remove ${m.name || m.label}?`} />
                          )}
                        </li>
                      ))}
                    </ul>
                    {manage && (
                      <ActionForm
                        endpoint={SELF}
                        action="group.addMember"
                        extra={{ groupId: g.id }}
                        compact
                        reset
                        submit="Add"
                        fields={[{ name: 'who', label: 'Their cellphone number', type: 'tel', placeholder: '072 123 4567', hint: 'They create a Memora account first.' }]}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'roles' && (
          <section style={{ marginBottom: 64 }}>
            <p className="small muted" style={{ marginTop: 0 }}>
              Everyone in {org.name} gets a role through their group. A role is a set of things they can do, and anything not listed is not allowed. Nobody sees another funeral home.
            </p>
            <div className="cc-role-grid">
              {ORG_ROLES.map((r) => (
                <RoleCard key={r} role={r} yours={myRoles.includes(r)} />
              ))}
            </div>
          </section>
        )}

        {tab === 'branding' && (
          <section className="card" style={{ marginBottom: 64 }}>
            <h2 className="h3">Branding</h2>
            <p className="small muted">Your logo and colour appear on your memorials: “Arranged with care by {org.name}”.</p>
            <ActionForm
              endpoint={SELF}
              action="org.brand"
              extra={{ id: org.id }}
              submit="Save branding"
              fields={[
                { name: 'logoUrl', label: 'Logo (https link to a PNG or SVG)', type: 'text', value: org.logoUrl },
                { name: 'brandColour', label: 'Colour', type: 'text', value: org.brandColour, placeholder: '#5B3E8C' },
              ]}
            />
          </section>
        )}

        {tab === 'billing' && (
          <section className="card" style={{ marginBottom: 64 }}>
            <h2 className="h3">Plan and invoices</h2>
            <p className="small muted">
              {plan.name} plan: {org.monthlyFeeMinor ? `${formatMoney(org.monthlyFeeMinor)} per month + ` : ''}
              {formatMoney(org.perMemorialMinor)} per published memorial, excl. VAT.
              {org.status === 'trial' ? ' You’re in your trial: nothing is billed yet.' : ''} To change plan, contact Memora.
            </p>
            {invoices.length === 0 ? (
              <p className="muted small">No invoices yet.</p>
            ) : (
              invoices.map((i) => (
                <div className="kv" key={i.id}>
                  <span>{i.period}</span>
                  <span>
                    {formatMoney(i.amountMinor)} · {i.memorials} memorial{i.memorials === 1 ? '' : 's'} · <span className="muted">{i.status.toLowerCase()}</span>
                  </span>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </>
  );

  function FuneralSection({ title, hint, rows, empty }: { title: string; hint: string; rows: AdminCase[]; empty: string }) {
    if (!rows.length && !empty) return null;
    return (
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 className="h3">
          {title} <span className="muted small">{rows.length || ''}</span>
        </h2>
        <p className="small muted" style={{ margin: '4px 0 12px' }}>
          {hint}
        </p>
        {rows.length === 0 ? (
          <p className="muted small">{empty}</p>
        ) : (
          <div className="board-wrap">
            <table className="board">
              <thead>
                <tr>
                  <th>Memorial</th>
                  <th>Funeral</th>
                  <th>Status</th>
                  <th>Made by</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const own = c.ownerEmail.toLowerCase() === access!.user.email.toLowerCase();
                  const family = fromLink.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <span className="sub">updated {fmtDate(c.updatedAt.slice(0, 10))}</span>
                      </td>
                      <td>
                        {c.funeralDate ? fmtDate(c.funeralDate) : '—'}
                        {c.funeralDate === today && <span className="sub">today</span>}
                      </td>
                      <td>{c.status === 'PUBLISHED' ? 'Live' : c.status === 'ARCHIVED' ? 'Closed' : 'Draft'}</td>
                      <td>
                        {own ? 'You' : family ? 'The family' : accountLabel(c.ownerEmail) || '—'}
                        {family && <span className="sub">{family}</span>}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {(own || edits) && (
                            <Link className="btn sm" href={`/memorials/${c.id}`}>
                              {c.status === 'DRAFT' ? 'Open' : 'Edit'}
                            </Link>
                          )}
                          {c.status === 'PUBLISHED' && c.slug && (
                            <a className="btn sm" href={`/m/${c.slug}`} target="_blank" rel="noopener noreferrer">
                              View ↗
                            </a>
                          )}
                          {c.status === 'DRAFT' && live && can(p, 'org.memorials.publish', org.id) && <PublishForHome caseId={c.id} />}
                          {c.status === 'PUBLISHED' && live && can(p, 'org.runsheet', org.id) && <RunSheetFor caseId={c.id} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }
}
