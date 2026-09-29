'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useOrigin } from '@/lib/hooks';
import { CopyField, QrImage, ShareButtons } from '@/components/Share';
import { useToast } from '@/components/Toast';
import { displayName, fmtDate, slugify, type CaseMeta, type Draft, type Readiness } from '@/lib/memorial';
import { PanelFoot, type Nav, type StepId } from './shared';

type Owner = { caseId: string; price: string; publicDays: number; paymentsReady: boolean };

export function PublishStep({
  draft,
  readiness: r,
  owner,
  meta,
  setMeta,
  flush,
  go,
  refresh,
  nav,
}: {
  draft: Draft;
  readiness: Readiness;
  owner: Owner | null;
  meta: CaseMeta | null;
  setMeta: (m: CaseMeta) => void;
  flush: () => Promise<void>;
  go: (s: StepId) => void;
  refresh: () => void;
  nav: Nav;
}) {
  const head = (title: string, lede: string) => (
    <header className="panel-head">
      <span className="eyebrow">Step 5 · Publish & share</span>
      <h1 className="h1">{title}</h1>
      <p className="lede">{lede}</p>
    </header>
  );

  if (!owner || !meta) {
    return (
      <div className="panel">
        {head('Create an account to publish.', 'You’ve built the memorial as a guest. To publish it, share it and download the keepsakes, keep it safe in a free account.')}
        <div className="card tint">
          <p style={{ margin: 0 }}>
            When you create an account or log in, Memora offers to move this draft (photo included) into your account. Until then it
            stays only in this browser.
          </p>
          <div className="row" style={{ marginTop: 18 }}>
            <Link className="btn primary" href="/account/register?next=/memorials">
              Create account
            </Link>
            <Link className="btn" href="/account/login?next=/memorials">
              I have an account
            </Link>
          </div>
        </div>
        <PanelFoot nav={nav} />
      </div>
    );
  }

  if (meta.status === 'PUBLISHED') return <Published draft={draft} meta={meta} caseId={owner.caseId} nav={nav} />;

  if (!r.complete) {
    return (
      <div className="panel">
        {head('Almost there.', 'Publishing unlocks once these are in place:')}
        <div className="checklist">
          {r.missing.map((m) => (
            <div key={m} className="check">
              <span className="mark" aria-hidden="true">
                !
              </span>
              <div style={{ flex: 1 }}>{m}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn primary" type="button" onClick={() => go('review')}>
            Back to review
          </button>
        </div>
        <PanelFoot nav={nav} />
      </div>
    );
  }

  return <Checkout owner={owner} meta={meta} setMeta={setMeta} flush={flush} refresh={refresh} nav={nav} head={head} />;
}

function Checkout({
  owner,
  meta,
  setMeta,
  flush,
  refresh,
  nav,
  head,
}: {
  owner: Owner;
  meta: CaseMeta;
  setMeta: (m: CaseMeta) => void;
  flush: () => Promise<void>;
  refresh: () => void;
  nav: Nav;
  head: (t: string, l: string) => React.ReactNode;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<'' | 'pay' | 'publish'>('');
  const paymentParam = useSearchParams().get('payment');
  const returning = paymentParam === 'return';
  const [pollDone, setPollDone] = useState(false);
  const confirming = returning && !meta.paid && !pollDone;
  const [error, setError] = useState('');
  const polled = useRef(false);

  // Returning from Yoco: ask the server to check with Yoco directly.
  useEffect(() => {
    if (polled.current || meta.paid || !returning) return;
    polled.current = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/memorials/${owner.caseId}/payment-status`, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (body?.paid) {
          setMeta({ ...meta, paid: true });
          setPollDone(true);
          toast('Payment confirmed. You can publish now.');
          return;
        }
      } catch {
        /* keep polling through a network blip */
      }
      if (attempts >= 12) {
        setPollDone(true);
        setError('We haven’t received confirmation from Yoco yet. If you were charged, it will appear shortly. Refresh this page in a minute.');
        return;
      }
      timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => clearTimeout(timer);
  }, [meta, owner.caseId, returning, setMeta, toast]);

  const pay = async () => {
    setError('');
    setBusy('pay');
    try {
      await flush();
      const res = await fetch(`/api/memorials/${owner.caseId}/checkout`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not start checkout.');
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      if (body.paid) {
        setMeta({ ...meta, paid: true });
        toast(body.simulated ? 'Test payment recorded.' : 'Payment already confirmed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
    }
    setBusy('');
  };

  const publish = async () => {
    setError('');
    setBusy('publish');
    try {
      await flush();
      const res = await fetch(`/api/memorials/${owner.caseId}/publish`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not publish.');
      setMeta(body.meta);
      toast('The memorial is live.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish.');
    }
    setBusy('');
  };

  return (
    <div className="panel">
      {meta.paid
        ? head('Ready to publish.', 'Payment is confirmed. Publishing creates the permanent link and QR code, and unlocks every download.')
        : head('One payment, then publish.', 'The memorial is complete. Pay once to publish it, share it and download the keepsakes.')}

      {!meta.paid ? (
        <div className="checkout">
          <div>
            <span className="eyebrow">Memorial · public for {owner.publicDays} days</span>
            <div className="price">{owner.price}</div>
            <p>
              Includes the memorial page with Live Funeral Mode, the QR code, WhatsApp cards, a printable programme and the keepsake PDF. Secure
              card checkout by Yoco.
            </p>
          </div>
          <button className="btn on-night primary lg" type="button" onClick={pay} disabled={Boolean(busy) || confirming || !owner.paymentsReady}>
            {confirming ? 'Confirming payment…' : busy === 'pay' ? 'Opening checkout…' : 'Pay securely with Yoco'}
          </button>
        </div>
      ) : (
        <div className="note ok">
          <span>
            <strong>Payment confirmed.</strong> Publishing is a single step. You can still edit details afterwards, and the live page updates.
          </span>
        </div>
      )}

      {!owner.paymentsReady && !meta.paid && (
        <div className="note warn" style={{ marginTop: 16 }}>
          <span>Checkout isn’t switched on for this deployment yet. Everything else is ready to go.</span>
        </div>
      )}
      {!meta.paid && (paymentParam === 'cancelled' || paymentParam === 'failed') && !error && (
        <div className={`note ${paymentParam === 'failed' ? 'error' : ''}`} style={{ marginTop: 16 }} role="status">
          <span>
            {paymentParam === 'failed'
              ? 'The payment didn’t go through and you weren’t charged. You can try again, or use a different card.'
              : 'Checkout was cancelled and nothing was charged. You can pay whenever you’re ready.'}
          </span>
        </div>
      )}
      {confirming && (
        <div className="note" style={{ marginTop: 16 }} role="status">
          <span>Checking with Yoco. This usually takes a few seconds, so please keep this page open.</span>
        </div>
      )}
      {error && (
        <div className="note error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {meta.paid && (
        <div className="row" style={{ marginTop: 24 }}>
          <button className="btn accent lg" type="button" onClick={publish} disabled={Boolean(busy)}>
            {busy === 'publish' ? 'Publishing…' : 'Publish memorial'}
          </button>
        </div>
      )}
      <PanelFoot nav={nav} />
    </div>
  );
}

function Published({ draft, meta, caseId, nav }: { draft: Draft; meta: CaseMeta; caseId: string; nav: Nav }) {
  const origin = useOrigin();
  const url = `${origin}/m/${meta.slug}`;
  const name = displayName(draft.person);
  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">
          <span className="pill live dot">Live</span>
        </span>
        <h1 className="h1">The memorial is live.</h1>
        <p className="lede">
          Share the link or QR code with family and friends. It stays public until {fmtDate(meta.archiveAt?.slice(0, 10))}. Edits you make here update the
          live page straight away.
        </p>
      </header>
      {origin && (
        <div className="share-panel">
          <QrImage url={url} label={`QR code for the memorial of ${name}`} />
          <div className="stack" style={{ ['--stack' as string]: '14px' }}>
            <CopyField value={url} />
            <ShareButtons url={url} title={`In loving memory of ${name}`} qrName={slugify(name) || 'memorial'} />
            <div className="row">
              <Link className="btn" href={`/m/${meta.slug}`} target="_blank">
                Open memorial ↗
              </Link>
              <Link className="btn accent" href={`/memorials/${caseId}/artifacts`}>
                Cards, programme & keepsake →
              </Link>
            </div>
          </div>
        </div>
      )}
      <PanelFoot nav={nav} />
    </div>
  );
}
