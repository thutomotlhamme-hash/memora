import { getAdminSupabase } from '@/lib/supabase/admin';
import { performAdminAction, type AdminActionInput } from '@/lib/server/admin';
import { getAdminUser } from '@/lib/server/admin-auth';
import { fail, json, sameOrigin } from '@/lib/server/http';

/** Every admin action goes through here: checked, performed and logged. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  const access = await getAdminUser();
  if (!admin || !access) return fail('Not found.', 404);
  const body = (await request.json().catch(() => null)) as AdminActionInput | null;
  if (!body?.action) return fail('Missing action.', 400);
  try {
    const result = await performAdminAction(admin, access.user, access.principal, body);
    return result.ok ? json({ message: result.message, ...(result.data ?? {}) }) : fail(result.error, result.status);
  } catch (err) {
    console.error('Admin action failed', body.action, err);
    return fail('Something went wrong. Refresh and check whether it was applied.', 500);
  }
}
