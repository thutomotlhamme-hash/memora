import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_PERMISSIONS, ALL_ROLES, PERMISSIONS, ROLES, branchScope, can, canGrantRole, canIn, orgsOf, principalFrom } from '../src/lib/rbac.ts';

const HOME_A = '00000000-0000-0000-0000-00000000000a';
const HOME_B = '00000000-0000-0000-0000-00000000000b';

test('everything is denied unless a role grants it', () => {
  const nobody = principalFrom('u1', []);
  for (const perm of ALL_PERMISSIONS) assert.equal(can(nobody, perm, HOME_A), false, perm);
  assert.equal(can(null, 'ops.view'), false);
});

test('every role only lists real permissions of its own scope, and says what it cannot do', () => {
  for (const r of ALL_ROLES) {
    const def = ROLES[r];
    assert.ok(def.cannot.length > 0, `${r} has no can'ts`);
    for (const perm of def.permissions) assert.equal(PERMISSIONS[perm].scope, def.scope, `${r}: ${perm}`);
  }
});

test('the owners in the server settings are administrators', () => {
  const owner = principalFrom('u1', [], { owner: true });
  for (const perm of ALL_PERMISSIONS) assert.equal(can(owner, perm, HOME_B), true, perm);
});

test('support can help families but not take memorials down, bill or change access', () => {
  const s = principalFrom('u1', [{ roles: ['support'], orgId: null }]);
  assert.equal(can(s, 'accounts.help'), true);
  assert.equal(can(s, 'org.view', HOME_A), true, 'support sees every funeral home');
  assert.equal(can(s, 'memorials.takedown'), false);
  assert.equal(can(s, 'orgs.billing'), false);
  assert.equal(can(s, 'access.manage'), false);
  assert.equal(can(s, 'org.memorials.publish', HOME_A), false);
});

const SOWETO = '00000000-0000-0000-0000-0000000000b1';
const PIMVILLE = '00000000-0000-0000-0000-0000000000b2';

test('funeral-home roles only work inside their own home', () => {
  const a = principalFrom('u1', [{ roles: ['org_staff'], orgId: HOME_A, branchId: SOWETO }]);
  assert.equal(can(a, 'org.memorials.publish', HOME_A), true);
  assert.equal(can(a, 'org.runsheet', HOME_A), true);
  assert.equal(can(a, 'org.view', HOME_B), false);
  assert.equal(can(a, 'org.team', HOME_A), false);
  assert.equal(can(a, 'ops.view'), false, 'no command centre');
  assert.deepEqual(orgsOf(a), [HOME_A]);
});

test('an arranger does everything for their branch’s families, and only their branch', () => {
  const a = principalFrom('u1', [{ roles: ['org_staff'], orgId: HOME_A, branchId: SOWETO }]);
  for (const perm of ['org.view', 'org.memorials.create', 'org.memorials.edit', 'org.memorials.publish', 'org.runsheet'] as const) {
    assert.equal(canIn(a, perm, HOME_A, SOWETO), true, perm);
    assert.equal(canIn(a, perm, HOME_A, PIMVILLE), false, `${perm} in another branch`);
  }
  for (const perm of ['org.team', 'org.branches', 'org.branding', 'org.billing.view'] as const) assert.equal(canIn(a, perm, HOME_A, SOWETO), false, perm);
  assert.deepEqual(branchScope(a, HOME_A), [SOWETO]);
});

test('an owner works across every branch; branch roles never count home-wide', () => {
  const owner = principalFrom('w', [{ roles: ['org_owner'], orgId: HOME_A }]);
  assert.equal(canIn(owner, 'org.memorials.publish', HOME_A, PIMVILLE), true);
  assert.equal(canIn(owner, 'org.branches', HOME_A, null), true);
  assert.equal(branchScope(owner, HOME_A), 'all');
  const manager = principalFrom('m', [{ roles: ['org_admin'], orgId: HOME_A, branchId: SOWETO }]);
  assert.equal(canIn(manager, 'org.memorials.publish', HOME_A, null), false, 'no branch named: home-wide only');
  assert.equal(canIn(manager, 'org.branches', HOME_A, SOWETO), false, 'managers never add or remove branches');
});

test('roles in the wrong kind of group grant nothing', () => {
  const p = principalFrom('u1', [
    { roles: ['platform_admin'], orgId: HOME_A },
    { roles: ['org_owner'], orgId: null },
  ]);
  assert.equal(can(p, 'ops.view'), false);
  assert.equal(can(p, 'org.view', HOME_A), false);
});

test('a disabled funeral home, or a switched-off group, grants nothing', () => {
  const p = principalFrom('u1', [{ roles: ['org_owner'], orgId: HOME_A }], { disabledOrgs: new Set([HOME_A]) });
  assert.equal(can(p, 'org.view', HOME_A), false);
  const off = principalFrom('u1', [{ roles: ['ops'], orgId: null, active: false }]);
  assert.equal(can(off, 'ops.view'), false);
});

test('permissions from several groups add up', () => {
  const p = principalFrom('u1', [
    { roles: ['support'], orgId: null },
    { roles: ['finance'], orgId: null },
  ]);
  assert.equal(can(p, 'accounts.help'), true);
  assert.equal(can(p, 'orgs.billing'), true);
  assert.equal(can(p, 'orgs.manage'), false);
});

test('no one can give out more than they have', () => {
  const admin = principalFrom('a', [{ roles: ['platform_admin'], orgId: null }]);
  const ops = principalFrom('o', [{ roles: ['ops'], orgId: null }]);
  const owner = principalFrom('w', [{ roles: ['org_owner'], orgId: HOME_A }]);
  const manager = principalFrom('m', [{ roles: ['org_admin'], orgId: HOME_A, branchId: SOWETO }]);
  assert.equal(canGrantRole(admin, 'platform_admin', null), true);
  assert.equal(canGrantRole(admin, 'finance', null), true);
  assert.equal(canGrantRole(ops, 'support', null), false, 'ops cannot change access');
  assert.equal(canGrantRole(owner, 'org_staff', HOME_A, SOWETO), true);
  assert.equal(canGrantRole(owner, 'org_staff', HOME_B, SOWETO), false, 'not in another home');
  assert.equal(canGrantRole(owner, 'support', null), false, 'not platform roles');
  assert.equal(canGrantRole(manager, 'org_owner', HOME_A), false, 'a manager cannot make an owner');
  assert.equal(canGrantRole(admin, 'org_owner', null), false, 'funeral-home roles need a home');
});

test('Pro pricing never undercuts families, and invoices add up', async () => {
  const { PRO_PLANS, PRODUCT, proInvoice } = await import('../src/lib/plans.ts');
  for (const plan of Object.values(PRO_PLANS)) assert.ok(plan.perMemorialMinor >= PRODUCT.amountMinor, plan.name);
  const org = { monthlyFeeMinor: 650000, perMemorialMinor: 99900, onboardingFeeMinor: 950000, onboardingPaid: false };
  assert.deepEqual(proInvoice(org, 12, true), { monthly: 650000, usage: 1198800, onboarding: 950000, total: 2798800 });
  assert.equal(proInvoice({ ...org, onboardingPaid: true }, 0, true).total, 650000);
  assert.equal(proInvoice(org, 3, false).onboarding, 0);
});

test('finance bills funeral homes but cannot run them or change memorials', () => {
  const f = principalFrom('u1', [{ roles: ['finance'], orgId: null }]);
  assert.equal(can(f, 'ops.view'), true);
  assert.equal(can(f, 'orgs.billing'), true);
  assert.equal(can(f, 'org.billing.view', HOME_A), true, 'finance sees every home’s bill');
  assert.equal(can(f, 'orgs.manage'), false);
  assert.equal(can(f, 'memorials.takedown'), false);
  assert.equal(can(f, 'org.memorials.edit', HOME_A), false);
  assert.equal(can(f, 'access.manage'), false);
});

test('an auditor can look everywhere and change nothing', () => {
  const a = principalFrom('u1', [{ roles: ['auditor'], orgId: null }]);
  assert.equal(can(a, 'audit.view'), true);
  assert.equal(can(a, 'org.view', HOME_B), true);
  for (const perm of ['orgs.manage', 'orgs.billing', 'memorials.takedown', 'memorials.assign', 'gifts.manage', 'orders.manage', 'accounts.help', 'access.manage'] as const) {
    assert.equal(can(a, perm), false, perm);
  }
  for (const perm of ['org.memorials.create', 'org.memorials.publish', 'org.team', 'org.branding'] as const) assert.equal(can(a, perm, HOME_A), false, perm);
});

test('operations run homes and memorials but cannot hand out roles', () => {
  const o = principalFrom('u1', [{ roles: ['ops'], orgId: null }]);
  assert.equal(can(o, 'orgs.manage'), true);
  assert.equal(can(o, 'memorials.takedown'), true);
  assert.equal(can(o, 'access.manage'), false);
  assert.equal(canGrantRole(o, 'support', null), false);
  assert.equal(canGrantRole(o, 'platform_admin', null), false);
  assert.equal(can(o, 'org.memorials.publish', HOME_A), false, 'publishing stays with the home’s directors');
});

test('an owner appoints branch managers; a branch manager appoints arrangers in their own branch only', () => {
  const owner = principalFrom('w', [{ roles: ['org_owner'], orgId: HOME_A }]);
  assert.equal(canGrantRole(owner, 'org_admin', HOME_A, SOWETO), true);
  assert.equal(canGrantRole(owner, 'org_admin', HOME_A, PIMVILLE), true);
  assert.equal(canGrantRole(owner, 'org_owner', HOME_A), true, 'only an owner makes an owner');
  assert.equal(canGrantRole(owner, 'org_owner', HOME_B), false);

  const m = principalFrom('m', [{ roles: ['org_admin'], orgId: HOME_A, branchId: SOWETO }]);
  assert.equal(canGrantRole(m, 'org_staff', HOME_A, SOWETO), true);
  assert.equal(canGrantRole(m, 'org_staff', HOME_A, PIMVILLE), false, 'not in another branch');
  assert.equal(canGrantRole(m, 'org_admin', HOME_A, SOWETO), false, 'managers don’t appoint managers');
  assert.equal(canGrantRole(m, 'org_owner', HOME_A), false);
  assert.equal(canGrantRole(m, 'ops', null), false, 'never a Memora role');
});

test('each funeral-home role only fits its own level', () => {
  const admin = principalFrom('a', [{ roles: ['platform_admin'], orgId: null }]);
  assert.equal(canGrantRole(admin, 'org_owner', HOME_A, SOWETO), false, 'owners are home-wide');
  assert.equal(canGrantRole(admin, 'org_staff', HOME_A, null), false, 'arrangers belong to a branch');
  assert.equal(canGrantRole(admin, 'org_admin', HOME_A, null), false, 'managers belong to a branch');
  assert.equal(canGrantRole(admin, 'org_staff', HOME_A, SOWETO), true);
});

test('there are three funeral-home roles: owner, branch manager, arranger', () => {
  assert.deepEqual(ALL_ROLES.filter((r) => ROLES[r].scope === 'org'), ['org_owner', 'org_admin', 'org_staff']);
});

test('being in two homes keeps each home’s roles apart', () => {
  const p = principalFrom('u1', [
    { roles: ['org_owner'], orgId: HOME_A },
    { roles: ['org_staff'], orgId: HOME_B, branchId: PIMVILLE },
  ]);
  assert.deepEqual(orgsOf(p).sort(), [HOME_A, HOME_B]);
  assert.equal(can(p, 'org.memorials.publish', HOME_A), true);
  assert.equal(canIn(p, 'org.memorials.publish', HOME_B, PIMVILLE), true);
  assert.equal(canIn(p, 'org.memorials.publish', HOME_B, SOWETO), false);
  assert.equal(can(p, 'org.billing.view', HOME_B), false);
  assert.equal(canGrantRole(p, 'org_staff', HOME_B, PIMVILLE), false);
});

test('without a home named, a funeral-home permission is not granted', () => {
  const d = principalFrom('u1', [{ roles: ['org_owner'], orgId: HOME_A }]);
  assert.equal(can(d, 'org.view'), false);
  assert.equal(can(null, 'org.view', HOME_A), false);
  assert.equal(can(null, 'ops.view'), false);
});

test('the roles the database lets edit a home’s memorials match the code', async () => {
  const { ORG_EDIT_ROLES } = await import('../src/lib/rbac.ts');
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../supabase/migrations/0012_memora_branches.sql', import.meta.url), 'utf8');
  const fn = sql.slice(sql.indexOf('function public.memora_org_edits'));
  const listed = [...(fn.match(/g\.roles && array\[([^\]]+)\]/)?.[1].matchAll(/'([a-z_]+)'/g) ?? [])].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), [...ORG_EDIT_ROLES].sort());
});

test('every role says who it is for', () => {
  for (const r of ALL_ROLES) assert.ok((ROLES[r] as { forWho: string }).forWho.length > 10, r);
});

test('helping someone log in and suspending an account are separate powers', () => {
  const support = principalFrom('s', [{ roles: ['support'], orgId: null }]);
  const ops = principalFrom('o', [{ roles: ['ops'], orgId: null }]);
  const finance = principalFrom('f', [{ roles: ['finance'], orgId: null }]);
  assert.equal(can(support, 'accounts.help'), true, 'support sends reset links');
  assert.equal(can(support, 'accounts.suspend'), false, 'but can’t suspend');
  assert.equal(can(ops, 'accounts.suspend'), true);
  assert.equal(can(finance, 'accounts.help'), false);
  const owner = principalFrom('w', [{ roles: ['org_owner'], orgId: HOME_A }]);
  assert.equal(can(owner, 'accounts.help'), false, 'a funeral home can’t reset anyone’s password');
});
