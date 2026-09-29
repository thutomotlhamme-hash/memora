import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MemorialView } from '@/components/MemorialView';
import { loadOwnedCase } from '@/lib/server/cases';
import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Preview', robots: { index: false } };

export default async function OwnerPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getSessionUser(supabase);
  if (!supabase || !user) redirect(`/account/login?next=/memorials/${id}/preview`);
  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded) notFound();
  const live = loaded.meta.status === 'PUBLISHED';
  return (
    <MemorialView
      draft={loaded.draft}
      path={live ? `/m/${loaded.meta.slug}` : `/memorials/${id}/preview`}
      banner={
        <div className="preview-bar">
          <div className="container">
            <span>{live ? 'You’re viewing your live memorial.' : 'Private preview. Only you can see this until you publish.'}</span>
            <Link href={`/memorials/${id}`}>← Back to editing</Link>
          </div>
        </div>
      }
    />
  );
}
