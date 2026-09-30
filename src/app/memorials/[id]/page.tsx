import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Editor } from '@/components/editor/Editor';
import { DeleteMemorial } from '@/components/DeleteMemorial';
import { SiteHeader } from '@/components/SiteHeader';
import { displayName } from '@/lib/memorial';
import { can } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { loadOwnedCase } from '@/lib/server/cases';
import { giftForCase } from '@/lib/server/gifts';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Memorial', robots: { index: false } };

export default async function MemorialEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getSessionUser(supabase);
  if (!supabase || !user) redirect(`/account/login?next=/memorials/${id}`);
  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded) notFound();
  const admin = getAdminSupabase();
  const [gift, home] = admin
    ? await Promise.all([
        giftForCase(admin, id),
        admin.from('memora_cases').select('owner_id, org_id, memora_orgs(name, contact_phone, status)').eq('id', id).maybeSingle(),
      ])
    : [null, null];
  // A funeral home's memorial: its staff may be editing a family's draft; the home publishes.
  const row = home?.data as { owner_id: string; org_id: string | null; memora_orgs: { name: string; contact_phone: string; status: string } | { name: string; contact_phone: string; status: string }[] | null } | null | undefined;
  const org = row?.memora_orgs ? (Array.isArray(row.memora_orgs) ? row.memora_orgs[0] : row.memora_orgs) : null;
  const isOwner = !row || row.owner_id === user.id;
  if (row?.org_id && org) {
    const access = await getAccess();
    loaded.meta.home = { name: org.name, canPublish: org.status !== 'disabled' && can(access?.principal ?? null, 'org.memorials.publish', row.org_id), phone: org.contact_phone };
  }

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
            paymentsReady={paymentsReady}
            gift={gift}
          />
        </Suspense>
        {loaded.meta.status === 'DRAFT' && isOwner && (
          <div className="container" style={{ paddingBottom: 64, marginTop: -48 }}>
            <DeleteMemorial id={id} name={displayName(loaded.draft.person, 'this memorial')} />
          </div>
        )}
      </main>
    </>
  );
}
