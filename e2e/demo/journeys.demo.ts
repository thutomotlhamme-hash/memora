import { test } from '@playwright/test';
import { FAMILIES, resolveTime } from './families';
import { DEMO_PASSWORD, addStop, day, demoPhone, expect, portrait, record, say } from './helpers';

// Watch Memora being used end to end, on the real site, by twelve different
// families. Each run signs up a new account (your number, last three digits
// random), builds the memorial the way a family would, publishes it, opens it
// as a guest and downloads the booklet. The family holding its funeral today
// is then run live from the run-sheet while the memorial updates beside it.

test.describe.configure({ mode: 'serial' });

for (const family of FAMILIES) {
  test(`${family.firstName} ${family.lastName} · ${family.heritage}`, async ({ page, context }) => {
    test.setTimeout(8 * 60_000);
    const hour = new Date().getHours();
    const usesNow = family.stops.some((st) => st.time.startsWith('__NOW'));
    test.skip(usesNow && (hour >= 20 || (Boolean(family.liveToday) && hour < 6)), 'This family’s funeral is today, so it needs daytime: its times run up to three hours from now.');
    const phone = process.env.MEMORA_DEMO_DRY ? '' : demoPhone();

    // ---- 1. The loved one --------------------------------------------------
    await page.goto('/create');
    await say(page, family, 'Step 1 · The loved one');
    await page.locator('#firstName').pressSequentially(family.firstName, { delay: 40 });
    await page.locator('#lastName').pressSequentially(family.lastName, { delay: 40 });
    if (family.preferredName) await page.locator('#preferredName').fill(family.preferredName);
    await page.locator('#birthDate').fill(family.born);
    const passed = day(-family.passed);
    const recent = page.locator('.quick-picks .chip');
    if (family.passed <= 3 && (await recent.count())) await recent.nth(family.passed).click();
    else await page.locator('#passingDate').fill(passed);
    await page.locator('input[type="file"]').first().setInputFiles(portrait());
    await expect(page.getByText(/Replace photo/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Continue to/ }).click();

    // ---- 2. The funeral journey -----------------------------------------------
    await say(page, family, 'Step 2 · The funeral journey');
    await page.locator('#disposition').selectOption(family.disposition);
    if (family.dispositionNote) await page.locator('#dispositionNotes').fill(family.dispositionNote);
    for (const [i, stop] of family.stops.entries()) await addStop(page, family, stop, i === 0);

    if (family.prayers?.length) {
      await say(page, family, 'Prayers during the week: one tap, then each evening’s details');
      await page.getByRole('button', { name: /Yes, set up evening prayers/ }).click();
      const evenings = page.locator('.pw-evening');
      for (const [i, p] of family.prayers.entries()) {
        if (i >= (await evenings.count())) break;
        await evenings.nth(i).locator('.pw-summary').click();
        await evenings.nth(i).getByLabel('Title of the service').fill(p.title);
        await evenings.nth(i).getByLabel('Word of the day').fill(p.word);
        await evenings.nth(i).getByLabel('Scripture').fill(p.scripture);
        await evenings.nth(i).getByLabel('Led by').fill(p.leader);
      }
    }
    await page.getByRole('button', { name: /^Continue to/ }).click();

    // ---- 3. Story and programme -------------------------------------------------
    await say(page, family, 'Step 3 · Their story and the programme');
    await page.locator('#obituary').pressSequentially(family.story, { delay: 8 });
    await page.locator('#familyMessage').fill(family.familyMessage);
    if (family.items?.length || family.vigil) {
      await page.getByRole('button', { name: /Yes, build the programme/ }).click();
      if (family.vigil) {
        await say(page, family, 'Night vigil from the template: the arrival home first');
        await page.getByRole('button', { name: /Add a night vigil programme/ }).click();
        await page.getByRole('radio', { name: family.vigil === 'night' ? /whole-night vigil/ : /short prayer evening/ }).click();
        await page.getByRole('button', { name: 'Use this vigil programme' }).click();
      }
      for (const item of family.items ?? []) {
        const part = item.part ?? 'service';
        await page.locator('.form-block .segmented').getByRole('radio', { name: part === 'vigil' ? 'Night vigil' : part === 'graveside' ? 'At the graveside' : 'The service' }).click();
        await page.locator('#itemType').selectOption(item.type);
        if (item.time) await page.locator('#itemTime').fill(resolveTime(item.time));
        await page.locator('#itemTitle').fill(item.title);
        if (item.presenter) await page.locator('#itemPresenter').fill(item.presenter);
        if (item.detail) await page.locator('#itemDetail').fill(item.detail);
        await page.getByRole('button', { name: 'Add to programme' }).click();
      }
    } else {
      await page.getByRole('button', { name: /No formal programme/ }).click();
    }
    await page.getByRole('button', { name: /^Continue to/ }).click();

    // ---- 4. Review, then save with a cellphone number and publish ---------------
    await say(page, family, 'Step 4 · Review');
    await expect(page.getByText('Everything needed to publish is here.')).toBeVisible();
    // A rehearsal (MEMORA_DEMO_DRY=1) stops here, before anything is saved to the site.
    if (process.env.MEMORA_DEMO_DRY) return;
    await page.getByRole('button', { name: /^Continue to/ }).click();

    await say(page, family, `Step 5 · Save with ${phone} and publish (no SMS, no email)`);
    await page.getByLabel('Cellphone number').pressSequentially(phone, { delay: 50 });
    await page.getByLabel('Choose a password').fill(DEMO_PASSWORD);
    await page.getByLabel(/Your name/).fill(`${family.lastName} family (demo)`);
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await page.waitForURL(/\/memorials\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const caseId = /\/memorials\/([0-9a-f-]{36})/.exec(page.url())![1];
    await page.getByRole('button', { name: 'Publish memorial' }).click();
    await expect(page.getByRole('heading', { name: 'The memorial is live.' })).toBeVisible({ timeout: 30_000 });
    const memorialPath = (await page.getByRole('link', { name: /Open memorial/ }).getAttribute('href'))!;
    record({ family: family.key, phone, caseId, memorial: new URL(memorialPath, page.url()).toString() });

    // ---- 5. What guests see -----------------------------------------------------
    const guest = await context.newPage();
    await guest.goto(memorialPath);
    await say(guest, family, 'What guests see: the memorial');
    await expect(guest.getByText(`${family.preferredName ?? family.firstName} ${family.lastName}`).first()).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await guest.mouse.wheel(0, 700);
      await guest.waitForTimeout(700);
    }

    // ---- 6. Keepsakes -----------------------------------------------------------
    await page.bringToFront();
    await page.goto(`/memorials/${caseId}/artifacts`);
    await say(page, family, 'Keepsakes: the A5 programme booklet, made fresh from the memorial');
    const booklet = page.locator('article.artifact', { hasText: 'Programme booklet' });
    const [download] = await Promise.all([page.waitForEvent('download'), booklet.getByRole('button').click()]);
    await download.saveAs(`e2e/demo/output/${family.key}-${download.suggestedFilename()}`);

    // ---- 7. On the day: run it live -------------------------------------------------
    if (family.liveToday) {
      await page.goto(`/memorials/${caseId}?step=publish`);
      await say(page, family, 'On the day: hand the run-sheet to the programme director');
      await page.getByRole('button', { name: 'Get the run-sheet link' }).click();
      const runUrl = await page.locator('.run-link-box input').inputValue();
      const run = await context.newPage();
      await run.goto(runUrl);
      await say(run, family, 'The run-sheet: tap Start, then Next as the service moves on');
      await guest.bringToFront();
      await guest.goto(memorialPath);
      await run.bringToFront();
      await run.getByRole('button', { name: /^Start/ }).click();
      await say(run, family, 'Guests’ phones follow within seconds');
      await guest.bringToFront();
      await expect(guest.locator('#now')).toContainText('Happening now', { timeout: 30_000 });
      await run.bringToFront();
      await run.getByRole('button', { name: /^Next/ }).click();
      await guest.bringToFront();
      await expect(guest.locator('#now')).toContainText('Opening prayer', { timeout: 30_000 });
      await run.bringToFront();
      run.once('dialog', (d) => void d.accept());
      await run.getByRole('button', { name: 'End the funeral' }).click();
      await expect(run.getByText('Thank you. You carried the family through today.')).toBeVisible();
      await guest.bringToFront();
      await expect(guest.locator('#now')).toContainText('Thank you for walking with us', { timeout: 30_000 });
      await say(guest, family, 'After the funeral, guests are pointed to the refreshments');
      await guest.waitForTimeout(3000);
    }
  });
}
