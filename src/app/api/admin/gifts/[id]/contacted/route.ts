import { getAdminSupabase } from '@/lib/supabase/admin';
import { getAdminUser } from '@/lib/server/admin-auth';
import { markGiftContacted } from '@/lib/server/gifts';
import { fail, json, sameOrigin } from '@/lib/server/http';

/** The team records that they followed up with a family. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const { id } = await params;
  const admin = getAdminSupabase();
  if (!admin || !(await getAdminUser())) return fail('Not found.', 404);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await markGiftContacted(admin, id))) return fail('Gift not found.', 404);
  return json({ ok: true });
}
