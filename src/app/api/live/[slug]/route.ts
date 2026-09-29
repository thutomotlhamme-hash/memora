import { getAdminSupabase } from '@/lib/supabase/admin';
import { fail } from '@/lib/server/http';
import { loadLiveSnapshot } from '@/lib/server/cases';

/** What guests' memorial pages poll on the funeral day: programme, stop times, live item. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const admin = getAdminSupabase();
  if (!admin) return fail('Not configured.', 503);
  const snap = await loadLiveSnapshot(admin, (await params).slug);
  if (!snap) return fail('Not found.', 404);
  // Every guest polls this. The CDN answers them all from one database read every
  // few seconds, so a full church costs about the same as one phone.
  return new Response(JSON.stringify(snap), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=3, stale-while-revalidate=4',
    },
  });
}
