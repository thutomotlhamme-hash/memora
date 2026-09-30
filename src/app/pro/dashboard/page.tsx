import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusScreen } from '@/components/MemorialView';
import { SiteHeader } from '@/components/SiteHeader';
import { Studio, type Persona, type Stage, type StudioFuneral, type StudioTab } from '@/components/pro/studio/Studio';
import { accountLabel } from '@/lib/account-id';
import { branchScope, can, canIn, orgsOf, principalFrom, type Role } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { loadAdminCases } from '@/lib/server/admin';
import { loadInvites } from '@/lib/server/invites';
import { loadBranches, loadGroups, loadInvoices, loadOrgs } from '@/lib/server/pro';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Funeral home', robots: { index: false } };

const TABS: StudioTab[] = ['today', 'funerals', 'families', 'print', 'team', 'branding', 'billing', 'roles'];
const TAB_PERM = {
  today: 'org.view',
  funerals: 'org.view',
  families: 'org.memorials.create',
  print: 'org.memorials.edit',
  team: 'org.team',
  branding: 'org.branding',
  billing: 'org.billing.view',
  roles: 'org.view',
} as const;
const saToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Row = Record<string, any>;

/** The funeral home's workspace: loads what this person may see, then hands it to the Studio. */
export default async function ProDashboard({ searchParams }: { searchParams: Promise<{ home?: string; tab?: string; welcome?: string; branch?: string; as?: string; view?: string; month?: string }> }) {
  const access = await getAccess();
  const admin = getAdminSupabase();
  if (!admin) return <StatusScreen eyebrow="Memora Pro" title="Not switched on yet." body="The site owner needs to finish setup." />;
  if (!access) redirect('/account/login?next=/pro/dashboard');
  const real = access.principal;
  const sp = await searchParams;

  // "Funeral home" is for the homes you belong to. Memora's team can still open
  // any home from the command centre (?home=…), clearly marked as a support view.
  const mine = orgsOf(real);
  const support = real.anyOrg.has('org.view');
  const myOrgs = await loadOrgs(admin, mine);
  const visiting = sp.home && !mine.includes(sp.home) && support ? (await loadOrgs(admin, [sp.home]))[0] : undefined;
  if (!myOrgs.length && !visiting) {
    return (
      <>
        <SiteHeader />
        <StatusScreen
          eyebrow="Memora Pro"
          title={support ? 'You’re not in a funeral home yourself.' : 'You’re not part of a funeral home yet.'}
          body={
            support
              ? 'To help a funeral home, open it from the command centre. To run your own, add your number to its Owners group.'
              : `You’re signed in as ${accountLabel(access.user.email)}. Ask your funeral home’s owner or manager to add this number to their team.`
          }
          action={
            <Link className="btn" href={support ? '/admin?tab=homes' : '/pro'}>
              {support ? 'Funeral homes in the command centre' : 'About Memora Pro'}
            </Link>
          }
        />
      </>
    );
  }
  const org = visiting ?? myOrgs.find((o) => o.id === sp.home) ?? myOrgs[0];
  if (!can(real, 'org.view', org.id)) redirect('/pro/dashboard');
  const branches = await loadBranches(admin, org.id);

  // "See as": owners and Memora's team can preview exactly what each role sees.
  const canPreview = support || canIn(real, 'org.branches', org.id, null);
  const previewOptions: { key: string; label: string; grant: { roles: Role[]; orgId: string; branchId: string | null } }[] = [
    { key: 'owner', label: 'Owner', grant: { roles: ['org_owner'], orgId: org.id, branchId: null } },
    ...branches.flatMap((b) => [
      { key: `manager:${b.id}`, label: `Manager · ${b.name}`, grant: { roles: ['org_admin'] as Role[], orgId: org.id, branchId: b.id } },
      { key: `arranger:${b.id}`, label: `Arranger · ${b.name}`, grant: { roles: ['org_staff'] as Role[], orgId: org.id, branchId: b.id } },
    ]),
  ];
  const preview = canPreview ? previewOptions.find((o) => o.key === sp.as) : undefined;
  const p = preview ? principalFrom(real.userId, [preview.grant]) : real;

  // What this person is here to do comes first.
  const persona: Persona = canIn(p, 'org.branches', org.id, null)
    ? 'owner'
    : [...(p.branches.get(org.id)?.values() ?? [])].some((s) => s.has('org.team'))
      ? 'manager'
      : 'arranger';
  const requested = TABS.find((t) => t === sp.tab) ?? 'today';
  const tab: StudioTab = can(p, TAB_PERM[requested], org.id) ? requested : 'today';

  const scope = branchScope(p, org.id);
  const myBranches = scope === 'all' ? branches : branches.filter((b) => scope.includes(b.id));
  const onlyBranch = myBranches.find((b) => b.id === sp.branch)?.id ?? null;
  const inView = (branchId: string | null | undefined) => (onlyBranch ? branchId === onlyBranch : scope === 'all' || (branchId != null && scope.includes(branchId)));

  const [{ data: links }, cases, groups, invoices, families] = await Promise.all([
    admin.from('memora_cases').select('id,branch_id').eq('org_id', org.id),
    loadAdminCases(admin),
    loadGroups(admin, org.id),
    can(p, 'org.billing.view', org.id) ? loadInvoices(admin, org.id) : Promise.resolve([]),
    can(p, 'org.memorials.create', org.id) ? loadInvites(admin, 'family', org.id) : Promise.resolve([]),
  ]);
  const branchOf = new Map(((links ?? []) as Row[]).map((l) => [l.id as string, (l.branch_id as string | null) ?? null]));
  const visible = cases.filter((c) => branchOf.has(c.id) && inView(branchOf.get(c.id)));
  const { data: stops } = visible.length
    ? await admin
        .from('memora_stops')
        .select('case_id,event_date,event_time,title,address_text,sort_order')
        .in(
          'case_id',
          visible.map((c) => c.id),
        )
        .order('sort_order')
    : { data: [] as Row[] };
  const firstStop = new Map<string, Row>();
  for (const s of (stops ?? []) as Row[]) if (!firstStop.has(s.case_id)) firstStop.set(s.case_id, s);
  const fromLink = new Map(families.filter((f) => f.caseId).map((f) => [f.caseId!, f.label]));

  const today = saToday();
  const weekEnd = addDays(today, 7);
  const stageOf = (status: string, date: string | null): Stage =>
    status === 'ARCHIVED' || (date && date < today) ? 'past' : date && date <= weekEnd ? 'soon' : status === 'DRAFT' ? 'drafts' : 'upcoming';
  const funerals: StudioFuneral[] = visible
    .map((c) => {
      const s = firstStop.get(c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.status as StudioFuneral['status'],
        slug: c.slug,
        funeralDate: c.funeralDate,
        time: s?.event_time ? String(s.event_time).slice(0, 5) : '',
        venue: s ? String(s.address_text || s.title || '').split(',')[0] : '',
        branchId: branchOf.get(c.id) ?? null,
        madeBy: accountLabel(c.ownerEmail) || '—',
        own: c.ownerEmail.toLowerCase() === access.user.email.toLowerCase(),
        family: fromLink.get(c.id) ?? null,
        updatedAt: c.updatedAt,
        stage: stageOf(c.status, c.funeralDate),
      };
    })
    .sort((a, b) => (a.stage === 'past' && b.stage === 'past' ? (b.funeralDate ?? '').localeCompare(a.funeralDate ?? '') : (a.funeralDate ?? '9999').localeCompare(b.funeralDate ?? '9999')));

  return (
    <Studio
      p={p}
      persona={persona}
      org={org}
      homes={visiting ? [] : myOrgs.map((o) => ({ id: o.id, name: o.name }))}
      visiting={Boolean(visiting)}
      canPreview={canPreview}
      preview={preview ? { key: preview.key, label: preview.label } : null}
      previewOptions={previewOptions.map(({ key, label }) => ({ key, label }))}
      branches={branches}
      myBranches={myBranches}
      allBranchesInScope={scope === 'all'}
      onlyBranch={onlyBranch}
      funerals={funerals}
      groups={groups}
      invoices={invoices}
      families={families.filter((f) => inView(f.branchId))}
      user={{ id: access.user.id, firstName: (access.user.name || '').split(/\s+/)[0] || '' }}
      tab={tab}
      view={sp.view === 'month' ? 'month' : 'list'}
      month={/^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? '') ? sp.month! : today.slice(0, 7)}
      today={today}
      welcome={Boolean(sp.welcome)}
    />
  );
}
