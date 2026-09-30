import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fmtDate } from '@/lib/memorial';
import { PRO_PLANS, formatMoney, periodOf, planLabel, proInvoice, type ProPlan } from '@/lib/plans';
import { ALL_ROLES, BRANCH_ROLES, PERMISSIONS, ROLES, can, canGrantRole, roleGrants, type Principal, type Role } from '@/lib/rbac';
import { loadAudit, loadBranches, loadGroups, loadInvoices, loadOrgs, type Group, type Org } from '@/lib/server/pro';
import { loadInvites } from '@/lib/server/invites';
import { InviteList } from '@/components/pro/InviteList';
import { ActionForm } from './ActionForm';
import { AdminAction } from './AdminAction';

const R = (minor: number) => formatMoney(minor);
const when = (iso: string | null | undefined) => (iso ? fmtDate(String(iso).slice(0, 10)) : '—');
const PLAN_OPTIONS = (Object.keys(PRO_PLANS) as ProPlan[]).map((p) => ({ value: p, label: planLabel(p) }));
/** Self-serve plans: Enterprise is set up with the Enterprise wizard, never a one-line link. */
const SELF_SERVE_OPTIONS = PLAN_OPTIONS.filter((o) => !PRO_PLANS[o.value].quoted);
const termsLine = (o: Org) =>
  o.monthlyFeeMinor
    ? `${R(o.monthlyFeeMinor)}/mo · ${o.includedMemorials} included · ${R(o.perMemorialMinor)} extra`
    : `${R(o.perMemorialMinor)} per funeral`;
const STATUS_LABEL: Record<Org['status'], string> = { trial: 'Trial', active: 'Active', disabled: 'Disabled' };

// ---------------------------------------------------------------------------
// Funeral homes
// ---------------------------------------------------------------------------

export async function HomesPanel({ admin, p }: { admin: SupabaseClient; p: Principal }) {
  const manage = can(p, 'orgs.manage');
  const [orgs, invites, branches] = await Promise.all([loadOrgs(admin), manage ? loadInvites(admin, 'org') : Promise.resolve([]), loadBranches(admin)]);
  const billing = can(p, 'orgs.billing');
  return (
    <>
      {manage && (
        <section className="card cc-onboard">
          <h2 className="h3">Onboard a funeral home with a link</h2>
          <p className="small muted">
            Make a link and send it on WhatsApp. They open it on a phone or computer, create their account with their cellphone number, fill in their details, and become
            the owner of their funeral home on Memora, in trial. Each link works once, for 14 days.
          </p>
          <ActionForm
            action="invite.create"
            extra={{ kind: 'org' }}
            reset
            compact
            submit="Make onboarding link"
            fields={[
              { name: 'label', label: 'Funeral home (optional)', type: 'text', placeholder: 'e.g. Sizwe Funeral Services', hint: 'Fills in their name for them.' },
              { name: 'plan', label: 'Plan', type: 'select', value: 'pro', options: SELF_SERVE_OPTIONS, hint: 'For a group, franchise or insurer, use Create Enterprise account instead.' },
            ]}
          />
          <InviteList invites={invites.slice(0, 12)} empty="No onboarding links yet." />
        </section>
      )}
      {manage && (
        <details className="card cc-add">
          <summary>
            <strong>+ Add a funeral home yourself</strong>
            <span className="muted small">Starts in trial with its Owners group and a first branch (Managers and Arrangers) ready.</span>
          </summary>
          <ActionForm
            action="org.create"
            reset
            submit="Add funeral home"
            fields={[
              { name: 'name', label: 'Funeral home', type: 'text', required: true, placeholder: 'e.g. Sizwe Funeral Services' },
              { name: 'plan', label: 'Plan', type: 'select', value: 'pro', options: SELF_SERVE_OPTIONS },
              { name: 'contactName', label: 'Contact person', type: 'text' },
              { name: 'contactPhone', label: 'Contact number', type: 'tel', placeholder: '082 123 4567' },
              { name: 'contactEmail', label: 'Contact email', type: 'email' },
            ]}
          />
        </details>
      )}
      {orgs.length === 0 ? (
        <p className="muted">No funeral homes yet.</p>
      ) : (
        <div className="cc-orgs">
          {orgs.map((o) => {
            const inv = proInvoice(o, o.publishedThisMonth, false);
            return (
              <article key={o.id} id={o.id} className={`card cc-org status-${o.status}`}>
                <header className="cc-org-head">
                  <div className="cc-org-title">
                    {o.logoUrl ? <img src={o.logoUrl} alt="" /> : <span className="cc-org-mono" style={o.brandColour ? { background: o.brandColour } : undefined}>{o.name.slice(0, 1)}</span>}
                    <div>
                      <h3 className="h4">{o.name}</h3>
                      <span className="muted small">
                        {PRO_PLANS[o.plan].name} · {o.memorials} memorial{o.memorials === 1 ? '' : 's'} · {o.publishedThisMonth} published this month
                      </span>
                    </div>
                  </div>
                  <span className={`pill cc-status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                </header>
                <div className="cc-org-facts">
                  <div>
                    <span>This month so far</span>
                    <strong>{o.status === 'trial' ? 'Trial: not billed' : R(inv.total)}</strong>
                  </div>
                  <div>
                    <span>Terms</span>
                    <strong>{termsLine(o)}</strong>
                  </div>
                  <div>
                    <span>Used this month</span>
                    <strong>
                      {o.includedMemorials ? `${o.publishedThisMonth} of ${o.includedMemorials} included` : `${o.publishedThisMonth} published`}
                      {inv.overageMemorials ? ` · ${inv.overageMemorials} extra` : ''}
                    </strong>
                  </div>
                  <div>
                    <span>Contract</span>
                    <strong>{o.contractStart ? `${when(o.contractStart)} → ${when(o.contractEnd)}` : 'Not set'}</strong>
                  </div>
                  <div>
                    <span>Branches</span>
                    <strong>
                      {branches
                        .filter((b) => b.orgId === o.id)
                        .map((b) => b.name)
                        .join(', ') || '—'}
                    </strong>
                  </div>
                  <div>
                    <span>Contact</span>
                    <strong>{[o.contactName, o.contactPhone].filter(Boolean).join(' · ') || '—'}</strong>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Link className="btn sm" href={`/pro/dashboard?home=${o.id}`}>
                    Open their dashboard
                  </Link>
                  <Link className="btn sm" href={`/admin?tab=access#org-${o.id}`}>
                    Their people
                  </Link>
                  {manage && o.status !== 'active' && <AdminAction action="org.setStatus" extra={{ id: o.id, status: 'active' }} label="Make active" variant="primary" confirm={`Make ${o.name} active? Billing applies from this month.`} />}
                  {manage && o.status !== 'disabled' && (
                    <AdminAction
                      action="org.setStatus"
                      extra={{ id: o.id, status: 'disabled' }}
                      label="Disable"
                      variant="danger"
                      prompt={{ field: 'reason', question: `Why is ${o.name} being disabled? (kept in the audit log)` }}
                      confirm="Their staff lose access immediately. Published memorials stay up. Continue?"
                    />
                  )}
                </div>
                {(manage || billing) && (
                  <details className="cc-edit">
                    <summary>Edit details{billing ? ', plan and prices' : ''}</summary>
                    <div className="cc-edit-grid">
                      {manage && (
                        <ActionForm
                          action="org.update"
                          extra={{ id: o.id }}
                          submit="Save details"
                          fields={[
                            { name: 'name', label: 'Name', type: 'text', value: o.name },
                            { name: 'contactName', label: 'Contact person', type: 'text', value: o.contactName },
                            { name: 'contactPhone', label: 'Contact number', type: 'tel', value: o.contactPhone },
                            { name: 'contactEmail', label: 'Contact email', type: 'email', value: o.contactEmail },
                            { name: 'logoUrl', label: 'Logo (https link)', type: 'text', value: o.logoUrl, hint: 'Shown on their memorials and keepsakes.' },
                            { name: 'brandColour', label: 'Brand colour', type: 'text', value: o.brandColour, placeholder: '#5B3E8C' },
                            { name: 'notes', label: 'Notes (only Memora sees these)', type: 'text', value: o.notes },
                          ]}
                        />
                      )}
                      {billing && (
                        <ActionForm
                          action="org.setPlan"
                          extra={{ id: o.id }}
                          submit="Save plan"
                          fields={[
                            { name: 'plan', label: 'Plan', type: 'select', value: o.plan, options: PLAN_OPTIONS },
                            { name: 'monthly', label: 'Monthly fee (R)', type: 'money', value: String(o.monthlyFeeMinor / 100) },
                            { name: 'included', label: 'Funerals included each month', type: 'text', value: String(o.includedMemorials) },
                            { name: 'perMemorial', label: 'Each extra funeral (R)', type: 'money', value: String(o.perMemorialMinor / 100), hint: 'Switching plan? Leave these as they are to take the new plan’s list prices.' },
                            { name: 'branches', label: 'Branches allowed', type: 'text', value: String(o.branches) },
                            { name: 'onboarding', label: 'Onboarding fee (R)', type: 'money', value: String(o.onboardingFeeMinor / 100) },
                            { name: 'onboardingPaid', label: 'Onboarding fee paid', type: 'checkbox', value: o.onboardingPaid },
                            { name: 'contractStart', label: 'Contract starts', type: 'date', value: o.contractStart ?? '' },
                            { name: 'contractEnd', label: 'Contract ends', type: 'date', value: o.contractEnd ?? '' },
                          ]}
                        />
                      )}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export async function BillingPanel({ admin }: { admin: SupabaseClient }) {
  const [orgs, invoices] = await Promise.all([loadOrgs(admin), loadInvoices(admin)]);
  const name = new Map(orgs.map((o) => [o.id, o.name]));
  const period = periodOf();
  const active = orgs.filter((o) => o.status === 'active');
  const projected = active.reduce((sum, o) => sum + proInvoice(o, o.publishedThisMonth, false).total, 0);
  const outstanding = invoices.filter((i) => i.status === 'SENT').reduce((s, i) => s + i.amountMinor, 0);
  const paidMonth = invoices.filter((i) => i.status === 'PAID' && i.period === period).reduce((s, i) => s + i.amountMinor, 0);
  return (
    <>
      <div className="stat-row" style={{ marginBottom: 20 }}>
        <div className="stat">
          <span>Active funeral homes</span>
          <strong>{active.length}</strong>
        </div>
        <div className="stat">
          <span>This month so far (excl. VAT)</span>
          <strong>{R(projected)}</strong>
        </div>
        <div className="stat">
          <span>Invoiced, not yet paid</span>
          <strong>{R(outstanding)}</strong>
        </div>
        <div className="stat">
          <span>Paid for {period}</span>
          <strong>{R(paidMonth)}</strong>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="h3">Raise this month’s invoices</h2>
        <p className="small muted">
          One draft per active funeral home: the monthly fee, each published funeral beyond the month’s allowance, any credits or charges, and the onboarding fee
          on a first invoice, plus VAT. Homes in trial aren’t billed. Running it again updates drafts; sent or paid invoices are left alone.
        </p>
        <ActionForm action="invoice.generate" compact submit="Raise invoices" fields={[{ name: 'period', label: 'Month', type: 'text', value: period, placeholder: 'YYYY-MM' }]} />
      </div>
      <details className="card" style={{ marginBottom: 20 }}>
        <summary>
          <strong>Credit or extra charge</strong> <span className="muted small">A goodwill credit, a correction, or a once-off charge, with a reason.</span>
        </summary>
        <ActionForm
          action="billing.adjust"
          reset
          submit="Record it"
          fields={[
            { name: 'orgId', label: 'Funeral home', type: 'select', value: orgs[0]?.id ?? '', options: orgs.map((o) => ({ value: o.id, label: o.name })) },
            { name: 'kind', label: 'Kind', type: 'select', value: 'credit', options: [{ value: 'credit', label: 'Credit (reduces the invoice)' }, { value: 'charge', label: 'Extra charge' }] },
            { name: 'amount', label: 'Amount (R, excl. VAT)', type: 'money', value: '' },
            { name: 'period', label: 'Month', type: 'text', value: period, placeholder: 'YYYY-MM' },
            { name: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'e.g. Duplicate memorial published in error' },
          ]}
        />
      </details>
      <div className="board-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>Funeral home</th>
              <th>Month</th>
              <th>Memorials</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{name.get(i.orgId) ?? '—'}</td>
                <td>{i.period}</td>
                <td>{i.memorials}</td>
                <td>
                  {R(i.amountMinor)}
                  <span className="sub">
                    {i.monthlyFeeMinor ? `${R(i.monthlyFeeMinor)} fee` : 'No fee'}
                    {i.includedMemorials ? ` (${i.includedMemorials} included)` : ''}
                    {i.overageMemorials ? ` + ${i.overageMemorials} × ${R(i.perMemorialMinor)}` : ''}
                    {i.onboardingMinor ? ` + ${R(i.onboardingMinor)} onboarding` : ''}
                    {i.adjustmentsMinor ? ` ${i.adjustmentsMinor < 0 ? '−' : '+'} ${R(Math.abs(i.adjustmentsMinor))} adjustment` : ''}
                    {` · VAT ${R(i.vatMinor)} · ${R(i.amountMinor + i.vatMinor)} incl.`}
                  </span>
                </td>
                <td>{i.status.toLowerCase()}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {i.status === 'DRAFT' && <AdminAction action="invoice.setStatus" extra={{ id: i.id, status: 'SENT' }} label="Mark sent" />}
                    {(i.status === 'SENT' || i.status === 'DRAFT') && <AdminAction action="invoice.setStatus" extra={{ id: i.id, status: 'PAID' }} label="Mark paid" variant="primary" />}
                    {i.status !== 'VOID' && i.status !== 'PAID' && <AdminAction action="invoice.setStatus" extra={{ id: i.id, status: 'VOID' }} label="Void" variant="danger" confirm="Void this invoice?" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Access: groups, people, roles
// ---------------------------------------------------------------------------

function GroupCard({ g, p }: { g: Group; p: Principal }) {
  const manage = g.roles.every((r) => canGrantRole(p, r, g.orgId, g.branchId));
  // Roles that fit where the group sits: Memora's own, home-wide (owners), or a branch's.
  const scopeRoles = !g.orgId ? ALL_ROLES.filter((r) => ROLES[r].scope === 'platform') : g.branchId ? BRANCH_ROLES : (['org_owner'] as Role[]);
  return (
    <article className={`card cc-group${g.active ? '' : ' off'}`}>
      <header className="cc-group-head">
        <div>
          <h3 className="h4">
            {g.name}
            {!g.active && <span className="muted small"> · switched off</span>}
          </h3>
          {g.description && <span className="muted small">{g.description}</span>}
        </div>
        <div className="cc-roles">
          {g.roles.map((r) => (
            <span key={r} className="pill">
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
              <span className="muted small"> · since {when(m.addedAt)}</span>
            </span>
            {manage && <AdminAction action="group.removeMember" extra={{ groupId: g.id, userId: m.userId }} label="Remove" variant="ghost" confirm={`Remove ${m.name || m.label} from ${g.name}?`} />}
          </li>
        ))}
      </ul>
      {manage && (
        <div className="cc-group-actions">
          <ActionForm
            action="group.addMember"
            extra={{ groupId: g.id }}
            compact
            reset
            submit="Add person"
            fields={[{ name: 'who', label: 'Their cellphone number', type: 'text', placeholder: '072 123 4567', hint: 'They need a Memora account first.' }]}
          />
          <details className="cc-edit">
            <summary>Change roles or switch off</summary>
            <ActionForm
              action="group.update"
              extra={{ groupId: g.id }}
              submit="Save group"
              fields={[
                { name: 'name', label: 'Name', type: 'text', value: g.name },
                { name: 'description', label: 'What the group is for', type: 'text', value: g.description },
                {
                  name: 'roles',
                  label: 'Roles',
                  type: 'multi',
                  value: g.roles,
                  options: scopeRoles.map((r) => ({ value: r, label: ROLES[r].label, hint: ROLES[r].summary, disabled: !canGrantRole(p, r, g.orgId, g.branchId) })),
                },
                { name: 'active', label: 'Group is on (off removes its roles from everyone in it)', type: 'checkbox', value: g.active },
              ]}
            />
            <AdminAction action="group.delete" extra={{ groupId: g.id }} label="Delete group" variant="danger" confirm={`Delete ${g.name}? Everyone in it loses its roles.`} />
          </details>
        </div>
      )}
    </article>
  );
}

export async function AccessPanel({ admin, p }: { admin: SupabaseClient; p: Principal }) {
  const [groups, orgs, branches] = await Promise.all([loadGroups(admin), loadOrgs(admin), loadBranches(admin)]);
  const platform = groups.filter((g) => !g.orgId);
  const manage = can(p, 'access.manage');
  const platformRoles = ALL_ROLES.filter((r) => ROLES[r].scope === 'platform');
  return (
    <>
      <p className="lede" style={{ marginTop: 0 }}>
        People join <strong>groups</strong>. Groups hold <strong>roles</strong>. Roles say what someone <strong>can</strong> and <strong>can’t</strong> do. Anything a role
        doesn’t grant is refused. Nobody can give a role with more than they have themselves.
      </p>

      <h2 className="h3 cc-h">Memora team</h2>
      {manage && (
        <details className="card cc-add">
          <summary>
            <strong>+ New Memora group</strong>
          </summary>
          <ActionForm
            action="group.create"
            reset
            submit="Create group"
            fields={[
              { name: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Weekend support' },
              { name: 'description', label: 'What it’s for', type: 'text' },
              { name: 'roles', label: 'Roles', type: 'multi', options: platformRoles.map((r) => ({ value: r, label: ROLES[r].label, hint: ROLES[r].summary, disabled: !canGrantRole(p, r, null) })) },
            ]}
          />
        </details>
      )}
      <div className="cc-groups">
        {platform.map((g) => (
          <GroupCard key={g.id} g={g} p={p} />
        ))}
      </div>

      {orgs.map((o) => {
        const wide = groups.filter((g) => g.orgId === o.id && !g.branchId);
        const bs = branches.filter((b) => b.orgId === o.id);
        return (
          <section key={o.id} id={`org-${o.id}`} className="cc-org-access">
            <header className="cc-mem-head cc-h">
              <h2 className="h3">
                {o.name} <span className="muted small">· {STATUS_LABEL[o.status]} · {bs.length} branch{bs.length === 1 ? '' : 'es'}</span>
              </h2>
              <Link className="btn sm" href={`/pro/dashboard?home=${o.id}&tab=team`}>
                Branches & people
              </Link>
            </header>
            <div className="cc-groups">
              {wide.map((g) => (
                <GroupCard key={g.id} g={{ ...g, name: `${g.name} · whole funeral home` }} p={p} />
              ))}
            </div>
            {bs.map((b) => (
              <div key={b.id} className="cc-branch">
                <h3 className="h4 cc-branch-name">
                  {b.name} <span className="muted small">{b.area}</span>
                </h3>
                <div className="cc-groups">
                  {groups
                    .filter((g) => g.branchId === b.id)
                    .map((g) => (
                      <GroupCard key={g.id} g={g} p={p} />
                    ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      <h2 className="h3 cc-h">Roles: what each can and can’t do</h2>
      <div className="cc-role-grid">
        {ALL_ROLES.map((r) => (
          <RoleCard key={r} role={r} />
        ))}
      </div>
    </>
  );
}

export function RoleCard({ role, yours = false }: { role: Role; yours?: boolean }) {
  const def = ROLES[role];
  return (
    <article className={`card cc-role${yours ? ' yours' : ''}`}>
      <span className="eyebrow plain">
        {def.scope === 'platform' ? 'Memora team' : 'Funeral home'}
        {yours ? ' · You' : ''}
      </span>
      <h3 className="h4">{def.label}</h3>
      <p className="small muted">{def.summary}</p>
      <p className="small cc-for">
        <strong>For:</strong> {def.forWho}
      </p>
      <ul className="cc-cans">
        {roleGrants(role).map((perm) => (
          <li key={perm} className="can">
            {PERMISSIONS[perm].can}
            {PERMISSIONS[perm].scope === 'org' && def.scope === 'platform' ? ' (in every funeral home)' : ''}
          </li>
        ))}
        {def.cannot.map((c) => (
          <li key={c} className="cant">
            {c}
          </li>
        ))}
      </ul>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function AuditPanel({ admin }: { admin: SupabaseClient }) {
  const rows = await loadAudit(admin);
  return (
    <div className="board-wrap">
      <table className="board">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>What</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Nothing recorded yet.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                {when(r.at)}
                <span className="sub">{new Date(r.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })}</span>
              </td>
              <td>{r.actor}</td>
              <td>{r.action}</td>
              <td className="small">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A small picker to move a memorial into (or out of) a funeral home. */
export function AssignHome({ caseId, orgId, orgs }: { caseId: string; orgId: string | null; orgs: { id: string; name: string }[] }) {
  return (
    <div className="cc-assign">
      <ActionForm
        action="org.assignMemorial"
        extra={{ caseId }}
        compact
        submit="Move"
        variant=""
        fields={[{ name: 'orgId', label: 'Funeral home', type: 'select', value: orgId ?? '', options: [{ value: '', label: 'No funeral home' }, ...orgs.map((o) => ({ value: o.id, label: o.name }))] }]}
      />
    </div>
  );
}
