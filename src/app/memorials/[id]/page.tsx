import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Editor } from '@/components/editor/Editor';
import { DeleteMemorial } from '@/components/DeleteMemorial';
import { SiteHeader } from '@/components/SiteHeader';
import { formatMoney, pricing, publicDays } from '@/lib/config';
import { displayName } from '@/lib/memorial';
import { loadOwnedCase } from '@/lib/server/cases';
import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Memorial', robots: { index: false } };

export default async function MemorialEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getSessionUser(supabase);
  if (!supabase || !user) redirect(`/account/login?next=/memorials/${id}`);
  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded) notFound();

  const paymentsReady =
    Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    (Boolean(process.env.YOCO_SECRET_KEY) || (process.env.MEMORA_SIMULATE_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production'));

  return (
    <>
      <SiteHeader />
      <main>
        <Suspense>
          <Editor
            key={id}
            mode="owner"
            caseId={id}
            initialDraft={loaded.draft}
            initialMeta={loaded.meta}
            price={formatMoney(pricing.amountMinor, pricing.currency)}
            publicDays={publicDays()}
            paymentsReady={paymentsReady}
          />
        </Suspense>
        {loaded.meta.status === 'DRAFT' && (
          <div className="container" style={{ paddingBottom: 64, marginTop: -48 }}>
            <DeleteMemorial id={id} name={displayName(loaded.draft.person, 'this memorial')} />
          </div>
        )}
      </main>
    </>
  );
}
