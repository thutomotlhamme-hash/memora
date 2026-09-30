import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArtifactStudio } from '@/components/ArtifactStudio';
import { StatusScreen } from '@/components/MemorialView';
import { SiteHeader } from '@/components/SiteHeader';
import { loadOwnedCase } from '@/lib/server/cases';
import { orgBrand } from '@/lib/server/org-cases';
import { getAdminSupabase } from '@/lib/supabase/admin';
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
  // A funeral home's memorial prints with the home's name and logo on the back.
  const admin = getAdminSupabase();
  const home = admin ? await orgBrand(admin, id) : null;
  return (
    <>
      <SiteHeader />
      <ArtifactStudio draft={loaded.draft} slug={loaded.meta.slug} caseId={id} brand={home ? { name: home.name, logoUrl: home.logoUrl, colour: home.brandColour } : null} />
    </>
  );
}
