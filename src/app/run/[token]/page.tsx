import type { Metadata } from 'next';
import { StatusScreen } from '@/components/MemorialView';
import { RunSheet } from '@/components/run/RunSheet';
import { loadRunSnapshot, verifyRunToken } from '@/lib/server/run';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Funeral-day run-sheet', robots: { index: false, follow: false }, referrer: 'no-referrer' };

/** The coordinator's console. Anyone with this private link can run the programme on the day. */
export default async function RunPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdminSupabase();
  const caseId = admin ? await verifyRunToken(admin, decodeURIComponent(token)) : null;
  const snap = admin && caseId ? await loadRunSnapshot(admin, caseId) : null;
  if (!snap) {
    return (
      <StatusScreen
        eyebrow="Run-sheet"
        title="This run-sheet link isn’t working."
        body="The family may have reset it, or it was copied incompletely. Ask them to send you the run-sheet link again from their Memora editor."
      />
    );
  }
  return (
    <main className="run-page">
      <RunSheet token={decodeURIComponent(token)} initial={snap} />
    </main>
  );
}
