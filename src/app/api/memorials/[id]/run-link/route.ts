import { getAdminSupabase } from '@/lib/supabase/admin';
import { can } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { caseOrg } from '@/lib/server/org-cases';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { linkSecret } from '@/lib/server/links';
import { runUrl } from '@/lib/server/run';

type Ctx = { params: Promise<{ id: string }> };

/**
 * The family's coordinator link. POST {reset: true} issues a new link and makes
 * every previously shared one stop working (e.g. it was sent to the wrong person).
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const admin = getAdminSupabase();
  if (!admin || !linkSecret()) return fail('The run-sheet isn’t switched on for this site yet. The site owner can see what’s missing under Admin → Overview → Setup.', 503);

  // RLS: only the owner can see their memorial.
  const { data: owned } = await auth.supabase.from('memora_cases').select('id').eq('id', id).maybeSingle();
  if (!owned) {
    // Not the owner: a funeral home's directors may still run its funerals.
    const org = /^[0-9a-f-]{36}$/i.test(id) ? await caseOrg(admin, id) : null;
    const access = org ? await getAccess() : null;
    if (!org || org.status === 'disabled' || !can(access?.principal ?? null, 'org.runsheet', org.orgId)) return fail('Memorial not found.', 404);
  }

  const body = (await request.json().catch(() => ({}))) as { reset?: boolean };
  const { data: c } = await admin.from('memora_cases').select('run_version').eq('id', id).single();
  let version = Number(c?.run_version ?? 1);
  if (body.reset) {
    version += 1;
    await admin.from('memora_cases').update({ run_version: version }).eq('id', id);
    await admin.from('memora_activity_log').insert({ case_id: id, actor_user_id: auth.user.id, action: 'RUN_LINK_RESET', metadata: { version } });
  }
  return json({ url: runUrl(id, version) });
}
