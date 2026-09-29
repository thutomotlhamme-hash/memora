import { test } from '@playwright/test';
import { DEMO_PASSWORD, demoPhone, expect, say } from './helpers';

// The same site when things go wrong, so you can watch each one land gently.

test.describe.configure({ mode: 'serial' });

test('wrong number, wrong password, links that lead nowhere', async ({ page }) => {
  test.setTimeout(4 * 60_000);

  await page.goto('/account/login');
  await say(page, null, 'Logging in with a password that is wrong');
  await page.getByLabel(/cellphone number or email/i).first().fill(demoPhone());
  await page.getByLabel(/password/i).first().fill('definitely-not-it');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.locator('.note.error')).toBeVisible();
  await page.waitForTimeout(2500);

  await page.goto('/account/register');
  await say(page, null, 'A cellphone number that is not a cellphone number');
  const who = page.getByLabel(/cellphone number/i).first();
  await who.fill('0112345678');
  await who.blur();
  await expect(page.getByText(/doesn’t look like a cellphone number/)).toBeVisible();
  await page.waitForTimeout(2500);

  await say(page, null, 'A memorial link that does not exist');
  await page.goto('/m/nobody-by-this-name');
  await expect(page.getByRole('heading', { name: 'This memorial isn’t available.' })).toBeVisible();
  await say(page, null, 'A memorial link that does not exist');
  await page.waitForTimeout(2500);

  await page.goto('/run/not-a-real-token');
  await say(page, null, 'A broken run-sheet link');
  await expect(page.getByRole('heading', { name: 'This run-sheet link isn’t working.' })).toBeVisible();
  await page.waitForTimeout(2500);

  await page.goto('/this-page-does-not-exist');
  await say(page, null, 'A page that does not exist');
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
  await page.waitForTimeout(2500);

  await page.context().setOffline(true);
  await page.goto('/account/login').catch(() => {});
  await page.context().setOffline(false);
  await page.goto('/account/login');
  await page.route(/supabase\.co/, (r) => r.abort('internetdisconnected'));
  await say(page, null, 'Logging in while the internet drops out');
  await page.getByLabel(/cellphone number or email/i).first().fill(demoPhone());
  await page.getByLabel(/password/i).first().fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.locator('.note.error')).toContainText(/couldn’t reach Memora/);
  await page.waitForTimeout(2500);
});
