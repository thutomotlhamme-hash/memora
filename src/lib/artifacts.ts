'use client';

// Artifact Engine: every card and PDF is regenerated from the one memorial each
// time it is downloaded, so nothing goes stale and nothing is typed twice.

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { dispositionLabel, displayName, fmtDate, funeralDate, lifeDates, programmeParts, programmeTypeLabel, stopLabel, type Draft } from './memorial';

const C = {
  paper: '#ffffff',
  paper2: '#f4f1f8',
  night: '#15121c',
  night3: '#2c2636',
  ink: '#1e1a24',
  ink2: '#424245',
  muted: '#6b6475',
  clay: '#5b3e8c',
  clayLight: '#e8a94a',
  onNight: '#f4f1f8',
  onNightMuted: '#a79fb3',
};
// Display type: semibold, like the site's headlines.
const SERIF = '"Inter Variable", "Helvetica Neue", Arial, sans-serif';
const SANS = '"Inter Variable", Arial, sans-serif';

/** The Memora arch: a semicircular top over softly rounded feet. */
function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, foot = 26) {
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

export interface ArtifactInput {
  draft: Draft;
  url: string;
  slug: string;
}

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
    await Promise.all([document.fonts.load(`600 48px ${SERIF}`), document.fonts.load(`24px ${SANS}`), document.fonts.load(`600 24px ${SANS}`)]);
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

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 8): number {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length) shown[shown.length - 1] = `${shown[shown.length - 1].replace(/[,.;:]?$/, '')}…`;
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + shown.length * lineHeight;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // Letter-spaced small caps label, centred or left depending on textAlign.
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

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function monogram(ctx: CanvasRenderingContext2D, draft: Draft, x: number, y: number, w: number, h: number, bg: string, fg: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.28)}px ${SERIF}`;
  ctx.textAlign = 'center';
  const p = draft.person;
  ctx.fillText(((p.preferredName || p.firstName || 'M')[0] + (p.lastName || '')[0] || '').toUpperCase(), x + w / 2, y + h / 2 + Math.min(w, h) * 0.1);
}

const file = (slug: string, kind: string, ext: string) => `memora-${slug || 'memorial'}-${kind}.${ext}`;

// ---------------------------------------------------------------------------
// PNG cards
// ---------------------------------------------------------------------------

/** 1080×1080 square for WhatsApp Status, Instagram and family groups. */
export async function socialCard({ draft, slug }: ArtifactInput) {
  await ensureFonts();
  const { c, ctx } = canvas(1080, 1080);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, 1080, 1080);
  const img = await loadImage(draft.person.portraitUrl);
  const px = 190;
  const py = 80;
  const pw = 700;
  const ph = 700;
  ctx.save();
  archPath(ctx, px + 70, py, pw - 140, ph);
  ctx.clip();
  if (img) drawCover(ctx, img, px + 70, py, pw - 140, ph);
  else monogram(ctx, draft, px + 70, py, pw - 140, ph, C.night, C.onNightMuted);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.clay;
  ctx.font = `600 20px ${SANS}`;
  spaced(ctx, 'IN LOVING MEMORY', 540, 850, 4);
  ctx.fillStyle = C.ink;
  ctx.font = `600 64px ${SERIF}`;
  wrap(ctx, displayName(draft.person), 540, 928, 900, 68, 1);
  ctx.fillStyle = C.muted;
  ctx.font = `26px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), 540, 984);
  await download(c, file(slug, 'social', 'png'));
}

/** 1080×1350 portrait death notice for immediate sharing. */
export async function announcementCard({ draft, url, slug }: ArtifactInput) {
  await ensureFonts();
  const { c, ctx } = canvas(1080, 1350);
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.textAlign = 'center';
  const img = await loadImage(draft.person.portraitUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(540, 330, 170, 0, Math.PI * 2);
  ctx.clip();
  if (img) drawCover(ctx, img, 370, 160, 340, 340);
  else monogram(ctx, draft, 370, 160, 340, 340, C.night3, C.onNightMuted);
  ctx.restore();
  ctx.fillStyle = C.clayLight;
  ctx.font = `600 22px ${SANS}`;
  spaced(ctx, 'WITH DEEP SORROW', 540, 590, 5);
  ctx.fillStyle = C.onNight;
  ctx.font = `600 68px ${SERIF}`;
  let y = wrap(ctx, displayName(draft.person), 540, 680, 900, 74, 2);
  ctx.fillStyle = C.onNightMuted;
  ctx.font = `26px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), 540, y + 6);
  y += 80;
  ctx.strokeStyle = 'rgba(250,249,245,.18)';
  ctx.beginPath();
  ctx.moveTo(360, y);
  ctx.lineTo(720, y);
  ctx.stroke();
  y += 70;
  ctx.fillStyle = C.onNight;
  ctx.font = `400 30px ${SANS}`;
  y = wrap(ctx, `The family sadly announces the passing of ${displayName(draft.person)}.`, 540, y, 820, 44, 3);
  const first = draft.journey[0];
  ctx.fillStyle = C.clayLight;
  ctx.font = `26px ${SANS}`;
  wrap(ctx, first ? `${stopLabel(first.type)} · ${fmtDate(first.date)} at ${first.time} · ${first.title}` : 'Funeral details to follow.', 540, y + 30, 860, 36, 2);
  ctx.fillStyle = C.onNightMuted;
  ctx.font = `20px ${SANS}`;
  ctx.fillText('Details, directions and programme', 540, 1230);
  ctx.fillStyle = C.onNight;
  ctx.font = `600 24px ${SANS}`;
  ctx.fillText(url.replace(/^https?:\/\//, ''), 540, 1272);
  await download(c, file(slug, 'announcement', 'png'));
}

/** 1080×1350 route card with times, stops and the memorial link. */
export async function journeyCard({ draft, url, slug }: ArtifactInput) {
  await ensureFonts();
  const { c, ctx } = canvas(1080, 1350);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.clay;
  ctx.font = `600 20px ${SANS}`;
  spaced(ctx, 'FUNERAL JOURNEY', 80, 110, 4);
  ctx.fillStyle = C.ink;
  ctx.font = `600 64px ${SERIF}`;
  const nameEnd = wrap(ctx, displayName(draft.person), 80, 190, 920, 70, 2);
  ctx.fillStyle = C.muted;
  ctx.font = `26px ${SANS}`;
  ctx.fillText(`${dispositionLabel(draft.disposition.type)} · ${fmtDate(funeralDate(draft))}`, 80, nameEnd + 6);
  let y = nameEnd + 90;
  const stops = draft.journey.slice(0, 6);
  stops.forEach((s, i) => {
    const top = y;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(104, y + 2, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.font = `600 20px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 104, y + 9);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = `600 30px ${SANS}`;
    ctx.fillText(`${s.time}  ${s.title}`.slice(0, 48), 156, y + 12);
    ctx.fillStyle = C.muted;
    ctx.font = `22px ${SANS}`;
    let yy = wrap(ctx, [stopLabel(s.type), s.address].filter(Boolean).join(' · '), 156, y + 50, 840, 30, 2);
    if (s.departTime) {
      ctx.fillStyle = C.clay;
      ctx.fillText(`Departs ${s.departTime}`, 156, yy + 2);
      yy += 32;
    }
    y = Math.max(top + 128, yy + 36);
    if (i < stops.length - 1) {
      ctx.strokeStyle = 'rgba(20,20,19,.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(104, top + 32);
      ctx.lineTo(104, y - 28);
      ctx.stroke();
    }
  });
  ctx.fillStyle = C.night;
  ctx.beginPath();
  ctx.roundRect(60, 1180, 960, 110, 20);
  ctx.fill();
  ctx.fillStyle = C.onNightMuted;
  ctx.font = `20px ${SANS}`;
  ctx.fillText('Live directions and updates on the day', 96, 1224);
  ctx.fillStyle = C.onNight;
  ctx.font = `600 24px ${SANS}`;
  ctx.fillText(url.replace(/^https?:\/\//, ''), 96, 1260);
  await download(c, file(slug, 'funeral-journey', 'png'));
}

/** 1080×1512 printable keepsake card to hand to guests. */
export async function keepsakeCard({ draft, slug }: ArtifactInput) {
  await ensureFonts();
  const { c, ctx } = canvas(1080, 1512);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, 1080, 1512);
  ctx.strokeStyle = C.clay;
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, 992, 1424);
  ctx.textAlign = 'center';
  const img = await loadImage(draft.person.portraitUrl);
  ctx.save();
  archPath(ctx, 290, 130, 500, 620);
  ctx.clip();
  if (img) drawCover(ctx, img, 290, 130, 500, 620);
  else monogram(ctx, draft, 290, 130, 500, 620, C.night, C.onNightMuted);
  ctx.restore();
  ctx.fillStyle = C.clay;
  ctx.font = `600 22px ${SANS}`;
  spaced(ctx, 'IN LOVING MEMORY', 540, 840, 5);
  ctx.fillStyle = C.ink;
  ctx.font = `600 64px ${SERIF}`;
  let y = wrap(ctx, displayName(draft.person), 540, 930, 880, 70, 2);
  ctx.fillStyle = C.muted;
  ctx.font = `26px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), 540, y + 4);
  y += 90;
  const line = draft.story.obituary.split(/(?<=[.!?])\s+/)[0] || 'Forever in our hearts.';
  ctx.fillStyle = C.ink2;
  ctx.font = `400 30px ${SANS}`;
  wrap(ctx, line, 540, y, 780, 46, 4);
  await download(c, file(slug, 'keepsake-card', 'png'));
}

/** 1080×1350 framed QR card for entrances, tables and programmes. */
export async function qrCard({ draft, url, slug }: ArtifactInput) {
  await ensureFonts();
  const { c, ctx } = canvas(1080, 1350);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.clay;
  ctx.font = `600 22px ${SANS}`;
  spaced(ctx, 'SCAN TO REMEMBER', 540, 130, 5);
  ctx.fillStyle = C.ink;
  ctx.font = `600 60px ${SERIF}`;
  let y = wrap(ctx, displayName(draft.person), 540, 215, 900, 66, 2);
  ctx.fillStyle = C.muted;
  ctx.font = `24px ${SANS}`;
  ctx.fillText(lifeDates(draft.person), 540, y + 2);
  y += 50;
  const qr = await loadImage(await QRCode.toDataURL(url, { width: 1200, margin: 1, color: { dark: C.ink, light: '#ffffff' }, errorCorrectionLevel: 'M' }));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(220, y, 640, 640, 28);
  ctx.fill();
  if (qr) ctx.drawImage(qr, 250, y + 30, 580, 580);
  y += 700;
  ctx.fillStyle = C.ink2;
  ctx.font = `26px ${SANS}`;
  ctx.fillText('Story · programme · funeral journey · directions', 540, y);
  ctx.fillStyle = C.muted;
  ctx.font = `22px ${SANS}`;
  ctx.fillText(url.replace(/^https?:\/\//, ''), 540, y + 44);
  await download(c, file(slug, 'qr-card', 'png'));
}

// ---------------------------------------------------------------------------
// PDFs — one pagination helper shared by the programme and the keepsake pack.
// ---------------------------------------------------------------------------

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 22;
const BOTTOM = 26;

class Pdf {
  doc = new jsPDF({ unit: 'mm', format: 'a4' });
  y = MARGIN;
  constructor(private footer: string) {}

  private foot() {
    const y = PAGE_H - 14;
    this.doc.setDrawColor(224, 221, 211);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(102, 101, 95);
    this.doc.text(this.footer, MARGIN, y);
    this.doc.text(String(this.doc.getNumberOfPages()), PAGE_W - MARGIN, y, { align: 'right' });
  }
  ensure(space: number) {
    if (this.y + space > PAGE_H - BOTTOM) {
      this.foot();
      this.doc.addPage();
      this.y = MARGIN + 4;
    }
  }
  cover(draft: Draft, subtitle: string, portrait: HTMLImageElement | null) {
    const d = this.doc;
    this.y = MARGIN + 6;
    if (portrait) {
      const w = 52;
      const h = 65;
      const cv = document.createElement('canvas');
      cv.width = 520;
      cv.height = 650;
      const ctx = cv.getContext('2d');
      if (ctx) {
        drawCover(ctx, portrait, 0, 0, 520, 650);
        d.addImage(cv.toDataURL('image/jpeg', 0.88), 'JPEG', (PAGE_W - w) / 2, this.y, w, h);
        this.y += h + 12;
      }
    }
    d.setFont('helvetica', 'bold');
    d.setFontSize(8.5);
    d.setTextColor(181, 85, 47);
    d.text('IN LOVING MEMORY', PAGE_W / 2, this.y, { align: 'center', charSpace: 0.8 });
    this.y += 13;
    d.setFont('helvetica', 'bold');
    d.setFontSize(32);
    d.setTextColor(20, 20, 19);
    for (const line of d.splitTextToSize(displayName(draft.person), PAGE_W - MARGIN * 2)) {
      d.text(line, PAGE_W / 2, this.y, { align: 'center' });
      this.y += 12;
    }
    d.setFont('helvetica', 'normal');
    d.setFontSize(11);
    d.setTextColor(102, 101, 95);
    d.text(lifeDates(draft.person), PAGE_W / 2, this.y, { align: 'center' });
    this.y += 6;
    if (subtitle) {
      d.text(subtitle, PAGE_W / 2, this.y, { align: 'center' });
      this.y += 6;
    }
    this.rule();
  }
  rule() {
    this.ensure(8);
    this.y += 4;
    this.doc.setDrawColor(224, 221, 211);
    this.doc.setLineWidth(0.25);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 10;
  }
  heading(text: string) {
    this.ensure(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(181, 85, 47);
    this.doc.text(text.toUpperCase(), MARGIN, this.y, { charSpace: 0.6 });
    this.y += 8;
  }
  text(value: string, opts: { size?: number; bold?: boolean; serif?: boolean; color?: [number, number, number]; gap?: number; indent?: number } = {}) {
    if (!value) return;
    const size = opts.size ?? 11;
    const lineH = size * 0.46;
    this.doc.setFont(opts.serif ? 'times' : 'helvetica', opts.bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(opts.color ?? [40, 39, 36]));
    for (const para of String(value).split(/\n{2,}/)) {
      for (const line of this.doc.splitTextToSize(para.replace(/\n/g, ' '), PAGE_W - MARGIN * 2 - (opts.indent ?? 0))) {
        this.ensure(lineH + 1);
        this.doc.text(line, MARGIN + (opts.indent ?? 0), this.y);
        this.y += lineH;
      }
      this.y += lineH * 0.6;
    }
    this.y += opts.gap ?? 1;
  }
  programme(draft: Draft) {
    if (draft.programme.mode !== 'formal' || !draft.programme.items.length) return;
    this.heading('Order of service');
    const groups = programmeParts(draft.programme.items);
    const headings = groups.length > 1 || groups[0]?.part !== 'service';
    groups.forEach((g) => {
      if (headings) {
        this.ensure(22);
        this.text(g.label.toUpperCase(), { size: 9, color: [91, 62, 140], gap: 1 });
      }
      g.items.forEach((item) => {
        this.ensure(16);
        this.text([item.time, item.title].filter(Boolean).join('   '), { size: 13, serif: true, gap: -1 });
        const meta = [programmeTypeLabel(item.type), item.presenter, item.detail].filter(Boolean).join(' · ');
        this.text(meta, { size: 9.5, color: [107, 100, 117], gap: 3 });
      });
    });
    this.rule();
  }
  journey(draft: Draft) {
    if (!draft.journey.length) return;
    this.heading(`Funeral journey · ${dispositionLabel(draft.disposition.type)}`);
    draft.journey.forEach((s, i) => {
      this.ensure(20);
      this.text(`${i + 1}.  ${s.time}   ${s.title}`, { size: 13, serif: true, gap: -1 });
      this.text([fmtDate(s.date), stopLabel(s.type), s.address].filter(Boolean).join(' · '), { size: 9.5, color: [102, 101, 95], gap: -1 });
      const extra = [s.departTime && `Until ${s.departTime}`, s.landmark && `Entrance: ${s.landmark}`, s.transport].filter(Boolean).join(' · ');
      this.text(extra, { size: 9.5, color: [91, 62, 140], gap: 3 });
    });
    this.rule();
  }
  save(filename: string) {
    this.foot();
    this.doc.save(filename);
  }
}

/** Printable order of service with the funeral journey. */
export async function programmePdf({ draft, url, slug }: ArtifactInput) {
  const pdf = new Pdf(`Memora · ${url.replace(/^https?:\/\//, '')}`);
  pdf.cover(draft, funeralDate(draft) ? `Funeral service · ${fmtDate(funeralDate(draft))}` : '', await loadImage(draft.person.portraitUrl));
  pdf.programme(draft);
  pdf.journey(draft);
  if (draft.story.familyMessage) {
    pdf.heading('From the family');
    pdf.text(draft.story.familyMessage, { serif: true, size: 12 });
  }
  pdf.save(file(slug, 'programme', 'pdf'));
}

/** The complete keepsake: story, programme, journey and family message. */
export async function keepsakePdf({ draft, url, slug }: ArtifactInput) {
  const pdf = new Pdf(`Memora · ${url.replace(/^https?:\/\//, '')}`);
  pdf.cover(draft, '', await loadImage(draft.person.portraitUrl));
  if (draft.story.obituary) {
    pdf.heading('Their story');
    pdf.text(draft.story.obituary, { serif: true, size: 12.5, gap: 4 });
    pdf.rule();
  }
  pdf.programme(draft);
  pdf.journey(draft);
  if (draft.story.familyMessage) {
    pdf.heading('From the family');
    pdf.text(draft.story.familyMessage, { serif: true, size: 12.5 });
  }
  pdf.save(file(slug, 'keepsake', 'pdf'));
}
