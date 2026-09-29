'use client';

import { useOrigin } from '@/lib/hooks';
import { QrImage, ShareButtons } from './Share';

export function MemorialShare({ path, name, qrName }: { path: string; name: string; qrName: string }) {
  const origin = useOrigin();
  if (!origin) return null;
  const url = `${origin}${path}`;
  return (
    <div className="m-share">
      <QrImage url={url} label={`QR code for this memorial`} />
      <div>
        <span className="eyebrow">Share the details</span>
        <h2 className="h3" style={{ margin: '10px 0 8px' }}>
          One link for the programme, journey and directions.
        </h2>
        <p className="muted" style={{ margin: '0 0 18px' }}>
          Print the QR in the programme, pin it at the entrance, or send the link on WhatsApp. It always shows the latest details.
        </p>
        <ShareButtons url={url} title={`In loving memory of ${name}`} qrName={qrName} compact />
      </div>
    </div>
  );
}
