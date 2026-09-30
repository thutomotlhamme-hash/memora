import type { Metadata } from 'next';
import { cache } from 'react';
import { MemorialView, StatusScreen } from '@/components/MemorialView';
import { displayName, lifeDates } from '@/lib/memorial';
import { loadPublicMemorial } from '@/lib/server/cases';
import { orgBrand } from '@/lib/server/org-cases';
import { getAdminSupabase } from '@/lib/supabase/admin';

// Served from the edge cache and re-rendered at most once a minute, so guests
// opening a shared link don't wait on the database. Saves, publishing, the
// run-sheet and take-downs drop the cache straight away (refreshPublicPages);
// the on-the-day parts refresh themselves through /api/live.
export const revalidate = 60;
export const generateStaticParams = async () => [];

const load = cache(async (slug: string) => {
  const admin = getAdminSupabase();
  if (!admin) return { state: 'not_found' as const };
  return loadPublicMemorial(admin, slug);
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = await load(slug);
  if (m.state !== 'ok') return { title: 'Memorial', robots: { index: false } };
  const name = displayName(m.draft.person);
  const description = `In loving memory of ${name}. ${lifeDates(m.draft.person)}. Funeral details, directions and programme.`;
  return {
    title: `In loving memory of ${name}`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: `In loving memory of ${name}`, description, type: 'article' },
  };
}

export default async function PublicMemorial({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await load(slug);
  if (m.state === 'archived') {
    return (
      <StatusScreen
        eyebrow="Memorial"
        title={m.name ? `The memorial for ${m.name} is now private.` : 'This memorial is now private.'}
        body="It’s no longer shown publicly. The family still has their memorial, programme and keepsakes."
      />
    );
  }
  if (m.state !== 'ok') {
    return (
      <StatusScreen
        eyebrow="Memorial"
        title="This memorial isn’t available."
        body="The link may be mistyped, or the family may still be preparing it. Please check with the person who shared it."
      />
    );
  }
  const brand = await orgBrand(getAdminSupabase()!, m.meta.id);
  return <MemorialView draft={m.draft} path={`/m/${slug}`} live={{ slug, liveKey: m.meta.liveKey ?? null }} brand={brand} />;
}
