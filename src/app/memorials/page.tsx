import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GuestImport, NewMemorialButton } from '@/components/Dashboard';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { UnveilingPrompt } from '@/components/UnveilingPrompt';
import { ConfirmNumberNudge } from '@/components/ConfirmNumberNudge';
import { fmtDate } from '@/lib/memorial';
import { publicYear } from '@/lib/plans';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { listOwnedCases } from '@/lib/server/cases';
import { confirmState } from '@/lib/server/verify';
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
  const [cases, { new: wantsNew }] = await Promise.all([listOwnedCases(supabase, user.id), searchParams]);
  // Memorials whose first year is ending: the unveiling is usually around now.
  const now = new Date();
  const years = new Map(cases.map((c) => [c.id, c.status === 'PUBLISHED' ? publicYear(c.publishedAt, c.archiveAt, now) : null]));
  const ending = cases.filter((c) => ['unveiling_soon', 'last_days'].includes(years.get(c.id)?.phase ?? ''));
  const admin = ending.length ? getAdminSupabase() : null;
  const { data: asked } = admin
    ? await admin
        .from('memora_event_interest')
        .select('case_id')
        .eq('kind', 'unveiling')
        .in(
          'case_id',
          ending.map((c) => c.id),
        )
    : { data: [] as { case_id: string }[] };
  const askedIds = new Set((asked ?? []).map((a) => a.case_id as string));
  const phone = await confirmState(getAdminSupabase(), user);

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

        {phone === 'needed' && <ConfirmNumberNudge next="/memorials" />}

        {ending.map((c) => (
          <UnveilingPrompt key={c.id} caseId={c.id} name={c.name.split(' ')[0]} daysLeft={years.get(c.id)!.daysLeft} until={years.get(c.id)!.until} asked={askedIds.has(c.id)} />
        ))}

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
                  {years.get(c.id) && years.get(c.id)!.phase !== 'ended' && (
                    <div className="year-timer" aria-label={`Public for ${years.get(c.id)!.daysLeft} more days`}>
                      <span className="year-bar">
                        <span style={{ width: `${Math.round(years.get(c.id)!.elapsed * 100)}%` }} />
                      </span>
                      <span className="tiny muted">
                        Public until {fmtDate(years.get(c.id)!.until)} · {years.get(c.id)!.daysLeft} days
                      </span>
                    </div>
                  )}
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
