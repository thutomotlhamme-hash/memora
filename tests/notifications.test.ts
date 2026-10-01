import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowanceNotice, groupRolesWith, homeRolesWith, platformRolesWith, situationalNotices } from '../src/lib/notifications.ts';

test('recipients come from the roles: only people whose role covers it', () => {
  assert.deepEqual(homeRolesWith('org.memorials.edit').sort(), ['org_admin', 'org_owner', 'org_staff']);
  assert.deepEqual(homeRolesWith('org.billing.view'), ['org_owner'], 'only owners hear about invoices');
  assert.deepEqual(groupRolesWith('org.memorials.edit').sort(), ['group_admin', 'regional_manager']);
  assert.deepEqual(groupRolesWith('group.billing').sort(), ['group_admin', 'group_finance']);
  assert.ok(!groupRolesWith('org.memorials.edit').includes('group_finance'), 'finance never hears about memorial work');
  assert.deepEqual(platformRolesWith('orgs.manage').sort(), ['ops', 'platform_admin']);
});

test('situations: unpublished close to the funeral, funeral today, first year ending', () => {
  const today = '2026-10-01';
  const open = (c: { id: string }) => `/memorials/${c.id}`;
  const cases = [
    { id: 'a', name: 'Naledi', status: 'DRAFT' as const, funeralDate: '2026-10-03', yearDaysLeft: null, branch: 'Soweto' },
    { id: 'b', name: 'Thabo', status: 'DRAFT' as const, funeralDate: '2026-10-08', yearDaysLeft: null },
    { id: 'c', name: 'Mpho', status: 'PUBLISHED' as const, funeralDate: '2026-10-01', yearDaysLeft: 360 },
    { id: 'd', name: 'Agnes', status: 'PUBLISHED' as const, funeralDate: '2025-11-20', yearDaysLeft: 60 },
    { id: 'e', name: 'Petrus', status: 'DRAFT' as const, funeralDate: '2026-09-29', yearDaysLeft: null },
  ];
  const staff = situationalNotices(cases, today, 'staff', open);
  assert.deepEqual(staff.map((n) => n.key), ['due:a:2026-10-03', 'today:c:2026-10-01']);
  assert.match(staff[0].title, /in 2 days/);
  assert.match(staff[0].body!, /^Soweto\./);
  const family = situationalNotices(cases, today, 'family', open);
  assert.deepEqual(family.map((n) => n.kind), ['due_unpublished', 'funeral_today', 'year_ending'], 'families also hear about the first year');
});

test('allowance warnings at 80% and when it is used up, once each', () => {
  assert.equal(allowanceNotice(4, 5, '2026-10', 'h', '/x')?.kind, 'allowance_80');
  assert.equal(allowanceNotice(5, 5, '2026-10', 'h', '/x')?.kind, 'allowance_full');
  assert.equal(allowanceNotice(3, 5, '2026-10', 'h', '/x'), null);
  assert.equal(allowanceNotice(6, 5, '2026-10', 'h', '/x'), null, 'not again for every extra one');
  assert.equal(allowanceNotice(12, 15, '2026-10', 'h', '/x')?.kind, 'allowance_80');
  assert.equal(allowanceNotice(3, 0, '2026-10', 'h', '/x'), null, 'pay-as-you-go has no allowance');
});
