'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { QuickAccount } from '@/components/QuickAccount';

/** Signed out on a link: create an account (or log in) right here, then carry on. */
export function JoinAccount({ cta }: { cta: string }) {
  const router = useRouter();
  return <QuickAccount initialMode="register" cta={cta} onSignedIn={() => router.refresh()} />;
}

async function join(token: string, details: Record<string, string> = {}): Promise<string> {
  const res = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...details }) }).catch(() => null);
  const body = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok || !body.redirect) throw new Error(body?.error || 'Couldn’t reach Memora. Check the connection and try again.');
  return body.redirect as string;
}

/** A family starting their memorial under the funeral home: one tap. */
export function StartFamilyMemorial({ token }: { token: string }) {
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
        {busy ? 'Starting…' : 'Start the memorial'}
      </button>
    </>
  );
}

/** A funeral home setting itself up from Memora's onboarding link. */
export function SetUpHome({ token, name, phone }: { token: string; name: string; phone: string }) {
  const router = useRouter();
  const uid = useId();
  const [v, setV] = useState({ name, contactName: '', contactPhone: phone, contactEmail: '', area: '', branchName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
        setBusy(true);
        setError('');
        try {
          router.push(await join(token, v));
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
