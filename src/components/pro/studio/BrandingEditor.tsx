'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/Brand';
import { useToast } from '@/components/Toast';
import { drawQrCard, prepareBrand } from '@/lib/artifacts';
import { emptyDraft } from '@/lib/memorial';

// A funeral home's look: its logo and one colour. Everything on the right is
// what families and guests will actually get: the QR card is drawn by the same
// code as the download, and the programme covers mirror the printed PDF.

const SWATCHES: [string, string][] = [
  ['#5B3E8C', 'Jacaranda'],
  ['#3F2A66', 'Deep plum'],
  ['#1F3A5F', 'Navy'],
  ['#2F6B4A', 'Forest'],
  ['#8C5A2B', 'Cedar'],
  ['#7A2E3A', 'Burgundy'],
  ['#2B2B2B', 'Charcoal'],
  ['#9C7A3C', 'Ochre'],
];
const MAX_INPUT = 10 * 1024 * 1024;
const HEX = /^#[0-9a-f]{6}$/i;

/** WCAG contrast against white paper. */
function contrastOnWhite(hex: string): number {
  const ch = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
  return 1.05 / (L + 0.05);
}

/**
 * Any logo in, a print-ready PNG out: up to 1600 px wide, transparent edges
 * trimmed, transparency kept. SVGs are drawn crisp at that size.
 */
async function optimiseLogo(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error('That file doesn’t look like an image.'));
      img.src = url;
    });
    const nw = img.naturalWidth || 1600;
    const nh = img.naturalHeight || 800;
    const scale = Math.min(1600 / nw, 800 / nh, file.type === 'image/svg+xml' ? Infinity : 1);
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    // Trim fully transparent edges so the logo sits centred everywhere.
    const data = ctx.getImageData(0, 0, w, h).data;
    let top = h,
      left = w,
      right = -1,
      bottom = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
    let out = c;
    if (right >= left && bottom >= top && (left > 0 || top > 0 || right < w - 1 || bottom < h - 1)) {
      const pad = Math.round(Math.max(right - left, bottom - top) * 0.02);
      const x0 = Math.max(0, left - pad);
      const y0 = Math.max(0, top - pad);
      const cw = Math.min(w, right + pad + 1) - x0;
      const chh = Math.min(h, bottom + pad + 1) - y0;
      out = document.createElement('canvas');
      out.width = cw;
      out.height = chh;
      out.getContext('2d')!.drawImage(c, x0, y0, cw, chh, 0, 0, cw, chh);
    }
    const png = await new Promise<Blob | null>((ok) => out.toBlob(ok, 'image/png'));
    if (png && png.size <= 4.5 * 1024 * 1024) return png;
    const webp = await new Promise<Blob | null>((ok) => out.toBlob(ok, 'image/webp', 0.92));
    if (webp) return webp;
    throw new Error('Could not prepare the logo.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

type View = 'programme' | 'qr' | 'memorial';

export function BrandingEditor({ orgId, name, logoUrl, colour, sample }: { orgId: string; name: string; logoUrl: string; colour: string; sample?: string }) {
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(logoUrl);
  const [saved, setSaved] = useState(HEX.test(colour) ? colour.toUpperCase() : '#5B3E8C');
  const [hex, setHex] = useState(saved);
  const [busy, setBusy] = useState<'' | 'logo' | 'save'>('');
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState<View>('programme');
  const [qr, setQr] = useState('');
  const valid = HEX.test(hex);
  const ink = valid ? hex : saved;
  const contrast = valid ? contrastOnWhite(hex) : 21;
  const person = sample || 'Nomvula Khumalo';
  const dirty = valid && hex.toUpperCase() !== saved;

  // The real QR card, redrawn as the logo or colour changes.
  useEffect(() => {
    if (view !== 'qr') return;
    let live = true;
    const t = setTimeout(async () => {
      const draft = emptyDraft();
      const [first, ...rest] = person.split(' ');
      draft.person.firstName = first;
      draft.person.lastName = rest.join(' ');
      draft.person.birthDate = '1939-01-20';
      draft.person.passingDate = '2026-09-26';
      const brand = await prepareBrand({ name, logoUrl: logo, colour: ink });
      const c = await drawQrCard({ draft, url: `${window.location.origin}/m/${first.toLowerCase()}`, brand });
      if (live) setQr(c.toDataURL('image/png'));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [view, logo, ink, name, person]);

  const upload = async (f: File) => {
    if (f.size > MAX_INPUT) return toast('That file is over 10 MB. Try a smaller export of your logo.', 'error');
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) return toast('Use a PNG, JPG, WebP or SVG logo.', 'error');
    setBusy('logo');
    try {
      const blob = await optimiseLogo(f);
      const body = new FormData();
      body.set('orgId', orgId);
      body.set('file', new File([blob], blob.type === 'image/webp' ? 'logo.webp' : 'logo.png', { type: blob.type }));
      const res = await fetch('/api/pro/logo', { method: 'POST', body }).catch(() => null);
      const out = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) throw new Error(out?.error || 'Could not upload the logo.');
      setLogo(out.url);
      toast('Logo saved. It’s on your memorials and printed programmes now.');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not upload the logo.', 'error');
    }
    setBusy('');
  };

  const save = async (next: { logoUrl?: string; brandColour?: string }) => {
    setBusy('save');
    const res = await fetch('/api/pro/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'org.brand', id: orgId, logoUrl: next.logoUrl ?? logo, brandColour: next.brandColour ?? saved }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy('');
    toast(out?.message || out?.error || (res?.ok ? 'Saved.' : 'That didn’t work.'), res?.ok ? 'info' : 'error');
    if (res?.ok) {
      if (next.brandColour) setSaved(next.brandColour.toUpperCase());
      router.refresh();
    }
  };

  return (
    <div className="bx" style={{ ['--pick' as string]: ink }}>
      <section className="bx-controls">
        <span className="st-eyebrow">Your look</span>
        <h2>Your name, on every memorial and every programme.</h2>
        <p className="st-sub">Set it once. Every memorial, printed programme and QR card your team makes carries it from then on.</p>

        <div className="bx-field">
          <div className="bx-label">
            <span>Logo</span>
            <small>PNG, JPG, WebP or SVG · up to 10 MB</small>
          </div>
          <div
            className={`bx-drop${drag ? ' drag' : ''}${logo ? ' has' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void upload(f);
            }}
          >
            {logo ? (
              <div className="bx-logo-tiles">
                <span className="bx-tile light">
                  <img src={logo} alt="Your logo on white" />
                </span>
                <span className="bx-tile dark">
                  <img src={logo} alt="Your logo on dark" />
                </span>
              </div>
            ) : (
              <div className="bx-empty">
                <span className="st-logo mono big" style={{ background: ink }}>
                  {name.slice(0, 1)}
                </span>
                <p>
                  <strong>Drop your logo here</strong>
                  <br />
                  We trim the edges and prepare it for print automatically. A wide logo on a transparent background looks best.
                </p>
              </div>
            )}
            <div className="bx-drop-actions">
              <button className="btn sm primary" type="button" disabled={Boolean(busy)} onClick={() => file.current?.click()}>
                {busy === 'logo' ? 'Preparing…' : logo ? 'Replace logo' : 'Choose a file'}
              </button>
              {logo && (
                <button
                  className="btn sm ghost"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setLogo('');
                    void save({ logoUrl: '' });
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="bx-field">
          <div className="bx-label">
            <span>Colour</span>
            <small>For your name and accents</small>
          </div>
          <div className="bx-swatches" role="radiogroup" aria-label="Brand colour">
            {SWATCHES.map(([c, label]) => (
              <button key={c} type="button" role="radio" aria-checked={hex.toUpperCase() === c} className="bx-swatch" onClick={() => setHex(c)}>
                <span style={{ background: c }} />
                <small>{label}</small>
              </button>
            ))}
            <label className="bx-swatch">
              <span className="custom">
                <input type="color" value={valid ? hex : saved} onChange={(e) => setHex(e.target.value.toUpperCase())} aria-label="Choose any colour" />
              </span>
              <small>Your own</small>
            </label>
          </div>
          <div className="bx-hex-row">
            <input className="input bx-hex" value={hex} onChange={(e) => setHex(e.target.value.trim())} aria-label="Colour code" maxLength={7} />
            {valid && (
              <span className={`bx-contrast ${contrast >= 4.5 ? 'good' : contrast >= 3 ? 'ok' : 'bad'}`}>
                {contrast >= 4.5 ? 'Reads beautifully on white paper' : contrast >= 3 ? 'Fine for names; a deeper shade reads better' : 'Too light to read on white paper. Choose a deeper shade.'}
              </span>
            )}
          </div>
        </div>

        <div className="bx-save">
          <span className="st-sub">{dirty ? 'Colour not saved yet' : 'All changes saved'}</span>
          <button className="btn primary" type="button" disabled={Boolean(busy) || !dirty || contrast < 3} onClick={() => save({ brandColour: hex })}>
            {busy === 'save' ? 'Saving…' : 'Save colour'}
          </button>
        </div>
      </section>

      <section className="bx-stage" aria-label="What families and guests get">
        <div className="bx-seg" role="tablist" aria-label="Preview">
          {(
            [
              ['programme', 'Printed programme'],
              ['qr', 'QR card'],
              ['memorial', 'Memorial page'],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>

        <div className="bx-table">
          {view === 'programme' && (
            <div className="bx-spread">
              <article className="bx-page front">
                <div className="bx-frame">
                  <span className="bx-arch" />
                  <span className="bx-kicker">In loving memory</span>
                  <b className="bx-name">{person}</b>
                  <span className="bx-dates">20 January 1939 — 26 September 2026</span>
                  <span className="bx-orn" />
                  <i className="bx-title">Order of service</i>
                  <span className="bx-line">Saturday 11 October · St Mary’s Church</span>
                </div>
                <small className="bx-caption">Front cover</small>
              </article>
              <article className="bx-page back">
                <span className="bx-kicker">From the family</span>
                <i className="bx-msg">Thank you for standing with our family.</i>
                <span className="bx-orn" />
                <span className="st-qr bx-qr" />
                <i className="bx-scan">Scan to visit their memorial</i>
                <div className="bx-arranged">
                  {logo ? <img src={logo} alt="" /> : null}
                  <i>Arranged with care by</i>
                  <b>{name}</b>
                </div>
                <span className="bx-maker">MEMORA</span>
                <small className="bx-caption">Back cover</small>
              </article>
            </div>
          )}

          {view === 'qr' && (
            <figure className="bx-qrcard">
              {qr ? <img src={qr} alt={`The QR card for ${person}, arranged by ${name}`} /> : <span className="bx-loading">Drawing your card…</span>}
              <figcaption>This is the exact card your team downloads: 4 × 5 inches, print quality.</figcaption>
            </figure>
          )}

          {view === 'memorial' && (
            <div className="bx-phone" aria-label="Memorial page on a phone">
              <div className="bx-phone-screen">
                <div className="bx-m-top">
                  <BrandMark size={18} />
                </div>
                <span className="bx-arch big" />
                <span className="bx-kicker">In loving memory</span>
                <b className="bx-name">{person}</b>
                <span className="bx-dates">1939 — 2026</span>
                <div className="bx-m-now">
                  <span>Happening now</span>
                  <b>Family tributes</b>
                </div>
                <div className="bx-m-foot">
                  {logo ? <img src={logo} alt="" /> : null}
                  <span>
                    Arranged with care by <strong>{name}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="bx-note">
          {view === 'programme'
            ? 'The A5 booklet and A4 programme print with your logo and name on the back cover.'
            : view === 'qr'
              ? 'Families put it at the entrance, on the guest book table and on the back of the programme.'
              : 'Every guest who opens the memorial sees who arranged it.'}
        </p>
      </section>
    </div>
  );
}
