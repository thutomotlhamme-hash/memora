'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { RESEND_SECONDS, channelLabel, type Channel, type Channels } from '@/lib/verify';

type Status = { phone: boolean; masked?: string; on: boolean; channels: Channels; confirmed: string | null };

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; body: Record<string, any> }> {
  const res = await fetch('/api/account/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: Boolean(res?.ok), body: res ? await res.json().catch(() => ({})) : { error: 'We couldn’t reach Memora. Check your connection.' } };
}

/** Counts down to when another code may be sent. */
function useCountdown(): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(0);
  const until = useRef(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setInterval(() => setLeft(Math.max(0, Math.ceil((until.current - Date.now()) / 1000))), 500);
    return () => window.clearInterval(t);
  }, [left]);
  return [
    left,
    (seconds: number) => {
      until.current = Date.now() + seconds * 1000;
      setLeft(seconds);
    },
  ];
}

/**
 * Confirm your cellphone number: we send a 6-number code by WhatsApp (or SMS),
 * you type it in. Used on its own page, in the account, and in a pop-up when
 * publishing needs it.
 */
export function PhoneConfirm({ onDone, intro }: { onDone?: () => void; intro?: React.ReactNode }) {
  const uid = useId();
  const [status, setStatus] = useState<Status | null>(null);
  const [sentBy, setSentBy] = useState<Channel | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [wait, startWait] = useCountdown();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/account/verify', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => {
        if (live) setStatus(s ?? { phone: false, on: false, channels: { whatsapp: false, sms: false }, confirmed: null });
      })
      .catch(() => live && setError('We couldn’t reach Memora. Check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  const send = async (channel: Channel) => {
    setError('');
    setBusy(true);
    const out = await post({ action: 'send', channel });
    setBusy(false);
    if (!out.ok) {
      setError(out.body.error || 'We couldn’t send a code.');
      if (out.body.waitSeconds) startWait(Math.min(out.body.waitSeconds, 3600));
      return;
    }
    setSentBy(out.body.channel ?? channel);
    setCode('');
    startWait(RESEND_SECONDS);
    window.setTimeout(() => input.current?.focus(), 50);
  };

  const check = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (code.replace(/\D/g, '').length !== 6) return setError('Enter the 6 numbers from the message.');
    setBusy(true);
    const out = await post({ action: 'check', code });
    setBusy(false);
    if (!out.ok) return setError(out.body.error || 'That didn’t work. Please try again.');
    setDone(true);
    onDone?.();
  };

  if (!status) return <p className="small muted">One moment…</p>;
  if (done || status.confirmed)
    return (
      <div className="note ok phone-ok" role="status">
        <span>
          <strong>Your number is confirmed.</strong> {status.masked ? `${status.masked} is yours, and that’s how we’ll know it’s you.` : ''}
        </span>
      </div>
    );
  if (!status.phone) return <p className="small muted">You log in with an email, so there’s no number to confirm.</p>;
  if (!status.on) return <p className="small muted">Confirming numbers isn’t switched on yet. There’s nothing you need to do for now.</p>;

  const ways = (['whatsapp', 'sms'] as Channel[]).filter((c) => status.channels[c]);
  const other = ways.find((c) => c !== sentBy);
  return (
    <div className="phone-confirm">
      {intro}
      {!sentBy ? (
        <>
          <p className="small" style={{ margin: 0 }}>
            We’ll send a 6-number code to <strong>{status.masked}</strong>. It’s free for you and works for 10 minutes.
          </p>
          <div className="row" style={{ gap: 8 }}>
            {ways.map((c, i) => (
              <button key={c} className={`btn ${i === 0 ? 'primary' : ''}`} type="button" disabled={busy || wait > 0} onClick={() => void send(c)}>
                {busy ? 'Sending…' : `Send code by ${channelLabel(c)}`}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form className="phone-code" onSubmit={check} noValidate>
          <label htmlFor={`${uid}-code`} className="small">
            We sent a code by {channelLabel(sentBy)} to <strong>{status.masked}</strong>.
          </label>
          <input
            ref={input}
            id={`${uid}-code`}
            className="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
          />
          <button className="btn primary block" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Confirm my number'}
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Didn’t get it?{' '}
            {wait > 0 ? (
              `You can ask again in ${wait}s.`
            ) : (
              <>
                <button type="button" className="text-link tiny" onClick={() => void send(sentBy)}>
                  Send again
                </button>
                {other && (
                  <>
                    {' · '}
                    <button type="button" className="text-link tiny" onClick={() => void send(other)}>
                      Send by {channelLabel(other)} instead
                    </button>
                  </>
                )}
              </>
            )}
          </p>
        </form>
      )}
      {error && (
        <div className="note error" role="alert">
          {error}
        </div>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>
        Memora will never phone you or ask you for this code. Don’t share it with anyone.
      </p>
    </div>
  );
}

/** The same, as a pop-up: when publishing needs a confirmed number first. */
export function PhoneConfirmSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="confirm-sheet" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={onClose}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <h2 id={`${uid}-t`} className="h3">
          First, confirm your number.
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          A memorial goes out under your name, so we check the number on your account is really yours. You only do this once.
        </p>
        <PhoneConfirm onDone={() => window.setTimeout(onDone, 900)} />
        <div className="confirm-actions">
          <button className="btn" type="button" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
