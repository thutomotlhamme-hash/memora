import { MEDIA_BUCKET } from '@/lib/config';
import { can } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { normaliseDraft } from '@/lib/memorial';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { saveOwnedDraft } from '@/lib/server/cases';

/** Creates a memorial for the signed-in owner, optionally importing a guest draft. */
export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  const body = (await request.json().catch(() => ({}))) as { draft?: unknown; orgId?: string };
  // Starting a memorial for a funeral home needs that home's permission, and a home that isn't disabled.
  const orgId = typeof body.orgId === 'string' && /^[0-9a-f-]{36}$/i.test(body.orgId) ? body.orgId : null;
  const admin = orgId ? getAdminSupabase() : null;
  if (orgId) {
    const access = await getAccess();
    if (!admin || !can(access?.principal ?? null, 'org.memorials.create', orgId)) return fail('You can’t start memorials for this funeral home.', 403);
    const { data: org } = await admin.from('memora_orgs').select('status').eq('id', orgId).maybeSingle();
    if (!org || org.status === 'disabled') return fail('This funeral home’s Memora is switched off. Contact Memora.', 403);
  }
  const { data: created, error } = await supabase.from('memora_cases').insert({ owner_id: user.id }).select('id').single();
  if (error || !created) return fail('Could not create the memorial.', 500);
  if (orgId && admin) {
    await admin.from('memora_cases').update({ org_id: orgId }).eq('id', created.id);
    await admin.from('memora_activity_log').insert({ case_id: created.id, actor_user_id: user.id, action: 'CASE_CREATED_FOR_HOME', metadata: { org: orgId } });
  }

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
