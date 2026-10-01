'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { QuickAccount } from '@/components/QuickAccount';
import { TERMS_VERSION } from '@/lib/config';

/** Signed out on a link: create an account (or log in) right here, then carry on. */
export function JoinAccount({ cta }: { cta: string }) {
  const router = useRouter();
  return <QuickAccount initialMode="register" cta={cta} onSignedIn={() => router.refresh()} />;
}

async function join(token: string, details: Record<string, string | boolean> = {}): Promise<string> {
  const res = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...details }) }).catch(() => null);
  const body = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok || !body.redirect) throw new Error(body?.error || 'Couldn’t reach Memora. Check the connection and try again.');
  return body.redirect as string;
}

/** A family starting their memorial under the funeral home: one tap. */
export function StartFamilyMemorial({ token, label = 'Start the memorial', busyLabel = 'Starting…' }: { token: string; label?: string; busyLabel?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      {error && (
        <div className="note error" role="alert">
          <span>{error}</span>
        </div>
      )}
      <button
        className="btn primary lg block"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            router.push(await join(token));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong.');
            setBusy(false);
          }
        }}
      >
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

/** A funeral home setting itself up from Memora's onboarding link. */
export function SetUpHome({ token, name, phone }: { token: string; name: string; phone: string }) {
  const router = useRouter();
  const uid = useId();
  const [v, setV] = useState({ name, contactName: '', contactPhone: phone, contactEmail: '', area: '', branchName: '' });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Checked here for a quick answer; the server checks again.
  const problem = (): string => {
    if (v.name.trim().length < 2) return 'Enter your funeral home’s name.';
    if (v.contactPhone && v.contactPhone.replace(/\D/g, '').length < 9) return 'Check the office number: it looks too short.';
    if (v.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contactEmail.trim())) return 'Check the office email address.';
    if (!agreed) return 'Please confirm you may sign up for the funeral home and agree to the Memora Pro terms.';
    return '';
  };
  const field = (k: keyof typeof v, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={`${uid}-${k}`}>{label}</label>
      <input id={`${uid}-${k}`} className="input" value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} {...extra} />
    </div>
  );
  return (
    <form
      className="join-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const why = problem();
        if (why) return setError(why);
        setBusy(true);
        setError('');
        try {
          router.push(await join(token, { ...v, agreed: true, termsVersion: TERMS_VERSION }));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
          setBusy(false);
        }
      }}
    >
      {field('name', 'Funeral home name', { required: true, placeholder: 'e.g. Sizwe Funeral Services', autoComplete: 'organization' })}
      <div className="join-two">
        {field('contactName', 'Your name', { autoComplete: 'name' })}
        {field('contactPhone', 'Office number', { type: 'tel', inputMode: 'tel', placeholder: '011 123 4567' })}
      </div>
      <div className="join-two">
        {field('contactEmail', 'Office email (optional)', { type: 'email', autoComplete: 'email' })}
        {field('area', 'Area or town', { placeholder: 'e.g. Soweto, Johannesburg' })}
      </div>
      {field('branchName', 'Your first branch', { placeholder: 'e.g. Soweto (you can add more later)' })}
      <div className="join-terms">
        <strong>Before you start</strong>
        <ul>
          <li>Your free trial starts now. Nothing is billed until Memora makes your account active, and we’ll tell you first.</li>
          <li>On a monthly plan, a funeral counts once, when its memorial is published. Drafts and family links don’t count.</li>
          <li>You’re responsible for the families’ information your staff add, and Memora looks after it for you under POPIA.</li>
        </ul>
        <label className="confirm-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I may sign up on behalf of this funeral home, and I agree to the{' '}
            <Link href="/terms#pro" target="_blank">
              Memora Pro terms
            </Link>{' '}
            and the{' '}
            <Link href="/privacy" target="_blank">
              privacy policy
            </Link>
            .
          </span>
        </label>
      </div>
      {error && (
        <div className="note error" role="alert">
          <span>{error}</span>
        </div>
      )}
      <button className="btn primary lg block" type="submit" disabled={busy}>
        {busy ? 'Setting up…' : 'Set up our funeral home'}
      </button>
    </form>
  );
}
