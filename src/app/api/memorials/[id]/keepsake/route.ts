import { loadOwnedCase } from '@/lib/server/cases';
import { fail, json } from '@/lib/server/http';
import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

/**
 * What a keepsake thumbnail needs: the memorial's content and its link. Only
 * for someone who can open the memorial (its family, or the funeral home's
 * staff, by the database's own rules), and only once it has been published.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = supabase ? await getSessionUser(supabase) : null;
  if (!supabase || !user) return fail('Please log in to continue.', 401);
  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded || loaded.meta.status === 'DRAFT' || !loaded.meta.slug) return fail('Memorial not found.', 404);
  return json({ draft: loaded.draft, slug: loaded.meta.slug });
}
