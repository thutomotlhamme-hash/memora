import { expect, test } from './fixtures';

test.describe('Memora Pro and the command centre', () => {
  test('the Pro page shows the four ways to run Memora', async ({ page }) => {
    await page.goto('/pro');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('beautifully remembered');
    const plans = page.locator('.pro-plan');
    await expect(plans).toHaveCount(4);
    await expect(plans.nth(0)).toContainText('No monthly fee');
    await expect(plans.nth(0)).toContainText('R1,490 per funeral');
    await expect(page.locator('.pro-plan.featured')).toContainText('R6,500');
    await expect(page.locator('.pro-plan.featured')).toContainText('5 funerals included each month');
    await expect(page.locator('.pro-plan.featured')).toContainText('R899 per additional funeral');
    await expect(plans.nth(2)).toContainText('R14,500');
    await expect(plans.nth(2)).toContainText('15 funerals included each month');
    await expect(plans.nth(2)).toContainText('R699 per additional funeral');
    await expect(plans.nth(2)).toContainText('Up to three branches');
    await page.locator('.pro-plan.featured').getByRole('link').click();
    await expect(page).toHaveURL(/\/contact\?topic=pro/);
    await expect(page.locator('#c-topic')).toHaveValue('pro');
  });

  test('the funeral-home dashboard never shows to someone signed out', async ({ page }) => {
    await page.goto('/pro/dashboard');
    await expect(page.getByText(/Not switched on yet|Log in|log in/).first()).toBeVisible();
    await expect(page.locator('table.board')).toHaveCount(0);
  });

  test('the command centre never shows to someone signed out', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/isn’t set up yet|Log in|log in/).first()).toBeVisible();
    await expect(page.getByText('Running Memora')).toHaveCount(0);
  });

  test('command-centre and funeral-home actions refuse anyone without access', async ({ request, baseURL }) => {
    const headers = { origin: baseURL! };
    const admin = await request.post('/api/admin/actions', { data: { action: 'org.create', name: 'Sneaky Funerals' }, headers });
    expect([401, 403, 404]).toContain(admin.status());
    const self = await request.post('/api/pro/actions', { data: { action: 'org.brand', id: '00000000-0000-0000-0000-000000000000' }, headers });
    expect([401, 403, 503]).toContain(self.status());
    const notAllowed = await request.post('/api/pro/actions', { data: { action: 'org.setPlan' }, headers });
    expect([401, 403]).toContain(notAllowed.status());
  });
});

test.describe('Memora Pro: the offer', () => {
  test('prices are clear: VAT, the onboarding fee, and Enterprise is quoted', async ({ page }) => {
    await page.goto('/pro');
    await expect(page.getByText(/Prices exclude VAT/)).toBeVisible();
    await expect(page.getByText(/once-off onboarding R3,500/)).toBeVisible();
    const enterprise = page.locator('.pro-plan.enterprise');
    await expect(enterprise).toContainText('From R35,000');
    await expect(enterprise).toContainText('Volume rates from R499');
    await expect(enterprise.getByRole('link')).toHaveText('Talk to Memora');
    await expect(page.getByText(/Memora Complete/)).toBeVisible();
    for (const plan of await page.locator('.pro-plan').all()) {
      await expect(plan.getByRole('link')).toHaveAttribute('href', /\/contact\?topic=pro/);
    }
  });

  test('asking for a demo arrives at the contact form ready to send', async ({ page }) => {
    await page.goto('/pro');
    await page.getByRole('link', { name: /demo/i }).first().click();
    await expect(page).toHaveURL(/\/contact\?topic=pro/);
    await expect(page.locator('#c-topic')).toHaveValue('pro');
    await expect(page.locator('#c-message')).toHaveValue(/Memora Pro/);
  });

  test('funeral homes can find Pro from any page', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('.site-footer').getByRole('link', { name: 'For funeral homes' }).click();
    await expect(page).toHaveURL(/\/pro$/);
  });

  test('the Pro page never scrolls sideways on a phone', async ({ page }) => {
    await page.goto('/pro');
    await page.mouse.wheel(0, 4000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Access: signed out means no way in', () => {
  test('the header offers log in, never the command centre or a funeral home', async ({ page }) => {
    await page.goto('/pro');
    const header = page.locator('.site-header');
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Command centre' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Funeral home' })).toHaveCount(0);
  });

  test('the access check answers "nothing" to a stranger', async ({ request }) => {
    const res = await request.get('/api/account/me');
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual({ signedIn: false, team: false, pro: false, group: false });
  });

  test('a funeral home’s dashboard link for a specific home still needs a login', async ({ page }) => {
    await page.goto('/pro/dashboard?home=00000000-0000-0000-0000-00000000000a');
    await expect(page.getByText(/Not switched on yet|Log in|log in/).first()).toBeVisible();
    await expect(page.locator('.cc-groups')).toHaveCount(0);
    await expect(page.getByText('Plan and invoices')).toHaveCount(0);
  });

  test('command-centre tabs cannot be opened by address', async ({ page }) => {
    for (const tab of ['homes', 'billing', 'access', 'audit']) {
      await page.goto(`/admin?tab=${tab}`);
      await expect(page.getByText(/isn’t set up yet|Log in|log in/).first()).toBeVisible();
      await expect(page.locator('.cc-groups, .cc-org-mono')).toHaveCount(0);
    }
  });

  test('starting a memorial for a funeral home needs a signed-in director', async ({ request, baseURL }) => {
    const res = await request.post('/api/memorials', { data: { orgId: '00000000-0000-0000-0000-00000000000a' }, headers: { origin: baseURL! } });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect((await res.json()).error).toBeTruthy();
  });

  test('publishing or running a home’s funeral needs a signed-in director', async ({ request, baseURL }) => {
    const id = '00000000-0000-0000-0000-00000000000c';
    for (const path of [`/api/memorials/${id}/publish`, `/api/memorials/${id}/run-link`]) {
      const res = await request.post(path, { data: {}, headers: { origin: baseURL! } });
      expect(res.status(), path).toBeGreaterThanOrEqual(400);
      expect(res.status(), path).toBeLessThan(500);
      expect((await res.json()).error, path).toBeTruthy();
    }
  });

  test('funeral-home actions refuse cross-site requests and anything outside self-service', async ({ request, baseURL }) => {
    const evil = await request.post('/api/pro/actions', { data: { action: 'group.addMember', groupId: 'x', who: '0721234567' }, headers: { origin: 'https://evil.example' } });
    expect(evil.status()).toBe(403);
    expect((await evil.json()).error).toMatch(/refused/i);
    for (const action of ['org.create', 'org.setStatus', 'invoice.generate', 'group.create', 'group.delete', 'account.resetPassword']) {
      const res = await request.post('/api/pro/actions', { data: { action }, headers: { origin: baseURL! } });
      expect([401, 403], action).toContain(res.status());
    }
  });

  test('command-centre actions refuse cross-site requests', async ({ request }) => {
    const res = await request.post('/api/admin/actions', { data: { action: 'group.addMember', groupId: 'x', who: 'a@b.co' }, headers: { origin: 'https://evil.example' } });
    expect([403, 404]).toContain(res.status());
  });
});

test.describe('Branding', () => {
  test('a family’s own memorial carries no funeral-home branding', async ({ page }) => {
    await page.goto('/m/preview?demo=1');
    await expect(page.getByText('Naledi Magumba').first()).toBeVisible();
    await expect(page.getByText('Arranged with care by')).toHaveCount(0);
  });
});

test.describe('Onboarding and family links', () => {
  test('a made-up link explains itself instead of breaking', async ({ page }) => {
    await page.goto('/join/not-a-real-link');
    await expect(page.getByRole('heading', { name: 'This link isn’t working.' })).toBeVisible();
    await expect(page.getByText('ask whoever sent it for a new one')).toBeVisible();
  });

  test('a link that looks right but is forged is refused', async ({ page }) => {
    await page.goto('/join/00000000-0000-0000-0000-000000000000.forged-signature');
    await expect(page.getByRole('heading', { name: 'This link isn’t working.' })).toBeVisible();
  });

  test('using a link needs an account, and never works cross-site', async ({ request, baseURL }) => {
    const signedOut = await request.post('/api/join', { data: { token: 'x.y' }, headers: { origin: baseURL! } });
    expect([401, 503]).toContain(signedOut.status());
    expect((await signedOut.json()).error).toBeTruthy();
    const evil = await request.post('/api/join', { data: { token: 'x.y' }, headers: { origin: 'https://evil.example' } });
    expect(evil.status()).toBe(403);
  });

  test('links can’t be made or switched off without access', async ({ request, baseURL }) => {
    for (const data of [
      { action: 'invite.create', kind: 'family', orgId: '00000000-0000-0000-0000-00000000000a', label: 'Khumalo family' },
      { action: 'invite.create', kind: 'org', label: 'Sneaky Funerals' },
      { action: 'invite.revoke', id: '00000000-0000-0000-0000-00000000000b' },
    ]) {
      for (const path of ['/api/pro/actions', '/api/admin/actions']) {
        const res = await request.post(path, { data, headers: { origin: baseURL! } });
        expect([401, 403, 404], `${path} ${data.action}`).toContain(res.status());
      }
    }
  });

  test('every funeral-home tab needs a login', async ({ page }) => {
    for (const tab of ['today', 'funerals', 'families', 'team', 'roles', 'branding', 'billing']) {
      await page.goto(`/pro/dashboard?tab=${tab}`);
      await expect(page.getByText(/Not switched on yet|Log in|log in/).first()).toBeVisible();
      await expect(page.locator('.admin-tabs')).toHaveCount(0);
    }
  });

  test('the memorials board filters can’t be opened by address', async ({ page }) => {
    await page.goto('/admin?tab=memorials&status=draft');
    await expect(page.locator('.cc-mem-section')).toHaveCount(0);
  });
});

test.describe('Memora Enterprise: the group layer', () => {
  test('the group control centre never shows to someone signed out', async ({ page }) => {
    await page.goto('/pro/group');
    await expect(page.getByText(/Not switched on yet|Log in|log in/).first()).toBeVisible();
    await expect(page.getByText('Needs attention')).toHaveCount(0);
  });

  test('group actions, reports and templates refuse anyone without access', async ({ request, baseURL }) => {
    const headers = { origin: baseURL! };
    const acct = '00000000-0000-0000-0000-000000000000';
    for (const action of ['account.brand', 'region.create', 'branch.bulk', 'people.bulk', 'template.save', 'apikey.create']) {
      const res = await request.post('/api/group/actions', { data: { action, accountId: acct }, headers });
      expect([401, 403, 503], action).toContain(res.status());
    }
    const provision = await request.post('/api/admin/actions', { data: { action: 'account.provision', name: 'Sneaky Group', structure: 'A > B > C' }, headers });
    expect([401, 403, 404]).toContain(provision.status());
    const contract = await request.post('/api/admin/actions', { data: { action: 'account.contract', accountId: acct, monthly: '1' }, headers });
    expect([401, 403, 404]).toContain(contract.status());
    const csv = await request.get(`/api/group/report?account=${acct}`);
    expect([401, 403, 503]).toContain(csv.status());
    const templates = await request.get(`/api/memorials/${acct}/templates`);
    expect([200, 401, 404]).toContain(templates.status());
    if (templates.status() === 200) expect((await templates.json()).templates).toEqual([]);
    const logo = await request.post('/api/pro/logo', { multipart: { accountId: acct }, headers });
    expect([401, 403, 503]).toContain(logo.status());
  });

  test('a group invite link that isn’t real says so', async ({ page }) => {
    await page.goto('/join/not-a-real-token');
    await expect(page.getByText(/isn’t working|Not switched on/).first()).toBeVisible();
  });
});

test.describe('The first year and the unveiling', () => {
  test('asking about the unveiling needs the family to be signed in', async ({ request, baseURL }) => {
    const res = await request.post('/api/memorials/00000000-0000-0000-0000-000000000000/unveiling', { data: {}, headers: { origin: baseURL! } });
    expect([401, 403, 404, 503]).toContain(res.status());
  });
});

test.describe('The legal pages say what Memora does', () => {
  test('terms cover families, the funeral day, Memora Pro and Enterprise, with live prices', async ({ page }) => {
    await page.goto('/terms');
    for (const h of ['Memora Complete: a family memorial', 'Memorials made with a funeral home', 'On the funeral day', 'Memora Pro: for funeral homes', 'Memora Enterprise', 'Law and disputes']) {
      await expect(page.getByRole('heading', { name: new RegExp(h.split(':')[0]) }).first()).toBeVisible();
    }
    const pro = page.locator('table.legal-table');
    await expect(pro).toContainText('R1,490');
    await expect(pro).toContainText('R6,500');
    await expect(pro).toContainText('R14,500');
    await expect(page.getByText(/A funeral counts once, in the month its memorial is first published/)).toBeVisible();
  });

  test('the privacy policy explains who is responsible, the audit log and location', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Who is responsible for your information' })).toBeVisible();
    await expect(page.getByText(/that funeral home is the responsible party/)).toBeVisible();
    await expect(page.getByText(/Activity records:/)).toBeVisible();
    await expect(page.getByText(/keep only the latest position, never a history/)).toBeVisible();
  });

  test('the Pro page links to the Pro terms', async ({ page }) => {
    await page.goto('/pro');
    await expect(page.getByRole('link', { name: 'Memora Pro terms' })).toHaveAttribute('href', '/terms#pro');
  });
});

test.describe('Notifications', () => {
  test('a stranger has no notifications and can’t mark any', async ({ request, baseURL }) => {
    const res = await request.get('/api/notifications?sync=1');
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual({ items: [], unread: 0 });
    const mark = await request.post('/api/notifications', { data: { id: 'all' }, headers: { origin: baseURL! } });
    expect([401, 403]).toContain(mark.status());
    const keepsake = await request.get('/api/memorials/00000000-0000-0000-0000-000000000000/keepsake');
    expect([401, 404]).toContain(keepsake.status());
    const ready = await request.post('/api/memorials/00000000-0000-0000-0000-000000000000/ready', { headers: { origin: baseURL! } });
    expect([401, 403, 404, 503]).toContain(ready.status());
  });
});

test.describe('Confirming numbers', () => {
  test('codes need a signed-in person, and resets refuse cross-site requests', async ({ request }) => {
    const status = await request.get('/api/account/verify');
    expect([401, 503]).toContain(status.status());
    const send = await request.post('/api/account/verify', { data: { action: 'send' }, headers: { origin: 'https://evil.example' } });
    expect(send.status()).toBe(403);
    const reset = await request.post('/api/account/reset-code', { data: { action: 'send', phone: '0721234567' }, headers: { origin: 'https://evil.example' } });
    expect(reset.status()).toBe(403);
  });

  test('while codes are off, a reset by code says so and the forgot page offers a person', async ({ page, request, baseURL }) => {
    const reset = await request.post('/api/account/reset-code', { data: { action: 'send', phone: '0721234567' }, headers: { origin: baseURL! } });
    expect(reset.status()).toBe(503);
    await page.goto('/account/forgot');
    await page.getByLabel('Cellphone number or email').fill('072 123 4567');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'We’ll sort it out with you.' })).toBeVisible();
  });

  test('confirming your number needs you to log in first', async ({ page }) => {
    await page.goto('/account/confirm?next=/memorials');
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test('the privacy policy says when we message a number', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText(/We message your number only when a one-time code is needed/)).toBeVisible();
    await expect(page.getByText(/Meta \(WhatsApp\) and BulkSMS/)).toBeVisible();
  });
});

test.describe('iKhokha payments', () => {
  test('a callback alone can never mark anything paid', async ({ request }) => {
    const res = await request.post('/api/ikhokha/webhook', { data: { paylinkID: 'fake123', status: 'SUCCESS', externalTransactionID: 'x', responseCode: '00' } });
    expect([400, 503]).toContain(res.status());
    const bad = await request.post('/api/ikhokha/webhook', { data: { paylinkID: '../../etc' } });
    expect([400, 503]).toContain(bad.status());
  });
});
