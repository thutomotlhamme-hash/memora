'use client';

import { useState } from 'react';

const TOPICS = [
  ['help', 'Help with a memorial'],
  ['account', 'Logging in or my password'],
  ['gift', 'A gift'],
  ['payment', 'A payment or refund'],
  ['privacy', 'Privacy or removing content'],
  ['partnership', 'Churches, printers and partners'],
  ['other', 'Something else'],
] as const;

/** Sends to Netlify Forms (see public/__forms.html); the team gets an email alert per message. */
export function ContactForm({ defaults = {} }: { defaults?: { topic?: string; message?: string; whatsapp?: string } }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const whatsapp = String(data.get('whatsapp') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    if (!email && !whatsapp) return setError('Add an email or a WhatsApp number so we can reply.');
    if (message.length < 5) return setError('Tell us a little about how we can help.');
    setError('');
    setState('sending');
    try {
      const res = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data as unknown as Record<string, string>).toString(),
      });
      if (!res.ok) throw new Error();
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="panel">
        <span className="pill ok dot">Sent</span>
        <h2 className="h2" style={{ margin: '14px 0 10px' }}>
          Thank you. We’ll be in touch.
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          We usually reply within a day, on WhatsApp or email. If it’s about a funeral this week, we’ll prioritise it.
        </p>
      </div>
    );
  }

  return (
    <form className="panel stack" style={{ ['--stack' as string]: '16px' }} onSubmit={submit} name="contact" noValidate>
      <input type="hidden" name="form-name" value="contact" />
      <p className="sr-only">
        <label>
          Don’t fill this in: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>
      <div className="grid-2">
        <div className="field span-2">
          <label htmlFor="c-name">Your name</label>
          <input className="input" id="c-name" name="name" autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="c-whatsapp">WhatsApp number</label>
          <input className="input" id="c-whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="082 123 4567" defaultValue={defaults.whatsapp} />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input className="input" id="c-email" name="email" type="email" inputMode="email" autoComplete="email" />
        </div>
        <div className="field span-2">
          <label htmlFor="c-topic">What is it about?</label>
          <select className="select" id="c-topic" name="topic" defaultValue={TOPICS.some(([v]) => v === defaults.topic) ? defaults.topic : 'help'}>
            {TOPICS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field span-2">
          <label htmlFor="c-message">Message</label>
          <textarea className="textarea short" id="c-message" name="message" required maxLength={3000} defaultValue={defaults.message} />
        </div>
      </div>
      {error && (
        <div className="note error" role="alert">
          {error}
        </div>
      )}
      {state === 'error' && (
        <div className="note error" role="alert">
          Your message didn’t send. Please try again in a moment.
        </div>
      )}
      <button className="btn primary lg" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
