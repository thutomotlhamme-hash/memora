'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { localCellphone, loginAddress, normaliseCellphone } from '@/lib/account-id';
import { getBrowserSupabase } from '@/lib/supabase/client';

// The quickest way to keep a memorial: a cellphone number and a password.
// Nothing is sent to the phone; the number is how Memora recognises you when
// you come back. Email stays available for people who prefer it.

type Mode = 'register' | 'login';
type Method = 'phone' | 'email';
const REMEMBER = 'memora:last-login';

function remembered(): string {
  try {
    return localStorage.getItem(REMEMBER) ?? '';
  } catch {
    return '';
  }
}
function remember(value: string) {
  try {
    localStorage.setItem(REMEMBER, value);
  } catch {
    /* private mode: nothing to remember */
  }
}

export function QuickAccount({
  initialMode = 'register',
  cta,
  onSignedIn,
  onNeedsEmailConfirm,
}: {
  initialMode?: Mode;
  cta?: string;
  onSignedIn: () => Promise<void> | void;
  onNeedsEmailConfirm?: (email: string) => void;
}) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [method, setMethod] = useState<Method>('phone');
  const [who, setWho] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const digits = method === 'phone' && mode === 'register' ? normaliseCellphone(who) : null;
  const id = (k: string) => `${uid}-${k}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    const supabase = getBrowserSupabase();
    if (!supabase) return setError('Accounts aren’t switched on yet. Your draft is safe on this device.');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    setBusy(true);
    try {
      if (mode === 'register' && method === 'phone') {
        if (!digits) throw new Error('Enter your cellphone number, like 072 123 4567.');
        const res = await fetch('/api/account/phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: who, password, name }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body?.code === 'EXISTS') {
          // Already signed up on another day: switch to logging in, number kept.
          setMode('login');
          setNotice(body.error.replace(' Log in instead, or WhatsApp us if it isn’t yours.', '. Enter your password to log in.'));
          return;
        }
        if (!res.ok) throw new Error(body?.error || 'We couldn’t create the account just now.');
        const login = loginAddress(who)!;
        const { error } = await supabase.auth.signInWithPassword({ email: login.email, password });
        if (error) throw error;
        remember(localCellphone(digits));
        await onSignedIn();
        return;
      }
      if (mode === 'register') {
        const email = who.trim().toLowerCase();
        if (!loginAddress(email) || loginAddress(email)?.kind !== 'email') throw new Error('Enter a valid email address.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/confirm?next=/memorials` },
        });
        if (error) throw error;
        remember(email);
        if (data.session) await onSignedIn();
        else onNeedsEmailConfirm?.(email);
        return;
      }
      const login = loginAddress(who);
      if (!login) throw new Error('Enter the cellphone number or email you signed up with.');
      const { error } = await supabase.auth.signInWithPassword({ email: login.email, password });
      if (error) throw error;
      remember(who.trim());
      await onSignedIn();
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : ''));
    } finally {
      setBusy(false);
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setNotice('');
  };

  return (
    <form className="quick-account" onSubmit={submit} noValidate>
      {mode === 'register' ? (
        method === 'phone' ? (
          <div className="field">
            <label htmlFor={id('who')}>Cellphone number</label>
            <input
              id={id('who')}
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="072 123 4567"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && who !== '' && !digits}
              aria-describedby={id('who-hint')}
            />
            <span className={`hint${digits ? ' ok' : ''}`} id={id('who-hint')}>
              {digits
                ? `We’ll know you by ${localCellphone(digits)}. Please check it’s right.`
                : touched && who
                  ? 'That doesn’t look like a cellphone number. Try 072 123 4567.'
                  : 'No SMS, no email. It’s how you’ll log back in.'}
            </span>
          </div>
        ) : (
          <div className="field">
            <label htmlFor={id('who')}>Email address</label>
            <input id={id('who')} className="input" type="email" autoComplete="email" placeholder="you@example.com" value={who} onChange={(e) => setWho(e.target.value)} />
            <span className="hint">We’ll send a link to confirm it’s yours.</span>
          </div>
        )
      ) : (
        <div className="field">
          <label htmlFor={id('who')}>Cellphone number or email</label>
          <input
            id={id('who')}
            className="input"
            autoComplete="username"
            placeholder="072 123 4567"
            value={who}
            onFocus={() => {
              // Coming back on the same phone: fill in the number used last time.
              if (!who) setWho(remembered());
            }}
            onChange={(e) => setWho(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor={id('pw')}>{mode === 'register' ? 'Choose a password' : 'Password'}</label>
        <div className="pw-wrap">
          <input
            id={id('pw')}
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        {mode === 'register' && <span className="hint">At least 8 characters. Your number and this password bring you back.</span>}
      </div>

      {mode === 'register' && (
        <div className="field">
          <label htmlFor={id('name')}>
            Your name <span className="muted">(optional)</span>
          </label>
          <input id={id('name')} className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      {notice && (
        <div className="note" role="status">
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="note error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <button className="btn primary lg block" type="submit" disabled={busy}>
        {busy ? 'One moment…' : mode === 'login' ? 'Log in' : (cta ?? 'Save and continue')}
      </button>

      <div className="quick-links">
        {mode === 'register' ? (
          <>
            <button type="button" className="text-link small" onClick={() => switchMode('login')}>
              I already have an account
            </button>
            <button
              type="button"
              className="text-link small"
              onClick={() => {
                setMethod(method === 'phone' ? 'email' : 'phone');
                setWho('');
                setError('');
              }}
            >
              {method === 'phone' ? 'Use email instead' : 'Use my cellphone instead'}
            </button>
          </>
        ) : (
          <>
            <Link className="text-link small" href="/account/forgot">
              Forgot your password?
            </Link>
            <button type="button" className="text-link small" onClick={() => switchMode('register')}>
              New here? Create an account
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That number (or email) and password don’t match. Check both, or tap “Forgot your password?”.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address first. Check your inbox for the link.';
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Tap “I already have an account”.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return 'We couldn’t reach Memora just now. Check your connection and try again.';
  return message || 'Something went wrong. Please try again.';
}
