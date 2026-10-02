'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { channelLabel, type Channel, type Channels } from '@/lib/verify';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { phoneLoginEmail, normaliseCellphone, localCellphone } from '@/lib/account-id';

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; body: Record<string, any> }> {
  const res = await fetch('/api/account/reset-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: Boolean(res?.ok), body: res ? await res.json().catch(() => ({})) : { error: 'We couldn’t reach Memora. Check your connection.' } };
}

/**
 * Forgot your password, on your own: a code to your number by WhatsApp (or
 * SMS), then a new password, then you're logged in. A person can still help on
 * WhatsApp if the code doesn't arrive.
 */
export function ResetByCode({ phone, channels, helpHref }: { phone: string; channels: Channels; helpHref: string }) {
  const router = useRouter();
  const ways = (['whatsapp', 'sms'] as Channel[]).filter((c) => channels[c]);
  const digits = normaliseCellphone(phone) ?? '';
  const [sent, setSent] = useState<{ channel: Channel; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (channel: Channel) => {
    setError('');
    setBusy(true);
    const out = await post({ action: 'send', phone: digits, channel });
    setBusy(false);
    if (!out.ok) return setError(out.body.error || 'We couldn’t send a code.');
    setSent({ channel, message: out.body.message });
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    const code = String(form.get('code') ?? '');
    const password = String(form.get('password') ?? '');
    if (code.replace(/\D/g, '').length !== 6) return setError('Enter the 6 numbers from the message.');
    if (password.length < 8) return setError('Choose a password of at least 8 characters.');
    setBusy(true);
    const out = await post({ action: 'check', phone: digits, code, password });
    if (!out.ok) {
      setBusy(false);
      return setError(out.body.error || 'That didn’t work. Please try again.');
    }
    // Straight in with the new password.
    const supabase = getBrowserSupabase();
    const { error: signInError } = supabase ? await supabase.auth.signInWithPassword({ email: phoneLoginEmail(digits), password }) : { error: new Error('x') };
    router.replace(signInError ? '/account/login' : '/memorials');
    router.refresh();
  };

  return (
    <div className="auth-card">
      <span className="eyebrow">Password help</span>
      <h1 className="h1">{sent ? 'Enter your code.' : 'We’ll send you a code.'}</h1>
      {!sent ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            We’ll send a 6-number code to <strong>{localCellphone(digits)}</strong>. Then you choose a new password.
          </p>
          <div className="row" style={{ gap: 8 }}>
            {ways.map((c, i) => (
              <button key={c} className={`btn ${i === 0 ? 'primary' : ''}`} type="button" disabled={busy} onClick={() => void send(c)}>
                {busy ? 'Sending…' : `Send by ${channelLabel(c)}`}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={save} noValidate>
          <p className="muted" style={{ margin: 0 }}>
            {sent.message} It works for 10 minutes.
          </p>
          <div className="field">
            <label htmlFor="code">Code from {channelLabel(sent.channel)}</label>
            <input className="input code-input" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" required />
          </div>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
            <span className="hint">At least 8 characters.</span>
          </div>
          <button className="btn primary lg block" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : 'Save and log in'}
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Nothing yet?{' '}
            {ways.map((c, i) => (
              <span key={c}>
                {i > 0 && ' · '}
                <button type="button" className="text-link tiny" disabled={busy} onClick={() => void send(c)}>
                  {c === sent.channel ? 'Send again' : `Send by ${channelLabel(c)} instead`}
                </button>
              </span>
            ))}
          </p>
        </form>
      )}
      {error && (
        <div className="note error" role="alert">
          {error}
        </div>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>
        Memora will never phone you or ask you for this code. No longer have this number? <Link href={helpHref}>Message us</Link> and a person will help.
      </p>
      <Link className="text-link small" href="/account/login" style={{ justifySelf: 'start' }}>
        Back to log in
      </Link>
    </div>
  );
}
