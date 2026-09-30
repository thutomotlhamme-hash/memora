import { toCsv } from '@/lib/enterprise';
import { canAccount } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { buildReport, loadGroupWorld, type ReportFilters } from '@/lib/server/enterprise';
import { fail } from '@/lib/server/http';
import { getAdminSupabase } from '@/lib/supabase/admin';

const isDate = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isId = (v: string | null): v is string => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));

/** The group report as CSV, cut to what this person may see. Numbers only: no family stories or contact details. */
export async function GET(request: Request) {
  const admin = getAdminSupabase();
  const access = await getAccess();
  if (!admin || !access) return fail('Please log in to continue.', 401);
  const q = new URL(request.url).searchParams;
  const accountId = q.get('account');
  if (!isId(accountId) || !canAccount(access.principal, 'group.reports', accountId)) return fail('You don’t have permission to do that.', 403);
  const w = await loadGroupWorld(admin, accountId, access.principal);
  if (!w) return fail('Group not found.', 404);
  if (!w.account.modules.includes('advanced_reporting')) return fail('Report exports aren’t part of this group’s agreement.', 403);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
  const f: ReportFilters = {
    from: isDate(q.get('from')) ? q.get('from')! : `${today.slice(0, 7)}-01`,
    to: isDate(q.get('to')) ? q.get('to')! : today,
    regionId: isId(q.get('region')) ? q.get('region')! : undefined,
    homeId: isId(q.get('home')) ? q.get('home')! : undefined,
    branchId: isId(q.get('branch')) ? q.get('branch')! : undefined,
    status: q.get('status') === 'published' || q.get('status') === 'draft' ? (q.get('status') as 'published' | 'draft') : 'all',
  };
  const { rows } = buildReport(w, f);
  const csv = toCsv(
    ['Region', 'Funeral home', 'Branch', 'Branch active', 'Funerals', 'Published', 'Drafts', 'With programme', 'From family links', 'Average lead (days)', 'Last activity'],
    rows.map((r) => [r.region, r.home, r.branch, r.active ? 'yes' : 'no', r.funerals, r.published, r.drafts, r.withProgramme, r.fromFamilyLinks, r.avgLeadDays ?? '', r.lastActivity?.slice(0, 10) ?? '']),
  );
  await admin.from('memora_activity_log').insert({ actor_user_id: access.user.id, action: 'ADMIN_REPORT_EXPORTED', metadata: { from: f.from, to: f.to, rows: rows.length }, account_id: accountId });
  const name = `${w.account.slug}-report-${f.from}-to-${f.to}.csv`;
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });
}
