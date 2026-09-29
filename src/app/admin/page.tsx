import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { fmtDate } from '@/lib/memorial';
import { formatWhatsApp } from '@/lib/phone';
import { loadGiftBoard } from '@/lib/server/gifts';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gifts board', robots: { index: false } };

function isAdmin(email: string): boolean {
  const list = (process.env.MEMORA_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(email) && list.includes(email.toLowerCase());
}

export default async function AdminPage() {
  const user = await getSessionUser();
  const admin = getAdminSupabase();
  // Not an admin → behave as if the page doesn't exist.
  if (!user || !admin || !isAdmin(user.email)) notFound();

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
              Sorted by expected funeral date. Rows in clay are within 3 days and not yet published.
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
              {view.map(({ g, p, days, stage, urgent, published }) => (
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
                      {[g.email_sent_at && 'emailed', g.whatsapp_sent_at && 'WhatsApped', g.reminder_count ? `${g.reminder_count} reminder${g.reminder_count > 1 ? 's' : ''}` : '']
                        .filter(Boolean)
                        .join(' · ') || (g.status === 'PENDING' ? '' : 'link not sent automatically')}
                    </span>
                  </td>
                  <td>
                    {g.buyer_name}
                    <span className="sub">{g.buyer_email}</span>
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
