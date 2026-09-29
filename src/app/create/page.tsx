import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { GuestEditor } from '@/components/editor/Editor';
import { SiteHeader } from '@/components/SiteHeader';
import { getSessionUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Create a memorial' };

export default async function CreatePage() {
  // Signed-in families create memorials from their dashboard (which also offers to
  // import any guest draft left in this browser).
  if (await getSessionUser()) redirect('/memorials?new=1');
  return (
    <>
      <SiteHeader hideCreate />
      <main>
        <Suspense>
          <GuestEditor />
        </Suspense>
      </main>
    </>
  );
}
