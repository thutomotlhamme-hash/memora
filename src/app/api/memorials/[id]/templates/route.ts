import { templatesForBranch } from '@/lib/server/enterprise';
import { fail, json } from '@/lib/server/http';
import { caseOrg } from '@/lib/server/org-cases';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

/**
 * The programme templates and wording this memorial's branch may use: its own
 * funeral home's, and its group's that are published to it. Only someone who
 * can open the memorial (the family, or the home's staff) gets them.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Memorial not found.', 404);
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return json({ templates: [] });
  const user = await getSessionUser(supabase);
  if (!user) return fail('Please log in to continue.', 401);
  // RLS decides who can see the memorial: its owner, or the home's staff (and their group's head office).
  const { data: visible } = await supabase.from('memora_cases').select('id').eq('id', id).maybeSingle();
  if (!visible) return fail('Memorial not found.', 404);
  const org = await caseOrg(admin, id);
  if (!org || org.status === 'disabled') return json({ templates: [] });
  const templates = await templatesForBranch(admin, org.orgId, org.branchId);
  return json({ templates: templates.map((t) => ({ id: t.id, name: t.name, kind: t.kind, tradition: t.tradition, items: t.items, wording: t.wording })) });
}
