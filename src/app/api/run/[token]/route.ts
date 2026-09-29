import { getAdminSupabase } from '@/lib/supabase/admin';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { applyRunUpdate, loadRunSnapshot, verifyRunToken, type RunUpdate } from '@/lib/server/run';

type Ctx = { params: Promise<{ token: string }> };

async function authorise(token: string) {
  const admin = getAdminSupabase();
  if (!admin) return { error: fail('Not configured.', 503) } as const;
  const caseId = await verifyRunToken(admin, decodeURIComponent(token));
  if (!caseId) return { error: fail('This run-sheet link is no longer valid. Ask the family for the new link.', 404) } as const;
  return { admin, caseId } as const;
}

/** The coordinator's current view of the day. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await authorise((await params).token);
  if ('error' in auth) return auth.error;
  const snap = await loadRunSnapshot(auth.admin, auth.caseId);
  return snap ? json(snap) : fail('Memorial not found.', 404);
}

/** Apply a change from the coordinator: programme, stop times and/or the live item. */
export async function POST(request: Request, { params }: Ctx) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const auth = await authorise((await params).token);
  if ('error' in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as RunUpdate | null;
  if (!body || typeof body.base !== 'string') return fail('Missing base version.', 400);
  // Guests always need an order of service to follow; the family can switch it off in the editor.
  if (body.programme !== undefined && (!Array.isArray(body.programme) || body.programme.length === 0)) {
    return fail('Keep at least one item in the programme.', 400);
  }
  const result = await applyRunUpdate(auth.admin, auth.caseId, body);
  const snap = await loadRunSnapshot(auth.admin, auth.caseId);
  if (result === 'stale') return json({ error: 'Someone else changed the programme a moment ago. Here’s the latest version.', code: 'STALE', snapshot: snap }, 409);
  if (result === 'not_found' || !snap) return fail('Memorial not found.', 404);
  return json(snap);
}
