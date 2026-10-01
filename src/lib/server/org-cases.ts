import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { readiness, slugify, type CaseMeta, type Draft } from '../memorial';
import { resolveBrand, type BrandPart } from '../enterprise';
import { archiveDate, periodOf } from '../plans';
import { loadCaseById } from './cases';
import { refreshPublicPages } from './public-cache';
import { notify, notifyAllowance } from './notify';

// Memorials that belong to a funeral home (memora_cases.org_id). Their staff act
// on them through their roles, not through owning them, so these helpers run
// with the service role after the caller has checked the permission.

export type OrgBrand = { id: string; name: string; logoUrl: string; brandColour: string; footer: string };

/** The funeral home a memorial belongs to, and whether that home can still act. */
export async function caseOrg(admin: SupabaseClient, caseId: string): Promise<{ orgId: string; branchId: string | null; status: string } | null> {
  const { data } = await admin.from('memora_cases').select('org_id, branch_id, memora_orgs(status)').eq('id', caseId).maybeSingle();
  if (!data?.org_id) return null;
  const org = Array.isArray(data.memora_orgs) ? data.memora_orgs[0] : data.memora_orgs;
  return { orgId: data.org_id as string, branchId: (data.branch_id as string | null) ?? null, status: (org as { status?: string } | null)?.status ?? 'disabled' };
}

/**
 * Branding for guests' pages; none when the home is disabled or its group is
 * suspended. In an Enterprise group, the group's locked brand parts win.
 */
export async function orgBrand(admin: SupabaseClient, caseId: string): Promise<OrgBrand | null> {
  const { data } = await admin
    .from('memora_cases')
    .select('memora_orgs(id,name,logo_url,brand_colour,status,memora_accounts(logo_url,brand_colour,brand_footer,brand_locks,status,modules))')
    .eq('id', caseId)
    .maybeSingle();
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  const o = one(data?.memora_orgs as Record<string, any> | Record<string, any>[] | null);
  if (!o || o.status === 'disabled') return null;
  const g = one(o.memora_accounts as Record<string, any> | Record<string, any>[] | null);
  if (g && (g.status === 'suspended' || g.status === 'closed')) return null;
  const governed = g && ((g.modules ?? []) as string[]).includes('brand_governance');
  const b = resolveBrand(
    { name: o.name, logoUrl: o.logo_url, brandColour: o.brand_colour },
    g ? { logoUrl: g.logo_url, brandColour: g.brand_colour, footer: g.brand_footer ?? '', locks: governed ? ((g.brand_locks ?? []) as BrandPart[]) : [] } : null,
  );
  return { id: o.id, name: b.name, logoUrl: b.logoUrl, brandColour: b.brandColour, footer: b.footer };
}

/**
 * DRAFT → PUBLISHED with the service role, after the caller has checked who may
 * publish. Completeness is re-checked from the database, never the browser.
 */
export async function publishCase(admin: SupabaseClient, id: string, actorId: string, metadata: Record<string, unknown>): Promise<{ ok: true; meta: CaseMeta } | { ok: false; error: string; status: number }> {
  const loaded = await loadCaseById(admin, id);
  if (!loaded) return { ok: false, error: 'Memorial not found.', status: 404 };
  const { draft, meta } = loaded as { draft: Draft; meta: CaseMeta };
  if (meta.status === 'PUBLISHED') return { ok: true, meta };
  if (meta.status !== 'DRAFT') return { ok: false, error: 'This memorial cannot be published.', status: 409 };
  const r = readiness(draft);
  if (!r.complete) return { ok: false, error: r.missing[0] ?? 'The memorial is not complete yet.', status: 409 };
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
  if (error || !updated) return { ok: false, error: 'Could not publish the memorial.', status: 500 };
  refreshPublicPages();
  await recordUsage(admin, id, actorId, now);
  await notifyPublished(admin, id, actorId, `${draft.person.preferredName || draft.person.firstName} ${draft.person.lastName}`.trim());
  await admin.from('memora_activity_log').insert({ case_id: id, actor_user_id: actorId, action: 'CASE_PUBLISHED', metadata: { slug, archive_at: archiveAt, ...metadata } });
  return {
    ok: true,
    meta: { ...meta, status: updated.status, slug: updated.slug, publishedAt: updated.published_at, archiveAt: updated.archive_at, updatedAt: updated.updated_at },
  };
}

/**
 * One billable publication for the funeral home the memorial belongs to. The
 * memorial's id is the key, so it is billed once, in the month it was first
 * published; publishing again, editing or restoring it never adds a second.
 */
export async function recordUsage(admin: SupabaseClient, caseId: string, actorId: string, at: Date): Promise<void> {
  const { data: c } = await admin.from('memora_cases').select('org_id,branch_id').eq('id', caseId).maybeSingle();
  if (!c?.org_id) return;
  await admin
    .from('memora_org_usage')
    .upsert({ case_id: caseId, org_id: c.org_id, branch_id: c.branch_id ?? null, period: periodOf(at), published_at: at.toISOString(), published_by: actorId }, { onConflict: 'case_id', ignoreDuplicates: true });
}

/** The family hears their memorial is live (when the home published it); owners hear as the allowance runs out. */
async function notifyPublished(admin: SupabaseClient, caseId: string, actorId: string, name: string): Promise<void> {
  const { data: c } = await admin.from('memora_cases').select('owner_id,org_id,memora_orgs(name)').eq('id', caseId).maybeSingle();
  if (!c?.org_id) return;
  const home = (Array.isArray(c.memora_orgs) ? c.memora_orgs[0] : c.memora_orgs) as { name?: string } | null;
  await notify(
    admin,
    [c.owner_id as string],
    {
      kind: 'published',
      tone: 'good',
      title: `${name || 'The'} memorial is live`,
      body: `${home?.name ?? 'Your funeral home'} published it. Share the link and QR code with family and friends; you can still edit it.`,
      href: `/memorials/${caseId}`,
      key: `published:${caseId}`,
    },
    actorId,
  );
  await notifyAllowance(admin, c.org_id as string, actorId);
}
