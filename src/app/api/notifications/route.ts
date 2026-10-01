import { getAccess } from '@/lib/server/access';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { listNotifications, markRead, syncSituations } from '@/lib/server/notify';
import { getAdminSupabase } from '@/lib/supabase/admin';

/** The signed-in person's notifications. ?sync=1 also checks their situations (funerals close by, a first year ending). */
export async function GET(request: Request) {
  const admin = getAdminSupabase();
  const access = await getAccess();
  if (!admin || !access) return json({ items: [], unread: 0 });
  if (new URL(request.url).searchParams.get('sync') === '1') await syncSituations(admin, access.user.id, access.principal).catch((e) => console.error('Notification sync failed', e));
  return json(await listNotifications(admin, access.user.id));
}

/** Mark one notification (or all) as read. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  const access = await getAccess();
  if (!admin || !access) return fail('Please log in to continue.', 401);
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = body.id === 'all' ? 'all' : typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!id) return fail('Notification not found.', 404);
  await markRead(admin, access.user.id, id);
  return json(await listNotifications(admin, access.user.id));
}
