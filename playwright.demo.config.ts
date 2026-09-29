import { defineConfig } from '@playwright/test';

// Times like "30 minutes from now" are worked out in South African time, as the browser shows them.
const TZ = process.env.MEMORA_DEMO_TZ ?? 'Africa/Johannesburg';
process.env.TZ = TZ;

// The watchable demo: a real, visible browser on the live site, slowed down
// enough to follow. It creates real accounts and memorials (see e2e/demo/README.md).
//   MEMORA_DEMO_PHONE=0721234567 npm run demo
export default defineConfig({
  testDir: 'e2e/demo',
  testMatch: '*.demo.ts',
  workers: 1,
  timeout: 10 * 60_000,
  reporter: [['list']],
  outputDir: 'e2e/demo/output/results',
  use: {
    baseURL: process.env.MEMORA_DEMO_URL ?? 'https://memora-memorials.netlify.app',
    headless: Boolean(process.env.MEMORA_DEMO_HEADLESS),
    viewport: { width: 1280, height: 860 },
    launchOptions: { slowMo: Number(process.env.MEMORA_DEMO_SLOWMO ?? 250) },
    video: 'on',
    trace: 'retain-on-failure',
    acceptDownloads: true,
    permissions: ['geolocation'],
    geolocation: { latitude: -26.2041, longitude: 28.0473 },
    locale: 'en-ZA',
    timezoneId: TZ,
  },
});
