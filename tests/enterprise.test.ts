import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUEPRINTS, CONTRACT_STATUS, MODULES, csvCell, lockedParts, parsePeople, parseStructure, resolveBrand, templateReaches, templateToProgramme, toCsv } from '../src/lib/enterprise.ts';
import { accountsOf, can, canAccount, canGrantRole, canIn, regionScope, principalFrom, type Structure } from '../src/lib/rbac.ts';
import { proInvoice } from '../src/lib/plans.ts';

const G = '00000000-0000-0000-0000-0000000000a1';
const OTHER = '00000000-0000-0000-0000-0000000000a2';
const GAUTENG = 'region-gauteng';
const NW = 'region-nw';
const PTA = 'home-pretoria';
const MAH = 'home-mahikeng';
const SOLO = 'home-independent';
const B_PTA = 'branch-pta';
const B_CEN = 'branch-centurion';
const B_MAH = 'branch-mahikeng';
const structure: Structure = {
  accountOrgs: new Map([[G, [PTA, MAH]]]),
  regionBranches: new Map([
    [GAUTENG, [{ orgId: PTA, branchId: B_PTA }, { orgId: PTA, branchId: B_CEN }]],
    [NW, [{ orgId: MAH, branchId: B_MAH }]],
  ]),
};
const as = (roles: string[], regionId: string | null = null, extra: Partial<Structure> = {}) =>
  principalFrom('u', [{ roles: roles as never, orgId: null, accountId: G, regionId }], { structure: { ...structure, ...extra } });

test('a group administrator runs the whole group, and every home in it', () => {
  const p = as(['group_admin']);
  for (const perm of ['group.view', 'group.structure', 'group.people', 'group.reports', 'group.billing', 'group.brand', 'group.templates', 'group.audit', 'group.integrations'] as const) assert.equal(canAccount(p, perm, G), true, perm);
  assert.equal(canAccount(p, 'group.view', OTHER), false, 'not another group');
  assert.equal(canIn(p, 'org.memorials.publish', PTA, B_PTA), true);
  assert.equal(canIn(p, 'org.branches', MAH, null), true, 'owner-level in each home');
  assert.equal(can(p, 'org.view', SOLO), false, 'not a home outside the group');
  assert.equal(regionScope(p, G), 'all');
  assert.deepEqual(accountsOf(p), [G]);
  assert.equal(can(p, 'orgs.billing'), false, 'cannot change the contract');
});

test('a regional manager sees and runs only their region’s branches', () => {
  const p = as(['regional_manager'], GAUTENG);
  assert.equal(canAccount(p, 'group.view', G), true);
  assert.equal(canAccount(p, 'group.reports', G), true);
  assert.equal(canAccount(p, 'group.billing', G), false);
  assert.equal(canAccount(p, 'group.structure', G), false);
  assert.deepEqual(regionScope(p, G), [GAUTENG]);
  assert.equal(canIn(p, 'org.memorials.edit', PTA, B_CEN), true);
  assert.equal(canIn(p, 'org.memorials.edit', MAH, B_MAH), false, 'not North West');
  assert.equal(canIn(p, 'org.branches', PTA, null), false, 'no home-wide control');
  // Appoints branch managers and arrangers in the region; never owners or group roles.
  assert.equal(canGrantRole(p, 'org_admin', PTA, B_PTA), true);
  assert.equal(canGrantRole(p, 'org_staff', PTA, B_CEN), true);
  assert.equal(canGrantRole(p, 'org_admin', MAH, B_MAH), false);
  assert.equal(canGrantRole(p, 'org_owner', PTA, null), false);
  assert.equal(canGrantRole(p, 'group_finance', null, null, { accountId: G }), false);
});

test('finance, brand, reporting and integrations each get only their slice', () => {
  const f = as(['group_finance']);
  assert.equal(canAccount(f, 'group.billing', G), true);
  assert.equal(canIn(f, 'org.memorials.edit', PTA, B_PTA), false, 'finance never edits memorials');
  assert.equal(can(f, 'org.billing.view', PTA), true);
  const b = as(['group_brand']);
  assert.equal(canAccount(b, 'group.brand', G), true);
  assert.equal(canAccount(b, 'group.templates', G), true);
  assert.equal(canAccount(b, 'group.people', G), false);
  assert.equal(canIn(b, 'org.memorials.edit', PTA, B_PTA), false);
  const r = as(['group_reporting']);
  assert.equal(canAccount(r, 'group.audit', G), true);
  assert.equal(can(r, 'org.view', PTA), true);
  assert.equal(canIn(r, 'org.memorials.edit', PTA, B_PTA), false, 'read-only');
  const i = as(['group_integrations']);
  assert.equal(canAccount(i, 'group.integrations', G), true);
  assert.equal(canAccount(i, 'group.reports', G), false);
  assert.equal(can(i, 'org.view', PTA), false);
});

test('a suspended group grants nothing', () => {
  const p = as(['group_admin'], null, { inactiveAccounts: new Set([G]) });
  assert.equal(canAccount(p, 'group.view', G), false);
  assert.equal(can(p, 'org.view', PTA), false);
});

test('appointing in a group: only group admins make group admins', () => {
  const admin = as(['group_admin']);
  assert.equal(canGrantRole(admin, 'group_admin', null, null, { accountId: G }), true);
  assert.equal(canGrantRole(admin, 'regional_manager', null, null, { accountId: G, regionId: GAUTENG }), true);
  assert.equal(canGrantRole(admin, 'regional_manager', null, null, { accountId: G }), false, 'a regional manager needs a region');
  assert.equal(canGrantRole(admin, 'group_finance', null, null, { accountId: G, regionId: GAUTENG }), false, 'group roles are group-wide');
  assert.equal(canGrantRole(admin, 'org_owner', PTA, null), true, 'owners of the group’s homes');
  assert.equal(canGrantRole(admin, 'org_owner', SOLO, null), false);
  assert.equal(canGrantRole(admin, 'group_admin', null, null, { accountId: OTHER }), false);
  const people = principalFrom('u', [{ roles: ['group_reporting'], orgId: null, accountId: G }], { structure });
  assert.equal(canGrantRole(people, 'group_finance', null, null, { accountId: G }), false);
});

test('Memora’s support sees any group, read-only, and never looks like staff', () => {
  const s = principalFrom('s', [{ roles: ['support'], orgId: null }]);
  assert.equal(canAccount(s, 'group.view', G), true);
  assert.equal(canAccount(s, 'group.audit', G), true);
  assert.equal(canAccount(s, 'group.structure', G), false);
  assert.equal(canAccount(s, 'group.billing', G), false);
  assert.deepEqual(accountsOf(s), [], 'not a member of any group');
  const ops = principalFrom('o', [{ roles: ['ops'], orgId: null }]);
  assert.equal(can(ops, 'accounts.manage'), true);
  assert.equal(can(ops, 'orgs.billing'), false, 'provisioning also needs finance');
  const fin = principalFrom('f', [{ roles: ['finance'], orgId: null }]);
  assert.equal(canAccount(fin, 'group.billing', G), true);
  assert.equal(canAccount(fin, 'group.people', G), false);
});

test('existing Pro homes behave exactly as before', () => {
  const owner = principalFrom('o', [{ roles: ['org_owner'], orgId: SOLO }]);
  assert.equal(canGrantRole(owner, 'org_admin', SOLO, 'b1'), true, 'owners still appoint branch managers');
  const manager = principalFrom('m', [{ roles: ['org_admin'], orgId: SOLO, branchId: 'b1' }]);
  assert.equal(canGrantRole(manager, 'org_admin', SOLO, 'b1'), false, 'managers still don’t');
  assert.equal(canGrantRole(manager, 'org_staff', SOLO, 'b1'), true);
  assert.deepEqual(accountsOf(owner), []);
});

test('blueprints configure, they don’t fork', () => {
  for (const b of Object.values(BLUEPRINTS)) {
    for (const m of b.modules) assert.ok(m in MODULES, m);
    assert.ok(b.terms.monthlyFeeMinor > 0 && b.terms.perMemorialMinor > 0);
  }
  assert.ok(BLUEPRINTS.insurer.modules.includes('api_access'));
  assert.deepEqual(BLUEPRINTS.network.brandLocks, [], 'independent homes keep their brands');
  assert.equal(CONTRACT_STATUS.suspended.access, false);
  assert.equal(CONTRACT_STATUS.suspended.billed, false);
  assert.equal(CONTRACT_STATUS.ending.billed, true);
  assert.equal(CONTRACT_STATUS.onboarding.billed, false);
});

test('the provisioning structure box', () => {
  const s = parseStructure(
    ['Gauteng > Motheo Pretoria > Pretoria Central | Arcadia', 'Gauteng > Motheo Pretoria > Centurion', 'Motheo Soweto > Soweto', 'Rustenburg', '# a comment', '', 'North West › Motheo NW › Mahikeng'].join('\n'),
    'Motheo Funeral Group',
  );
  assert.deepEqual(s.errors, []);
  assert.deepEqual(s.regions, ['Gauteng', 'North West']);
  assert.deepEqual(s.homes, ['Motheo Pretoria', 'Motheo Soweto', 'Motheo Funeral Group', 'Motheo NW']);
  assert.equal(s.branches.length, 5);
  assert.deepEqual(s.branches[0], { region: 'Gauteng', home: 'Motheo Pretoria', branch: 'Pretoria Central', area: 'Arcadia' });
  assert.equal(parseStructure('A > B > C > D', 'x').errors.length, 1);
  assert.equal(parseStructure('Home > Soweto\nhome > soweto', 'x').errors.length, 1, 'duplicates are caught');
  assert.deepEqual(parsePeople('082 123 4567\nthandi@motheo.co.za, 082 123 4567;x'), ['082 123 4567', 'thandi@motheo.co.za']);
});

test('brand inheritance: locked parts come from the group', () => {
  const home = { name: 'Motheo Soweto', logoUrl: 'https://x/home.png', brandColour: '#2f6b5a' };
  const group = { logoUrl: 'https://x/group.png', brandColour: '#4a3b7a', footer: 'A Motheo home', locks: ['logo' as const] };
  assert.deepEqual(resolveBrand(home, group), { name: 'Motheo Soweto', logoUrl: 'https://x/group.png', brandColour: '#2f6b5a', footer: 'A Motheo home' });
  assert.equal(resolveBrand({ ...home, brandColour: '' }, group).brandColour, '#4a3b7a', 'unlocked parts fall back to the group');
  assert.equal(resolveBrand(home, null).logoUrl, 'https://x/home.png', 'Pro homes unchanged');
  assert.deepEqual(lockedParts({ logoUrl: 'https://x/new.png', brandColour: '#000000' }, home, ['logo']), ['logo']);
  assert.deepEqual(lockedParts({ logoUrl: home.logoUrl, brandColour: '#000000' }, home, ['logo']), [], 'unchanged locked parts are fine');
});

test('templates reach all branches, chosen regions, or chosen branches', () => {
  const b = { id: B_PTA, regionId: GAUTENG };
  assert.equal(templateReaches({ audience: 'all', audienceIds: [] }, b), true);
  assert.equal(templateReaches({ audience: 'regions', audienceIds: [GAUTENG] }, b), true);
  assert.equal(templateReaches({ audience: 'regions', audienceIds: [NW] }, b), false);
  assert.equal(templateReaches({ audience: 'branches', audienceIds: [B_CEN] }, b), false);
  assert.equal(templateReaches({ audience: 'regions', audienceIds: [GAUTENG] }, { id: 'x', regionId: null }), false);
  let n = 0;
  const items = templateToProgramme(
    [
      { part: 'service', type: 'prayer', title: 'Prayer', minutes: 10 },
      { part: 'service', type: 'hymn', title: 'Hymn', minutes: 55 },
      { part: 'graveside', type: 'committal', title: 'Committal', minutes: 5 },
    ],
    '09:50',
    () => `i${n++}`,
  );
  assert.deepEqual(
    items.map((i) => [i.time, i.title, i.part]),
    [
      ['09:50', 'Prayer', 'service'],
      ['10:00', 'Hymn', 'service'],
      ['10:55', 'Committal', 'graveside'],
    ],
  );
});

test('CSV export is safe to open in a spreadsheet', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+27 82'), "'+27 82");
  assert.equal(csvCell('Pretoria, Central'), '"Pretoria, Central"');
  assert.equal(toCsv(['a', 'b'], [[1, null]]), 'a,b\r\n1,\r\n');
});

test('an enterprise invoice from its contract', () => {
  const inv = proInvoice({ monthlyFeeMinor: 3500000, includedMemorials: 50, perMemorialMinor: 49900, onboardingFeeMinor: 950000, onboardingPaid: false }, 67, true);
  assert.equal(inv.overageMemorials, 17);
  assert.equal(inv.usage, 17 * 49900);
  assert.equal(inv.onboarding, 950000);
  assert.equal(inv.subtotal, 3500000 + 848300 + 950000);
});

test('group reports: per branch, filtered by period, region and status, cut to what you see', async () => {
  const { buildReport } = await import('../src/lib/enterprise.ts');
  const world = {
    regions: [{ id: GAUTENG, name: 'Gauteng' }, { id: NW, name: 'North West' }],
    homes: [{ id: PTA, name: 'Motheo Pretoria' }, { id: MAH, name: 'Motheo NW' }],
    branches: [
      { id: B_PTA, orgId: PTA, name: 'Pretoria Central', regionId: GAUTENG, active: true },
      { id: B_CEN, orgId: PTA, name: 'Centurion', regionId: GAUTENG, active: true },
      { id: B_MAH, orgId: MAH, name: 'Mahikeng', regionId: NW, active: false },
    ],
    funerals: [
      { branchId: B_PTA, ownerId: 'a', status: 'PUBLISHED' as const, funeralDate: '2026-09-10', createdAt: '2026-09-01T08:00:00Z', publishedAt: '2026-09-04T12:00:00Z', hasProgramme: true, fromFamilyLink: true },
      { branchId: B_PTA, ownerId: 'a', status: 'DRAFT' as const, funeralDate: '2026-09-20', createdAt: '2026-09-15T08:00:00Z', publishedAt: null, hasProgramme: false, fromFamilyLink: false },
      { branchId: B_CEN, ownerId: 'b', status: 'PUBLISHED' as const, funeralDate: '2026-10-02', createdAt: '2026-09-25T08:00:00Z', publishedAt: '2026-09-28T12:00:00Z', hasProgramme: true, fromFamilyLink: false },
      { branchId: B_MAH, ownerId: 'c', status: 'PUBLISHED' as const, funeralDate: '2026-09-12', createdAt: '2026-09-05T08:00:00Z', publishedAt: '2026-09-06T12:00:00Z', hasProgramme: true, fromFamilyLink: false },
    ],
    visibleBranchIds: [B_PTA, B_CEN, B_MAH],
  };
  const sept = buildReport(world, { from: '2026-09-01', to: '2026-09-30', status: 'all' });
  const pta = sept.rows.find((r) => r.branchId === B_PTA)!;
  assert.deepEqual([pta.funerals, pta.published, pta.drafts, pta.withProgramme, pta.fromFamilyLinks, pta.avgLeadDays], [2, 1, 1, 1, 1, 6]);
  assert.equal(sept.rows.find((r) => r.branchId === B_CEN)!.funerals, 0, 'October’s funeral is not in September');
  assert.equal(buildReport(world, { from: '2026-09-01', to: '2026-09-30', regionId: NW }).rows.length, 1);
  assert.equal(buildReport(world, { from: '2026-09-01', to: '2026-09-30', status: 'draft' }).rows.find((r) => r.branchId === B_PTA)!.funerals, 1);
  const regional = buildReport({ ...world, visibleBranchIds: [B_PTA, B_CEN] }, { from: '2026-09-01', to: '2026-10-31' });
  assert.deepEqual(regional.rows.map((r) => r.branch), ['Pretoria Central', 'Centurion'], 'a regional manager sees only their branches');
  assert.deepEqual(sept.byArranger.map((x) => [x.ownerId, x.funerals]), [['a', 2], ['c', 1]]);
});
