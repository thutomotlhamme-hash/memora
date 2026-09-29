'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { safeNext } from '@/lib/safe-next';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const COPY: Record<Mode, { eyebrow: string; title: string; lede: string; cta: string }> = {
  login: { eyebrow: 'Welcome back', title: 'Log in to Memora.', lede: 'Continue a memorial you started, or publish a draft from this browser.', cta: 'Log in' },
  register: {
    eyebrow: 'Create your account',
    title: 'Keep your memorial safe.',
    lede: 'You can build a whole memorial as a guest. An account stores it securely so you can publish, share and download it.',
    cta: 'Create account',
  },
  forgot: { eyebrow: 'Password help', title: 'Reset your password.', lede: 'Enter the email address on your account and we’ll send you a reset link.', cta: 'Send reset link' },
  reset: { eyebrow: 'Account recovery', title: 'Choose a new password.', lede: 'Use at least 8 characters, and don’t reuse a password from another site.', cta: 'Update password' },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const copy = COPY[mode];
  const supabase = getBrowserSupabase();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!supabase) return setError('Accounts are not configured on this Memora deployment yet.');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const name = String(form.get('name') ?? '').trim();
    const origin = window.location.origin;

    if ((mode === 'register' || mode === 'reset') && password.length < 8) return setError('Use a password of at least 8 characters.');
    if ((mode === 'register' || mode === 'reset') && password !== confirm) return setError('The two passwords don’t match.');

    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
        return;
      }
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          router.replace(`/account/check-email?kind=confirm&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
        }
        return;
      }
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/account/reset` });
        if (error) throw error;
        router.replace('/account/check-email?kind=reset');
        return;
      }
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

  const q = next !== '/memorials' ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <div className="auth-card">
      {(mode === 'login' || mode === 'register') && (
        <nav className="auth-switch" aria-label="Account">
          <Link href={`/account/login${q}`} aria-current={mode === 'login' ? 'page' : undefined}>
            Log in
          </Link>
          <Link href={`/account/register${q}`} aria-current={mode === 'register' ? 'page' : undefined}>
            Create account
          </Link>
        </nav>
      )}
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1 className="h1">{copy.title}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {copy.lede}
      </p>
      <form onSubmit={onSubmit} noValidate>
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input className="input" id="name" name="name" autoComplete="name" />
          </div>
        )}
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </div>
        )}
        {mode !== 'forgot' && (
          <div className="field">
            <label htmlFor="password">{mode === 'reset' ? 'New password' : 'Password'}</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
        )}
        {(mode === 'register' || mode === 'reset') && (
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input className="input" id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
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
        {mode === 'login' && (
          <Link className="text-link small" href="/account/forgot" style={{ justifySelf: 'start' }}>
            Forgot your password?
          </Link>
        )}
        {mode === 'forgot' && (
          <Link className="text-link small" href="/account/login" style={{ justifySelf: 'start' }}>
            Back to log in
          </Link>
        )}
        {(mode === 'login' || mode === 'register') && (
          <>
            <div className="divider">or</div>
            <Link className="btn block" href="/create">
              Continue as a guest
            </Link>
            <p className="tiny muted" style={{ margin: 0 }}>
              Guest memorials stay only in this browser. Nothing is sent to Memora until you create an account.
            </p>
          </>
        )}
      </form>
    </div>
  );
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match an account.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address first. Check your inbox for the link.';
  if (/already registered/i.test(message)) return 'An account with this email already exists. Try logging in.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  return message;
}
