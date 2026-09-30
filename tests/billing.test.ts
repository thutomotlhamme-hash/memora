import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRODUCT, PRO_PLANS, billableUsage, periodOf, periodRange, planLabel, proInvoice, type BillingTerms, type ProPlan, type Publication } from '../src/lib/plans.ts';

const termsOf = (plan: ProPlan, onboardingPaid = true): BillingTerms => ({
  monthlyFeeMinor: PRO_PLANS[plan].monthlyMinor,
  includedMemorials: PRO_PLANS[plan].includedMemorials,
  perMemorialMinor: PRO_PLANS[plan].overageMinor,
  onboardingFeeMinor: PRO_PLANS[plan].onboardingMinor,
  onboardingPaid,
});

test('the family product is untouched: Memora Complete is R899 once-off', () => {
  assert.equal(PRODUCT.amountMinor, 89900);
  assert.equal(PRODUCT.publicDays, 365);
});

test('the Pro price list', () => {
  assert.deepEqual(
    Object.fromEntries((Object.keys(PRO_PLANS) as ProPlan[]).map((p) => [p, [PRO_PLANS[p].monthlyMinor, PRO_PLANS[p].includedMemorials, PRO_PLANS[p].overageMinor, PRO_PLANS[p].onboardingMinor, PRO_PLANS[p].branches]])),
    {
      payg: [0, 0, 149000, 0, 1],
      pro: [650000, 5, 89900, 350000, 1],
      pro_plus: [1450000, 15, 69900, 650000, 3],
      enterprise: [3500000, 50, 49900, 950000, null],
    },
  );
  assert.equal(planLabel('payg'), 'Pro PAYG · R1,490 / funeral');
  assert.equal(planLabel('pro'), 'Pro · R6,500/mo · 5 included · R899 extra');
  assert.equal(planLabel('pro_plus'), 'Pro Plus · R14,500/mo · 15 included · R699 extra');
  assert.equal(planLabel('enterprise'), 'Enterprise · Custom contract · from R35,000/mo');
  assert.ok(PRO_PLANS.enterprise.quoted, 'Enterprise is contracted, not checked out');
});

test('Pay-as-you-go: no monthly fee, every funeral at R1,490, no onboarding', () => {
  const none = proInvoice(termsOf('payg', false), 0, true);
  assert.equal(none.subtotal, 0);
  const inv = proInvoice(termsOf('payg', false), 4, true);
  assert.equal(inv.overageMemorials, 4);
  assert.equal(inv.usage, 4 * 149000);
  assert.equal(inv.onboarding, 0);
  assert.equal(inv.subtotal, 596000);
  assert.equal(inv.vat, 89400);
  assert.equal(inv.totalInclVat, 685400);
});

test('Pro: five funerals included, then R899 each; onboarding on the first invoice only', () => {
  assert.equal(proInvoice(termsOf('pro'), 0, false).subtotal, 650000, 'the base fee is due even in a quiet month');
  assert.equal(proInvoice(termsOf('pro'), 5, false).subtotal, 650000, 'five are included');
  const busy = proInvoice(termsOf('pro'), 8, false);
  assert.equal(busy.overageMemorials, 3);
  assert.equal(busy.usage, 3 * 89900);
  assert.equal(busy.subtotal, 650000 + 269700);
  const first = proInvoice(termsOf('pro', false), 2, true);
  assert.equal(first.onboarding, 350000);
  assert.equal(proInvoice(termsOf('pro', false), 2, false).onboarding, 0, 'not on later invoices');
  assert.equal(proInvoice(termsOf('pro', true), 2, true).onboarding, 0, 'not once paid');
});

test('Pro Plus: fifteen included, then R699 each', () => {
  assert.equal(proInvoice(termsOf('pro_plus'), 15, false).subtotal, 1450000);
  const inv = proInvoice(termsOf('pro_plus'), 21, false);
  assert.equal(inv.overageMemorials, 6);
  assert.equal(inv.subtotal, 1450000 + 6 * 69900);
});

test('Enterprise: the contract’s own terms, the same engine', () => {
  const contract: BillingTerms = { monthlyFeeMinor: 3500000, includedMemorials: 50, perMemorialMinor: 49900, onboardingFeeMinor: 950000, onboardingPaid: true };
  const inv = proInvoice(contract, 67, false);
  assert.equal(inv.overageMemorials, 17);
  assert.equal(inv.usage, 17 * 49900);
  assert.equal(inv.subtotal, 3500000 + 848300);
  const negotiated = proInvoice({ ...contract, monthlyFeeMinor: 4200000, includedMemorials: 80, perMemorialMinor: 42500 }, 95, false);
  assert.equal(negotiated.subtotal, 4200000 + 15 * 42500, 'overrides flow straight through');
});

test('credits and adjustments, and an invoice never goes below zero', () => {
  const inv = proInvoice(termsOf('pro'), 6, false, -89900);
  assert.equal(inv.subtotal, 650000);
  assert.equal(inv.adjustments, -89900);
  assert.equal(proInvoice(termsOf('payg'), 0, false, -50000).subtotal, 0);
  assert.equal(proInvoice(termsOf('pro'), 0, false, 25000).subtotal, 675000);
});

test('usage: only published memorials, counted once, in the month first published', () => {
  const rows: Publication[] = [
    { caseId: 'a', orgId: 'home', status: 'PUBLISHED', publishedAt: '2026-09-03T08:00:00Z' },
    { caseId: 'a', orgId: 'home', status: 'PUBLISHED', publishedAt: '2026-09-20T08:00:00Z' }, // re-published after an edit
    { caseId: 'b', orgId: 'home', status: 'ARCHIVED', publishedAt: '2026-09-10T08:00:00Z' }, // taken down later: still billed
    { caseId: 'c', orgId: 'home', status: 'DRAFT', publishedAt: null }, // draft / family link never finished
    { caseId: 'd', orgId: 'home', status: 'DRAFT', publishedAt: '2026-09-11T08:00:00Z' }, // a preview never counts
    { caseId: 'e', orgId: 'other', status: 'PUBLISHED', publishedAt: '2026-09-12T08:00:00Z' },
    { caseId: 'f', orgId: 'home', status: 'PUBLISHED', publishedAt: '2026-08-31T21:30:00Z' }, // 23:30 SA time on 31 Aug
    { caseId: 'g', orgId: 'home', status: 'PUBLISHED', publishedAt: '2026-08-31T22:30:00Z' }, // 00:30 SA time on 1 Sept
  ];
  const sept = billableUsage(rows, '2026-09');
  assert.equal(sept.get('home'), 3, 'a, b and g');
  assert.equal(sept.get('other'), 1);
  assert.equal(billableUsage(rows, '2026-08').get('home'), 1, 'f belongs to August');
  assert.equal(billableUsage(rows, '2026-10').get('home'), undefined, 'the allowance resets each month');
});

test('billing months run on South African time', () => {
  assert.equal(periodOf(new Date('2026-09-30T22:30:00Z')), '2026-10');
  assert.equal(periodOf(new Date('2026-09-30T21:30:00Z')), '2026-09');
  assert.deepEqual(periodRange('2026-10'), ['2026-09-30T22:00:00.000Z', '2026-10-31T22:00:00.000Z']);
});
