'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useToast } from '@/components/Toast';

// A funeral home's look: its logo and one colour. Chosen here, seen straight away
// on a memorial's footer, the back of the printed programme and the QR card.

const SWATCHES = ['#5B3E8C', '#3F2A66', '#1F3A5F', '#2F6B4A', '#8C5A2B', '#7A2E3A', '#2B2B2B', '#9C7A3C'];

export function BrandingEditor({ orgId, name, logoUrl, colour }: { orgId: string; name: string; logoUrl: string; colour: string }) {
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(logoUrl);
  const [hex, setHex] = useState(/^#[0-9a-f]{6}$/i.test(colour) ? colour.toUpperCase() : '#5B3E8C');
  const [busy, setBusy] = useState<'' | 'logo' | 'save'>('');
  const valid = /^#[0-9a-f]{6}$/i.test(hex);

  const upload = async (f: File) => {
    if (f.size > 1024 * 1024) return toast('The logo must be under 1 MB.', 'error');
    setBusy('logo');
    const body = new FormData();
    body.set('orgId', orgId);
    body.set('file', f);
    const res = await fetch('/api/pro/logo', { method: 'POST', body }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy('');
    if (!res?.ok) return toast(out?.error || 'Could not upload the logo.', 'error');
    setLogo(out.url);
    toast(out.message || 'Logo saved.');
    router.refresh();
  };

  const save = async (next: { logoUrl?: string; brandColour?: string }) => {
    setBusy('save');
    const res = await fetch('/api/pro/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'org.brand', id: orgId, logoUrl: next.logoUrl ?? logo, brandColour: next.brandColour ?? hex }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy('');
    toast(out?.message || out?.error || (res?.ok ? 'Saved.' : 'That didn’t work.'), res?.ok ? 'info' : 'error');
    if (res?.ok) router.refresh();
  };

  return (
    <div className="st-brand" style={{ ['--pick' as string]: valid ? hex : '#5B3E8C' }}>
      <section className="st-panel st-brand-controls">
        <span className="st-eyebrow">Your look</span>
        <h2>Your name, on every memorial and programme.</h2>
        <p className="st-sub">Families see it on the memorial. Guests take it home on the printed programme.</p>

        <div className="st-field">
          <span className="st-label">Logo</span>
          <div className="st-logo-drop">
            {logo ? <img src={logo} alt="Your logo" /> : <span className="st-logo mono big">{name.slice(0, 1)}</span>}
            <div>
              <button className="btn sm primary" type="button" disabled={Boolean(busy)} onClick={() => file.current?.click()}>
                {busy === 'logo' ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}
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
              <small>PNG, JPG or WebP, under 1 MB. A wide logo on a transparent background prints best.</small>
            </div>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="st-field">
          <span className="st-label">Colour</span>
          <div className="st-swatches" role="radiogroup" aria-label="Brand colour">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={hex.toUpperCase() === c}
                aria-label={c}
                className="st-swatch"
                style={{ background: c }}
                onClick={() => setHex(c)}
              />
            ))}
            <label className="st-swatch custom" aria-label="Choose any colour">
              <input type="color" value={valid ? hex : '#5B3E8C'} onChange={(e) => setHex(e.target.value.toUpperCase())} />
            </label>
            <input className="input st-hex" value={hex} onChange={(e) => setHex(e.target.value.trim())} aria-label="Colour code" maxLength={7} />
          </div>
          <small className="st-sub">Deep, calm colours read best on white and print well.</small>
        </div>

        <button className="btn primary" type="button" disabled={Boolean(busy) || !valid} onClick={() => save({ brandColour: hex })}>
          {busy === 'save' ? 'Saving…' : 'Save colour'}
        </button>
      </section>

      <section className="st-brand-preview" aria-label="Preview">
        <span className="st-eyebrow">How it looks</span>
        <div className="st-pv-memorial">
          <div className="st-pv-arch" />
          <b>Nomvula Khumalo</b>
          <small>1939 – 2026</small>
          <div className="st-pv-foot">
            {logo ? <img src={logo} alt="" /> : null}
            <span>
              Arranged with care by <strong>{name}</strong>
            </span>
          </div>
        </div>
        <div className="st-pv-row">
          <div className="st-pv-booklet">
            <small>Back of the programme</small>
            <span className="st-qr" />
            {logo ? <img src={logo} alt="" /> : <span className="st-logo mono">{name.slice(0, 1)}</span>}
            <em>Arranged with care by</em>
            <strong>{name}</strong>
          </div>
          <div className="st-pv-qr">
            <small>QR card</small>
            <span className="st-qr" />
            <em>Arranged with care by</em>
            <strong>{name}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
