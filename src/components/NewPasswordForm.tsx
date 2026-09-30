'use client';

import Link from 'next/link';
import { useId, useState } from 'react';

/** The form behind a reset link: a new password, twice, then straight to logging in. */
export function NewPasswordForm({ token, label }: { token: string; label: string }) {
  const uid = useId();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (done)
    return (
      <div className="stack" style={{ ['--stack' as string]: '14px', marginTop: 16 }}>
        <div className="note ok" role="status">
          <span>
            <strong>Password changed.</strong> Log in with {label} and your new password.
          </span>
        </div>
        <Link className="btn primary lg block" href="/account/login">
          Log in
        </Link>
      </div>
    );

  return (
    <form
      className="stack"
      style={{ ['--stack' as string]: '14px', marginTop: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 8) return setError('Use a password of at least 8 characters.');
        if (password !== again) return setError('The two passwords don’t match.');
        setBusy(true);
        const res = await fetch('/api/account/reset-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) }).catch(() => null);
        const out = res ? await res.json().catch(() => ({})) : { error: 'Couldn’t reach Memora. Check the connection and try again.' };
        setBusy(false);
        if (res?.ok) setDone(true);
        else setError(out?.error || 'That didn’t work. Please try again.');
      }}
    >
      <div className="field">
        <label htmlFor={`${uid}-pw`}>New password</label>
        <input id={`${uid}-pw`} className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        <span className="hint">At least 8 characters.</span>
      </div>
      <div className="field">
        <label htmlFor={`${uid}-again`}>Type it again</label>
        <input id={`${uid}-again`} className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
      </div>
      <label className="af-check">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <span>Show passwords</span>
      </label>
      {error && (
        <div className="note error" role="alert">
          <span>{error}</span>
        </div>
      )}
      <button className="btn primary lg block" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}
