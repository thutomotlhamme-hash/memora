import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminAction, CopyButton } from '@/components/admin/AdminAction';
import { accountLabel } from '@/lib/account-id';
import { StatusScreen } from '@/components/MemorialView';
import { SiteHeader } from '@/components/SiteHeader';
import { siteUrl } from '@/lib/config';
import { fmtDate } from '@/lib/memorial';
import { formatWhatsApp } from '@/lib/phone';
import { PRO_PLANS, formatMoney } from '@/lib/plans';
import { loadAdminCases, loadAdminOrders, loadOverview, loadTeam, setupChecks, teamInviteText, teamJoinText } from '@/lib/server/admin';
import { getAdminAccess } from '@/lib/server/admin-auth';
import { AccessPanel, AssignHome, AuditPanel, BillingPanel, HomesPanel } from '@/components/admin/CommandPanels';
import { EnterprisePanel } from '@/components/admin/EnterprisePanel';
import { PeoplePanel } from '@/components/admin/PeoplePanel';
import { ROLES, can, type Permission } from '@/lib/rbac';
import { loadOrgs } from '@/lib/server/pro';
import { giftWhatsAppText, loadGiftBoard } from '@/lib/server/gifts';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Command centre', robots: { index: false } };

/** Each tab shows only to people whose roles grant its permission. */
const TABS = [
  ['overview', 'Needs attention', 'ops.view'],
  ['homes', 'Funeral homes', 'ops.view'],
  ['enterprise', 'Enterprise', 'ops.view'],
  ['memorials', 'Memorials', 'memorials.view_all'],
  ['gifts', 'Gifts', 'gifts.manage'],
  ['payments', 'Payments', 'orders.manage'],
  ['people', 'People', 'accounts.help'],
  ['billing', 'Billing', 'orgs.billing'],
  ['access', 'Access', 'ops.view'],
  ['audit', 'Audit log', 'audit.view'],
] as const satisfies readonly (readonly [string, string, Permission])[];
type Tab = (typeof TABS)[number][0];

const wa = (digits: string, text: string) => `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
const when = (iso: string | null | undefined) => (iso ? fmtDate(String(iso).slice(0, 10)) : '—');
const inDays = (d: number | null) => (d == null ? '' : d < 0 ? 'passed' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; q?: string; id?: string; bp?: string }> }) {
  const access = await getAdminAccess();

  // ---- Unhappy paths: every visitor gets a clear, safe answer. ----
  if (access.state === 'signed_out') redirect('/account/login?next=/admin');
  if (access.state === 'not_configured') {
    return (
      <StatusScreen
        eyebrow="Admin"
        title="Admin isn’t set up yet."
        body="Add MEMORA_ADMIN_PHONES (your cellphone number) and SUPABASE_SECRET_KEY in Netlify → Environment variables, then redeploy."
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
        body={`You’re signed in as ${accountLabel(access.email)}. If you should have access, send an owner that number so they can add you to a group under Command centre → Access.`}
        action={
          <Link className="btn" href="/account">
            Switch account
          </Link>
        }
      />
    );
  }

  const admin = getAdminSupabase()!;
  const p = access.principal;
  const tabs = TABS.filter(([, , perm]) => can(p, perm));
  const requested = (await searchParams).tab;
  const tab: Tab = (tabs.find(([t]) => t === requested)?.[0] ?? 'overview') as Tab;
  const roleNames = [...p.roles].filter((r) => ROLES[r].scope === 'platform').map((r) => ROLES[r].label);

  return (
    <>
      <SiteHeader />
      <main className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow">
              Command centre · {roleNames.join(', ') || 'Team'} · {accountLabel(access.user.email)}
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
          {tabs.map(([t, label]) => (
            <Link key={t} href={`/admin?tab=${t}`} aria-current={t === tab ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {tab === 'overview' && (await renderOverview())}
        {tab === 'gifts' && (await renderGifts())}
        {tab === 'memorials' && (await renderMemorials())}
        {tab === 'payments' && (await renderPayments())}
        {tab === 'homes' && <HomesPanel admin={admin} p={p} />}
        {tab === 'enterprise' && <EnterprisePanel admin={admin} p={p} bp={(await searchParams).bp} />}
        {tab === 'people' && <PeoplePanel admin={admin} p={p} q={(await searchParams).q} id={(await searchParams).id} />}
        {tab === 'billing' && <BillingPanel admin={admin} />}
        {tab === 'access' && (
          <>
            {await renderTeam(can(p, 'access.manage'), can(p, 'accounts.help'))}
            <AccessPanel admin={admin} p={p} />
          </>
        )}
        {tab === 'audit' && <AuditPanel admin={admin} />}
      </main>
    </>
  );

  async function renderOverview() {
    const o = await loadOverview(admin);
    // Families asking about the unveiling: the first customers for Memora's events.
    const { data: unveil } = await admin
      .from('memora_event_interest')
      .select('case_id,kind,planned_for,created_at,memora_cases(slug,archive_at,memora_people(first_name,last_name,preferred_name))')
      .order('created_at', { ascending: false })
      .limit(40);
    const unveilings = ((unveil ?? []) as Record<string, any>[]).map((r) => {
      const c = Array.isArray(r.memora_cases) ? r.memora_cases[0] : r.memora_cases;
      const pp = c ? (Array.isArray(c.memora_people) ? c.memora_people[0] : c.memora_people) : null;
      return { id: `${r.case_id}-${r.kind}`, kind: r.kind as string, plannedFor: r.planned_for as string | null, name: [pp?.preferred_name || pp?.first_name, pp?.last_name].filter(Boolean).join(' ') || 'A memorial', slug: c?.slug as string | null, until: c?.archive_at as string | null };
    });
    const nothing = !o.urgent.length && !o.paidNotPublished.length && !o.stuckOrders.length && !o.stuckGifts.length && !o.giftsNotStarted.length;
    const setup = setupChecks();
    const missing = setup.filter((c) => !c.ok && !c.needed.startsWith('Optional'));
    return (
      <>
        <div className={`card setup-card${missing.length ? ' bad' : ''}`} style={{ marginBottom: 20 }}>
          <h2 className="h3">{missing.length ? `Setup: ${missing.length} setting${missing.length > 1 ? 's' : ''} missing` : 'Setup: all good'}</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Settings live in Netlify → Site configuration → Environment variables. After changing one, trigger a new deploy.
          </p>
          {setup.map((c) => (
            <div className="kv" key={c.name}>
              <span>
                {c.ok ? '✓' : c.needed.startsWith('Optional') ? '○' : '✗'} <code>{c.name}</code>
              </span>
              <span className={c.ok ? 'muted small' : 'small'}>
                {c.needed}
                {!c.ok && <span className="muted"> · {c.fix}</span>}
              </span>
            </div>
          ))}
        </div>
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
        <Section title="Families asking about the unveiling" hint="They want to hear when unveiling pages are ready. The first customers for events." show={unveilings.length > 0}>
          {unveilings.map((u) => (
            <div className="kv" key={u.id}>
              <span>{u.plannedFor ? `Unveiling ${fmtDate(u.plannedFor)}` : 'Date not set'}</span>
              <span>
                <strong>{u.name}</strong> <span className="muted">· {u.kind === 'extend' ? 'wants another year' : 'unveiling'} · public until {when(u.until)}</span>
                {u.slug && <Link href={`/m/${u.slug}`}> Open →</Link>}
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
    const [cases, orgs, { data: links }, { data: people }, { data: platformGroups }, team] = await Promise.all([
      loadAdminCases(admin),
      loadOrgs(admin),
      admin.from('memora_cases').select('id,org_id').not('org_id', 'is', null),
      admin.rpc('memora_group_people'),
      admin.from('memora_groups').select('id').is('org_id', null),
      loadTeam(admin),
    ]);
    const orgOf = new Map(((links ?? []) as { id: string; org_id: string }[]).map((l) => [l.id, l.org_id]));
    const assign = can(p, 'memorials.assign');
    const takedown = can(p, 'memorials.takedown');
    // Who counts as "us": owners, anyone in a Memora group, and the earlier team list.
    const ours = new Set(((platformGroups ?? []) as { id: string }[]).map((g) => g.id));
    const teamEmails = new Set([
      ...team.owners,
      ...team.staff.map((s) => s.email.toLowerCase()),
      ...((people ?? []) as { group_id: string; email: string }[]).filter((m) => ours.has(m.group_id)).map((m) => m.email.toLowerCase()),
    ]);

    const filter = (await searchParams).status ?? 'all';
    const shown = cases.filter((c) =>
      filter === 'draft' ? c.status === 'DRAFT' : filter === 'live' ? c.status === 'PUBLISHED' : filter === 'closed' ? c.status === 'ARCHIVED' : true,
    );
    // Upcoming funerals first (soonest at the top), then the rest by last change.
    const today = new Date().toISOString().slice(0, 10);
    const order = (a: (typeof cases)[number], b: (typeof cases)[number]) => {
      const au = a.funeralDate && a.funeralDate >= today ? a.funeralDate : null;
      const bu = b.funeralDate && b.funeralDate >= today ? b.funeralDate : null;
      if (au && bu) return au.localeCompare(bu);
      if (au || bu) return au ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    };
    const sections: { key: string; title: string; hint: string; rows: typeof cases; orgId?: string }[] = [
      { key: 'ours', title: 'Made by the Memora team', hint: 'Memorials our own team made or is making.', rows: shown.filter((c) => !orgOf.has(c.id) && teamEmails.has(c.ownerEmail.toLowerCase())) },
      ...orgs.map((o) => ({ key: o.id, orgId: o.id, title: o.name, hint: `${PRO_PLANS[o.plan].name} plan · ${o.status === 'trial' ? 'trial' : o.status}`, rows: shown.filter((c) => orgOf.get(c.id) === o.id) })),
      { key: 'families', title: 'Families on their own', hint: 'Families who came to Memora directly, not through a funeral home.', rows: shown.filter((c) => !orgOf.has(c.id) && !teamEmails.has(c.ownerEmail.toLowerCase())) },
    ];
    const count = (st: string) => (st === 'all' ? cases.length : cases.filter((c) => (st === 'draft' ? c.status === 'DRAFT' : st === 'live' ? c.status === 'PUBLISHED' : c.status === 'ARCHIVED')).length);

    return (
      <>
        <nav className="row cc-filter" aria-label="Filter memorials">
          {(
            [
              ['all', 'All'],
              ['draft', 'Drafts'],
              ['live', 'Live'],
              ['closed', 'Closed'],
            ] as const
          ).map(([k, label]) => (
            <Link key={k} className={`chip${filter === k ? ' on' : ''}`} href={`/admin?tab=memorials&status=${k}`}>
              {label} <span className="muted">{count(k)}</span>
            </Link>
          ))}
          <span className="muted small cc-jump">
            Jump to:{' '}
            {sections
              .filter((s) => s.rows.length)
              .map((s, i) => (
                <span key={s.key}>
                  {i ? ' · ' : ''}
                  <a href={`#sec-${s.key}`}>{s.title}</a>
                </span>
              ))}
          </span>
        </nav>
        {sections.map((sec) =>
          sec.rows.length === 0 && sec.key !== 'families' ? null : (
            <section key={sec.key} id={`sec-${sec.key}`} className="card cc-mem-section">
              <header className="cc-mem-head">
                <div>
                  <h2 className="h3">
                    {sec.title} <span className="muted small">{sec.rows.length}</span>
                  </h2>
                  <p className="small muted">{sec.hint}</p>
                </div>
                {sec.orgId && (
                  <Link className="btn sm" href={`/pro/dashboard?home=${sec.orgId}&tab=funerals`}>
                    Their dashboard
                  </Link>
                )}
              </header>
              {sec.rows.length === 0 ? (
                <p className="muted small">None{filter === 'all' ? '' : ' with this filter'}.</p>
              ) : (
                <div className="board-wrap">
                  <table className="board">
                    <thead>
                      <tr>
                        <th>Memorial</th>
                        <th>Made by</th>
                        <th>Funeral</th>
                        <th>Status</th>
                        {assign && <th>Funeral home</th>}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sec.rows].sort(order).map((c) => (
                        <tr key={c.id} id={c.id}>
                          <td>
                            {c.name}
                            <span className="sub">updated {when(c.updatedAt)}</span>
                          </td>
                          <td>{accountLabel(c.ownerEmail) || '—'}</td>
                          <td>
                            {c.funeralDate ? fmtDate(c.funeralDate) : '—'}
                            {c.funeralDate && c.funeralDate >= today && <span className="sub">{inDays(Math.round((Date.parse(c.funeralDate) - Date.parse(today)) / 86_400_000))}</span>}
                          </td>
                          <td>
                            {c.status === 'PUBLISHED' ? 'Live' : c.status === 'ARCHIVED' ? 'Taken down / expired' : c.paid ? 'Draft · paid' : 'Draft'}
                            {c.status === 'PUBLISHED' && <span className="sub">until {when(c.archiveAt)}</span>}
                          </td>
                          {assign && <td>{orgs.length ? <AssignHome caseId={c.id} orgId={orgOf.get(c.id) ?? null} orgs={orgs} /> : '—'}</td>}
                          <td>
                            <div className="row" style={{ gap: 6 }}>
                              {c.slug && c.status === 'PUBLISHED' && (
                                <a className="btn sm" href={`/m/${c.slug}`} target="_blank" rel="noopener noreferrer">
                                  Open ↗
                                </a>
                              )}
                              {takedown && c.status === 'PUBLISHED' && (
                                <AdminAction
                                  action="case.unpublish"
                                  id={c.id}
                                  label="Take down"
                                  variant="danger"
                                  prompt={{ field: 'reason', question: 'Why is this memorial being taken down? (e.g. family request, harmful content)' }}
                                  confirm="The public link will stop showing this memorial. The family keeps their draft. Continue?"
                                />
                              )}
                              {takedown && c.status === 'ARCHIVED' && c.publishedAt && <AdminAction action="case.restore" id={c.id} label="Restore" />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ),
        )}
      </>
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

  async function renderTeam(isOwner: boolean, canHelp: boolean) {
    const team = await loadTeam(admin);
    return (
      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 64 }}>
        <div className="card">
          <h2 className="h3">Owners</h2>
          <p className="small muted">People sign in with their own account (cellphone or email). Access is tied to that account, so a forwarded link never gives anyone else access.</p>
          {team.owners.map((e) => (
            <div className="kv" key={e}>
              <span>Owner</span>
              <span>
                {accountLabel(e)} <span className="muted small">· set in Netlify</span>
              </span>
            </div>
          ))}
          {team.staff.map((s) => (
            <div className="kv" key={s.email}>
              <span>Earlier team list</span>
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
            Forgot their password? Find them under People, check on WhatsApp that it’s really them, then send a reset link. They choose their own new
            password.
          </p>
          {canHelp ? (
            <Link className="btn primary" href="/admin?tab=people">
              Open People
            </Link>
          ) : (
            <p className="small muted">Needs a role with “help with logins”.</p>
          )}
        </div>
        <div className="card">
          <h2 className="h3">Add someone</h2>
          <p className="small muted">
            1. Ask them to create a Memora account (Copy sign-up message, then paste on WhatsApp). 2. Add the number they used to the right group below.
            Their access follows the group’s roles.
          </p>
          <CopyButton text={teamJoinText()} label="Copy sign-up message" />
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
