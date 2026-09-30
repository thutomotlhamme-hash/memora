import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusScreen } from '@/components/MemorialView';
import { SiteHeader } from '@/components/SiteHeader';
import { GroupCentre, groupTabs, type GroupTab } from '@/components/pro/group/GroupCentre';
import { accountsOf, canAccount } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { loadAccounts, loadGroupWorld, type ReportFilters } from '@/lib/server/enterprise';
import { loadGroups } from '@/lib/server/pro';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Group control centre', robots: { index: false } };

const saToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
const isDate = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isId = (v: string | undefined): v is string => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));

type Search = { account?: string; tab?: string; from?: string; to?: string; region?: string; home?: string; branch?: string; status?: string; welcome?: string };

/** An Enterprise group's control centre. Memora's team opens any group as a clearly marked support view. */
export default async function GroupPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await getAccess();
  const admin = getAdminSupabase();
  if (!admin) return <StatusScreen eyebrow="Memora Enterprise" title="Not switched on yet." body="The site owner needs to finish setup." />;
  if (!access) redirect('/account/login?next=/pro/group');
  const p = access.principal;
  const sp = await searchParams;
  const mine = accountsOf(p);
  const support = p.anyAccount.has('group.view');
  const accountId = isId(sp.account) && (mine.includes(sp.account) || support) ? sp.account : mine[0];
  if (!accountId) {
    return (
      <>
        <SiteHeader />
        <StatusScreen
          eyebrow="Memora Enterprise"
          title={support ? 'Choose a group to open.' : 'You’re not part of a group yet.'}
          body={support ? 'Open an Enterprise group from the command centre.' : 'Ask your head office to add your cellphone number to the group on Memora.'}
          action={
            <Link className="btn" href={support ? '/admin?tab=enterprise' : '/pro/dashboard'}>
              {support ? 'Enterprise in the command centre' : 'Your funeral home'}
            </Link>
          }
        />
      </>
    );
  }
  if (!canAccount(p, 'group.view', accountId)) redirect('/pro/dashboard');
  const w = await loadGroupWorld(admin, accountId, p);
  if (!w) redirect('/pro/group');

  const tabs = groupTabs(p, w);
  const tab = (tabs.find((t) => t.tab === sp.tab)?.tab ?? 'overview') as GroupTab;
  const today = saToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const filters: ReportFilters = {
    from: isDate(sp.from) ? sp.from : monthStart,
    to: isDate(sp.to) ? sp.to : today,
    regionId: isId(sp.region) ? sp.region : undefined,
    homeId: isId(sp.home) ? sp.home : undefined,
    branchId: isId(sp.branch) ? sp.branch : undefined,
    status: sp.status === 'published' || sp.status === 'draft' ? sp.status : 'all',
  };
  const homeGroups = tab === 'people' ? (await Promise.all(w.homes.map((h) => loadGroups(admin, h.id)))).flat() : [];
  const accounts = mine.length > 1 ? (await loadAccounts(admin, mine)).map((a) => ({ id: a.id, name: a.name })) : [];
  return <GroupCentre w={w} p={p} tab={tab} support={!mine.includes(accountId)} today={today} filters={filters} homeGroups={homeGroups} accounts={accounts} />;
}
