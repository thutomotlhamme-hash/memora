import { test as base, expect, type Page } from '@playwright/test';

/** Every test fails if the page throws an uncaught error: graceful means no crashes. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Today at hh:mm on the browser's clock. */
export function todayAt(hh: number, mm = 0): Date {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

export function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DRAFT_KEY = 'memora:v2:guest-draft';

/** Put a guest draft in this browser before the page loads (a raw string to test corrupt data). */
export async function seedDraft(page: Page, draft: unknown) {
  const raw = typeof draft === 'string' ? draft : JSON.stringify(draft);
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('e2e-seeded', '1');
      }
    },
    [DRAFT_KEY, raw] as const,
  );
}

/** A family partway through: the person, and a journey with a vigil, service and burial. */
export function familyDraft() {
  return {
    person: { firstName: 'Thandi', lastName: 'Khumalo', preferredName: '', birthDate: '1950-03-02', passingDate: isoDay(-3) },
    disposition: { type: 'burial', notes: '' },
    journey: [
      { id: 'v', type: 'vigil', title: 'Night vigil', date: isoDay(4), time: '18:00', address: '12 Protea Road, Soweto', lat: -26.25, lng: 27.9 },
      { id: 'c', type: 'church', title: 'Funeral service', date: isoDay(5), time: '09:00', departTime: '11:00', address: 'St Mary’s, Orlando', lat: -26.24, lng: 27.92 },
      { id: 'g', type: 'cemetery', title: 'Burial', date: isoDay(5), time: '11:45', address: 'Avalon Cemetery', lat: -26.28, lng: 27.87 },
    ],
    story: { obituary: 'Thandi was the heart of every gathering. She taught three generations to sing and to forgive.', familyMessage: '' },
    programme: { mode: 'formal', items: [] },
  };
}
