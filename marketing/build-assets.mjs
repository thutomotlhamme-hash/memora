// Renders Memora's marketing assets (PNG + PDF) from HTML with Playwright.
//   node marketing/build-assets.mjs            # uses https://memora-memorials.netlify.app
//   SITE=https://memora.co.za node marketing/build-assets.mjs
// Needs Playwright with Chromium available (set PLAYWRIGHT_MODULE if it isn't resolvable).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(here, 'assets');
const SITE = (process.env.SITE || 'https://memora-memorials.netlify.app').replace(/\/$/, '');
const SITE_LABEL = SITE.replace(/^https?:\/\//, '');

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '@playwright/test'].filter(Boolean);
  for (const t of tries) {
    try {
      return require(t);
    } catch {}
  }
  const globalRoot = require('node:child_process').execSync('npm root -g').toString().trim();
  return require(join(globalRoot, 'playwright'));
}

// Fonts are inlined as data URLs: a page loaded with setContent can't read file:// fonts.
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(join(root, 'node_modules', '@fontsource-variable', pkg, 'files', file)).toString('base64')}`;
const FONTS = `
@font-face { font-family: 'Newsreader'; src: url('${font('newsreader', 'newsreader-latin-opsz-normal.woff2')}') format('woff2-variations'); font-weight: 200 800; }
@font-face { font-family: 'Newsreader'; font-style: italic; src: url('${font('newsreader', 'newsreader-latin-opsz-italic.woff2')}') format('woff2-variations'); font-weight: 200 800; }
@font-face { font-family: 'Inter'; src: url('${font('inter', 'inter-latin-wght-normal.woff2')}') format('woff2-variations'); font-weight: 100 900; }
`;

const BASE = `
${FONTS}
:root { --paper:#faf9f5; --paper2:#f0eee6; --night:#141413; --ink:#141413; --ink2:#3d3d3a; --muted:#66655f; --clay:#b5552f; --clayInk:#9f4829; --clayNight:#e08a67; --onNight:#faf9f5; --onNightMuted:#b9b6ab; --sage:#4f6b53; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; }
body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
.serif { font-family: 'Newsreader', Georgia, serif; font-weight: 400; letter-spacing: -0.025em; }
.eyebrow { font-weight: 650; letter-spacing: .16em; text-transform: uppercase; }
.brand { display:flex; align-items:center; gap:.45em; }
.brand .m { width:1.35em; height:1.35em; border-radius:50%; border:.06em solid currentColor; display:grid; place-items:center; font-family:'Newsreader',serif; font-size:1em; line-height:1; }
.brand .w { font-family:'Newsreader',serif; letter-spacing:-.02em; }
.canvas { width:100%; height:100%; position:relative; overflow:hidden; display:flex; flex-direction:column; }
.night { background: var(--night); color: var(--onNight); }
.paper { background: var(--paper); color: var(--ink); }
.glow::before { content:''; position:absolute; inset:auto -30% -45% 25%; height:90%; background: radial-gradient(closest-side, rgba(181,85,47,.28), transparent); }
.pill { display:inline-flex; align-items:center; gap:.5em; padding:.35em .85em; border-radius:999px; font-weight:650; }
.pill.live { background: var(--clay); color:#fff; }
.pill.live::before { content:''; width:.45em; height:.45em; border-radius:50%; background:#fff; }
.card { background:#fff; color:var(--ink); border-radius:28px; box-shadow: 0 40px 90px rgba(0,0,0,.35); }
.stop { display:grid; grid-template-columns: 64px 1fr; gap: 18px; align-items:start; }
.stop .n { width:52px; height:52px; border-radius:50%; background:var(--ink); color:var(--paper); display:grid; place-items:center; font-weight:650; font-size:22px; }
.stop .k { font-size:18px; font-weight:650; letter-spacing:.1em; text-transform:uppercase; color:var(--clayInk); }
.stop .t { font-size:34px; font-weight:600; margin-top:4px; }
.stop .a { font-size:22px; color:var(--muted); margin-top:4px; }
.check { display:flex; gap:16px; align-items:flex-start; }
.check::before { content:'✓'; color: var(--sage); font-weight:800; }
`;

const page = (w, h, body, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${extraCss} body{width:${w}px;height:${h}px}</style></head><body>${body}</body></html>`;

const mockMemorial = (scale = 1) => `
<div class="card" style="width:${420 * scale}px; overflow:hidden; font-size:${16 * scale}px">
  <div style="background:var(--night); color:var(--onNight); padding:${26 * scale}px ${26 * scale}px ${22 * scale}px; position:relative">
    <div class="eyebrow" style="color:var(--clayNight); font-size:${12 * scale}px">In loving memory</div>
    <div class="serif" style="font-size:${44 * scale}px; line-height:1; margin-top:${10 * scale}px">Naledi Magumba</div>
    <div style="color:var(--onNightMuted); font-size:${15 * scale}px; margin-top:${8 * scale}px">12 April 1958 — 19 August 2026</div>
  </div>
  <div style="padding:${20 * scale}px ${24 * scale}px; display:grid; gap:${14 * scale}px">
    <div style="display:flex; align-items:center; gap:${10 * scale}px"><span class="pill live" style="font-size:${12 * scale}px">Live</span><span class="serif" style="font-size:${24 * scale}px">Happening now</span></div>
    <div style="border:1px solid rgba(20,20,19,.12); border-radius:${16 * scale}px; padding:${14 * scale}px ${16 * scale}px">
      <div class="eyebrow" style="color:var(--clayInk); font-size:${11 * scale}px">Church / service</div>
      <div style="font-weight:650; font-size:${20 * scale}px; margin-top:${4 * scale}px">10:00 · Celebration service</div>
      <div style="display:flex; gap:${8 * scale}px; margin-top:${10 * scale}px">
        ${['Google Maps', 'Apple Maps', 'Waze'].map((l) => `<span style="border:1px solid rgba(20,20,19,.2); border-radius:${8 * scale}px; padding:${6 * scale}px ${10 * scale}px; font-size:${13 * scale}px; font-weight:600">${l}</span>`).join('')}
      </div>
    </div>
    <div style="border:1px solid rgba(20,20,19,.12); border-radius:${16 * scale}px; padding:${14 * scale}px ${16 * scale}px">
      <div class="eyebrow" style="color:var(--clayInk); font-size:${11 * scale}px">Next · Cemetery</div>
      <div style="font-weight:650; font-size:${20 * scale}px; margin-top:${4 * scale}px">12:30 · Burial, East gate</div>
    </div>
  </div>
</div>`;

async function build() {
  mkdirSync(out, { recursive: true });
  const qr = await QRCode.toDataURL(SITE, { width: 900, margin: 1, color: { dark: '#141413', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  const qrGift = await QRCode.toDataURL(`${SITE}/gift`, { width: 900, margin: 1, color: { dark: '#141413', light: '#ffffff' }, errorCorrectionLevel: 'M' });

  const assets = [
    {
      name: 'social-01-one-link',
      w: 1080,
      h: 1080,
      html: `<div class="canvas night glow" style="padding:84px">
        <div class="brand" style="font-size:40px; position:relative"><span class="m">M</span><span class="w">Memora</span></div>
        <div style="display:grid; grid-template-columns: 1.05fr .95fr; gap:40px; align-items:center; flex:1; position:relative">
          <div>
            <div class="eyebrow" style="color:var(--clayNight); font-size:22px">For the day and after</div>
            <div class="serif" style="font-size:96px; line-height:.98; margin-top:22px">One link for the whole funeral.</div>
            <div style="font-size:28px; color:var(--onNightMuted); margin-top:28px; line-height:1.4">Their story, the programme and every stop with directions, plus one QR code.</div>
          </div>
          <div style="transform: rotate(2deg)">${mockMemorial(0.95)}</div>
        </div>
        <div style="font-size:26px; color:var(--onNightMuted); position:relative">${SITE_LABEL}</div>
      </div>`,
    },
    {
      name: 'social-02-directions',
      w: 1080,
      h: 1080,
      html: `<div class="canvas paper" style="padding:84px">
        <div class="brand" style="font-size:40px"><span class="m">M</span><span class="w">Memora</span></div>
        <div class="serif" style="font-size:104px; line-height:.98; margin-top:auto">Nobody gets lost.</div>
        <div style="font-size:30px; color:var(--ink2); margin-top:22px; max-width:820px; line-height:1.4">Every stop pinned at the right gate. One tap opens Google Maps, Apple Maps or Waze.</div>
        <div style="display:grid; gap:34px; margin-top:56px">
          <div class="stop"><div class="n">1</div><div><div class="k">Church · 10:00</div><div class="t">Celebration service</div><div class="a">Main entrance · parking behind the hall</div></div></div>
          <div class="stop"><div class="n">2</div><div><div class="k">Cemetery · 12:30</div><div class="t">Burial</div><div class="a">East gate, not the street address</div></div></div>
          <div class="stop"><div class="n">3</div><div><div class="k">Reception · 14:00</div><div class="t">Family reception</div><div class="a">Refreshments after the burial</div></div></div>
        </div>
        <div style="margin-top:auto; font-size:26px; color:var(--muted)">${SITE_LABEL}</div>
      </div>`,
    },
    {
      name: 'social-03-price',
      w: 1080,
      h: 1080,
      html: `<div class="canvas paper" style="padding:84px">
        <div class="brand" style="font-size:40px"><span class="m">M</span><span class="w">Memora</span></div>
        <div class="eyebrow" style="color:var(--clayInk); font-size:24px; margin-top:auto">Build it free. Pay when you publish.</div>
        <div class="serif" style="font-size:112px; line-height:.95; margin-top:20px">R899<span style="font-size:44px; color:var(--muted); letter-spacing:0"> once-off</span></div>
        <div class="serif" style="font-size:52px; line-height:1.1; margin-top:24px; color:var(--ink2)">Less than printing 100 programmes.</div>
        <div style="display:grid; gap:18px; margin-top:52px; font-size:30px; color:var(--ink2)">
          <div class="check">Memorial page with Live Funeral Mode</div>
          <div class="check">Every stop with directions</div>
          <div class="check">QR code, WhatsApp cards and print-ready programme</div>
          <div class="check">Keepsake book · public for a full year</div>
        </div>
        <div style="margin-top:auto; font-size:26px; color:var(--muted)">${SITE_LABEL}</div>
      </div>`,
    },
    {
      name: 'social-04-gift',
      w: 1080,
      h: 1080,
      html: `<div class="canvas night glow" style="padding:84px">
        <div class="brand" style="font-size:40px; position:relative"><span class="m">M</span><span class="w">Memora</span></div>
        <div style="margin-top:auto; position:relative">
          <div class="eyebrow" style="color:var(--clayNight); font-size:24px">Give a memorial</div>
          <div class="serif" style="font-size:110px; line-height:.96; margin-top:22px">One less thing for the family to carry.</div>
          <div style="font-size:30px; color:var(--onNightMuted); margin-top:30px; line-height:1.4; max-width:860px">You pay. They get a private link on WhatsApp to create the memorial, already paid for.</div>
          <div style="font-size:28px; margin-top:44px">${SITE_LABEL}/gift</div>
        </div>
      </div>`,
    },
    {
      name: 'story-01-one-link',
      w: 1080,
      h: 1920,
      html: `<div class="canvas night glow" style="padding:110px 90px">
        <div class="brand" style="font-size:46px; position:relative"><span class="m">M</span><span class="w">Memora</span></div>
        <div class="serif" style="font-size:118px; line-height:.96; margin-top:110px; position:relative">One link for the whole funeral.</div>
        <div style="font-size:36px; color:var(--onNightMuted); margin-top:36px; line-height:1.4; position:relative">The programme, every stop with directions, and a live “where to be now” on the day.</div>
        <div style="display:flex; justify-content:center; margin-top:90px; position:relative">${mockMemorial(1.55)}</div>
        <div style="margin-top:auto; font-size:36px; text-align:center; position:relative">Build it free · ${SITE_LABEL}</div>
      </div>`,
    },
    {
      name: 'story-02-gift',
      w: 1080,
      h: 1920,
      html: `<div class="canvas paper" style="padding:110px 90px">
        <div class="brand" style="font-size:46px"><span class="m">M</span><span class="w">Memora</span></div>
        <div class="eyebrow" style="color:var(--clayInk); font-size:30px; margin-top:150px">Give a memorial</div>
        <div class="serif" style="font-size:126px; line-height:.95; margin-top:26px">Help with the part nobody has time for.</div>
        <div style="font-size:38px; color:var(--ink2); margin-top:40px; line-height:1.4">Pay for their memorial and send them a private link. We help them finish before the funeral.</div>
        <div style="display:grid; gap:26px; margin-top:80px; font-size:36px">
          <div class="check">Their story and photo</div>
          <div class="check">The programme and directions</div>
          <div class="check">A QR code for everyone</div>
        </div>
        <div style="margin-top:auto; display:flex; align-items:center; gap:36px">
          <img src="${qrGift}" style="width:230px; height:230px; border-radius:20px; background:#fff; padding:14px; border:1px solid rgba(20,20,19,.1)" />
          <div style="font-size:34px; line-height:1.4">Scan or visit<br/><strong>${SITE_LABEL}/gift</strong></div>
        </div>
      </div>`,
    },
  ];

  const printables = [
    {
      name: 'flyer-a5',
      format: 'A5',
      html: `<div class="canvas paper" style="padding:14mm 13mm; font-size:10pt">
        <div class="brand" style="font-size:16pt"><span class="m">M</span><span class="w">Memora</span></div>
        <div class="eyebrow" style="color:var(--clayInk); font-size:8pt; margin-top:12mm">Planning a funeral?</div>
        <div class="serif" style="font-size:34pt; line-height:1; margin-top:3mm">The programme, the directions and a QR code, in one link.</div>
        <div style="font-size:11pt; color:var(--ink2); margin-top:5mm; line-height:1.5">Make it on your phone tonight. Guests get the programme, every stop with directions, and a live guide on the day. Download a print-ready programme too.</div>
        <div style="display:grid; gap:2.5mm; margin-top:7mm; font-size:10.5pt; color:var(--ink2)">
          <div class="check">Free to build and preview</div>
          <div class="check">R899 once-off to publish · public for a year</div>
          <div class="check">Works on any phone, no app needed</div>
        </div>
        <div style="margin-top:auto; display:flex; align-items:center; gap:7mm; padding-top:6mm; border-top:0.3mm solid rgba(20,20,19,.15)">
          <img src="${qr}" style="width:34mm; height:34mm" />
          <div style="font-size:10.5pt; line-height:1.45"><strong>Scan to start</strong><br/>${SITE_LABEL}<br/><span style="color:var(--muted)">Can’t be there? Give a memorial:<br/><span style="white-space:nowrap">${SITE_LABEL}/gift</span></span></div>
        </div>
      </div>`,
    },
    {
      name: 'poster-a4',
      format: 'A4',
      html: `<div class="canvas night glow" style="padding:20mm 18mm">
        <div class="brand" style="font-size:22pt; position:relative"><span class="m">M</span><span class="w">Memora</span></div>
        <div style="position:relative; margin-top:18mm">
          <div class="eyebrow" style="color:var(--clayNight); font-size:10pt">Planning a funeral?</div>
          <div class="serif" style="font-size:54pt; line-height:.98; margin-top:5mm">One link for the whole funeral.</div>
          <div style="font-size:15pt; color:var(--onNightMuted); margin-top:7mm; line-height:1.45">Their story, the programme and every stop with directions, plus one QR code for everyone. Make it on your phone tonight.</div>
        </div>
        <div style="margin-top:auto; display:flex; align-items:center; gap:10mm; position:relative">
          <img src="${qr}" style="width:62mm; height:62mm; background:#fff; padding:4mm; border-radius:5mm" />
          <div style="font-size:15pt; line-height:1.5"><strong>Scan to start free</strong><br/>${SITE_LABEL}<br/><span style="color:var(--onNightMuted)">R899 once-off to publish</span></div>
        </div>
      </div>`,
    },
  ];

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  for (const a of assets) {
    const p = await browser.newPage({ viewport: { width: a.w, height: a.h } });
    await p.setContent(page(a.w, a.h, a.html), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: join(out, `${a.name}.png`) });
    await p.close();
    console.log('✓', `${a.name}.png`);
  }
  for (const a of printables) {
    const p = await browser.newPage();
    const size = a.format === 'A5' ? { w: '148mm', h: '210mm' } : { w: '210mm', h: '297mm' };
    await p.setContent(page(0, 0, a.html, `@page { size: ${size.w} ${size.h}; margin: 0 } body { width:${size.w} !important; height:${size.h} !important; }`), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: join(out, `${a.name}.pdf`), width: size.w, height: size.h, printBackground: true });
    await p.close();
    console.log('✓', `${a.name}.pdf`);
  }
  await browser.close();
  writeFileSync(join(out, 'SITE.txt'), `Assets point to ${SITE}\n`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
