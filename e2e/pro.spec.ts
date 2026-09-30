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
