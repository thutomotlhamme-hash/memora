'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useToast } from './Toast';

export function QrImage({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#1d1d1f', light: '#ffffff' }, errorCorrectionLevel: 'M' })
      .then((d) => live && setSrc(d))
      .catch(() => live && setSrc(''));
    return () => {
      live = false;
    };
  }, [url]);
  return <div className="qr">{src ? <img src={src} alt={label} width={148} height={148} /> : null}</div>;
}

export async function downloadQrPng(url: string, filename: string) {
  const dataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 3, color: { dark: '#1d1d1f', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function ShareButtons({ url, title, qrName, compact = false }: { url: string; title: string; qrName: string; compact?: boolean }) {
  const toast = useToast();
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied.');
      }
    } catch {
      /* the share sheet was dismissed */
    }
  };
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  return (
    <div className="row">
      <button className={`btn primary ${compact ? 'sm' : ''}`} type="button" onClick={share}>
        Share link
      </button>
      <a className={`btn ${compact ? 'sm' : ''}`} href={whatsapp} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      <button
        className={`btn ${compact ? 'sm' : ''}`}
        type="button"
        onClick={() => downloadQrPng(url, `${qrName}-qr.png`).then(() => toast('QR code downloaded.'), () => toast('The QR code could not be created.', 'error'))}
      >
        Download QR
      </button>
    </div>
  );
}

export function CopyField({ value }: { value: string }) {
  const toast = useToast();
  return (
    <div className="copy-field">
      <input className="input" readOnly value={value} onFocus={(e) => e.target.select()} aria-label="Memorial link" />
      <button
        className="btn"
        type="button"
        onClick={() => navigator.clipboard.writeText(value).then(() => toast('Link copied.'), () => toast('Copy failed. Select the link and copy it.', 'error'))}
      >
        Copy
      </button>
    </div>
  );
}
