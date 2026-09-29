import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GuestImport, NewMemorialButton } from '@/components/Dashboard';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { fmtDate } from '@/lib/memorial';
import { listOwnedCases } from '@/lib/server/cases';
import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My memorials' };

function statusPill(status: string, archiveAt: string | null) {
  if (status === 'PUBLISHED' && archiveAt && new Date(archiveAt) <= new Date()) return <span className="pill">Private</span>;
  if (status === 'PUBLISHED') return <span className="pill live dot">Live</span>;
  if (status === 'ARCHIVED') return <span className="pill">Private</span>;
  return <span className="pill">Draft</span>;
}

export default async function MemorialsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const supabase = await getServerSupabase();
  const user = await getSessionUser(supabase);
  if (!supabase || !user) redirect('/account/login?next=/memorials');
  const [cases, { new: wantsNew }] = await Promise.all([listOwnedCases(supabase), searchParams]);

  return (
    <>
      <SiteHeader />
      <main className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow">Your memorials</span>
            <h1 className="h1" style={{ marginTop: 10 }}>
              {user.name ? `Welcome, ${user.name.split(' ')[0]}.` : 'Welcome.'}
            </h1>
          </div>
          <NewMemorialButton autoStart={wantsNew === '1' && cases.length === 0} />
        </div>

        <GuestImport />

        {cases.length === 0 ? (
          <div className="empty" style={{ marginBottom: 80 }}>
            <h2 className="h3">No memorials yet.</h2>
            <p className="muted">Start with a name and a photo. Everything else can come later.</p>
          </div>
        ) : (
          <div className="memorial-grid">
            {cases.map((c) => (
              <Link key={c.id} href={`/memorials/${c.id}`} className="memorial-card">
                <div className="avatar">{c.portraitUrl ? <img src={c.portraitUrl} alt="" /> : c.name.slice(0, 1)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <h2 className="h4">{c.name}</h2>
                    {statusPill(c.status, c.archiveAt)}
                  </div>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    {c.funeralDate ? `Funeral ${fmtDate(c.funeralDate)}` : c.passingDate ? `Passed ${fmtDate(c.passingDate)}` : 'Details still to add'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
