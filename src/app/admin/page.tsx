import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { fmtDate } from '@/lib/memorial';
import { formatWhatsApp } from '@/lib/phone';
import { giftWhatsAppText, loadGiftBoard } from '@/lib/server/gifts';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/config';
import { getAdminUser } from '@/lib/server/admin-auth';
import { AdminGiftActions } from '@/components/AdminGiftActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gifts board', robots: { index: false } };

export default async function AdminPage() {
  const admin = getAdminSupabase();
  // Not an admin → behave as if the page doesn't exist.
  if (!admin || !(await getAdminUser())) notFound();

  const view = await loadGiftBoard(admin);
  const upcoming = view.filter((v) => v.days != null && v.days >= 0);

  return (
    <>
      <SiteHeader />
      <main className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow">Team</span>
            <h1 className="h1" style={{ marginTop: 10 }}>
              Gifts board
            </h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Sorted by expected funeral date. Rows in clay are within 3 days and not yet published: contact those families first.
            </p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat">
            <strong>{view.filter((v) => v.urgent).length}</strong>
            <span>At risk (≤ 3 days)</span>
          </div>
          <div className="stat">
            <strong>{view.filter((v) => v.g.status === 'PAID').length}</strong>
            <span>Sent, not started</span>
          </div>
          <div className="stat">
            <strong>{view.filter((v) => v.g.status === 'REDEEMED' && !v.published).length}</strong>
            <span>In progress</span>
          </div>
          <div className="stat">
            <strong>{upcoming.length}</strong>
            <span>Funerals ahead</span>
          </div>
        </div>
        <div className="board-wrap">
          <table className="board">
            <thead>
              <tr>
                <th>Funeral</th>
                <th>Loved one</th>
                <th>Family contact</th>
                <th>Status</th>
                <th>From</th>
                <th>Follow up</th>
              </tr>
            </thead>
            <tbody>
              {view.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No gifts yet.
                  </td>
                </tr>
              )}
              {view.map(({ g, p, days, stage, urgent, published, redeemLink }) => (
                <tr key={g.id} className={urgent ? 'urgent' : ''}>
                  <td>
                    {g.funeral_date_estimate ? fmtDate(g.funeral_date_estimate) : 'Not sure yet'}
                    <span className="sub">{days == null ? '' : days < 0 ? 'passed' : days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}</span>
                  </td>
                  <td>{g.loved_one_name || '—'}</td>
                  <td>
                    {g.recipient_name}
                    {g.recipient_email && <span className="sub">{g.recipient_email}</span>}
                    {g.recipient_whatsapp && (
                      <a className="sub" href={`https://wa.me/${g.recipient_whatsapp}`} target="_blank" rel="noopener noreferrer">
                        {formatWhatsApp(g.recipient_whatsapp)} ↗
                      </a>
                    )}
                  </td>
                  <td>
                    {published && p?.slug ? (
                      <a href={`/m/${p.slug}`} target="_blank" rel="noopener noreferrer">
                        {stage} ↗
                      </a>
                    ) : (
                      stage
                    )}
                    <span className="sub">
                      {g.team_contact_count
                        ? `contacted ${g.team_contact_count}× · last ${fmtDate(String(g.team_contacted_at).slice(0, 10))}`
                        : g.status === 'PENDING'
                          ? ''
                          : 'not contacted yet'}
                    </span>
                  </td>
                  <td>
                    {g.buyer_name}
                    <span className="sub">{g.buyer_email}</span>
                  </td>
                  <td>
                    {g.status !== 'PENDING' && !published && (
                      <AdminGiftActions
                        giftId={g.id}
                        whatsapp={g.recipient_whatsapp}
                        link={redeemLink}
                        text={
                          redeemLink
                            ? giftWhatsAppText(g as { recipient_name: string; buyer_name: string; loved_one_name?: string }, redeemLink)
                            : `Hi ${g.recipient_name}, it's the Memora team checking in on the memorial${g.loved_one_name ? ` for ${g.loved_one_name}` : ''}.${
                                g.funeral_date_estimate ? ` The funeral is around ${fmtDate(g.funeral_date_estimate)}.` : ''
                              } Can we help you finish it? You can continue here: ${siteUrl()}/memorials`
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
