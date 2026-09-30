import { canAccount, canIn } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { fail, json, sameOrigin } from '@/lib/server/http';
import { refreshPublicPages } from '@/lib/server/public-cache';
import { getAdminSupabase } from '@/lib/supabase/admin';

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/**
 * A funeral home's owner uploads its logo, or an Enterprise group's brand team
 * uploads the master logo. It shows on memorials and printed programmes.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const admin = getAdminSupabase();
  const access = await getAccess();
  if (!admin || !access) return fail('Please log in to continue.', 401);
  const form = await request.formData().catch(() => null);
  const orgId = String(form?.get('orgId') ?? '');
  const accountId = String(form?.get('accountId') ?? '');
  const file = form?.get('file');
  const forGroup = isId(accountId);
  if (forGroup ? !canAccount(access.principal, 'group.brand', accountId) : !isId(orgId) || !canIn(access.principal, 'org.branding', orgId, null))
    return fail(forGroup ? 'Only the group’s brand team can change its logo.' : 'Only the funeral home’s owner can change its logo.', 403);
  if (!forGroup) {
    // A group that sets the logo for every home: the home can't replace it.
    const { data: cur } = await admin.from('memora_orgs').select('memora_accounts(brand_locks,modules)').eq('id', orgId).maybeSingle();
    const acc = (Array.isArray(cur?.memora_accounts) ? cur?.memora_accounts[0] : cur?.memora_accounts) as { brand_locks?: string[]; modules?: string[] } | null | undefined;
    if (acc?.modules?.includes('brand_governance') && acc.brand_locks?.includes('logo')) return fail('Your group sets the logo for every home. Ask head office to change it.', 403);
  }
  if (!(file instanceof File)) return fail('Choose a logo to upload.', 400);
  const ext = TYPES[file.type];
  if (!ext) return fail('Use a PNG, JPG or WebP logo.', 400);
  if (file.size > 5 * 1024 * 1024) return fail('The logo must be under 5 MB.', 400);
  const owner = forGroup ? `group-${accountId}` : orgId;
  const path = `${owner}/logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('memora-brand').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return fail('Could not upload the logo. Please try again.', 500);
  const url = admin.storage.from('memora-brand').getPublicUrl(path).data.publicUrl;
  const now = new Date().toISOString();
  if (forGroup) await admin.from('memora_accounts').update({ logo_url: url, updated_at: now }).eq('id', accountId);
  else await admin.from('memora_orgs').update({ logo_url: url, updated_at: now }).eq('id', orgId);
  const { data: org } = forGroup ? { data: null } : await admin.from('memora_orgs').select('account_id').eq('id', orgId).maybeSingle();
  await admin.from('memora_activity_log').insert({
    actor_user_id: access.user.id,
    action: forGroup ? 'ADMIN_BRAND_CHANGED' : 'ADMIN_ORG_BRANDING',
    metadata: { ...(forGroup ? {} : { org: orgId }), logo: 'uploaded' },
    account_id: forGroup ? accountId : (org?.account_id ?? null),
    org_id: forGroup ? null : orgId,
  });
  refreshPublicPages();
  return json({ url, message: forGroup ? 'Logo saved. Every home in the group shows it.' : 'Logo saved. It shows on your memorials and printed programmes.' });
}
