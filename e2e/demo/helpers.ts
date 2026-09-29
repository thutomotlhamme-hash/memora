import { expect, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveTime, type DemoFamily, type DemoStop } from './families';

/** YYYY-MM-DD, n days from today. */
export function day(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Your number with the last three digits replaced at random, so every demo
 * account is new. Set MEMORA_DEMO_PHONE to your own number (e.g. 0721234567).
 */
export function demoPhone(): string {
  const base = (process.env.MEMORA_DEMO_PHONE ?? '').replace(/\D/g, '');
  if (!/^0[678]\d{8}$/.test(base)) {
    throw new Error('Set MEMORA_DEMO_PHONE to your South African cellphone number, e.g. MEMORA_DEMO_PHONE=0721234567 npm run demo');
  }
  const tail = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `${base.slice(0, 7)}${tail}`;
}

export const DEMO_PASSWORD = process.env.MEMORA_DEMO_PASSWORD ?? 'Memora-demo-2026';

/** A caption pinned to the top of the page, so you can follow what the run is doing. */
export async function say(page: Page, family: DemoFamily | null, text: string) {
  await page
    .evaluate(
      ([heading, line]) => {
        let el = document.getElementById('demo-caption');
        if (!el) {
          el = document.createElement('div');
          el.id = 'demo-caption';
          el.setAttribute(
            'style',
            'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;max-width:min(680px,92vw);padding:12px 18px;border-radius:16px;background:rgba(21,18,28,.92);color:#f4f1f8;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);pointer-events:none',
          );
          document.body.appendChild(el);
        }
        el.innerHTML = `<div style="color:#e8a94a;font-size:12px;font-weight:600">${heading}</div><div>${line}</div>`;
      },
      [family ? `${family.firstName} ${family.lastName} · ${family.heritage}` : 'Memora demo', text] as const,
    )
    .catch(() => {});
}

/** The portrait each demo family uploads: Naledi's, from the example memorial. */
export function portrait(): { name: string; mimeType: string; buffer: Buffer } {
  return { name: 'portrait.webp', mimeType: 'image/webp', buffer: readFileSync(join(process.cwd(), 'public', 'demo', 'naledi.webp')) };
}

/** Remember what was created, so it can be found and cleaned up later. */
export function record(entry: Record<string, string>) {
  const dir = join(process.cwd(), 'e2e', 'demo', 'output');
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'created.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

/** Add one stop to the journey, finding the place with the live place search. */
export async function addStop(page: Page, family: DemoFamily, stop: DemoStop, first: boolean) {
  if (!first) await page.getByRole('button', { name: '+ Add a stop' }).click();
  await say(page, family, `Adding “${stop.title}”`);
  await page.locator('#stopType').selectOption(stop.type);
  await page.locator('#stopTitle').fill(stop.title);
  await page.locator('#stopDate').fill(day(stop.day));
  const time = resolveTime(stop.time);
  const chip = page.locator('.quick-picks .chip', { hasText: new RegExp(`^${time}$`) });
  if (await chip.count()) await chip.first().click();
  else await page.locator('#stopTime').fill(time);
  if (stop.until) await page.locator('#stopDepart').fill(resolveTime(stop.until));

  const search = page.locator('#placeSearch');
  await search.pressSequentially(stop.search, { delay: 60 });
  const suggestion = page.locator('.place-results button[role="option"]').first();
  try {
    await suggestion.waitFor({ state: 'visible', timeout: 8000 });
    await suggestion.click();
    await page.locator('#stopTitle').fill(stop.title);
  } catch {
    // Search unavailable or nothing found: pin by coordinates, as a family could.
    await page.locator('#stopAddress').fill(stop.fallback.address);
    await page.locator('#stopLat').fill(String(stop.fallback.lat));
    await page.locator('#stopLng').fill(String(stop.fallback.lng));
  }
  if (stop.landmark) await page.locator('#stopLandmark').fill(stop.landmark);
  if (stop.parking) await page.locator('#stopParking').fill(stop.parking);
  if (stop.transport) await page.locator('#stopTransport').fill(stop.transport);
  await page.getByRole('button', { name: 'Add stop', exact: true }).click();
  await expect(page.locator('#stopTitle')).toHaveCount(0);
}

export { expect };
