import { getAccess } from '@/lib/server/access';
import { GROUP_SELF_SERVICE, performEnterpriseAction } from '@/lib/server/enterprise';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { ORG_SELF_SERVICE, performProAction, type ProInput } from '@/lib/server/pro';
import { getAdminSupabase } from '@/lib/supabase/admin';

/** An Enterprise group's own people running their group. Every action is permission-checked. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  const access = await getAccess();
  if (!admin || !access) return fail('Please log in to continue.', 401);
  const body = (await request.json().catch(() => null)) as ProInput | null;
  if (!body?.action) return fail('Missing action.', 400);
  try {
    const out = GROUP_SELF_SERVICE.has(body.action)
      ? await performEnterpriseAction(admin, access.principal, body)
      : ORG_SELF_SERVICE.has(body.action)
        ? await performProAction(admin, access.principal, body)
        : null;
    if (!out) return fail('Not allowed here.', 403);
    return out.ok ? json({ message: out.message, ...(out.data ?? {}) }) : fail(out.error, out.status);
  } catch (err) {
    console.error('Group action failed', body.action, err);
    return fail('Something went wrong. Refresh and check whether it was applied.', 500);
  }
}
