'use client';

import { useState } from 'react';
import { CopyField, QrImage, downloadQrPng } from '@/components/Share';
import { useToast } from '@/components/Toast';

/**
 * The family hands the funeral day to a coordinator (programme director, MC,
 * pastor's assistant) with a private link. No account needed; resetting it
 * switches off every copy already sent.
 */
export function RunSheetLink({ caseId, name }: { caseId: string; name: string }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (reset: boolean) => {
    if (reset && !window.confirm('Make a new run-sheet link? The link you already sent will stop working straight away.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/memorials/${caseId}/run-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'The run-sheet link could not be created.');
      setUrl(body.url);
      if (reset) toast('New link ready. The old one no longer works.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const message = `You're running the programme for ${name}'s funeral. This private Memora link lets you start each item, reshuffle the order and move times if things run late. Guests' memorial pages update automatically. Please don't forward it.\n${url}`;

  return (
    <div className="subsection">
      <div className="subsection-head">
        <span className="eyebrow plain">On the day</span>
        <h2 className="h3">Hand the programme to whoever is running it.</h2>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        The programme director gets a private run-sheet on their phone: start items, drag them into a new order, add or edit items and push
        times back when things run late. Guests see the changes on the memorial within seconds. No account needed.
      </p>
      {!url ? (
        <button className="btn primary" type="button" disabled={busy} onClick={() => void load(false)}>
          {busy ? 'Getting link…' : 'Get the run-sheet link'}
        </button>
      ) : (
        <div className="run-link-box">
          <div className="run-link-qr">
            <QrImage url={url} label={`QR code for the run-sheet for ${name}`} />
            <div>
              <strong>Scan to open the run-sheet</strong>
              <p className="tiny muted">Point the programme director’s phone camera at this code. It opens the run-sheet straight away.</p>
              <button
                className="btn sm"
                type="button"
                onClick={() => downloadQrPng(url, 'run-sheet-qr.png').then(() => toast('QR code downloaded.'), () => toast('The QR code could not be created.', 'error'))}
              >
                Download QR
              </button>
            </div>
          </div>
          <CopyField value={url} />
          <div className="row">
            <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
              Send on WhatsApp
            </a>
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
              Open run-sheet ↗
            </a>
            <button className="btn ghost danger" type="button" disabled={busy} onClick={() => void load(true)}>
              Reset link
            </button>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>
            Anyone with this link can change the programme. Sent it to the wrong person? Reset it and send the new one.
          </p>
        </div>
      )}
    </div>
  );
}
