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
  emailSent: boolean;
  whatsappSent: boolean;
  recipientWhatsapp: string | null;
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
        <p className="muted">Please use the link from your receipt email.</p>
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
            ? 'We haven’t had confirmation yet. If you were charged, your gift will be sent as soon as it arrives, and you’ll get a receipt by email. You can refresh this page.'
            : 'We’re checking with Yoco. Please keep this page open.'}
        </p>
      </div>
    );
  }

  const sentBy = [view.emailSent && 'email', view.whatsappSent && 'WhatsApp'].filter(Boolean).join(' and ');
  const text = `Hi ${view.recipientName}, I've arranged a Memora memorial${view.lovedOneName ? ` for ${view.lovedOneName}` : ''} for you. It's paid for. Use this private link to create it: ${view.redeemLink}`;
  const wa = view.recipientWhatsapp ? `https://wa.me/${view.recipientWhatsapp}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <div className="panel">
      <span className="pill ok dot">Paid</span>
      <h1 className="h1" style={{ margin: '14px 0 12px' }}>
        Thank you. Your gift is on its way.
      </h1>
      <p className="lede">
        {view.redeemed
          ? `${view.recipientName} has already started the memorial.`
          : sentBy
            ? `We’ve sent ${view.recipientName} their private link by ${sentBy}.`
            : `Send ${view.recipientName} their private link on WhatsApp below. It only works once, so share it with them alone.`}
      </p>
      <div className="stack" style={{ marginTop: 24, ['--stack' as string]: '14px' }}>
        {view.funeralDate && (
          <div className="note">
            <span>
              We’ve noted the funeral is around <strong>{fmtDate(view.funeralDate)}</strong>. We’ll remind {view.recipientName} as it gets close, and our team is
              watching the date.
            </span>
          </div>
        )}
        {!view.redeemed && view.redeemLink && (
          <>
            <div className="row">
              <a className="btn primary" href={wa} target="_blank" rel="noopener noreferrer">
                {view.whatsappSent ? 'Also send it yourself on WhatsApp' : 'Send it on WhatsApp'}
              </a>
            </div>
            <CopyField value={view.redeemLink} />
            <p className="small muted" style={{ margin: 0 }}>
              A receipt with this page’s link has been emailed to you.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
