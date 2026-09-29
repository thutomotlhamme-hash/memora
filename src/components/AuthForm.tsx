'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { loginAddress } from '@/lib/account-id';
import { contact } from '@/lib/config';
import { moveGuestDraftIntoAccount } from '@/lib/memorials-client';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { safeNext } from '@/lib/safe-next';
import { QuickAccount } from './QuickAccount';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const COPY: Record<Mode, { eyebrow: string; title: string; lede: string; cta: string }> = {
  login: { eyebrow: 'Welcome back', title: 'Log in to Memora.', lede: 'Your cellphone number (or email) and password.', cta: 'Log in' },
  register: {
    eyebrow: 'Keep your memorial',
    title: 'Save it in seconds.',
    lede: 'Just your cellphone number and a password. No SMS, no email to wait for.',
    cta: 'Create account',
  },
  forgot: { eyebrow: 'Password help', title: 'Forgot your password?', lede: 'Tell us the cellphone number or email you signed up with.', cta: 'Continue' },
  reset: { eyebrow: 'Your password', title: 'Choose a new password.', lede: 'Use at least 8 characters, and don’t reuse a password from another site.', cta: 'Save new password' },
};

export function AuthForm({ mode }: { mode: Mode }) {
  if (mode === 'login' || mode === 'register') return <QuickAuth mode={mode} />;
  return <PasswordForm mode={mode} />;
}

/** Log in / create account: cellphone first, then straight back to what you were doing. */
function QuickAuth({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const copy = COPY[mode];
  return (
    <div className="auth-card">
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1 className="h1">{copy.title}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {copy.lede}
      </p>
      <QuickAccount
        initialMode={mode}
        cta="Create account"
        onSignedIn={async () => {
          // Started as a guest? Carry the draft straight into the account.
          const dest = params.get('save') === '1' ? await moveGuestDraftIntoAccount(params.get('step')).catch(() => null) : null;
          router.replace(dest ?? next);
          router.refresh();
        }}
        onNeedsEmailConfirm={(email) => router.replace(`/account/check-email?kind=confirm&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`)}
      />
      {mode === 'register' && (
        <p className="consent">
          By creating an account you confirm you’re 18 or older and agree to the <Link href="/terms">terms</Link> and{' '}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      )}
      <div className="divider">or</div>
      <Link className="btn block" href="/create">
        Continue as a guest
      </Link>
      <p className="tiny muted" style={{ margin: 0 }}>
        Build the whole memorial first if you like. It stays on this device until you save it.
      </p>
    </div>
  );
}

function PasswordForm({ mode }: { mode: 'forgot' | 'reset' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phoneHelp, setPhoneHelp] = useState('');
  const copy = COPY[mode];
  const supabase = getBrowserSupabase();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    if (mode === 'forgot') {
      const who = String(form.get('who') ?? '').trim();
      const login = loginAddress(who);
      if (!login) return setError('Enter the cellphone number or email you signed up with.');
      // Nothing is ever sent to a phone: the team helps on WhatsApp instead.
      if (login.kind === 'phone') return setPhoneHelp(who);
    }
    if (!supabase) return setError('Accounts are not configured on this Memora deployment yet.');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const login = loginAddress(String(form.get('who') ?? ''))!;
        const { error } = await supabase.auth.resetPasswordForEmail(login.email, { redirectTo: `${window.location.origin}/auth/confirm?next=/account/reset` });
        if (error) throw error;
        router.replace('/account/check-email?kind=reset');
        return;
      }
      const password = String(form.get('password') ?? '');
      if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace('/memorials');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? friendly(err.message) : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (phoneHelp) {
    const text = `Hi Memora, I’ve forgotten my password. My account number is ${phoneHelp}.`;
    const wa = contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}` : '';
    return (
      <div className="auth-card">
        <span className="eyebrow">Password help</span>
        <h1 className="h1">We’ll sort it out with you.</h1>
        <p className="muted" style={{ margin: 0 }}>
          For your security we never send codes to phones. Message us and a person on our team will check it’s you (for example, by the name on your
          memorial) and give you a temporary password.
        </p>
        <div className="row" style={{ marginTop: 24 }}>
          {wa ? (
            <a className="btn primary" href={wa} target="_blank" rel="noopener noreferrer">
              WhatsApp us
            </a>
          ) : (
            <Link className="btn primary" href={`/contact?topic=account&whatsapp=${encodeURIComponent(phoneHelp)}&message=${encodeURIComponent(text)}`}>
              Message us
            </Link>
          )}
          <Link className="btn" href="/account/login">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1 className="h1">{copy.title}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {copy.lede}
      </p>
      <form onSubmit={onSubmit} noValidate>
        {mode === 'forgot' ? (
          <div className="field">
            <label htmlFor="who">Cellphone number or email</label>
            <input className="input" id="who" name="who" autoComplete="username" required placeholder="072 123 4567" />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="password">New password</label>
            <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            <span className="hint">At least 8 characters.</span>
          </div>
        )}
        {error && (
          <div className="note error" role="alert">
            {error}
          </div>
        )}
        <button className="btn primary lg block" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : copy.cta}
        </button>
        <Link className="text-link small" href="/account/login" style={{ justifySelf: 'start' }}>
          Back to log in
        </Link>
      </form>
    </div>
  );
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match an account.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address first. Check your inbox for the link.';
  if (/already registered/i.test(message)) return 'An account with this email already exists. Try logging in.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return 'We couldn’t reach Memora just now. Check your connection and try again.';
  return message;
}
