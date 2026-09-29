import { readiness, slugify } from '@/lib/memorial';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { paymentsOn } from '@/lib/config';
import { archiveDate } from '@/lib/plans';
import { isCasePaid, loadOwnedCase } from '@/lib/server/cases';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { refreshPublicPages } from '@/lib/server/public-cache';

type Ctx = { params: Promise<{ id: string }> };

/**
 * DRAFT → PUBLISHED. The only way a memorial becomes public: the owner asks, the
 * server re-checks completeness from the database (not the browser) and requires
 * a confirmed payment, then writes the trusted fields with the service role.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  const admin = getAdminSupabase();
  if (!admin) return fail('Publishing is not configured on this deployment yet.', 503);

  const loaded = await loadOwnedCase(supabase, id);
  if (!loaded) return fail('Memorial not found.', 404);
  const { draft, meta } = loaded;

  if (meta.status === 'PUBLISHED') return json({ meta });
  if (meta.status !== 'DRAFT') return fail('This memorial cannot be published.', 409);
  const r = readiness(draft);
  if (!r.complete) return fail(r.missing[0] ?? 'The memorial is not complete yet.', 409);
  // Launch mode (payments off): publishing is free.
  const paid = await isCasePaid(admin, id);
  if (paymentsOn && !paid) return fail('Payment has not been confirmed yet.', 402);

  const now = new Date();
  const base = slugify(`${draft.person.firstName}-${draft.person.lastName}`) || 'memorial';
  const slug = `${base}-${id.replaceAll('-', '').slice(0, 6)}`;
  const archiveAt = archiveDate(now);

  const { data: updated, error } = await admin
    .from('memora_cases')
    .update({ status: 'PUBLISHED', slug, published_at: now.toISOString(), archive_at: archiveAt, updated_at: now.toISOString() })
    .eq('id', id)
    .eq('status', 'DRAFT')
    .select('id,status,slug,published_at,archive_at,updated_at')
    .maybeSingle();
  if (error || !updated) return fail('Could not publish the memorial.', 500);
  refreshPublicPages();

  await admin.from('memora_activity_log').insert({ case_id: id, actor_user_id: user.id, action: 'CASE_PUBLISHED', metadata: { slug, archive_at: archiveAt, free_launch: !paid } });

  return json({
    meta: {
      id,
      status: updated.status,
      slug: updated.slug,
      publishedAt: updated.published_at,
      archiveAt: updated.archive_at,
      paid,
      updatedAt: updated.updated_at,
    },
  });
}
