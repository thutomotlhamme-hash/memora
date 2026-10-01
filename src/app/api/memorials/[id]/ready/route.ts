import { readiness } from '@/lib/memorial';
import { loadCaseById } from '@/lib/server/cases';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { homeAudience, notify } from '@/lib/server/notify';
import { caseOrg } from '@/lib/server/org-cases';
import { getAdminSupabase } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

/** A family tells their funeral home the memorial is ready to check and publish. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const admin = getAdminSupabase();
  if (!admin) return fail('Not switched on yet.', 503);
  const { data: mine } = await auth.supabase.from('memora_cases').select('id').eq('id', id).maybeSingle();
  if (!mine) return fail('Memorial not found.', 404);
  const org = await caseOrg(admin, id);
  if (!org || org.status === 'disabled') return fail('This memorial isn’t with a funeral home.', 400);
  const loaded = await loadCaseById(admin, id);
  if (!loaded) return fail('Memorial not found.', 404);
  if (loaded.meta.status !== 'DRAFT') return fail('It’s already published.', 409);
  const r = readiness(loaded.draft);
  if (!r.complete) return fail(r.missing[0] ?? 'A few details are still missing.', 409);
  const p = loaded.draft.person;
  const name = [p.preferredName || p.firstName, p.lastName].filter(Boolean).join(' ') || 'A memorial';
  await notify(
    admin,
    await homeAudience(admin, org.orgId, org.branchId, 'org.memorials.publish'),
    {
      kind: 'ready_to_publish',
      tone: 'action',
      title: `${name}: the family says it’s ready`,
      body: 'Check the names, times and places with them, then publish.',
      href: `/memorials/${id}`,
      key: `ready:${id}:${new Date().toISOString().slice(0, 13)}`,
    },
    auth.user.id,
  );
  return json({ message: 'Done. The funeral home has been told it’s ready to check and publish.' });
}
