import { getAdminSupabase } from '@/lib/supabase/admin';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { applyProcession, parseAction } from '@/lib/server/procession';
import { verifyRunToken } from '@/lib/server/run';

/** The coordinator's phone: start, pause, resume or end sharing, and send positions. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  if (!admin) return fail('Not configured.', 503);
  const caseId = await verifyRunToken(admin, decodeURIComponent((await params).token));
  if (!caseId) return fail('This run-sheet link is no longer valid. Ask the family for the new link.', 404);
  const action = parseAction(await request.json().catch(() => null));
  if (!action) return fail('That update wasn’t understood.', 400);
  const result = await applyProcession(admin, caseId, action);
  if ('error' in result) return fail(result.error, result.status);
  return json({ procession: result.record });
}
