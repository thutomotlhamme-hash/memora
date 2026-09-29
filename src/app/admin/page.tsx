import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AddTeamMember, AdminAction, CopyButton, HelpLogin } from '@/components/admin/AdminAction';
import { accountLabel } from '@/lib/account-id';
import { StatusScreen } from '@/components/MemorialView';
import { SiteHeader } from '@/components/SiteHeader';
import { siteUrl } from '@/lib/config';
import { fmtDate } from '@/lib/memorial';
import { formatWhatsApp } from '@/lib/phone';
import { formatMoney } from '@/lib/plans';
import { loadAdminCases, loadAdminOrders, loadOverview, loadTeam, teamInviteText, teamJoinText } from '@/lib/server/admin';
import { getAdminAccess } from '@/lib/server/admin-auth';
import { giftWhatsAppText, loadGiftBoard } from '@/lib/server/gifts';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false } };

const TABS = [
  ['overview', 'Needs attention'],
  ['gifts', 'Gifts'],
  ['memorials', 'Memorials'],
  ['payments', 'Payments'],
  ['team', 'Team'],
] as const;
type Tab = (typeof TABS)[number][0];

const wa = (digits: string, text: string) => `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
const when = (iso: string | null | undefined) => (iso ? fmtDate(String(iso).slice(0, 10)) : '—');
const inDays = (d: number | null) => (d == null ? '' : d < 0 ? 'passed' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await getAdminAccess();

  // ---- Unhappy paths: every visitor gets a clear, safe answer. ----
  if (access.state === 'signed_out') redirect('/account/login?next=/admin');
  if (access.state === 'not_configured') {
    return (
      <StatusScreen
        eyebrow="Admin"
        title="Admin isn’t set up yet."
        body="Add MEMORA_ADMIN_EMAILS (your email) and SUPABASE_SECRET_KEY in Netlify → Environment variables, then redeploy."
      />
    );
  }
  if (access.state === 'unconfirmed') {
    return (
      <StatusScreen
        eyebrow="Admin"
        title="Confirm your email first."
        body={`You’re signed in as ${access.email}, but that address isn’t confirmed yet. Open the confirmation email from Memora, then come back.`}
      />
    );
  }
  if (access.state === 'denied') {
    return (
      <StatusScreen
        eyebrow="Admin"
        title="This account isn’t on the team."
        body={`You’re signed in as ${accountLabel(access.email)}. If you should have access, send an owner that number or email so they can add it on Admin → Team.`}
        action={
          <Link className="btn" href="/account">
            Switch account
          </Link>
        }
      />
    );
  }

  const admin = getAdminSupabase()!;
  const requested = (await searchParams).tab;
  const tab: Tab = (TABS.find(([t]) => t === requested)?.[0] ?? 'overview') as Tab;

  return (
    <>
      <SiteHeader />
      <main className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow">
              Admin · {access.role === 'owner' ? 'Owner' : 'Staff'} · {accountLabel(access.user.email)}
            </span>
            <h1 className="h1" style={{ marginTop: 10 }}>
              Running Memora
            </h1>
          </div>
          <a className="btn" href={`https://app.netlify.com/projects/${process.env.SITE_NAME || 'memora-memorials'}/forms`} target="_blank" rel="noopener noreferrer">
            Contact-form messages ↗
          </a>
        </div>
        <nav className="admin-tabs" aria-label="Admin sections">
          {TABS.map(([t, label]) => (
            <Link key={t} href={`/admin?tab=${t}`} aria-current={t === tab ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {tab === 'overview' && (await renderOverview())}
        {tab === 'gifts' && (await renderGifts())}
        {tab === 'memorials' && (await renderMemorials())}
        {tab === 'payments' && (await renderPayments())}
        {tab === 'team' && (await renderTeam(access.role === 'owner'))}
      </main>
    </>
  );

  async function renderOverview() {
    const o = await loadOverview(admin);
    const nothing = !o.urgent.length && !o.paidNotPublished.length && !o.stuckOrders.length && !o.stuckGifts.length && !o.giftsNotStarted.length;
    return (
      <>
        <div className="stat-row">
          <div className="stat">
            <strong>{o.stats.published}</strong>
            <span>Live memorials</span>
          </div>
          <div className="stat">
            <strong>{o.stats.drafts}</strong>
            <span>Drafts</span>
          </div>
          <div className="stat">
            <strong>{o.stats.giftsOpen}</strong>
            <span>Gifts not started</span>
          </div>
          <div className="stat">
            <strong>{formatMoney(o.stats.revenueMonthMinor)}</strong>
            <span>Paid this month</span>
          </div>
        </div>
        {nothing && (
          <div className="note ok" style={{ marginBottom: 64 }}>
            <span>
              <strong>All clear.</strong> Nothing needs attention right now.
            </span>
          </div>
        )}
        <Section title="Funeral within 3 days, not published" hint="Contact these families today." show={o.urgent.length > 0}>
          {o.urgent.map((u) => (
            <div className="kv urgent-row" key={`${u.kind}-${u.id}`}>
              <span>
                {fmtDate(u.date)} · {inDays(u.days)}
              </span>
              <span>
                <strong>{u.name}</strong> <span className="muted">· {u.detail}</span> <Link href={u.href}>Open →</Link>
              </span>
            </div>
          ))}
        </Section>
        <Section title="Paid, but not published" hint="The family paid but hasn’t pressed Publish. Check in and offer to help." show={o.paidNotPublished.length > 0}>
          {o.paidNotPublished.map((c) => (
            <div className="kv" key={c.id}>
              <span>{c.funeralDate ? `Funeral ${fmtDate(c.funeralDate)}` : 'No funeral date'}</span>
              <span>
                <strong>{c.name}</strong> <span className="muted">· {accountLabel(c.ownerEmail)}</span>
              </span>
            </div>
          ))}
        </Section>
        <Section title="Payments waiting for Yoco" hint="Checkout started over 15 minutes ago with no confirmation. Usually abandoned, but if the family says they paid, press Check." show={o.stuckOrders.length > 0}>
          {o.stuckOrders.map((p) => (
            <div className="kv" key={p.id}>
              <span>{when(p.createdAt)}</span>
              <span className="row">
                <strong>{p.caseName}</strong> <span className="muted">{formatMoney(p.amountMinor)}</span>
                <AdminAction action="order.recheck" id={p.id} label="Check with Yoco" />
              </span>
            </div>
          ))}
        </Section>
        <Section title="Gift payments waiting for Yoco" hint="If the buyer says they paid, press Check; it asks Yoco directly." show={o.stuckGifts.length > 0}>
          {o.stuckGifts.map((g) => (
            <div className="kv" key={g.id}>
              <span>{when(g.created_at)}</span>
              <span className="row">
                <strong>{g.buyer_name}</strong> <span className="muted">for {g.recipient_name}</span>
                <AdminAction action="gift.recheck" id={g.id} label="Check with Yoco" />
              </span>
            </div>
          ))}
        </Section>
        <Section title="Gifts not started after a day" hint="Send a gentle WhatsApp from the Gifts tab." show={o.giftsNotStarted.length > 0}>
          {o.giftsNotStarted.map((g) => (
            <div className="kv" key={g.id}>
              <span>{g.funeral_date_estimate ? `Funeral ${fmtDate(g.funeral_date_estimate)}` : 'Date unknown'}</span>
              <span>
                <strong>{g.recipient_name}</strong> <span className="muted">· from {g.buyer_name} · contacted {g.team_contact_count}×</span>
              </span>
            </div>
          ))}
        </Section>
      </>
    );
  }

  async function renderGifts() {
    const view = await loadGiftBoard(admin);
    return (
      <div className="board-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>Funeral</th>
              <th>Family contact</th>
              <th>Status</th>
              <th>From</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No gifts yet.
                </td>
              </tr>
            )}
            {view.map(({ g, p, days, stage, urgent, published, redeemLink }) => (
              <tr key={g.id} className={urgent ? 'urgent' : ''}>
                <td>
                  {g.funeral_date_estimate ? fmtDate(g.funeral_date_estimate) : 'Not sure yet'}
                  <span className="sub">{inDays(days)}</span>
                  {g.loved_one_name && <span className="sub">for {g.loved_one_name}</span>}
                </td>
                <td>
                  {g.recipient_name}
                  <a className="sub" href={`https://wa.me/${g.recipient_whatsapp}`} target="_blank" rel="noopener noreferrer">
                    {formatWhatsApp(g.recipient_whatsapp)} ↗
                  </a>
                  {g.recipient_email && <span className="sub">{g.recipient_email}</span>}
                </td>
                <td>
                  {published && p?.slug ? (
                    <a href={`/m/${p.slug}`} target="_blank" rel="noopener noreferrer">
                      {stage} ↗
                    </a>
                  ) : (
                    stage
                  )}
                  <span className="sub">{g.team_contact_count ? `contacted ${g.team_contact_count}× · last ${when(g.team_contacted_at)}` : g.status === 'PENDING' ? '' : 'not contacted yet'}</span>
                </td>
                <td>
                  {g.buyer_name}
                  <span className="sub">{g.buyer_email}</span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {g.status === 'PENDING' && <AdminAction action="gift.recheck" id={g.id} label="Check with Yoco" />}
                    {g.status !== 'PENDING' && !published && (
                      <a
                        className="btn sm primary"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={wa(
                          g.recipient_whatsapp,
                          redeemLink
                            ? giftWhatsAppText(g as { recipient_name: string; buyer_name: string; loved_one_name?: string }, redeemLink)
                            : `Hi ${g.recipient_name}, it's the Memora team checking in on the memorial${g.loved_one_name ? ` for ${g.loved_one_name}` : ''}.${
                                g.funeral_date_estimate ? ` The funeral is around ${fmtDate(g.funeral_date_estimate)}.` : ''
                              } Can we help you finish it? Continue here: ${siteUrl()}/memorials`,
                        )}
                      >
                        WhatsApp
                      </a>
                    )}
                    {redeemLink && <CopyButton text={redeemLink} label="Copy link" />}
                    {g.status !== 'PENDING' && !published && <AdminAction action="gift.contacted" id={g.id} label="Mark contacted" variant="ghost" />}
                    {g.status === 'PAID' && (
                      <AdminAction
                        action="gift.updateContact"
                        id={g.id}
                        label="Fix number"
                        variant="ghost"
                        prompt={{ field: 'whatsapp', question: `New WhatsApp number for ${g.recipient_name}:`, initial: g.recipient_whatsapp }}
                      />
                    )}
                    {g.status === 'PAID' && (
                      <AdminAction
                        action="gift.cancel"
                        id={g.id}
                        label="Cancel & refund"
                        variant="danger"
                        prompt={{ field: 'reason', question: 'Why is this gift being cancelled? (kept in the log)' }}
                        confirm="This stops the gift link from working. Refund the buyer in the Yoco portal. Continue?"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  async function renderMemorials() {
    const cases = await loadAdminCases(admin);
    return (
      <div className="board-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>Memorial</th>
              <th>Family account</th>
              <th>Funeral</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No memorials yet.
                </td>
              </tr>
            )}
            {cases.map((c) => (
              <tr key={c.id} id={c.id}>
                <td>
                  {c.name}
                  <span className="sub">updated {when(c.updatedAt)}</span>
                </td>
                <td>{accountLabel(c.ownerEmail) || '—'}</td>
                <td>{c.funeralDate ? fmtDate(c.funeralDate) : '—'}</td>
                <td>
                  {c.status === 'PUBLISHED' ? 'Live' : c.status === 'ARCHIVED' ? 'Taken down / expired' : c.paid ? 'Draft · paid' : 'Draft'}
                  {c.status === 'PUBLISHED' && <span className="sub">until {when(c.archiveAt)}</span>}
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {c.slug && c.status === 'PUBLISHED' && (
                      <a className="btn sm" href={`/m/${c.slug}`} target="_blank" rel="noopener noreferrer">
                        Open ↗
                      </a>
                    )}
                    {c.status === 'PUBLISHED' && (
                      <AdminAction
                        action="case.unpublish"
                        id={c.id}
                        label="Take down"
                        variant="danger"
                        prompt={{ field: 'reason', question: 'Why is this memorial being taken down? (e.g. family request, harmful content)' }}
                        confirm="The public link will stop showing this memorial. The family keeps their draft. Continue?"
                      />
                    )}
                    {c.status === 'ARCHIVED' && c.publishedAt && <AdminAction action="case.restore" id={c.id} label="Restore" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  async function renderPayments() {
    const orders = await loadAdminOrders(admin);
    return (
      <div className="board-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>Date</th>
              <th>Memorial</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No payments yet.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{when(o.createdAt)}</td>
                <td>
                  {o.caseName}
                  <span className="sub">{o.provider === 'gift' ? 'paid by a gift' : o.provider}</span>
                </td>
                <td>{formatMoney(o.amountMinor, o.currency)}</td>
                <td>{o.status.toLowerCase()}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {o.status === 'PENDING' && o.provider === 'yoco' && <AdminAction action="order.recheck" id={o.id} label="Check with Yoco" />}
                    {o.status === 'PAID' && o.provider !== 'gift' && (
                      <AdminAction
                        action="order.refunded"
                        id={o.id}
                        label="Mark refunded"
                        variant="ghost"
                        prompt={{ field: 'reason', question: 'Reason for the refund (kept in the log):' }}
                        confirm="Only do this after refunding in the Yoco portal. Continue?"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  async function renderTeam(isOwner: boolean) {
    const team = await loadTeam(admin);
    return (
      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 64 }}>
        <div className="card">
          <h2 className="h3">Who has access</h2>
          <p className="small muted">People sign in with their own account (cellphone or email). Access is tied to that account, so a forwarded link never gives anyone else access.</p>
          {team.owners.map((e) => (
            <div className="kv" key={e}>
              <span>Owner</span>
              <span>
                {e} <span className="muted small">· set in Netlify</span>
              </span>
            </div>
          ))}
          {team.staff.map((s) => (
            <div className="kv" key={s.email}>
              <span>Staff</span>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span>
                  {accountLabel(s.email)} <span className="muted small">· added by {accountLabel(s.addedBy)}</span>
                </span>
                {isOwner && (
                  <span className="row" style={{ gap: 6 }}>
                    <CopyButton text={teamInviteText(s.email)} label="Copy invite" />
                    <AdminAction action="team.remove" extra={{ email: s.email }} label="Remove" variant="danger" confirm={`Remove ${accountLabel(s.email)}? Their access stops immediately.`} />
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="h3">Help someone log in</h2>
          <p className="small muted">
            Forgot their password? First check on WhatsApp that it’s really them (for example, ask for the name on their memorial). Then set a temporary
            password and send it. They change it under Account.
          </p>
          <HelpLogin />
        </div>
        <div className="card">
          <h2 className="h3">Add someone</h2>
          {isOwner ? (
            <>
              <p className="small muted">
                1. Ask them to create a Memora account first (Copy sign-up message, then paste on WhatsApp). 2. When they send you the number they used, add
                it here. The Admin link then appears at the top of the site for them.
              </p>
              <div className="row" style={{ marginBottom: 12 }}>
                <CopyButton text={teamJoinText()} label="Copy sign-up message" />
              </div>
              <AddTeamMember />
              <p className="small muted" style={{ marginTop: 16 }}>
                Owners can add and remove staff. Staff can do everything else. To add another owner, add their email to MEMORA_ADMIN_EMAILS in Netlify.
              </p>
            </>
          ) : (
            <p className="small muted">Only owners can add or remove team members.</p>
          )}
        </div>
      </div>
    );
  }
}

function Section({ title, hint, show, children }: { title: string; hint: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 className="h3">{title}</h2>
      <p className="small muted" style={{ margin: '6px 0 12px' }}>
        {hint}
      </p>
      {children}
    </section>
  );
}
