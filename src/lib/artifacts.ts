'use client';

// Artifact Engine: every card and PDF is regenerated from the one memorial each
// time it is downloaded, so nothing goes stale and nothing is typed twice.
//
// Designed for print as much as for phones: the Jacaranda palette, Fraunces and
// Instrument Sans (embedded in the PDFs, so text stays sharp at any size), the
// arch portrait and the journey line. Printable cards render at 300 dpi.

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  dispositionLabel,
  displayName,
  fmtDate,
  funeralDate,
  initials,
  lifeDates,
  partStart,
  partStartLabel,
  programmeParts,
  programmeTypeLabel,
  stopLabel,
  type Draft,
  type Stop,
} from './memorial';

const C = {
  paper: '#ffffff',
  petal: '#fbfaf8',
  mist: '#f2eef7',
  bloom: '#c9b8e8',
  clay: '#5b3e8c',
  clayInk: '#3f2a66',
  ink: '#1e1a24',
  dusk: '#6b6475',
  line: '#e4deec',
  night: '#15121c',
  night2: '#221d2b',
  candle: '#e8a94a',
  onNight: '#f4f1f8',
  onNightMuted: '#a79fb3',
};
const DISPLAY = '"Fraunces Variable", Georgia, "Times New Roman", serif';
const SANS = '"Instrument Sans Variable", "Helvetica Neue", Arial, sans-serif';

/** The funeral home behind a memorial: its name (and logo) go on the back of what's printed. */
export interface PrintBrand {
  name: string;
  colour?: string;
  logo?: { data: string; w: number; h: number } | null;
}

export interface ArtifactInput {
  draft: Draft;
  url: string;
  slug: string;
  brand?: PrintBrand | null;
}

/** Turns a funeral home's logo into a PNG data URL the PDFs can embed. Without a usable logo, just the name prints. */
export async function prepareBrand(b: { name: string; logoUrl?: string; colour?: string } | null | undefined): Promise<PrintBrand | null> {
  if (!b?.name) return null;
  const colour = b.colour && /^#[0-9a-f]{6}$/i.test(b.colour) ? b.colour : undefined;
  const img = b.logoUrl ? await loadImage(b.logoUrl) : null;
  if (!img || !img.naturalWidth) return { name: b.name, colour, logo: null };
  const scale = Math.min(1, 900 / img.naturalWidth, 360 / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  try {
    return { name: b.name, colour, logo: { data: c.toDataURL('image/png'), w, h } };
  } catch {
    return { name: b.name, colour, logo: null }; // a logo from a site that doesn't allow it: the name still prints
  }
}

const file = (slug: string, kind: string, ext: string) => `memora-${slug || 'memorial'}-${kind}.${ext}`;
const bare = (url: string) => url.replace(/^https?:\/\//, '');

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image'));
      img.src = src;
    });
    return img;
  } catch {
    return null;
  }
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`400 48px ${DISPLAY}`),
      document.fonts.load(`italic 400 32px ${DISPLAY}`),
      document.fonts.load(`400 24px ${SANS}`),
      document.fonts.load(`600 24px ${SANS}`),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create images.');
  ctx.textBaseline = 'alphabetic';
  return { c, ctx };
}

function download(c: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) =>
    c.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not create the image.'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      resolve();
    }, 'image/png'),
  );
}

/** Word-wrap onto lines no wider than maxWidth; the last shown line gets an ellipsis when cut. */
function lines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 8): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      out.push(line);
      line = word;
    } else line = test;
  }
  if (line) out.push(line);
  const shown = out.slice(0, maxLines);
  if (out.length > maxLines && shown.length) shown[shown.length - 1] = `${shown[shown.length - 1].replace(/[,.;:]?$/, '')}…`;
  return shown;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 8): number {
  const shown = lines(ctx, text, maxWidth, maxLines);
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + shown.length * lineHeight;
}

/** Shrink a font until one line fits (for names). */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, maxWidth: number, min = size * 0.6): number {
  let s = size;
  ctx.font = font(s);
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(s);
  }
  return s;
}

/** Letter-spaced small caps label, centred or left depending on textAlign. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = text.split('');
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
  const align = ctx.textAlign;
  let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

/** The Memora arch: a semicircular top over softly rounded feet. */
function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, foot = w * 0.06) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h - foot);
  ctx.quadraticCurveTo(x + w, y + h, x + w - foot, y + h);
  ctx.lineTo(x + foot, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - foot);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  // Portraits keep the face: crop from a little above centre.
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, Math.max(0, (img.naturalHeight - sh) * 0.35), sw, sh, x, y, w, h);
}

/**
 * The portrait in its arch, with a fine outline floating just outside it: the
 * signature of every Memora keepsake.
 */
function archPortrait(
  ctx: CanvasRenderingContext2D,
  draft: Draft,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { outline: string; gap: number; stroke: number; empty: string; emptyInk: string },
) {
  ctx.save();
  archPath(ctx, x, y, w, h);
  ctx.clip();
  if (img) drawCover(ctx, img, x, y, w, h);
  else {
    ctx.fillStyle = o.empty;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = o.emptyInk;
    ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(w * 0.3)}px ${DISPLAY}`;
    ctx.fillText(initials(draft.person), x + w / 2, y + h * 0.62);
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = o.outline;
  ctx.lineWidth = o.stroke;
  archPath(ctx, x - o.gap, y - o.gap, w + o.gap * 2, h + o.gap * 2);
  ctx.stroke();
  ctx.restore();
}

/** A short rule, a candle dot, a short rule. */
function ornament(ctx: CanvasRenderingContext2D, cx: number, y: number, half: number, lineColor: string, dot = C.candle, r = 4) {
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = Math.max(1, r / 3);
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - r * 3, y);
  ctx.moveTo(cx + r * 3, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The journey-line M, as in the logo. */
function brandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size / 40;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 32);
  ctx.lineTo(8, 10);
  ctx.lineTo(20, 26);
  ctx.lineTo(32, 10);
  ctx.lineTo(32, 32);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(8, 32, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.candle;
  ctx.beginPath();
  ctx.arc(32, 32, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

async function qrImage(url: string, dark = C.ink, light = '#ffffff') {
  return loadImage(await QRCode.toDataURL(url, { width: 1200, margin: 0, color: { dark, light }, errorCorrectionLevel: 'M' }));
}

/** The first sentence of their story, or the family's words, for a keepsake. */
function keepsakeLine(draft: Draft): string {
  const pick = (t: string) => t.trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  const line = pick(draft.story.obituary) || pick(draft.story.familyMessage);
  return line.length > 8 ? line : 'Forever in our hearts.';
}

/** The stops people most need, in order: the vigil, the service, the burial or cremation. */
function keyStops(draft: Draft): Stop[] {
  const wanted = ['vigil', 'church', 'hall', 'cemetery', 'crematorium'];
  const found = draft.journey.filter((s) => wanted.includes(s.type));
  return (found.length ? found : draft.journey).slice(0, 3);
}

/** What guests call each gathering. */
const GATHERING: Partial<Record<Stop['type'], string>> = {
  vigil: 'Night vigil',
  church: 'Funeral service',
  hall: 'Funeral service',
  cemetery: 'Burial',
  crematorium: 'Cremation',
  reception: 'Refreshments',
  aftertears: 'After-tears',
};
const gathering = (s: Stop) => GATHERING[s.type] ?? stopLabel(s.type);
/** Leave out a label that only repeats the stop's own title. */
const unlessTitle = (label: string, s: Stop) => (label.toLowerCase() === s.title.trim().toLowerCase() ? '' : label);

/** "Mon 28 Sep" */
const shortDay = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return `${d.toLocaleDateString('en-ZA', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-ZA', { month: 'short' })}`;
};

/** "Mon 28 Sep – Thu 1 Oct · 18:00 · Family home", or '' with no prayer week. */
function prayerRange(draft: Draft): string {
  const w = draft.prayers;
  const on = w?.enabled ? w.evenings.filter((e) => e.on) : [];
  if (!on.length) return '';
  const span = on.length === 1 ? shortDay(on[0].date) : `${shortDay(on[0].date)} – ${shortDay(on[on.length - 1].date)}`;
  return [span, w.time, w.place].filter(Boolean).join(' · ');
}

const shortDate = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? fmtDate(date) : `${d.toLocaleDateString('en-ZA', { weekday: 'long' })} ${d.getDate()} ${d.toLocaleDateString('en-ZA', { month: 'long' })}`;
};

// ---------------------------------------------------------------------------
// PNG cards
// ---------------------------------------------------------------------------

/** 1080×1080 square for WhatsApp Status, Instagram and family groups. */
export async function socialCard({ draft, slug }: ArtifactInput) {
  await ensureFonts();
  const W = 1080;
  const { c, ctx } = canvas(W, W);
  ctx.fillStyle = C.petal;
  ctx.fillRect(0, 0, W, W);
  glow(ctx, W / 2, 330, 520, '201,184,232', 0.45);
  const img = await loadImage(draft.person.portraitUrl);
  archPortrait(ctx, draft, img, 355, 96, 370, 470, { outline: C.bloom, gap: 16, stroke: 2, empty: C.mist, emptyInk: C.clay });

  ctx.textAlign = 'center';
  ctx.fillStyle = C.clay;
  ctx.font = `600 19px ${SANS}`;
  spaced(ctx, 'IN LOVING MEMORY', W / 2, 660, 5);
  const name = displayName(draft.person);
  fit(ctx, name, (s) => `400 ${s}px ${DISPLAY}`, 78, 920);
  ctx.fillStyle = C.ink;
  ctx.fillText(name, W / 2, 752);
  ctx.fillStyle = C.dusk;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), W / 2, 806);
  ornament(ctx, W / 2, 866, 70, C.bloom);
  ctx.fillStyle = C.dusk;
  ctx.font = `italic 400 30px ${DISPLAY}`;
  wrap(ctx, keepsakeLine(draft), W / 2, 934, 760, 42, 2);
  brandMark(ctx, W / 2 - 14, 1010, 28, C.bloom);
  await download(c, file(slug, 'social', 'png'));
}

/** 1080×1350 portrait death notice for immediate sharing. */
export async function announcementCard({ draft, url, slug }: ArtifactInput) {
  await ensureFonts();
  const W = 1080;
  const H = 1350;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, 250, 560, '232,169,74', 0.24);
  const img = await loadImage(draft.person.portraitUrl);
  archPortrait(ctx, draft, img, 400, 110, 280, 350, { outline: 'rgba(232,169,74,.55)', gap: 14, stroke: 2, empty: C.night2, emptyInk: C.onNightMuted });

  ctx.textAlign = 'center';
  ctx.fillStyle = C.candle;
  ctx.font = `600 19px ${SANS}`;
  spaced(ctx, 'WITH DEEP SORROW', W / 2, 548, 5);
  const name = displayName(draft.person);
  fit(ctx, name, (s) => `400 ${s}px ${DISPLAY}`, 80, 940);
  ctx.fillStyle = C.onNight;
  ctx.fillText(name, W / 2, 640);
  ctx.fillStyle = C.onNightMuted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), W / 2, 692);
  ornament(ctx, W / 2, 748, 70, 'rgba(244,241,248,.25)');

  ctx.fillStyle = C.onNight;
  ctx.font = `italic 400 34px ${DISPLAY}`;
  let y = wrap(ctx, `The family sadly announces the passing of their beloved ${draft.person.preferredName || draft.person.firstName || 'loved one'}.`, W / 2, 820, 820, 48, 3);

  // The details people act on: where and when.
  // What people act on: where and when. Prayers during the week come first.
  const rows: { label: string; line: string }[] = [];
  const prayer = prayerRange(draft);
  if (prayer) rows.push({ label: 'EVENING PRAYERS', line: prayer });
  for (const s of keyStops(draft).slice(0, 4 - rows.length)) {
    rows.push({ label: gathering(s).toUpperCase(), line: [shortDate(s.date), s.time, unlessTitle(s.title, { ...s, title: gathering(s) })].filter(Boolean).join(' · ') });
  }
  y += rows.length > 3 ? 16 : 34;
  const rowH = rows.length > 3 ? 70 : 74;
  const boxH = rows.length ? rows.length * rowH + 40 : 96;
  ctx.fillStyle = C.night2;
  ctx.beginPath();
  ctx.roundRect(110, y, 860, boxH, 28);
  ctx.fill();
  ctx.textAlign = 'left';
  if (!rows.length) {
    ctx.fillStyle = C.onNightMuted;
    ctx.font = `400 26px ${SANS}`;
    ctx.fillText('Funeral details to follow.', 150, y + 58);
  }
  rows.forEach((r, i) => {
    const ry = y + 26 + i * rowH;
    ctx.fillStyle = C.candle;
    ctx.font = `600 17px ${SANS}`;
    spaced(ctx, r.label, 150, ry + 20, 2);
    ctx.fillStyle = C.onNight;
    ctx.font = `400 25px ${SANS}`;
    ctx.fillText(lines(ctx, r.line, 780, 1)[0] ?? '', 150, ry + 52);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = C.onNightMuted;
  ctx.font = `400 20px ${SANS}`;
  ctx.fillText('Details, directions and live updates', W / 2, H - 78);
  ctx.fillStyle = C.onNight;
  ctx.font = `600 24px ${SANS}`;
  ctx.fillText(bare(url), W / 2, H - 44);
  await download(c, file(slug, 'announcement', 'png'));
}

/** 1080×1350 route card with times, stops and the memorial link. */
export async function journeyCard({ draft, url, slug }: ArtifactInput) {
  await ensureFonts();
  const W = 1080;
  const H = 1350;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = C.petal;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 900, 80, 420, '201,184,232', 0.35);

  ctx.textAlign = 'left';
  ctx.fillStyle = C.clay;
  ctx.font = `600 19px ${SANS}`;
  spaced(ctx, 'THE FUNERAL JOURNEY', 90, 116, 5);
  const name = displayName(draft.person);
  fit(ctx, name, (s) => `400 ${s}px ${DISPLAY}`, 72, 900);
  ctx.fillStyle = C.ink;
  ctx.fillText(name, 90, 200);
  ctx.fillStyle = C.dusk;
  ctx.font = `400 25px ${SANS}`;
  ctx.fillText([dispositionLabel(draft.disposition.type), draft.person && lifeDates(draft.person)].filter(Boolean).join(' · '), 90, 248);

  const stops = draft.journey.slice(0, 7);
  const lineX = 262;
  let y = 330;
  const rowGap = stops.length > 5 ? 118 : 138;
  let lastDate = '';
  const pins: { y: number; last: boolean }[] = [];
  stops.forEach((s, i) => {
    if (s.date && s.date !== lastDate) {
      ctx.fillStyle = C.clay;
      ctx.font = `600 17px ${SANS}`;
      spaced(ctx, shortDate(s.date).toUpperCase(), lineX + 44, y, 3);
      y += 42;
      lastDate = s.date;
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink;
    ctx.font = `400 40px ${DISPLAY}`;
    ctx.fillText(s.time || '', lineX - 38, y + 14);
    ctx.textAlign = 'left';
    pins.push({ y, last: i === stops.length - 1 });
    ctx.fillStyle = C.ink;
    ctx.font = `600 30px ${SANS}`;
    ctx.fillText(lines(ctx, s.title, 700, 1)[0] ?? '', lineX + 44, y + 12);
    ctx.fillStyle = C.dusk;
    ctx.font = `400 22px ${SANS}`;
    const sub = [unlessTitle(stopLabel(s.type), s), s.landmark && !s.address.includes(s.landmark) ? `${s.address} · ${s.landmark}` : s.address].filter(Boolean).join(' · ');
    ctx.fillText(lines(ctx, sub, 700, 1)[0] ?? '', lineX + 44, y + 48);
    if (s.departTime) {
      ctx.fillStyle = C.clay;
      ctx.fillText(`Until ${s.departTime}`, lineX + 44, y + 80);
    }
    y += rowGap + (s.departTime ? 18 : 0);
  });
  // The journey line, drawn behind the pins.
  if (pins.length > 1) {
    ctx.strokeStyle = C.bloom;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lineX, pins[0].y);
    ctx.lineTo(lineX, pins[pins.length - 1].y);
    ctx.stroke();
  }
  pins.forEach((p, i) => {
    ctx.fillStyle = p.last ? C.candle : i === 0 ? C.clay : C.paper;
    ctx.strokeStyle = p.last ? C.candle : C.clay;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(lineX, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Footer band with the QR code.
  ctx.fillStyle = C.night;
  ctx.beginPath();
  ctx.roundRect(60, H - 200, W - 120, 150, 30);
  ctx.fill();
  const qr = await qrImage(url, C.night, C.onNight);
  ctx.fillStyle = C.onNight;
  ctx.beginPath();
  ctx.roundRect(W - 200, H - 184, 118, 118, 14);
  ctx.fill();
  if (qr) ctx.drawImage(qr, W - 190, H - 174, 98, 98);
  ctx.fillStyle = C.candle;
  ctx.font = `600 17px ${SANS}`;
  spaced(ctx, 'ON THE DAY', 104, H - 140, 4);
  ctx.fillStyle = C.onNight;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText('Live directions, times and the procession', 104, H - 104);
  ctx.fillStyle = C.onNightMuted;
  ctx.font = `400 21px ${SANS}`;
  ctx.fillText(bare(url), 104, H - 72);
  await download(c, file(slug, 'funeral-journey', 'png'));
}

/** 5 × 7 in keepsake card at 300 dpi (1500 × 2100), to print and hand to guests. */
export async function keepsakeCard({ draft, slug }: ArtifactInput) {
  await ensureFonts();
  const W = 1500;
  const H = 2100;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  // A fine double frame, like engraved stationery.
  ctx.strokeStyle = C.clay;
  ctx.lineWidth = 3;
  ctx.strokeRect(66, 66, W - 132, H - 132);
  ctx.strokeStyle = C.bloom;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(84, 84, W - 168, H - 168);

  const img = await loadImage(draft.person.portraitUrl);
  archPortrait(ctx, draft, img, 440, 220, 620, 800, { outline: C.bloom, gap: 22, stroke: 2.5, empty: C.mist, emptyInk: C.clay });

  ctx.textAlign = 'center';
  ctx.fillStyle = C.clay;
  ctx.font = `600 26px ${SANS}`;
  spaced(ctx, 'IN LOVING MEMORY', W / 2, 1172, 7);
  const name = displayName(draft.person);
  const size = fit(ctx, name, (s) => `400 ${s}px ${DISPLAY}`, 108, 1180, 70);
  ctx.fillStyle = C.ink;
  ctx.fillText(name, W / 2, 1172 + 30 + size);
  let y = 1172 + 30 + size + 70;
  ctx.fillStyle = C.dusk;
  ctx.font = `400 36px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), W / 2, y);
  y += 96;
  ornament(ctx, W / 2, y, 110, C.bloom, C.candle, 6);
  y += 110;
  ctx.fillStyle = C.ink;
  ctx.font = `italic 400 46px ${DISPLAY}`;
  wrap(ctx, keepsakeLine(draft), W / 2, y, 1060, 66, 4);
  brandMark(ctx, W / 2 - 20, H - 190, 40, C.bloom);
  await download(c, file(slug, 'keepsake-card', 'png'));
}

/** 4 × 5 in QR card at 300 dpi (1200 × 1500) for entrances, tables and programmes. */
/** The QR card, drawn but not downloaded: the Branding preview shows exactly this. */
export async function drawQrCard({ draft, url, brand }: Omit<ArtifactInput, 'slug'>): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const W = 1200;
  const H = 1500;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = C.petal;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, 760, 640, '201,184,232', 0.4);

  ctx.textAlign = 'center';
  ctx.fillStyle = C.clay;
  ctx.font = `600 24px ${SANS}`;
  spaced(ctx, 'SCAN TO REMEMBER', W / 2, 150, 6);
  const name = displayName(draft.person);
  fit(ctx, name, (s) => `400 ${s}px ${DISPLAY}`, 84, 1000);
  ctx.fillStyle = C.ink;
  ctx.fillText(name, W / 2, 250);
  ctx.fillStyle = C.dusk;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), W / 2, 306);

  // The QR code sits in an arch-topped white panel.
  const pw = 700;
  const ph = 860;
  const px = (W - pw) / 2;
  const py = 380;
  ctx.save();
  ctx.shadowColor = 'rgba(63,42,102,.14)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = C.paper;
  archPath(ctx, px, py, pw, ph, 36);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.bloom;
  ctx.lineWidth = 2;
  archPath(ctx, px - 16, py - 16, pw + 32, ph + 32, 44);
  ctx.stroke();
  const qr = await qrImage(url);
  if (qr) ctx.drawImage(qr, px + 110, py + 330, pw - 220, pw - 220);
  brandMark(ctx, W / 2 - 30, py + 170, 60, C.clay);
  ctx.fillStyle = C.dusk;
  ctx.font = `600 20px ${SANS}`;
  spaced(ctx, 'MEMORIAL', W / 2, py + 290, 5);

  // The foot: what the code opens, then the funeral home that arranged it.
  const withLogo = Boolean(brand?.logo);
  const foot = brand ? (withLogo ? 1290 : 1340) : 1352;
  ctx.fillStyle = C.ink;
  ctx.font = `italic 400 34px ${DISPLAY}`;
  ctx.fillText('Their story, the programme and directions', W / 2, foot);
  ctx.fillStyle = C.dusk;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText(bare(url), W / 2, foot + 50);
  if (brand) {
    const ink = brand.colour ?? C.clay;
    let y = foot + 122;
    if (brand.logo) {
      const logo = await loadImage(brand.logo.data);
      if (logo) {
        const s2 = Math.min(280 / brand.logo.w, 56 / brand.logo.h);
        const w = brand.logo.w * s2;
        const h = brand.logo.h * s2;
        const top = foot + 78;
        ctx.drawImage(logo, W / 2 - w / 2, top + (56 - h) / 2, w, h);
        y = top + 56 + 38;
      }
    }
    ctx.fillStyle = ink;
    ctx.font = `600 19px ${SANS}`;
    spaced(ctx, `ARRANGED WITH CARE BY ${brand.name.toUpperCase()}`, W / 2, y, 3);
  }
  return c;
}

export async function qrCard(input: ArtifactInput) {
  const c = await drawQrCard(input);
  await download(c, file(input.slug, 'qr-card', 'png'));
}

// ---------------------------------------------------------------------------
// PDFs — A4, with Fraunces and Instrument Sans embedded so type prints crisp.
// ---------------------------------------------------------------------------

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 24;
const BOTTOM = 26;
type RGB = [number, number, number];
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const P = { ink: rgb(C.ink), dusk: rgb(C.dusk), clay: rgb(C.clay), bloom: rgb(C.bloom), line: rgb(C.line), candle: rgb(C.candle), mist: rgb(C.mist) };

const PDF_FONTS: [file: string, family: string, style: string][] = [
  ['fraunces-display.ttf', 'FrauncesDisplay', 'normal'],
  ['fraunces-text.ttf', 'Fraunces', 'normal'],
  ['fraunces-italic.ttf', 'Fraunces', 'italic'],
  ['instrument-sans.ttf', 'Instrument', 'normal'],
  ['instrument-sans-semibold.ttf', 'Instrument', 'bold'],
];
let fontData: Promise<Map<string, string> | null> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Fetched once, when the first PDF is made. Null if they can't load (PDFs fall back to Helvetica/Times). */
function loadPdfFonts() {
  fontData ??= Promise.all(
    PDF_FONTS.map(async ([f]) => {
      const res = await fetch(`/fonts/pdf/${f}`);
      if (!res.ok) throw new Error('font');
      return [f, toBase64(await res.arrayBuffer())] as const;
    }),
  )
    .then((pairs) => new Map(pairs))
    .catch(() => null);
  return fontData;
}

type Face = 'display' | 'serif' | 'italic' | 'sans' | 'sansBold';

type Op = [method: string, args: unknown[]];

/**
 * Stands in for jsPDF while a booklet is laid out: it measures text on a real
 * (never saved) A4 document and records every drawing call per page, so the
 * pages can then be placed two to a sheet in fold order.
 */
class Recorder {
  pages: Op[][] = [[]];
  constructor(readonly m: jsPDF) {}
  private rec(name: string, args: unknown[]) {
    this.pages[this.pages.length - 1].push([name, args]);
  }
  setFont(family: string, style?: string) {
    this.m.setFont(family, style);
    this.rec('setFont', [family, style]);
  }
  setFontSize(size: number) {
    this.m.setFontSize(size);
    this.rec('setFontSize', [size]);
  }
  setTextColor(...a: number[]) {
    this.rec('setTextColor', a);
  }
  setDrawColor(...a: number[]) {
    this.rec('setDrawColor', a);
  }
  setFillColor(...a: number[]) {
    this.rec('setFillColor', a);
  }
  setLineWidth(w: number) {
    this.rec('setLineWidth', [w]);
  }
  text(...a: unknown[]) {
    this.rec('text', a);
  }
  line(...a: unknown[]) {
    this.rec('line', a);
  }
  rect(...a: unknown[]) {
    this.rec('rect', a);
  }
  roundedRect(...a: unknown[]) {
    this.rec('roundedRect', a);
  }
  circle(...a: unknown[]) {
    this.rec('circle', a);
  }
  addImage(...a: unknown[]) {
    this.rec('addImage', a);
  }
  getTextWidth(t: string) {
    return this.m.getTextWidth(t);
  }
  splitTextToSize(t: string, w: number) {
    return this.m.splitTextToSize(t, w);
  }
  addPage() {
    this.pages.push([]);
  }
  getNumberOfPages() {
    return this.pages.length;
  }
  addFileToVFS(name: string, data: string) {
    this.m.addFileToVFS(name, data);
  }
  addFont(file: string, family: string, style: string) {
    this.m.addFont(file, family, style);
  }
  setProperties(p: Record<string, string>) {
    this.m.setProperties(p);
  }
}

/** Draw one recorded page onto a sheet, scaled by s and shifted right by ox (all in mm). */
function replay(out: jsPDF, ops: Op[], s: number, ox: number) {
  const X = (v: unknown) => ox + (v as number) * s;
  const S = (v: unknown) => (v as number) * s;
  for (const [name, a] of ops) {
    switch (name) {
      case 'setFont':
        out.setFont(a[0] as string, a[1] as string | undefined);
        break;
      case 'setFontSize':
        out.setFontSize(S(a[0]));
        break;
      case 'setTextColor':
        out.setTextColor(a[0] as number, a[1] as number, a[2] as number);
        break;
      case 'setDrawColor':
        out.setDrawColor(a[0] as number, a[1] as number, a[2] as number);
        break;
      case 'setFillColor':
        out.setFillColor(a[0] as number, a[1] as number, a[2] as number);
        break;
      case 'setLineWidth':
        out.setLineWidth(S(a[0]));
        break;
      case 'text': {
        const o = a[3] ? { ...(a[3] as Record<string, number | string>) } : undefined;
        if (o && typeof o.maxWidth === 'number') o.maxWidth = S(o.maxWidth);
        if (o && typeof o.charSpace === 'number') o.charSpace = S(o.charSpace);
        out.text(a[0] as string, X(a[1]), S(a[2]), o);
        break;
      }
      case 'line':
        out.line(X(a[0]), S(a[1]), X(a[2]), S(a[3]));
        break;
      case 'rect':
        out.rect(X(a[0]), S(a[1]), S(a[2]), S(a[3]), a[4] as string | undefined);
        break;
      case 'roundedRect':
        out.roundedRect(X(a[0]), S(a[1]), S(a[2]), S(a[3]), S(a[4]), S(a[5]), a[6] as string | undefined);
        break;
      case 'circle':
        out.circle(X(a[0]), S(a[1]), S(a[2]), a[3] as string | undefined);
        break;
      case 'addImage':
        out.addImage(a[0] as string, a[1] as string, X(a[2]), S(a[3]), S(a[4]), S(a[5]));
        break;
    }
  }
}

class Pdf {
  doc: jsPDF;
  y = MARGIN;
  private embedded = false;
  private closingPage = 0;
  /** Type scale: A5 booklet pages are laid out on A4 and shrunk, so their type starts larger. */
  private k: number;

  constructor(
    private name: string,
    private footerNote: string,
    opts: { doc?: jsPDF; typeScale?: number; brand?: PrintBrand | null } = {},
  ) {
    this.doc = opts.doc ?? new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.k = opts.typeScale ?? 1;
    this.brand = opts.brand ?? null;
  }
  private brand: PrintBrand | null;

  async init() {
    const fonts = await loadPdfFonts();
    if (fonts) {
      for (const [f, family, style] of PDF_FONTS) {
        this.doc.addFileToVFS(f, fonts.get(f)!);
        this.doc.addFont(f, family, style);
      }
      this.embedded = true;
    }
    this.doc.setProperties({ title: `In loving memory of ${this.name}`, creator: 'Memora' });
    return this;
  }

  face(face: Face, size: number, color: RGB = P.ink) {
    const d = this.doc;
    if (this.embedded) {
      const map: Record<Face, [string, string]> = {
        display: ['FrauncesDisplay', 'normal'],
        serif: ['Fraunces', 'normal'],
        italic: ['Fraunces', 'italic'],
        sans: ['Instrument', 'normal'],
        sansBold: ['Instrument', 'bold'],
      };
      d.setFont(...map[face]);
    } else {
      const map: Record<Face, [string, string]> = {
        display: ['times', 'normal'],
        serif: ['times', 'normal'],
        italic: ['times', 'italic'],
        sans: ['helvetica', 'normal'],
        sansBold: ['helvetica', 'bold'],
      };
      d.setFont(...map[face]);
    }
    d.setFontSize(size * this.k);
    d.setTextColor(...color);
  }

  /** Line height in mm for a font size in pt. */
  lh = (size: number, leading = 1.45) => size * this.k * 0.3528 * leading;

  split(text: string, width: number): string[] {
    return this.doc.splitTextToSize(String(text).replace(/\s*\n\s*/g, ' '), width) as string[];
  }

  private footer() {
    const d = this.doc;
    const page = d.getNumberOfPages();
    if (page === 1 || page === this.closingPage) return; // the covers stay clean
    const y = PAGE_H - 13;
    d.setDrawColor(...P.line);
    d.setLineWidth(0.2);
    d.line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5);
    this.face('italic', 8.5, P.dusk);
    d.text(`In loving memory of ${this.name}`, MARGIN, y);
    this.face('sans', 8, P.dusk);
    d.text(String(page), PAGE_W - MARGIN, y, { align: 'right' });
  }

  newPage() {
    this.footer();
    this.doc.addPage();
    this.y = MARGIN + 2;
  }

  ensure(space: number) {
    if (this.y + space > PAGE_H - BOTTOM) this.newPage();
  }

  private ornament(cx: number, y: number, half = 12) {
    const d = this.doc;
    d.setDrawColor(...P.bloom);
    d.setLineWidth(0.3);
    d.line(cx - half, y, cx - 2.2, y);
    d.line(cx + 2.2, y, cx + half, y);
    d.setFillColor(...P.candle);
    d.circle(cx, y, 0.9, 'F');
  }

  /** The cover: arch portrait, name, dates, and what this document is. */
  async cover(draft: Draft, title: string, subtitle: string) {
    const d = this.doc;
    // Fine double frame.
    d.setDrawColor(...P.clay);
    d.setLineWidth(0.35);
    d.rect(12, 12, PAGE_W - 24, PAGE_H - 24);
    d.setDrawColor(...P.bloom);
    d.setLineWidth(0.2);
    d.rect(14.5, 14.5, PAGE_W - 29, PAGE_H - 29);

    // Arch portrait, rendered at 300 dpi with its outline.
    const img = await loadImage(draft.person.portraitUrl);
    const pw = 72;
    const ph = 92;
    const pad = 4;
    const px = 12; // pixels per mm ≈ 300 dpi
    const { c, ctx } = canvas(Math.round((pw + pad * 2) * px), Math.round((ph + pad * 2) * px));
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, c.width, c.height);
    await ensureFonts();
    archPortrait(ctx, draft, img, pad * px, pad * px, pw * px, ph * px, { outline: C.bloom, gap: 2.2 * px, stroke: 0.35 * px, empty: C.mist, emptyInk: C.clay });
    const top = 38;
    d.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', (PAGE_W - pw) / 2 - pad, top - pad, pw + pad * 2, ph + pad * 2);
    this.y = top + ph + 18;

    this.face('sansBold', 8.5, P.clay);
    d.text('IN LOVING MEMORY', PAGE_W / 2, this.y, { align: 'center', charSpace: 1.1 });
    this.y += 16;
    let size = 36;
    this.face('display', size);
    while (size > 24 && d.getTextWidth(displayName(draft.person)) > PAGE_W - 50) this.face('display', (size -= 1));
    for (const line of this.split(displayName(draft.person), PAGE_W - 50)) {
      d.text(line, PAGE_W / 2, this.y, { align: 'center' });
      this.y += this.lh(size, 1.15);
    }
    this.y += 1;
    this.face('sans', 11, P.dusk);
    d.text(lifeDates(draft.person), PAGE_W / 2, this.y, { align: 'center' });
    this.y += 11;
    this.ornament(PAGE_W / 2, this.y);
    this.y += 11;
    this.face('italic', 16, P.clay);
    d.text(title, PAGE_W / 2, this.y, { align: 'center' });
    this.y += 7;
    if (subtitle) {
      this.face('sans', 10, P.dusk);
      for (const line of this.split(subtitle, PAGE_W - 60)) {
        d.text(line, PAGE_W / 2, this.y, { align: 'center' });
        this.y += this.lh(10);
      }
    }
    // A line from their story rests at the foot of the cover.
    this.face('italic', 12.5, P.ink);
    const quote = this.split(`“${keepsakeLine(draft).replace(/[.]$/, '')}.”`, PAGE_W - 70).slice(0, 3);
    let qy = PAGE_H - 34 - (quote.length - 1) * this.lh(12.5, 1.5);
    for (const line of quote) {
      d.text(line, PAGE_W / 2, qy, { align: 'center' });
      qy += this.lh(12.5, 1.5);
    }
  }

  /** A section opener: small caps label, a title and a hairline. */
  section(label: string, title: string) {
    this.ensure(34);
    const d = this.doc;
    this.face('sansBold', 8, P.clay);
    d.text(label.toUpperCase(), MARGIN, this.y, { charSpace: 0.9 });
    this.y += 9;
    this.face('display', 22);
    d.text(title, MARGIN, this.y);
    this.y += 5;
    d.setDrawColor(...P.line);
    d.setLineWidth(0.25);
    d.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 9;
  }

  /** Flowing text. A drop cap opens the story. */
  prose(value: string, opts: { size?: number; italic?: boolean; dropCap?: boolean; align?: 'left' | 'center' } = {}) {
    const d = this.doc;
    const size = opts.size ?? 11.5;
    const lh = this.lh(size, 1.55);
    const width = PAGE_W - MARGIN * 2;
    const paras = String(value || '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    paras.forEach((para, pi) => {
      let text = para;
      let capLines = 0;
      let capW = 0;
      if (opts.dropCap && pi === 0 && /^[A-Za-zÀ-ÿ]/.test(para)) {
        const cap = para[0];
        text = para.slice(1);
        this.ensure(lh * 3);
        this.face('display', size * 5.1, P.clay);
        capW = d.getTextWidth(cap) + 2.6;
        d.text(cap, MARGIN - 0.6, this.y + lh * 2);
        capLines = 3;
      }
      this.face(opts.italic ? 'italic' : 'serif', size, P.ink);
      // The first lines wrap beside the drop cap.
      const words = text.split(/\s+/).filter(Boolean);
      const out: { text: string; indent: number }[] = [];
      let line = '';
      const widthFor = () => (out.length < capLines ? width - capW : width);
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (d.getTextWidth(test) > widthFor() && line) {
          out.push({ text: line, indent: out.length < capLines ? capW : 0 });
          line = w;
        } else line = test;
      }
      if (line) out.push({ text: line, indent: out.length < capLines ? capW : 0 });
      for (const l of out) {
        this.ensure(lh);
        if (opts.align === 'center') d.text(l.text, PAGE_W / 2, this.y, { align: 'center' });
        else d.text(l.text, MARGIN + l.indent, this.y);
        this.y += lh;
      }
      this.y += lh * 0.55;
    });
  }

  programme(draft: Draft) {
    if (draft.programme.mode !== 'formal' || !draft.programme.items.length) return;
    const d = this.doc;
    this.section('Order of service', 'The programme');
    const groups = programmeParts(draft.programme.items);
    const timeX = MARGIN;
    const railX = MARGIN + 21;
    const textX = MARGIN + 27;
    const textW = PAGE_W - MARGIN - textX;
    groups.forEach((g, gi) => {
      const when = partStartLabel(partStart(draft.journey, draft.programme.items, g.part), g.part);
      if (groups.length > 1 || g.part !== 'service' || when) {
        // Keep a part's heading with its first item.
        this.ensure(30 + this.lh(13) * 3);
        if (gi > 0) this.y += 4;
        this.face('sansBold', 8, g.part === 'vigil' ? P.candle : P.clay);
        d.text(g.label.toUpperCase(), MARGIN, this.y, { charSpace: 0.9 });
        if (when) {
          this.y += 5.5;
          this.face('italic', 11, P.dusk);
          d.text(when, MARGIN, this.y);
        }
        this.y += 8;
      }
      g.items.forEach((item, i) => {
        this.face('serif', 13);
        const title = this.split(item.title, textW);
        this.face('sans', 9.5);
        const meta = [item.presenter].filter(Boolean);
        const detail = item.detail ? this.split(item.detail, textW) : [];
        const h = 4 + title.length * this.lh(13, 1.25) + meta.length * this.lh(9.5) + detail.length * this.lh(9.5) + 5;
        this.ensure(h);
        const top = this.y;
        // Rail and dot: the journey line through the service.
        d.setDrawColor(...P.bloom);
        d.setLineWidth(0.35);
        if (i < g.items.length - 1) d.line(railX, top + 4, railX, top + h + 4);
        d.setFillColor(...(i === 0 ? P.clay : [255, 255, 255] as RGB));
        d.setDrawColor(...P.clay);
        d.setLineWidth(0.35);
        d.circle(railX, top + 4, 1.3, 'FD');
        if (item.time) {
          this.face('serif', 12, P.clay);
          d.text(item.time, timeX, top + 5.4);
        }
        this.face('sansBold', 7, P.dusk);
        d.text(programmeTypeLabel(item.type).toUpperCase(), textX, top, { charSpace: 0.6 });
        this.y = top + 5.4;
        this.face('serif', 13);
        for (const l of title) {
          d.text(l, textX, this.y);
          this.y += this.lh(13, 1.25);
        }
        if (meta.length) {
          this.face('sans', 9.5, P.dusk);
          d.text(meta.join(' · '), textX, this.y);
          this.y += this.lh(9.5);
        }
        if (detail.length) {
          this.face('italic', 9.5, P.dusk);
          for (const l of detail) {
            d.text(l, textX, this.y);
            this.y += this.lh(9.5);
          }
        }
        this.y = top + h;
      });
    });
    this.y += 4;
  }

  /** Prayers during the week: one line per evening, with its title, word of the day and scripture. */
  prayers(draft: Draft) {
    const w = draft.prayers;
    const on = w?.enabled ? w.evenings.filter((e) => e.on) : [];
    if (!on.length) return;
    const d = this.doc;
    this.section('Prayers during the week', 'Pray with the family');
    this.face('sans', 10, P.dusk);
    const where = [`Each evening at ${w.time}${w.endTime ? `–${w.endTime}` : ''}`, w.place, w.address !== w.place ? w.address : ''].filter(Boolean).join(' · ');
    for (const l of this.split(where, PAGE_W - MARGIN * 2)) {
      d.text(l, MARGIN, this.y);
      this.y += this.lh(10);
    }
    this.y += 4;
    const textX = MARGIN + 27;
    const textW = PAGE_W - MARGIN - textX;
    for (const e of on) {
      const extra = [e.word && `“${e.word}”`, e.scripture, e.leader && `Led by ${e.leader}`].filter(Boolean).join(' · ');
      this.face('sans', 9.5);
      const extraLines = extra ? this.split(extra, textW) : [];
      const h = 6 + extraLines.length * this.lh(9.5) + 5;
      this.ensure(h);
      const top = this.y;
      this.face('sansBold', 7.5, P.clay);
      d.text(shortDay(e.date).toUpperCase(), MARGIN, top + 0.5, { charSpace: 0.4 });
      this.face('serif', 12, P.clay);
      d.text(e.time || w.time, MARGIN, top + 5.5);
      this.face('serif', 13);
      d.text(e.title || 'Evening prayers', textX, top + 1.5);
      this.y = top + 6.5;
      if (extraLines.length) {
        this.face('italic', 9.5, P.dusk);
        for (const l of extraLines) {
          d.text(l, textX, this.y);
          this.y += this.lh(9.5);
        }
      }
      this.y = top + h;
    }
    this.y += 4;
  }

  async journey(draft: Draft, url: string) {
    if (!draft.journey.length) return;
    const d = this.doc;
    this.section(`Funeral journey · ${dispositionLabel(draft.disposition.type)}`, 'Where to be, and when');
    const railX = MARGIN + 4;
    const textX = MARGIN + 13;
    const textW = PAGE_W - MARGIN - textX;
    let lastDate = '';
    draft.journey.forEach((s, i) => {
      const where = s.landmark && !s.address.includes(s.landmark) ? [s.address, `Entrance: ${s.landmark}`] : [s.address];
      const notes = [s.departTime && `Until ${s.departTime}`, s.parking && (/^park/i.test(s.parking) ? s.parking : `Parking: ${s.parking}`), s.transport].filter(
        Boolean,
      ) as string[];
      this.face('sans', 9.5);
      const label = stopLabel(s.type);
      const sub = this.split([label.toLowerCase() === s.title.toLowerCase() ? '' : label, ...where].filter(Boolean).join(' · '), textW);
      const extra = notes.length ? this.split(notes.join(' · '), textW) : [];
      const dateH = s.date !== lastDate ? 9 : 0;
      const h = dateH + 6 + sub.length * this.lh(9.5) + extra.length * this.lh(9.5) + 7;
      this.ensure(h);
      if (s.date && s.date !== lastDate) {
        this.face('sansBold', 8, P.clay);
        d.text(shortDate(s.date).toUpperCase(), textX, this.y, { charSpace: 0.8 });
        this.y += dateH;
        lastDate = s.date;
      }
      const top = this.y;
      if (i < draft.journey.length - 1) {
        d.setDrawColor(...P.bloom);
        d.setLineWidth(0.5);
        d.line(railX, top, railX, top + h - dateH + 2);
      }
      const last = i === draft.journey.length - 1;
      d.setFillColor(...(last ? P.candle : P.clay));
      d.circle(railX, top - 1.2, 3.1, 'F');
      this.face('sansBold', 7.5, [255, 255, 255]);
      d.text(String(i + 1), railX, top - 0.1, { align: 'center' });
      this.face('serif', 13.5);
      d.text([s.time, s.title].filter(Boolean).join('  ·  '), textX, top);
      this.y = top + 5.6;
      this.face('sans', 9.5, P.dusk);
      for (const l of sub) {
        d.text(l, textX, this.y);
        this.y += this.lh(9.5);
      }
      if (extra.length) {
        this.face('sans', 9.5, P.clay);
        for (const l of extra) {
          d.text(l, textX, this.y);
          this.y += this.lh(9.5);
        }
      }
      this.y = top + h - dateH;
    });
    // The QR code for the day fits here if there's room; otherwise the closing page carries it.
    if (this.y + 46 < PAGE_H - BOTTOM) await this.qrPanel(url, 'On the day', 'Scan for live directions, times and the procession.');
  }

  /** A soft panel with the memorial's QR code. */
  async qrPanel(url: string, label: string, line: string) {
    const d = this.doc;
    const h = 34;
    this.ensure(h + 6);
    this.y += 2;
    d.setFillColor(...P.mist);
    d.roundedRect(MARGIN, this.y, PAGE_W - MARGIN * 2, h, 4, 4, 'F');
    const qr = await QRCode.toDataURL(url, { width: 600, margin: 0, color: { dark: C.ink, light: C.mist }, errorCorrectionLevel: 'M' });
    d.addImage(qr, 'PNG', PAGE_W - MARGIN - 29, this.y + 5, 24, 24);
    this.face('sansBold', 8, P.clay);
    d.text(label.toUpperCase(), MARGIN + 7, this.y + 11, { charSpace: 0.9 });
    this.face('serif', 12.5);
    const text = this.split(line, PAGE_W - MARGIN * 2 - 44).slice(0, 2);
    let ty = this.y + 18.5;
    for (const l of text) {
      d.text(l, MARGIN + 7, ty);
      ty += this.lh(12.5, 1.25);
    }
    this.face('sans', 9, P.dusk);
    d.text(bare(url), MARGIN + 7, Math.max(this.y + 27, ty + 1.5));
    this.y += h + 8;
  }

  /** The last word: the family's message, centred, with a QR code to the memorial. */
  async closing(draft: Draft, url: string) {
    const d = this.doc;
    this.newPage();
    this.closingPage = d.getNumberOfPages();
    this.y = 86;
    this.face('sansBold', 8.5, P.clay);
    d.text(draft.story.familyMessage ? 'FROM THE FAMILY' : 'FOREVER IN OUR HEARTS', PAGE_W / 2, this.y, { align: 'center', charSpace: 1.1 });
    this.y += 14;
    if (draft.story.familyMessage) this.prose(draft.story.familyMessage, { italic: true, size: 14, align: 'center' });
    else {
      this.face('display', 24);
      d.text(displayName(draft.person), PAGE_W / 2, this.y, { align: 'center' });
      this.y += 10;
    }
    this.y += 6;
    this.ornament(PAGE_W / 2, this.y);
    this.y += 22;
    const qr = await QRCode.toDataURL(url, { width: 700, margin: 0, color: { dark: C.ink, light: '#ffffff' }, errorCorrectionLevel: 'M' });
    const s = 34;
    this.ensure(s + 24);
    d.addImage(qr, 'PNG', (PAGE_W - s) / 2, this.y, s, s);
    this.y += s + 8;
    this.face('italic', 11, P.dusk);
    d.text('Scan to visit their memorial', PAGE_W / 2, this.y, { align: 'center' });
    this.y += 5.5;
    this.face('sans', 9, P.dusk);
    d.text(bare(url), PAGE_W / 2, this.y, { align: 'center' });
    // The back cover: the funeral home that arranged it (with its logo), then a quiet maker's mark.
    if (this.brand) {
      const b = this.brand;
      const ink = b.colour ? rgb(b.colour) : P.clay;
      let y = PAGE_H - 34;
      if (b.logo) {
        const maxW = 46;
        const maxH = 16;
        const s = Math.min(maxW / b.logo.w, maxH / b.logo.h);
        const w = b.logo.w * s;
        const h = b.logo.h * s;
        d.addImage(b.logo.data, 'PNG', (PAGE_W - w) / 2, y - h - 6, w, h);
      }
      this.face('italic', 9.5, P.dusk);
      d.text('Arranged with care by', PAGE_W / 2, y, { align: 'center' });
      y += 5.2;
      this.face('sansBold', 10, ink);
      d.text(b.name, PAGE_W / 2, y, { align: 'center' });
      this.face('sans', 6.5, P.bloom);
      d.text(this.footerNote, PAGE_W / 2, PAGE_H - 16, { align: 'center', charSpace: 0.6 });
    } else {
      this.face('sans', 7.5, P.bloom);
      d.text(this.footerNote, PAGE_W / 2, PAGE_H - 30, { align: 'center', charSpace: 0.6 });
    }
  }

  save(filename: string) {
    this.footer();
    this.doc.save(filename);
  }

  /** Close the last page without saving (the booklet is saved after imposition). */
  finish() {
    this.footer();
  }
}

function serviceLine(draft: Draft): string {
  const svc = partStart(draft.journey, draft.programme.items, 'service');
  const date = svc?.date || funeralDate(draft);
  return [date ? shortDate(date) : '', svc?.time ? `at ${svc.time}` : '', svc?.place ?? ''].filter(Boolean).join(' · ');
}

async function layoutProgramme(pdf: Pdf, draft: Draft, url: string, withStory = false) {
  await pdf.cover(draft, 'Order of service', serviceLine(draft));
  pdf.newPage();
  // A printed booklet carries their story too, as funeral programmes do.
  if (withStory && draft.story.obituary) {
    pdf.section('Their story', 'A life remembered');
    pdf.prose(draft.story.obituary, { size: 11.5, dropCap: true });
    pdf.newPage();
  }
  pdf.prayers(draft);
  pdf.programme(draft);
  if (draft.journey.length) {
    if (draft.programme.items.length) pdf.ensure(80);
    await pdf.journey(draft, url);
  }
  await pdf.closing(draft, url);
}

/** Printable order of service with the funeral journey. */
export async function programmePdf({ draft, url, slug, brand }: ArtifactInput) {
  const pdf = await new Pdf(displayName(draft.person), 'MEMORA', { brand }).init();
  await layoutProgramme(pdf, draft, url);
  pdf.save(file(slug, 'programme', 'pdf'));
}

const A5_W = PAGE_W / Math.SQRT2; // 148.5 mm: an A5 page is an A4 page shrunk by 1/√2

/**
 * The programme as an A5 booklet to print at home: A4 sheets, two pages a side,
 * in fold order. Print double-sided (flip on the short edge), stack, fold in half.
 */
export async function programmeBooklet({ draft, url, slug, brand }: ArtifactInput) {
  const rec = new Recorder(new jsPDF({ unit: 'mm', format: 'a4', compress: true }));
  const pdf = await new Pdf(displayName(draft.person), 'MEMORA', { doc: rec as unknown as jsPDF, typeScale: 1.22, brand }).init();
  await layoutProgramme(pdf, draft, url, true);
  pdf.finish();

  const out = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const fonts = await loadPdfFonts();
  if (fonts) {
    for (const [f, family, style] of PDF_FONTS) {
      out.addFileToVFS(f, fonts.get(f)!);
      out.addFont(f, family, style);
    }
  }
  out.setProperties({ title: `In loving memory of ${displayName(draft.person)}`, creator: 'Memora' });

  // Pad to a multiple of four with blank pages before the back cover.
  const pages = rec.pages;
  const n = Math.ceil(pages.length / 4) * 4;
  const order: (Op[] | null)[] = [...pages.slice(0, -1), ...Array<null>(n - pages.length).fill(null), pages[pages.length - 1]];
  const s = 1 / Math.SQRT2;
  const name = displayName(draft.person);
  // A page left over by the fold keeps a quiet line of remembrance rather than standing empty.
  const blank = (ox: number) => {
    out.setFont(fonts ? 'Fraunces' : 'times', 'italic');
    out.setFontSize(11);
    out.setTextColor(...P.dusk);
    out.text(`In loving memory of ${name}`, ox + A5_W / 2, PAGE_W / 2, { align: 'center' });
    out.setDrawColor(...P.bloom);
    out.setLineWidth(0.25);
    out.line(ox + A5_W / 2 - 9, PAGE_W / 2 + 7, ox + A5_W / 2 - 1.8, PAGE_W / 2 + 7);
    out.line(ox + A5_W / 2 + 1.8, PAGE_W / 2 + 7, ox + A5_W / 2 + 9, PAGE_W / 2 + 7);
    out.setFillColor(...P.candle);
    out.circle(ox + A5_W / 2, PAGE_W / 2 + 7, 0.7, 'F');
  };
  const side = (left: Op[] | null, right: Op[] | null) => {
    if (left) replay(out, left, s, 0);
    else blank(0);
    if (right) replay(out, right, s, A5_W);
    else blank(A5_W);
    // Fold marks at the top and bottom of the spine.
    out.setDrawColor(...P.bloom);
    out.setLineWidth(0.2);
    out.line(A5_W, 0, A5_W, 5);
    out.line(A5_W, PAGE_W - 5, A5_W, PAGE_W);
  };
  for (let i = 0; i < n / 4; i++) {
    if (i > 0) out.addPage();
    side(order[n - 1 - 2 * i], order[2 * i]);
    out.addPage();
    side(order[2 * i + 1], order[n - 2 - 2 * i]);
  }
  out.save(file(slug, 'programme-booklet', 'pdf'));
}

/** The complete keepsake: story, programme, journey and family message. */
export async function keepsakePdf({ draft, url, slug, brand }: ArtifactInput) {
  const pdf = await new Pdf(displayName(draft.person), 'MEMORA', { brand }).init();
  await pdf.cover(draft, 'A life remembered', serviceLine(draft));
  pdf.newPage();
  if (draft.story.obituary) {
    pdf.section('Their story', 'A life remembered');
    pdf.prose(draft.story.obituary, { size: 12, dropCap: true });
    pdf.newPage();
  }
  pdf.prayers(draft);
  pdf.programme(draft);
  if (draft.journey.length) {
    if (draft.programme.items.length) pdf.ensure(80);
    await pdf.journey(draft, url);
  }
  await pdf.closing(draft, url);
  pdf.save(file(slug, 'keepsake', 'pdf'));
}
