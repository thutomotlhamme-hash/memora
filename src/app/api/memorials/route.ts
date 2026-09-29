import { MEDIA_BUCKET } from '@/lib/config';
import { normaliseDraft } from '@/lib/memorial';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { saveOwnedDraft } from '@/lib/server/cases';

/** Creates a memorial for the signed-in owner, optionally importing a guest draft. */
export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  const body = (await request.json().catch(() => ({}))) as { draft?: unknown };
  const { data: created, error } = await supabase.from('memora_cases').insert({ owner_id: user.id }).select('id').single();
  if (error || !created) return fail('Could not create the memorial.', 500);

  if (body?.draft) {
    const draft = normaliseDraft(body.draft);
    // A guest portrait is a compressed data URL kept in the browser. Move it into
    // the private bucket now that there is an owner.
    const match = draft.person.portraitUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (match) {
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.byteLength <= 5 * 1024 * 1024) {
        const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
        const path = `${created.id}/portrait-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: match[1], upsert: false });
        if (!uploadError) draft.person.portraitPath = path;
      }
    }
    draft.person.portraitUrl = '';
    try {
      await saveOwnedDraft(supabase, created.id, draft);
    } catch {
      return json({ id: created.id, warning: 'The memorial was created, but some guest details could not be copied.' }, 201);
    }
  }
  return json({ id: created.id }, 201);
}
