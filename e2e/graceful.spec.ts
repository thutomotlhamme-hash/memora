import { expect, familyDraft, seedDraft, test } from './fixtures';

// The inverse of every journey: wrong links, missing data, no network, no backend.
// Each must end on a calm, useful screen, never a crash or a raw error.

test.describe('Links that lead nowhere', () => {
  test('an unknown memorial explains itself', async ({ page }) => {
    await page.goto('/m/nobody-by-this-name');
    await expect(page.getByRole('heading', { name: 'This memorial isn’t available.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Memora' })).toBeVisible();
  });

  test('a mangled memorial link is treated the same way', async ({ page }) => {
    await page.goto('/m/%E2%9C%93%20not..valid');
    await expect(page.getByRole('heading', { name: 'This memorial isn’t available.' })).toBeVisible();
  });

  test('a broken run-sheet link says what to do next', async ({ page }) => {
    await page.goto('/run/not-a-real-token');
    await expect(page.getByRole('heading', { name: 'This run-sheet link isn’t working.' })).toBeVisible();
    await expect(page.getByText('Ask them to send you the run-sheet link again')).toBeVisible();
  });

  test('a page that does not exist is a proper 404', async ({ page }) => {
    const res = await page.goto('/no-such-page-here');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
  });
});

test.describe('APIs answer with clear errors, never a crash', () => {
  test('live updates for an unknown memorial', async ({ request }) => {
    const res = await request.get('/api/live/nobody-by-this-name');
    expect([404, 503]).toContain(res.status());
    expect((await res.json()).error).toBeTruthy();
  });

  test('saving a memorial without being signed in', async ({ request, baseURL }) => {
    const res = await request.post('/api/memorials', { data: {}, headers: { origin: baseURL! } });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect((await res.json()).error).toBeTruthy();
  });

  test('cross-site requests are refused', async ({ request }) => {
    const res = await request.post('/api/account/phone', { data: { phone: '0721234567', password: 'longenough' }, headers: { origin: 'https://evil.example' } });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/refused/i);
  });

  test('the run-sheet API rejects a bad token', async ({ request, baseURL }) => {
    const res = await request.post('/api/run/not-a-real-token', { data: { liveKey: 'x' }, headers: { origin: baseURL! } });
    // 404 in production; 503 here, where the test server has no database. Never a 500.
    expect([401, 403, 404, 503]).toContain(res.status());
    expect((await res.json()).error).toBeTruthy();
  });
});

test.describe('When the network or backend is down', () => {
  test('logging in shows a friendly message and lets you try again', async ({ page }) => {
    await page.goto('/account/login');
    await page.getByLabel(/cellphone number or email|email/i).first().fill('someone@example.com');
    await page.getByLabel(/password/i).first().fill('not-the-password');
    await page.getByRole('button', { name: /log in/i }).click();
    const alert = page.locator('.note.error[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/couldn’t reach Memora|don’t match/);
    await expect(alert).not.toContainText(/TypeError|undefined|stack/i);
    await expect(page.getByRole('button', { name: /log in/i })).toBeEnabled();
  });

  test('place search offline points to the map instead', async ({ page }) => {
    await page.route(/photon\.komoot\.io|nominatim\.openstreetmap\.org/, (route) => route.abort('internetdisconnected'));
    await seedDraft(page, familyDraft());
    await page.goto('/create?step=journey');
    await page.getByRole('button', { name: /Add a stop|Add another stop|\+ Add/ }).first().click();
    await page.locator('#placeSearch').fill('St Peter');
    await page.locator('#placeSearch').press('Enter');
    await expect(page.getByText('Search isn’t available right now')).toBeVisible();
  });

  test('a corrupted saved draft starts afresh instead of breaking the editor', async ({ page }) => {
    await seedDraft(page, '{"person": {"firstName": 42, broken');
    await page.goto('/create');
    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#firstName')).toHaveValue('');
  });

  test('odd saved data is cleaned up rather than shown', async ({ page }) => {
    await seedDraft(page, { person: { firstName: 'Thandi', birthDate: 'yesterday' }, journey: [{ title: 'No pin', date: 'soon' }], programme: { items: 'nope' }, prayers: { enabled: true, evenings: [{ date: 'x' }] } });
    await page.goto('/m/preview');
    await expect(page.getByText('Thandi').first()).toBeVisible();
    await expect(page.locator('#prayers')).toHaveCount(0);
  });
});

test.describe('Pages that need an account', () => {
  test('my memorials sends a signed-out visitor to log in', async ({ page }) => {
    await page.goto('/memorials');
    await expect(page).toHaveURL(/\/account\/login|\/memorials/);
    await expect(page.getByRole('button', { name: /log in/i }).or(page.getByRole('heading', { name: /log in|sign in|welcome/i })).first()).toBeVisible();
  });

  test('the contact form will not send empty', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page).toHaveURL(/\/contact/);
    const invalid = await page.locator('#c-message').evaluate((el: HTMLTextAreaElement) => !el.checkValidity());
    expect(invalid).toBe(true);
  });
});
