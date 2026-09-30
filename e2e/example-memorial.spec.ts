import { expect, test, todayAt } from './fixtures';

// The example memorial's funeral is always today, so the live view follows the clock.
test.describe('Example memorial on the day', () => {
  test('during the service guests see what is happening now', async ({ page }) => {
    await page.clock.install({ time: todayAt(10, 35) });
    await page.goto('/m/preview?demo=1');
    const now = page.locator('#now');
    await expect(now).toBeVisible();
    await expect(now).toContainText('Happening now');
    await expect(now).toContainText('Naledi Magumba');
    await expect(now).toContainText('Family tributes');
    await expect(now.getByRole('link', { name: 'Directions' }).first()).toHaveAttribute('href', /google\.com\/maps/);
    // The programme leads: the item on now is the headline, the place a detail.
    await expect(now.locator('.sl-item')).toHaveText('Family tributes');
    // The usual header would repeat the portrait: it steps aside while the live view is on.
    await expect(page.locator('.m-hero')).toBeHidden();
  });

  test('scrolling into the memorial keeps "now" one tap away', async ({ page }) => {
    await page.clock.install({ time: todayAt(10, 35) });
    await page.goto('/m/preview?demo=1');
    await page.locator('#story').scrollIntoViewIfNeeded();
    const bar = page.locator('.now-bar');
    await expect(bar).toHaveClass(/on/);
    await expect(bar).toContainText('Family tributes');
    await bar.click();
    await expect(page.locator('#now')).toBeInViewport();
  });

  test('before the first gathering it counts down; between places it shows the way', async ({ page }) => {
    await page.clock.install({ time: todayAt(8, 10) });
    await page.goto('/m/preview?demo=1');
    await expect(page.locator('#now')).toContainText('Starts at 10:00');
    await page.clock.setFixedTime(todayAt(12, 5));
    await page.reload();
    await expect(page.locator('#now')).toContainText('On the way');
    await expect(page.locator('#now')).toContainText('Burial');
  });

  test('late at night the live view gives way to the memorial', async ({ page }) => {
    await page.clock.install({ time: todayAt(23, 30) });
    await page.goto('/m/preview?demo=1');
    await expect(page.locator('#now')).toHaveCount(0);
    await expect(page.locator('.m-hero')).toBeVisible();
    await expect(page.getByText('Today’s gatherings have ended.')).toBeVisible();
  });

  test('the prayer week, programme and journey are all on the page', async ({ page }) => {
    await page.clock.install({ time: todayAt(20, 0) });
    await page.goto('/m/preview?demo=1');
    const prayers = page.locator('#prayers');
    await expect(prayers.locator('.pw-card')).toHaveCount(6); // four evenings, the vigil and the funeral
    await expect(prayers).toContainText('A service of comfort');
    await expect(prayers).toContainText('Psalm 23');
    await expect(prayers.getByText('Held').first()).toBeVisible();
    await expect(page.locator('#programme')).toContainText('Night vigil');
    await expect(page.locator('#programme')).toContainText('At the graveside');
    await expect(page.locator('#journey')).toContainText('Burial');
  });
});

test('Share, next to Read their story, goes straight to the QR code', async ({ page }) => {
  await page.clock.install({ time: todayAt(23, 30) });
  await page.goto('/m/preview?demo=1');
  await page.locator('.m-hero').getByRole('link', { name: /^Share/ }).click();
  await expect(page).toHaveURL(/#share$/);
  await expect(page.locator('#share img, #share svg').first()).toBeInViewport();
});
