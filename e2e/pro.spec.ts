import { expect, test } from './fixtures';

test.describe('Memora Pro and the command centre', () => {
  test('the Pro page shows every plan, and no plan undercuts families', async ({ page }) => {
    await page.goto('/pro');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('beautifully remembered');
    const plans = page.locator('.pro-plan');
    await expect(plans).toHaveCount(4);
    await expect(page.locator('.pro-plan.featured')).toContainText(/R6\s?500/);
    for (const per of await page.locator('.pro-per').allTextContents()) {
      const rands = Number(per.replace(/[^\d]/g, ''));
      expect(rands).toBeGreaterThanOrEqual(999);
    }
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
    await expect(page.getByText(/onboarding R9\s?500/)).toBeVisible();
    await expect(page.locator('.pro-plan').last().getByRole('link')).toHaveText('Talk to us');
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
    expect(await res.json()).toEqual({ signedIn: false, team: false, pro: false });
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
