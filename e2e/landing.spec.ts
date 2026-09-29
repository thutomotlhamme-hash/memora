import { expect, test } from './fixtures';

test.describe('Home page', () => {
  test('has one header, and its calls to action lead where they say', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-header')).toHaveCount(0);
    await expect(page.locator('header.local-nav')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Remember');

    await page.getByRole('link', { name: 'See an example' }).first().click();
    await expect(page).toHaveURL(/\/m\/preview/);
    await expect(page.getByText('Naledi Magumba').first()).toBeVisible();

    await page.goto('/');
    await page.getByRole('link', { name: 'Create a memorial' }).first().click();
    await expect(page).toHaveURL(/\/create/);
    await expect(page.locator('#firstName')).toBeVisible();
  });

  test('never scrolls sideways on a phone', async ({ page }) => {
    await page.goto('/');
    await page.mouse.wheel(0, 4000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
