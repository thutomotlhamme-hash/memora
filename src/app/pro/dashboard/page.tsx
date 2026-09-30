import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/admin/ActionForm';
import { AdminAction } from '@/components/admin/AdminAction';
import { StatusScreen } from '@/components/MemorialView';
import { NewHomeMemorial, PublishForHome, RunSheetFor } from '@/components/pro/ProButtons';
import { SiteHeader } from '@/components/SiteHeader';
import { accountLabel } from '@/lib/account-id';
import { fmtDate } from '@/lib/memorial';
import { PRO_PLANS, formatMoney, proInvoice } from '@/lib/plans';
import { ROLES, can, canGrantRole, orgsOf } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { loadAdminCases } from '@/lib/server/admin';
import { loadGroups, loadInvoices, loadOrgs } from '@/lib/server/pro';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Funeral home', robots: { index: false } };

const SELF = '/api/pro/actions';

/** A funeral home's own view: its memorials, its people and its bill, each shown only as far as the viewer's role allows. */
export default async function ProDashboard({ searchParams }: { searchParams: Promise<{ home?: string }> }) {
  const access = await getAccess();
  const admin = getAdminSupabase();
  if (!admin) return <StatusScreen eyebrow="Memora Pro" title="Not switched on yet." body="The site owner needs to finish setup." />;
  if (!access) redirect('/account/login?next=/pro/dashboard');
  const p = access.principal;

  // Staff see their own homes; Memora support roles can open any home to help.
  const mine = orgsOf(p);
  const allOrgs = p.anyOrg.has('org.view') ? await loadOrgs(admin) : await loadOrgs(admin, mine);
  if (!allOrgs.length) {
    return (
      <StatusScreen
        eyebrow="Memora Pro"
        title="You’re not part of a funeral home yet."
        body={`You’re signed in as ${accountLabel(access.user.email)}. Ask your funeral home’s owner or manager to add this number or email to their team.`}
        action={
          <Link className="btn" href="/pro">
            About Memora Pro
          </Link>
        }
      />
    );
  }
  const requested = (await searchParams).home;
  const org = allOrgs.find((o) => o.id === requested) ?? allOrgs[0];
  if (!can(p, 'org.view', org.id)) redirect('/pro/dashboard');

  const [{ data: links }, cases, groups, invoices] = await Promise.all([
    admin.from('memora_cases').select('id').eq('org_id', org.id),
    loadAdminCases(admin),
    loadGroups(admin, org.id),
    can(p, 'org.billing.view', org.id) ? loadInvoices(admin, org.id) : Promise.resolve([]),
  ]);
  const ids = new Set(((links ?? []) as { id: string }[]).map((l) => l.id));
  const memorials = cases.filter((c) => ids.has(c.id));
  const bill = proInvoice(org, org.publishedThisMonth, false);
  const plan = PRO_PLANS[org.plan];

  return (
    <>
      <SiteHeader />
      <main className="container">
        <div className="page-head">
          <div className="pro-org-head">
            {org.logoUrl ? <img src={org.logoUrl} alt="" /> : <span className="cc-org-mono" style={org.brandColour ? { background: org.brandColour } : undefined}>{org.name.slice(0, 1)}</span>}
            <div>
              <span className="eyebrow">
                Memora Pro · {plan.name}
                {org.status === 'trial' ? ' · Trial' : org.status === 'disabled' ? ' · Switched off' : ''}
              </span>
              <h1 className="h1" style={{ marginTop: 6 }}>
                {org.name}
              </h1>
            </div>
          </div>
          {allOrgs.length > 1 && (
            <nav className="row" aria-label="Funeral homes" style={{ gap: 6 }}>
              {allOrgs.map((o) => (
                <Link key={o.id} className={`chip${o.id === org.id ? ' on' : ''}`} href={`/pro/dashboard?home=${o.id}`}>
                  {o.name}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {org.status === 'disabled' && (
          <div className="note warn" style={{ marginBottom: 16 }}>
            <span>This funeral home’s Memora is switched off. Published memorials stay up. Contact Memora to switch it back on.</span>
          </div>
        )}

        <div className="stat-row" style={{ marginBottom: 20 }}>
          <div className="stat">
            <span>Memorials</span>
            <strong>{org.memorials}</strong>
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

        <section className="card" style={{ marginBottom: 20 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="h3">Funerals</h2>
            {org.status !== 'disabled' && can(p, 'org.memorials.create', org.id) && <NewHomeMemorial orgId={org.id} name={org.name} />}
          </div>
          <div className="board-wrap" style={{ marginTop: 12 }}>
            <table className="board">
              <thead>
                <tr>
                  <th>Memorial</th>
                  <th>Funeral</th>
                  <th>Status</th>
                  <th>Prepared by</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {memorials.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No memorials yet.
                    </td>
                  </tr>
                )}
                {memorials.map((c) => {
                  const own = c.ownerEmail.toLowerCase() === access.user.email.toLowerCase();
                  return (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <span className="sub">updated {fmtDate(c.updatedAt.slice(0, 10))}</span>
                      </td>
                      <td>{c.funeralDate ? fmtDate(c.funeralDate) : '—'}</td>
                      <td>{c.status === 'PUBLISHED' ? 'Live' : c.status === 'ARCHIVED' ? 'Closed' : 'Draft'}</td>
                      <td>{own ? 'You' : accountLabel(c.ownerEmail) || '—'}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {own && (
                            <Link className="btn sm" href={`/memorials/${c.id}`}>
                              Open
                            </Link>
                          )}
                          {c.status === 'PUBLISHED' && c.slug && (
                            <a className="btn sm" href={`/m/${c.slug}`} target="_blank" rel="noopener noreferrer">
                              View ↗
                            </a>
                          )}
                          {c.status === 'DRAFT' && org.status !== 'disabled' && can(p, 'org.memorials.publish', org.id) && <PublishForHome caseId={c.id} />}
                          {c.status === 'PUBLISHED' && org.status !== 'disabled' && can(p, 'org.runsheet', org.id) && <RunSheetFor caseId={c.id} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 className="h3 cc-h" style={{ marginTop: 0 }}>
            Your team
          </h2>
          <div className="cc-groups">
            {groups.map((g) => {
              const manage = g.roles.every((r) => canGrantRole(p, r, org.id));
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
                  <ul className="cc-members">
                    {g.members.length === 0 && <li className="muted small">No one yet.</li>}
                    {g.members.map((m) => (
                      <li key={m.userId}>
                        <span>
                          <strong>{m.name || m.label}</strong>
                          {m.name && <span className="muted small"> · {m.label}</span>}
                        </span>
                        {manage && m.userId !== access.user.id && (
                          <AdminAction endpoint={SELF} action="group.removeMember" extra={{ groupId: g.id, userId: m.userId }} label="Remove" variant="ghost" confirm={`Remove ${m.name || m.label}?`} />
                        )}
                      </li>
                    ))}
                  </ul>
                  {manage && org.status !== 'disabled' && (
                    <ActionForm
                      endpoint={SELF}
                      action="group.addMember"
                      extra={{ groupId: g.id }}
                      compact
                      reset
                      submit="Add"
                      fields={[{ name: 'who', label: 'Cellphone number or email', type: 'text', placeholder: '072 123 4567', hint: 'They create a Memora account first.' }]}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {can(p, 'org.branding', org.id) && (
          <section className="card" style={{ marginBottom: 20 }}>
            <h2 className="h3">Branding</h2>
            <p className="small muted">Your logo and colour appear on your memorials, programme booklets and QR cards.</p>
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

        {can(p, 'org.billing.view', org.id) && (
          <section className="card" style={{ marginBottom: 64 }}>
            <h2 className="h3">Plan and invoices</h2>
            <p className="small muted">
              {plan.name}: {org.monthlyFeeMinor ? `${formatMoney(org.monthlyFeeMinor)} per month + ` : ''}
              {formatMoney(org.perMemorialMinor)} per published memorial, excl. VAT. To change plan, contact Memora.
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
}
