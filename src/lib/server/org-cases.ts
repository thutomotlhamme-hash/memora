import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { readiness, slugify, type CaseMeta, type Draft } from '../memorial';
import { archiveDate } from '../plans';
import { loadCaseById } from './cases';
import { refreshPublicPages } from './public-cache';

// Memorials that belong to a funeral home (memora_cases.org_id). Their staff act
// on them through their roles, not through owning them, so these helpers run
// with the service role after the caller has checked the permission.

export type OrgBrand = { id: string; name: string; logoUrl: string; brandColour: string };

/** The funeral home a memorial belongs to, and whether that home can still act. */
export async function caseOrg(admin: SupabaseClient, caseId: string): Promise<{ orgId: string; branchId: string | null; status: string } | null> {
  const { data } = await admin.from('memora_cases').select('org_id, branch_id, memora_orgs(status)').eq('id', caseId).maybeSingle();
  if (!data?.org_id) return null;
  const org = Array.isArray(data.memora_orgs) ? data.memora_orgs[0] : data.memora_orgs;
  return { orgId: data.org_id as string, branchId: (data.branch_id as string | null) ?? null, status: (org as { status?: string } | null)?.status ?? 'disabled' };
}

/** Branding for guests' pages; none when the home is disabled. */
export async function orgBrand(admin: SupabaseClient, caseId: string): Promise<OrgBrand | null> {
  const { data } = await admin.from('memora_cases').select('memora_orgs(id,name,logo_url,brand_colour,status)').eq('id', caseId).maybeSingle();
  const o = (Array.isArray(data?.memora_orgs) ? data?.memora_orgs[0] : data?.memora_orgs) as Record<string, string> | null | undefined;
  if (!o || o.status === 'disabled') return null;
  return { id: o.id, name: o.name, logoUrl: o.logo_url, brandColour: o.brand_colour };
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
  await admin.from('memora_activity_log').insert({ case_id: id, actor_user_id: actorId, action: 'CASE_PUBLISHED', metadata: { slug, archive_at: archiveAt, ...metadata } });
  return {
    ok: true,
    meta: { ...meta, status: updated.status, slug: updated.slug, publishedAt: updated.published_at, archiveAt: updated.archive_at, updatedAt: updated.updated_at },
  };
}
