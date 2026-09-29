import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArtifactStudio } from '@/components/ArtifactStudio';
import { StatusScreen } from '@/components/MemorialView';
import { SiteHeader } from '@/components/SiteHeader';
import { loadOwnedCase } from '@/lib/server/cases';
import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Cards & keepsakes', robots: { index: false } };

export default async function ArtifactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getSessionUser(supabase);
  if (!supabase || !user) redirect(`/account/login?next=/memorials/${id}/artifacts`);
  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded) notFound();
  if (loaded.meta.status !== 'PUBLISHED' || !loaded.meta.slug) {
    return (
      <StatusScreen
        eyebrow="Cards & keepsakes"
        title="These unlock when the memorial is published."
        body="Downloads use the memorial’s permanent link and QR code, which are created when you publish."
        action={
          <Link className="btn primary" href={`/memorials/${id}?step=publish`}>
            Go to publishing
          </Link>
        }
      />
    );
  }
  return (
    <>
      <SiteHeader />
      <ArtifactStudio draft={loaded.draft} slug={loaded.meta.slug} caseId={id} />
    </>
  );
}
