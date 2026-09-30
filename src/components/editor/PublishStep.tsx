'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useOrigin } from '@/lib/hooks';
import { CopyField, QrImage, ShareButtons } from '@/components/Share';
import { useToast } from '@/components/Toast';
import { displayName, fmtDate, slugify, type CaseMeta, type Draft, type Readiness } from '@/lib/memorial';
import { paymentsOn } from '@/lib/config';
import { PRICE_LABEL, PRODUCT } from '@/lib/plans';
import { RunSheetLink } from './RunSheetLink';
import { SaveInline } from './SaveSheet';
import { PanelFoot, type Nav, type StepId } from './shared';

type Owner = { caseId: string; paymentsReady: boolean };

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
        {head('One step to go: save it.', 'Your cellphone number and a password keep the memorial safe and let you publish it. You’ll land right back here.')}
        <div className="card tint save-card">
          <SaveInline step="publish" cta="Save and publish" />
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

  if (meta.home) return <HomePublish home={meta.home} owner={owner} meta={meta} setMeta={setMeta} flush={flush} refresh={refresh} nav={nav} head={head} />;
  return <Checkout owner={owner} meta={meta} setMeta={setMeta} flush={flush} refresh={refresh} nav={nav} head={head} />;
}

/** A funeral home's memorial: its arranger or manager publishes (the home is billed); the family asks them to. */
function HomePublish({
  home,
  owner,
  meta,
  setMeta,
  flush,
  refresh,
  nav,
  head,
}: {
  home: NonNullable<CaseMeta['home']>;
  owner: Owner;
  meta: CaseMeta;
  setMeta: (m: CaseMeta) => void;
  flush: () => Promise<void>;
  refresh: () => void;
  nav: Nav;
  head: (t: string, l: string) => React.ReactNode;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const digits = home.phone.replace(/\D/g, '').replace(/^0(\d{9})$/, '27$1');

  if (!home.canPublish) {
    return (
      <div className="panel">
        {head('Ready for the funeral home.', `${home.name} publishes this memorial. There’s nothing for you to pay.`)}
        <div className="note ok">
          <span>
            <strong>Everything they need is filled in.</strong> Let {home.name} know it’s ready. They’ll check it and publish it, and you can keep editing until then.
          </span>
        </div>
        {digits.length >= 11 && (
          <div className="row" style={{ marginTop: 20 }}>
            <a
              className="btn accent lg"
              href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${home.name}, the memorial is ready for you to check and publish: ${typeof window === 'undefined' ? '' : window.location.origin}/memorials/${owner.caseId}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Tell {home.name} on WhatsApp
            </a>
          </div>
        )}
        <PanelFoot nav={nav} />
      </div>
    );
  }

  const publish = async () => {
    setError('');
    setBusy(true);
    try {
      await flush();
      const res = await fetch(`/api/memorials/${owner.caseId}/publish`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not publish.');
      setMeta({ ...body.meta, home: meta.home });
      toast('The memorial is live.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish.');
    }
    setBusy(false);
  };
  return (
    <div className="panel">
      {head('Ready to publish.', `Publishing is billed to ${home.name} on your Memora Pro plan. The family pays nothing.`)}
      {error && (
        <div className="note error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
      <div className="row" style={{ marginTop: 24 }}>
        <button className="btn accent lg" type="button" onClick={publish} disabled={busy}>
          {busy ? 'Publishing…' : `Publish for ${home.name}`}
        </button>
      </div>
      <PanelFoot nav={nav} />
    </div>
  );
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
  const confirming = paymentsOn && returning && !meta.paid && !pollDone;
  // Launch mode: publishing is free, so the checkout never shows.
  const canPublish = meta.paid || !paymentsOn;
  const [error, setError] = useState('');
  const polled = useRef(false);

  // Returning from Yoco: ask the server to check with Yoco directly.
  useEffect(() => {
    if (!paymentsOn || polled.current || meta.paid || !returning) return;
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
      {!paymentsOn
        ? head('Ready to publish.', 'Publishing is free during our launch. It creates the permanent link and QR code, and unlocks every download.')
        : meta.paid
        ? head('Ready to publish.', 'Payment is confirmed. Publishing creates the permanent link and QR code, and unlocks every download.')
        : head('One payment, then publish.', 'The memorial is complete. Pay once to publish it for a full year, share it, and download every card and keepsake.')}

      {!canPublish ? (
        <div className="checkout">
          <div>
            <span className="eyebrow">{PRODUCT.name} · public for a year</span>
            <div className="price">{PRICE_LABEL}</div>
            <p>
              Includes the memorial page with Live Funeral Mode, the QR code, WhatsApp cards, the printable programme and the keepsake book. One
              payment, no subscription. Secure card checkout by Yoco.
            </p>
          </div>
          <button className="btn on-night primary lg" type="button" onClick={pay} disabled={Boolean(busy) || confirming || !owner.paymentsReady}>
            {confirming ? 'Confirming payment…' : busy === 'pay' ? 'Opening checkout…' : `Pay ${PRICE_LABEL} with Yoco`}
          </button>
        </div>
      ) : (
        <div className="note ok">
          <span>
            <strong>{meta.paid ? 'Payment confirmed.' : 'Free while we launch.'}</strong> Publishing is a single step. You can still edit details afterwards, and the live
            page updates.
          </span>
        </div>
      )}

      {paymentsOn && !owner.paymentsReady && !meta.paid && (
        <div className="note warn" style={{ marginTop: 16 }}>
          <span>Checkout isn’t switched on for this deployment yet. Everything else is ready to go.</span>
        </div>
      )}
      {!canPublish && (paymentParam === 'cancelled' || paymentParam === 'failed') && !error && (
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

      {canPublish && (
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
          Share the link or QR code with family and friends. {meta.archiveAt ? `It stays public until ${fmtDate(meta.archiveAt.slice(0, 10))}.` : ''}{' '}
          Edits you make here update the live page straight away.
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
      <RunSheetLink caseId={caseId} name={name} />
      <PanelFoot nav={nav} />
    </div>
  );
}
