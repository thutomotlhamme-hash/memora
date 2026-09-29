import { MEDIA_BUCKET } from '@/lib/config';
import { normaliseDraft, readiness } from '@/lib/memorial';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { saveOwnedDraft } from '@/lib/server/cases';

type Ctx = { params: Promise<{ id: string }> };

/** Saves the whole draft atomically. */
export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { data: c } = await supabase.from('memora_cases').select('id,status,updated_at').eq('id', id).maybeSingle();
  if (!c) return fail('Memorial not found.', 404);

  const body = (await request.json().catch(() => null)) as { draft?: unknown; baseUpdatedAt?: string } | null;
  // Someone (e.g. the funeral-day coordinator) changed it since this editor loaded:
  // never silently overwrite their changes.
  if (body?.baseUpdatedAt && new Date(c.updated_at).getTime() > new Date(body.baseUpdatedAt).getTime()) {
    return fail('This memorial was changed somewhere else (for example on the funeral-day run-sheet). Reload to get the latest version.', 409, { code: 'STALE' });
  }
  if (!body?.draft) return fail('Nothing to save.', 400);
  const draft = normaliseDraft(body.draft);
  // Only keep a portrait path that belongs to this memorial's own folder.
  if (draft.person.portraitPath && !draft.person.portraitPath.startsWith(`${id}/`)) draft.person.portraitPath = '';

  // A live memorial is public: never let a save leave it half-empty.
  if (c.status === 'PUBLISHED') {
    const r = readiness(draft);
    if (!r.complete) return fail(`This memorial is live, so it must stay complete. ${r.missing[0] ?? ''}`.trim(), 409, { code: 'LIVE_INCOMPLETE' });
  }

  try {
    const updatedAt = await saveOwnedDraft(supabase, id, draft);
    return json({ updatedAt });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not save.', 500);
  }
}

/** Deletes an unpublished memorial and its private media. */
export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { data: c } = await supabase.from('memora_cases').select('id,status').eq('id', id).maybeSingle();
  if (!c) return fail('Memorial not found.', 404);
  if (c.status !== 'DRAFT') return fail('Published memorials cannot be deleted.', 409);

  const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(id, { limit: 100 });
  if (files?.length) await supabase.storage.from(MEDIA_BUCKET).remove(files.map((f) => `${id}/${f.name}`));

  const { error } = await supabase.from('memora_cases').delete().eq('id', id);
  if (error) return fail('This memorial has payment records, so it cannot be deleted.', 409);
  return json({ deleted: true });
}
