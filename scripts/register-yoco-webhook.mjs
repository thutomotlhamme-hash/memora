#!/usr/bin/env node
// Registers Memora's webhook with Yoco and prints the signing secret.
// Run it on your own computer. Never paste secret keys into chats or commits.
//
//   YOCO_SECRET_KEY=sk_test_xxx node scripts/register-yoco-webhook.mjs https://your-site.netlify.app
//   YOCO_SECRET_KEY=sk_test_xxx node scripts/register-yoco-webhook.mjs --list
//
// Test keys (sk_test_) and live keys (sk_live_) have separate webhooks: run it once per key.

const key = process.env.YOCO_SECRET_KEY;
const arg = process.argv[2];
if (!key || !arg) {
  console.error('Usage: YOCO_SECRET_KEY=sk_test_... node scripts/register-yoco-webhook.mjs <https://your-site> | --list');
  process.exit(1);
}
const api = (path, init = {}) =>
  fetch(`https://payments.yoco.com/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }));

if (arg === '--list') {
  const res = await api('/webhooks');
  console.log(JSON.stringify(res.body, null, 2));
  process.exit(res.ok ? 0 : 1);
}

const url = `${arg.replace(/\/$/, '')}/api/yoco/webhook`;
if (!url.startsWith('https://')) {
  console.error('The site URL must start with https://');
  process.exit(1);
}
const res = await api('/webhooks', { method: 'POST', body: JSON.stringify({ name: 'memora', url }) });
if (!res.ok) {
  console.error(`Yoco refused the request (${res.status}):`, res.body);
  process.exit(1);
}
console.log(`Registered ${url} (${res.body?.mode ?? 'unknown'} mode).`);
console.log('\nAdd this to your hosting environment variables as YOCO_WEBHOOK_SECRET:\n');
console.log(`  ${res.body?.secret}\n`);
