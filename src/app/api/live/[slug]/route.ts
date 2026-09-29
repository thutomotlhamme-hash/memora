import { getAdminSupabase } from '@/lib/supabase/admin';
import { fail, json } from '@/lib/server/http';
import { loadLiveSnapshot } from '@/lib/server/cases';

/** What guests' memorial pages poll on the funeral day: programme, stop times, live item. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const admin = getAdminSupabase();
  if (!admin) return fail('Not configured.', 503);
  const snap = await loadLiveSnapshot(admin, (await params).slug);
  return snap ? json(snap) : fail('Not found.', 404);
}
