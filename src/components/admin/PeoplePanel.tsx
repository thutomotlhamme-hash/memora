import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fmtDate } from '@/lib/memorial';
import { can, type Principal } from '@/lib/rbac';
import { findAccountId, loadAccount, recentAccounts } from '@/lib/server/accounts';
import { AccountHelp, AdminAction } from './AdminAction';

const when = (iso: string | null | undefined) => (iso ? fmtDate(String(iso).slice(0, 10)) : 'never');
const RESET_STATE = { open: 'Waiting', used: 'Used', expired: 'Expired', revoked: 'Switched off' } as const;

/** Find anyone by number, see what they have, and get them back in (or keep them out). */
export async function PeoplePanel({ admin, p, q, id }: { admin: SupabaseClient; p: Principal; q?: string; id?: string }) {
  const found = id && /^[0-9a-f-]{36}$/i.test(id) ? { id } : q ? await findAccountId(admin, q) : null;
  const [account, recent] = await Promise.all([found ? loadAccount(admin, found.id) : Promise.resolve(null), recentAccounts(admin)]);
  const suspend = can(p, 'accounts.suspend');
  return (
    <>
      <form className="card people-search" action="/admin" method="get">
        <input type="hidden" name="tab" value="people" />
        <label htmlFor="people-q" className="h4">
          Find a person
        </label>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
          <input id="people-q" className="input" name="q" defaultValue={q ?? ''} placeholder="Their cellphone number, e.g. 072 123 4567" inputMode="tel" autoComplete="off" />
          <button className="btn primary" type="submit">
            Find
          </button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Locked out? Check on WhatsApp that it’s really them (ask for the name on their memorial), then send a reset link.
        </p>
      </form>

      {(q || id) && !account && (
        <div className="note warn" style={{ margin: '16px 0' }}>
          <span>No account uses {q ? `“${q}”` : 'that'}. Check the number, or ask them to create their account first.</span>
        </div>
      )}

      {account && (
        <section className="card account-card">
          <header className="cc-mem-head">
            <div>
              <h2 className="h3">
                {account.name || account.label}{' '}
                {account.suspended && <span className="pill cc-status disabled">Suspended</span>}
                {account.owner && <span className="pill">Owner (Netlify)</span>}
              </h2>
              <p className="small muted">
                {account.name ? `${account.label} · ` : ''}joined {when(account.createdAt)} · last logged in {when(account.lastSignInAt)}
              </p>
            </div>
            {account.whatsapp && (
              <a className="btn sm" href={`https://wa.me/${account.whatsapp}`} target="_blank" rel="noopener noreferrer">
                WhatsApp them ↗
              </a>
            )}
          </header>

          <div className="account-grid">
            <div>
              <h3 className="h4">Get them back in</h3>
              {account.suspended ? <p className="small muted">Restore the account first.</p> : <AccountHelp id={account.id} label={account.label} />}
              {account.resets.length > 0 && (
                <ul className="invite-list" style={{ marginTop: 12 }}>
                  {account.resets.map((r) => (
                    <li key={r.id} className={`invite-row ${r.state}`}>
                      <span className="small">Reset link · {when(r.createdAt)}</span>
                      <span className={`pill invite-state ${r.state}`}>{RESET_STATE[r.state]}</span>
                    </li>
                  ))}
                </ul>
              )}
              {account.resets.some((r) => r.state === 'open') && (
                <AdminAction action="account.revokeResetLinks" id={account.id} label="Switch off their reset links" variant="ghost" confirm="Their open reset links stop working. Continue?" />
              )}
            </div>
            <div>
              <h3 className="h4">Memorials</h3>
              {account.memorials.length === 0 ? (
                <p className="small muted">None.</p>
              ) : (
                <ul className="plain-list">
                  {account.memorials.map((m) => (
                    <li key={m.id}>
                      {m.status === 'PUBLISHED' && m.slug ? (
                        <a href={`/m/${m.slug}`} target="_blank" rel="noopener noreferrer">
                          {m.name} ↗
                        </a>
                      ) : (
                        <Link href={`/admin?tab=memorials#${m.id}`}>{m.name}</Link>
                      )}{' '}
                      <span className="muted small">
                        · {m.status === 'PUBLISHED' ? 'live' : m.status === 'ARCHIVED' ? 'closed' : 'draft'}
                        {m.home ? ` · ${m.home}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="h4" style={{ marginTop: 16 }}>
                Access
              </h3>
              {account.access.length === 0 && !account.owner ? (
                <p className="small muted">A family account: no roles.</p>
              ) : (
                <ul className="plain-list">
                  {account.owner && <li>Memora team · Administrator (owner in Netlify)</li>}
                  {account.access.map((a, i) => (
                    <li key={i}>
                      {a.where} · <strong>{a.role}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {suspend && account.id !== p.userId && !account.owner && (
            <footer className="account-danger">
              {account.suspended ? (
                <AdminAction action="account.unsuspend" id={account.id} label="Restore account" variant="primary" confirm={`Let ${account.label} log in again?`} />
              ) : (
                <AdminAction
                  action="account.suspend"
                  id={account.id}
                  label="Suspend account"
                  variant="danger"
                  prompt={{ field: 'reason', question: `Why is ${account.label} being suspended? (kept in the audit log)` }}
                  confirm="They won’t be able to log in, and their reset links stop working. Their published memorials stay up. Continue?"
                />
              )}
              <span className="small muted">Suspending keeps someone out without deleting anything.</span>
            </footer>
          )}
        </section>
      )}

      <section className="card" style={{ margin: '16px 0 64px' }}>
        <h2 className="h3">Newest accounts</h2>
        <div className="board-wrap" style={{ marginTop: 8 }}>
          <table className="board">
            <thead>
              <tr>
                <th>Person</th>
                <th>Joined</th>
                <th>Last logged in</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name || r.label}
                    {r.name && <span className="sub">{r.label}</span>}
                  </td>
                  <td>{when(r.createdAt)}</td>
                  <td>
                    {when(r.lastSignInAt)}
                    {r.suspended && <span className="sub">suspended</span>}
                  </td>
                  <td>
                    <Link className="btn sm" href={`/admin?tab=people&id=${r.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
