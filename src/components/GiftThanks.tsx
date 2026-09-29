'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/memorial';
import { CopyField } from './Share';

type View = {
  paid: boolean;
  status: string;
  recipientName: string;
  lovedOneName: string;
  funeralDate: string | null;
  recipientWhatsapp: string;
  message: string;
  buyerName: string;
  redeemed: boolean;
  redeemLink: string | null;
};

export function GiftThanks({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [state, setState] = useState<'loading' | 'waiting' | 'ready' | 'timeout' | 'invalid'>('loading');

  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let live = true;
    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch('/api/gifts/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        if (res.status === 404) return live && setState('invalid');
        const body = (await res.json()) as View;
        if (!live) return;
        setView(body);
        if (body.paid) return setState('ready');
        setState('waiting');
      } catch {
        /* try again */
      }
      if (attempts >= 20) return live && setState('timeout');
      timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token]);

  if (state === 'invalid') {
    return (
      <div className="panel">
        <h1 className="h1">This link isn’t valid.</h1>
        <p className="muted">Please open the page you were sent back to after paying.</p>
      </div>
    );
  }
  if (!view || !view.paid) {
    return (
      <div className="panel" aria-busy={state !== 'timeout'}>
        <span className="eyebrow">Confirming payment</span>
        <h1 className="h1" style={{ margin: '10px 0 12px' }}>
          {state === 'timeout' ? 'Still waiting for Yoco.' : 'Just a moment…'}
        </h1>
        <p className="muted">
          {state === 'timeout'
            ? 'We haven’t had confirmation yet. If you were charged, refresh this page in a minute and the WhatsApp link will appear. Keep this page’s address.'
            : 'We’re checking with Yoco. Please keep this page open.'}
        </p>
      </div>
    );
  }

  const text = [
    `Hi ${view.recipientName}, I've arranged a Memora memorial${view.lovedOneName ? ` for ${view.lovedOneName}` : ''} for you, and it's already paid for.`,
    view.message ? view.message : '',
    `Use this private link to create it: ${view.redeemLink}`,
    `It stays private until you choose to publish it. — ${view.buyerName}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const wa = `https://wa.me/${view.recipientWhatsapp}?text=${encodeURIComponent(text)}`;

  return (
    <div className="panel">
      <span className="pill ok dot">Paid</span>
      <h1 className="h1" style={{ margin: '14px 0 12px' }}>
        {view.redeemed ? 'Thank you. They’ve started the memorial.' : `Thank you. Now send ${view.recipientName} the link.`}
      </h1>
      {!view.redeemed && view.redeemLink ? (
        <>
          <p className="lede">Tap the button to open WhatsApp with the message and private link ready to send. The link works once, so send it to {view.recipientName} alone.</p>
          <div className="stack" style={{ marginTop: 24, ['--stack' as string]: '14px' }}>
            <a className="btn primary lg" href={wa} target="_blank" rel="noopener noreferrer">
              Send on WhatsApp
            </a>
            <CopyField value={view.redeemLink} />
            <p className="small muted" style={{ margin: 0 }}>
              Bookmark this page in case you need the link again.
            </p>
          </div>
        </>
      ) : (
        <p className="lede">Nothing more to do. Thank you for looking after them.</p>
      )}
      <div className="note" style={{ marginTop: 24 }}>
        <span>
          Our team will also check in with {view.recipientName} on WhatsApp to help them finish
          {view.funeralDate ? <> before the funeral, around <strong>{fmtDate(view.funeralDate)}</strong>.</> : ' in good time.'}
        </span>
      </div>
    </div>
  );
}
