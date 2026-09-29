'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { emptyGift, validateGift, type GiftInput } from '@/lib/gift';
import { localDateKey } from '@/lib/memorial';
import { PRICE_LABEL } from '@/lib/plans';

type Errors = Partial<Record<keyof GiftInput, string>>;

export function GiftForm({ ready }: { ready: boolean }) {
  const params = useSearchParams();
  const payment = params.get('payment');
  const [form, setForm] = useState<GiftInput>(emptyGift);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = localDateKey();

  const set = <K extends keyof GiftInput>(key: K, value: GiftInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const check = validateGift(form);
    if (!check.ok) {
      setErrors(check.errors);
      const first = Object.keys(check.errors)[0];
      document.getElementById(`gift-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const website = String(new FormData(e.currentTarget).get('website') ?? '');
      const res = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body?.errors) setErrors(body.errors);
        throw new Error(body?.error || 'Could not open checkout.');
      }
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open checkout.');
      setBusy(false);
    }
  };

  const field = (key: keyof GiftInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div className="field">
      <label htmlFor={`gift-${key}`}>{label}</label>
      <input
        id={`gift-${key}`}
        className="input"
        value={String(form[key] ?? '')}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] || hint ? `gift-${key}-hint` : undefined}
        {...props}
      />
      {(errors[key] || hint) && (
        <span id={`gift-${key}-hint`} className="hint" style={errors[key] ? { color: 'var(--rust)' } : undefined}>
          {errors[key] ?? hint}
        </span>
      )}
    </div>
  );

  return (
    <form className="panel gift-form" onSubmit={submit} noValidate>
      {payment && (
        <div className={`note ${payment === 'failed' ? 'error' : ''}`} role="status" style={{ marginBottom: 20 }}>
          {payment === 'failed' ? 'The payment didn’t go through and you weren’t charged. Please try again.' : 'Checkout was cancelled and nothing was charged.'}
        </div>
      )}

      <fieldset>
        <legend className="h3">Who is it for?</legend>
        <p className="muted small">They get a private link to create the memorial. It’s already paid for.</p>
        <div className="grid-2">
          <div className="span-2">{field('recipientName', 'Their name', { autoComplete: 'off', autoCapitalize: 'words', placeholder: 'e.g. Lerato Magumba' })}</div>
          {field('recipientWhatsapp', 'Their WhatsApp number', { type: 'tel', autoComplete: 'off', inputMode: 'tel', placeholder: '082 123 4567' })}
          {field('recipientEmail', 'Their email (optional)', { type: 'email', autoComplete: 'off', inputMode: 'email' })}
          <p className="hint span-2" style={{ margin: 0 }}>
            After you pay, you send them the private link on WhatsApp in one tap. We use this number to help them finish in time.
          </p>
          <div className="span-2">
            {field('lovedOneName', 'Name of the person who passed away', { autoComplete: 'off', autoCapitalize: 'words' }, 'Optional. We’ll start the memorial with this name.')}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="h3">When is the funeral?</legend>
        <p className="muted small">A rough date is fine. Our team uses it to check in with the family so the memorial is ready in time.</p>
        <div className="grid-2">
          {field('funeralDate', 'Expected funeral date', { type: 'date', min: today, disabled: form.funeralDateUnsure })}
          <label className="check-row">
            <input type="checkbox" checked={form.funeralDateUnsure} onChange={(e) => set('funeralDateUnsure', e.target.checked)} />
            <span>Not sure yet</span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="h3">From you</legend>
        <div className="grid-2">
          {field('buyerName', 'Your name', { autoComplete: 'name', autoCapitalize: 'words' })}
          {field('buyerEmail', 'Your email', { type: 'email', autoComplete: 'email', inputMode: 'email' }, 'So we can reach you about the gift.')}
          <div className="field span-2">
            <label htmlFor="gift-message">A message for them</label>
            <textarea
              id="gift-message"
              className="textarea short"
              maxLength={1000}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder="Optional. e.g. Thinking of you all. Let this be one less thing to worry about."
            />
          </div>
        </div>
      </fieldset>

      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only" />

      {error && (
        <div className="note error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      <div className="gift-pay">
        <div>
          <strong className="plan-price" style={{ fontSize: 34 }}>
            {PRICE_LABEL}
          </strong>
          <span className="small muted">Once-off. Secure card checkout by Yoco.</span>
        </div>
        <button className="btn primary lg" type="submit" disabled={busy || !ready}>
          {busy ? 'Opening checkout…' : `Pay ${PRICE_LABEL} and send the gift`}
        </button>
      </div>
      <p className="consent" style={{ marginTop: 12 }}>
        By paying you agree to the <Link href="/terms">terms</Link> and confirm {form.recipientName || 'the recipient'} knows you’re sharing their number, so our
        team can help them on WhatsApp. See our <Link href="/privacy">privacy policy</Link>.
      </p>
      {!ready && (
        <p className="small muted" style={{ marginTop: 10 }}>
          Gifting isn’t switched on for this deployment yet.
        </p>
      )}
    </form>
  );
}
