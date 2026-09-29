import { expect, familyDraft, seedDraft, test } from './fixtures';

test.describe('Creating a memorial as a guest', () => {
  test('the first step takes a name and dates and moves on', async ({ page }) => {
    await page.goto('/create');
    await page.locator('#firstName').fill('Thandi');
    await page.locator('#lastName').fill('Khumalo');
    await page.locator('#birthDate').fill('1950-03-02');
    await page.locator('#passingDate').fill('2026-09-20');
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page).toHaveURL(/step=journey/);
    // The draft is kept in this browser: coming back finds it.
    await page.goto('/create');
    await expect(page.locator('#firstName')).toHaveValue('Thandi');
  });

  test('one tap sets up the week of evening prayers', async ({ page }) => {
    await seedDraft(page, familyDraft());
    await page.goto('/create?step=journey');
    await page.getByRole('button', { name: /Yes, set up evening prayers/ }).click();
    const evenings = page.locator('.pw-evening');
    expect(await evenings.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('#pwPlace')).toHaveValue('Family home');

    // Switch the first evening off, and give the second its word and scripture.
    await evenings.first().locator('.pw-date').click();
    await expect(evenings.first()).toHaveClass(/off/);
    await evenings.nth(1).locator('.pw-summary').click();
    await evenings.nth(1).getByLabel('Word of the day').fill('Hope');
    await evenings.nth(1).getByLabel('Scripture').fill('Psalm 121');
    await expect(evenings.nth(1)).toContainText('Psalm 121');

    await page.reload();
    await expect(page.locator('.pw-evening').nth(1)).toContainText('Hope');
  });

  test('the night vigil starts from a template with the arrival home', async ({ page }) => {
    await seedDraft(page, familyDraft());
    await page.goto('/create?step=story');
    await page.getByRole('button', { name: /Add a night vigil programme/ }).click();
    await page.getByRole('radio', { name: /whole-night vigil/ }).click();
    await page.getByRole('button', { name: 'Use this vigil programme' }).click();
    const vigil = page.locator('.part-vigil');
    await expect(vigil).toContainText('Thandi Khumalo arrives home');
    await expect(vigil).toContainText('Prayers and hymns through the night');
    await expect(vigil).toContainText('18:00');
  });

  test('the preview shows the family’s own memorial, not the example', async ({ page }) => {
    await seedDraft(page, familyDraft());
    await page.goto('/m/preview');
    await expect(page.getByText('Thandi Khumalo').first()).toBeVisible();
    await expect(page.getByText('Naledi Magumba')).toHaveCount(0);
  });
});
