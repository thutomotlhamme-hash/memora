import { canIn } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { refreshPublicPages } from '@/lib/server/public-cache';
import { getAdminSupabase } from '@/lib/supabase/admin';

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** A funeral home's owner uploads its logo. It shows on its memorials and printed programmes. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  const access = await getAccess();
  if (!admin || !access) return fail('Please log in to continue.', 401);
  const form = await request.formData().catch(() => null);
  const orgId = String(form?.get('orgId') ?? '');
  const file = form?.get('file');
  if (!/^[0-9a-f-]{36}$/i.test(orgId) || !canIn(access.principal, 'org.branding', orgId, null)) return fail('Only the funeral home’s owner can change its logo.', 403);
  if (!(file instanceof File)) return fail('Choose a logo to upload.', 400);
  const ext = TYPES[file.type];
  if (!ext) return fail('Use a PNG, JPG or WebP logo.', 400);
  if (file.size > 1024 * 1024) return fail('The logo must be under 1 MB.', 400);
  const path = `${orgId}/logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('memora-brand').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return fail('Could not upload the logo. Please try again.', 500);
  const url = admin.storage.from('memora-brand').getPublicUrl(path).data.publicUrl;
  await admin.from('memora_orgs').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('id', orgId);
  await admin.from('memora_activity_log').insert({ actor_user_id: access.user.id, action: 'ADMIN_ORG_BRANDING', metadata: { org: orgId, logo: 'uploaded' } });
  refreshPublicPages();
  return json({ url, message: 'Logo saved. It shows on your memorials and printed programmes.' });
}
