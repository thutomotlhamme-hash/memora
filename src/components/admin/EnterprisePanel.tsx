import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ALL_MODULES, BLUEPRINTS, CONTRACT_STATUS, MODULES, SLA_TIERS, SUPPORT_LEVELS, isBlueprint, type Blueprint, type ContractStatus } from '@/lib/enterprise';
import { fmtDate } from '@/lib/memorial';
import { formatMoney, proInvoice } from '@/lib/plans';
import { can, type Principal } from '@/lib/rbac';
import { loadAccounts } from '@/lib/server/enterprise';
import { ActionForm } from './ActionForm';
import { AdminAction } from './AdminAction';

const R = (minor: number) => formatMoney(minor);
const when = (iso: string | null | undefined) => (iso ? fmtDate(String(iso).slice(0, 10)) : '—');
const rands = (minor: number) => String(minor / 100);

/**
 * Memora's side of Enterprise: create a group in one go from a blueprint, then
 * look after its contract, status and modules. No SQL, no code per customer.
 */
export async function EnterprisePanel({ admin, p, bp }: { admin: SupabaseClient; p: Principal; bp?: string }) {
  const provision = can(p, 'accounts.manage') && can(p, 'orgs.billing');
  const manage = can(p, 'accounts.manage');
  const billing = can(p, 'orgs.billing');
  const accounts = await loadAccounts(admin);
  const chosen: Blueprint = isBlueprint(bp) ? bp : 'standard';
  const b = BLUEPRINTS[chosen];

  return (
    <>
      <p className="lede" style={{ marginTop: 0 }}>
        Enterprise is Memora as the operating layer for a funeral group: regions, homes and branches, head-office roles, central brand and templates, group reporting, and one
        contract. Every group runs on the same product, set up from a blueprint.
      </p>

      {provision ? (
        <section className="card cc-provision" id="create">
          <header className="cc-provision-head">
            <div>
              <span className="eyebrow plain">Create Enterprise account</span>
              <h2 className="h3">Start from a blueprint</h2>
            </div>
            <span className="muted small">It sets sensible modules, brand locks and terms. Change anything below before you create.</span>
          </header>
          <div className="cc-blueprints" role="list">
            {(Object.keys(BLUEPRINTS) as Blueprint[]).map((k) => (
              <Link key={k} role="listitem" href={`/admin?tab=enterprise&bp=${k}#create`} className={`cc-blueprint${k === chosen ? ' on' : ''}`} aria-current={k === chosen ? 'true' : undefined}>
                <strong>{BLUEPRINTS[k].label}</strong>
                <span>{BLUEPRINTS[k].summary}</span>
              </Link>
            ))}
          </div>
          <ActionForm
            key={chosen}
            action="account.provision"
            extra={{ blueprint: chosen }}
            reset
            submit="Create Enterprise"
            confirm="Create this Enterprise account now? Its homes, branches, teams and invites are made straight away."
            fields={[
              { name: 'h1', type: 'heading', label: '1 · The group', hint: 'Who they are and who looks after them.' },
              { name: 'name', label: 'Group name', type: 'text', required: true, placeholder: 'e.g. Motheo Funeral Group' },
              { name: 'primaryContact', label: 'Primary contact', type: 'text', placeholder: 'Name · number' },
              { name: 'billingContact', label: 'Billing contact', type: 'text', placeholder: 'Name · email' },
              { name: 'commercialContact', label: 'Commercial contact', type: 'text', placeholder: 'Name · number' },
              { name: 'accountManager', label: 'Account manager (Memora)', type: 'text' },
              { name: 'status', label: 'Status', type: 'select', value: 'onboarding', options: (Object.keys(CONTRACT_STATUS) as ContractStatus[]).filter((s) => s !== 'closed' && s !== 'suspended').map((s) => ({ value: s, label: `${CONTRACT_STATUS[s].label} — ${CONTRACT_STATUS[s].hint}` })) },
              { name: 'h2', type: 'heading', label: '2 · The contract', hint: 'Excluding VAT. Allowances reset monthly; only published memorials count.' },
              { name: 'monthly', label: 'Monthly fee (R)', type: 'money', value: rands(b.terms.monthlyFeeMinor) },
              { name: 'included', label: 'Memorials included / month', type: 'text', value: String(b.terms.includedMemorials) },
              { name: 'perMemorial', label: 'Each additional memorial (R)', type: 'money', value: rands(b.terms.perMemorialMinor) },
              { name: 'onboarding', label: 'Onboarding fee (R)', type: 'money', value: rands(b.terms.onboardingFeeMinor) },
              { name: 'branchAllowance', label: 'Branch allowance (blank = unlimited)', type: 'text', value: b.terms.branchAllowance ? String(b.terms.branchAllowance) : '' },
              { name: 'contractStart', label: 'Contract starts', type: 'date' },
              { name: 'renewalDate', label: 'Renewal date', type: 'date' },
              { name: 'contractEnd', label: 'Contract ends', type: 'date' },
              { name: 'slaTier', label: 'SLA tier', type: 'select', value: 'priority', options: Object.entries(SLA_TIERS).map(([value, label]) => ({ value, label })) },
              { name: 'supportLevel', label: 'Support', type: 'select', value: 'extended', options: Object.entries(SUPPORT_LEVELS).map(([value, label]) => ({ value, label })) },
              { name: 'h3', type: 'heading', label: '3 · Structure', hint: 'One branch per line. Regions are optional.' },
              {
                name: 'structure',
                label: 'Branches',
                type: 'textarea',
                rows: 7,
                required: true,
                placeholder: 'Gauteng > Motheo Pretoria > Pretoria Central\nGauteng > Motheo Pretoria > Centurion\nGauteng > Motheo Soweto > Soweto\nNorth West > Motheo North West > Mahikeng | Mahikeng CBD\nNorth West > Motheo North West > Rustenburg',
                hint: '“Region > Home > Branch”, “Home > Branch”, or just “Branch” (a home named after the group). Add “| area” for the address area.',
              },
              { name: 'regionKind', label: 'Regions are called', type: 'select', value: b.regionKind, options: ['region', 'province', 'district', 'brand', 'division'].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) + 's' })) },
              { name: 'h4', type: 'heading', label: '4 · Brand', hint: 'The master brand. Upload a logo later from the group’s Brand page if you don’t have a link.' },
              { name: 'logoUrl', label: 'Logo (https link, optional)', type: 'text' },
              { name: 'brandColour', label: 'Brand colour', type: 'text', placeholder: '#5B3E8C' },
              { name: 'brandFooter', label: 'Memorial footer line', type: 'text', placeholder: 'e.g. A Motheo Funeral Group home' },
              { name: 'h5', type: 'heading', label: '5 · People', hint: 'Head office’s first administrators. People with an account are added now; everyone else gets a one-time link.' },
              { name: 'admins', label: 'Group administrators', type: 'textarea', rows: 3, placeholder: '082 123 4567\nthandi@motheo.co.za' },
              { name: 'h6', type: 'heading', label: '6 · Modules', hint: 'What this agreement includes. Change it any time.' },
              {
                name: 'modules',
                label: 'Enterprise modules',
                type: 'multi',
                value: b.modules,
                options: ALL_MODULES.map((m) => ({ value: m, label: MODULES[m].label + (MODULES[m].ready ? '' : ' · coming'), hint: MODULES[m].hint })),
              },
              { name: 'notes', label: 'Notes (only Memora sees these)', type: 'text' },
            ]}
          />
        </section>
      ) : (
        <p className="muted small">Creating Enterprise accounts needs both Operations and Finance rights.</p>
      )}

      <h2 className="h3 cc-h">Enterprise groups</h2>
      {accounts.length === 0 && <p className="muted">No Enterprise groups yet.</p>}
      <div className="cc-orgs">
        {accounts.map((a) => {
          const inv = proInvoice(a, a.publishedThisMonth, false);
          const pct = a.includedMemorials ? Math.min(100, Math.round((a.publishedThisMonth / a.includedMemorials) * 100)) : 0;
          return (
            <article key={a.id} className={`card cc-org cc-account status-${a.status}`}>
              <header className="cc-org-head">
                <div className="cc-org-title">
                  {a.logoUrl ? <img src={a.logoUrl} alt="" /> : <span className="cc-org-mono" style={a.brandColour ? { background: a.brandColour } : undefined}>{a.name.slice(0, 1)}</span>}
                  <div>
                    <h3 className="h4">{a.name}</h3>
                    <span className="muted small">
                      {BLUEPRINTS[a.blueprint].label} · {a.homes} home{a.homes === 1 ? '' : 's'} · {a.branches} branch{a.branches === 1 ? '' : 'es'}
                      {a.branchAllowance ? ` of ${a.branchAllowance}` : ''}
                    </span>
                  </div>
                </div>
                <span className={`pill cc-status ${a.status}`}>{CONTRACT_STATUS[a.status].label}</span>
              </header>
              <div className="cc-allowance" aria-label={`${a.publishedThisMonth} of ${a.includedMemorials} included memorials used this month`}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="cc-org-facts">
                <div>
                  <span>This month</span>
                  <strong>
                    {a.publishedThisMonth} of {a.includedMemorials} included{inv.overageMemorials ? ` · ${inv.overageMemorials} extra` : ''}
                  </strong>
                </div>
                <div>
                  <span>Estimated invoice</span>
                  <strong>{CONTRACT_STATUS[a.status].billed ? R(inv.subtotal) : 'Not billed'}</strong>
                </div>
                <div>
                  <span>Terms</span>
                  <strong>
                    {R(a.monthlyFeeMinor)}/mo · {R(a.perMemorialMinor)} extra
                  </strong>
                </div>
                <div>
                  <span>Contract</span>
                  <strong>{a.contractStart ? `${when(a.contractStart)} → ${when(a.contractEnd)}` : 'Dates not set'}</strong>
                </div>
                <div>
                  <span>Renewal</span>
                  <strong>{when(a.renewalDate)}</strong>
                </div>
                <div>
                  <span>Service</span>
                  <strong>
                    {SLA_TIERS[a.slaTier]} · {SUPPORT_LEVELS[a.supportLevel].split(' (')[0]}
                  </strong>
                </div>
                <div>
                  <span>Account manager</span>
                  <strong>{a.accountManager || '—'}</strong>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Link className="btn sm primary" href={`/pro/group?account=${a.id}`}>
                  Open control centre
                </Link>
                {manage && a.status !== 'active' && a.status !== 'closed' && <AdminAction action="account.setStatus" extra={{ accountId: a.id, status: 'active' }} label="Make active" confirm={`Make ${a.name} active? Billing applies from this month.`} />}
                {manage && a.status !== 'suspended' && a.status !== 'closed' && (
                  <AdminAction
                    action="account.setStatus"
                    extra={{ accountId: a.id, status: 'suspended' }}
                    label="Suspend"
                    variant="danger"
                    prompt={{ field: 'reason', question: `Why is ${a.name} being suspended? (kept in the audit log)` }}
                    confirm="Their staff lose access at once. Published memorials stay up for families. Continue?"
                  />
                )}
              </div>
              {(manage || billing) && (
                <details className="cc-edit">
                  <summary>Contract, modules and details</summary>
                  <div className="cc-edit-grid">
                    {billing && (
                      <ActionForm
                        action="account.contract"
                        extra={{ accountId: a.id }}
                        submit="Save contract"
                        fields={[
                          { name: 'monthly', label: 'Monthly fee (R)', type: 'money', value: rands(a.monthlyFeeMinor) },
                          { name: 'included', label: 'Included / month', type: 'text', value: String(a.includedMemorials) },
                          { name: 'perMemorial', label: 'Each additional (R)', type: 'money', value: rands(a.perMemorialMinor) },
                          { name: 'onboarding', label: 'Onboarding (R)', type: 'money', value: rands(a.onboardingFeeMinor) },
                          { name: 'onboardingPaid', label: 'Onboarding paid', type: 'checkbox', value: a.onboardingPaid },
                          { name: 'branchAllowance', label: 'Branch allowance (blank = unlimited)', type: 'text', value: a.branchAllowance ? String(a.branchAllowance) : '' },
                          { name: 'contractStart', label: 'Starts', type: 'date', value: a.contractStart ?? '' },
                          { name: 'renewalDate', label: 'Renewal', type: 'date', value: a.renewalDate ?? '' },
                          { name: 'contractEnd', label: 'Ends', type: 'date', value: a.contractEnd ?? '' },
                          { name: 'slaTier', label: 'SLA tier', type: 'select', value: a.slaTier, options: Object.entries(SLA_TIERS).map(([value, label]) => ({ value, label })) },
                          { name: 'supportLevel', label: 'Support', type: 'select', value: a.supportLevel, options: Object.entries(SUPPORT_LEVELS).map(([value, label]) => ({ value, label })) },
                        ]}
                      />
                    )}
                    {manage && (
                      <ActionForm
                        action="account.modules"
                        extra={{ accountId: a.id }}
                        submit="Save modules"
                        fields={[{ name: 'modules', label: 'Modules', type: 'multi', value: a.modules, options: ALL_MODULES.map((m) => ({ value: m, label: MODULES[m].label + (MODULES[m].ready ? '' : ' · coming'), hint: MODULES[m].hint })) }]}
                      />
                    )}
                    {manage && (
                      <ActionForm
                        action="account.update"
                        extra={{ accountId: a.id }}
                        submit="Save details"
                        fields={[
                          { name: 'name', label: 'Name', type: 'text', value: a.name },
                          { name: 'primaryContact', label: 'Primary contact', type: 'text', value: a.primaryContact },
                          { name: 'billingContact', label: 'Billing contact', type: 'text', value: a.billingContact },
                          { name: 'commercialContact', label: 'Commercial contact', type: 'text', value: a.commercialContact },
                          { name: 'accountManager', label: 'Account manager', type: 'text', value: a.accountManager },
                          { name: 'notes', label: 'Notes', type: 'text', value: a.notes },
                        ]}
                      />
                    )}
                    {billing && (
                      <ActionForm
                        action="account.adjust"
                        extra={{ accountId: a.id }}
                        reset
                        submit="Record credit or charge"
                        fields={[
                          { name: 'kind', label: 'Kind', type: 'select', value: 'credit', options: [{ value: 'credit', label: 'Credit' }, { value: 'charge', label: 'Extra charge' }] },
                          { name: 'amount', label: 'Amount (R, excl. VAT)', type: 'money', value: '' },
                          { name: 'reason', label: 'Reason', type: 'text' },
                        ]}
                      />
                    )}
                    {manage && a.status !== 'closed' && (
                      <AdminAction
                        action="account.setStatus"
                        extra={{ accountId: a.id, status: 'ending' }}
                        label="Notice given (ending)"
                        confirm={`Mark ${a.name} as ending? It keeps working and being billed until the end date.`}
                      />
                    )}
                    {manage && a.status !== 'closed' && (
                      <AdminAction
                        action="account.setStatus"
                        extra={{ accountId: a.id, status: 'closed' }}
                        label="Close the account"
                        variant="danger"
                        prompt={{ field: 'reason', question: `Why is ${a.name} closing? (kept in the audit log)` }}
                        confirm="Staff lose access. Published memorials stay up until they expire. Continue?"
                      />
                    )}
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
