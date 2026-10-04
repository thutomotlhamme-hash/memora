'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '../Toast';

/** The team gives a family a memorial: a private link to send on WhatsApp, nothing to pay. */
export function GiveGift() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ link: string; text: string; whatsapp: string } | null>(null);
  if (!open)
    return (
      <button className="btn primary" type="button" onClick={() => setOpen(true)}>
        Give a memorial
      </button>
    );
  if (done)
    return (
      <div className="card give-gift">
        <h3 className="h4">Gift ready.</h3>
        <p className="small muted">Send this private link. It works once, and the memorial stays private until they publish.</p>
        <code className="small" style={{ wordBreak: 'break-all' }}>{done.link}</code>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn primary" href={`https://wa.me/${done.whatsapp}?text=${encodeURIComponent(done.text)}`} target="_blank" rel="noopener noreferrer">
            Send on WhatsApp
          </a>
          <button className="btn" type="button" onClick={() => navigator.clipboard.writeText(done.link).then(() => toast('Link copied.'))}>
            Copy link
          </button>
          <button className="btn ghost" type="button" onClick={() => { setDone(null); setOpen(false); }}>
            Done
          </button>
        </div>
      </div>
    );
  return (
    <form
      className="card give-gift"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        setBusy(true);
        const res = await fetch('/api/admin/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gift.give', ...f }) }).catch(() => null);
        const out = res ? await res.json().catch(() => ({})) : {};
        setBusy(false);
        if (!res?.ok) return toast(out.error || 'That didn’t work.', 'error');
        setDone({ link: out.link, text: out.text, whatsapp: out.whatsapp });
        router.refresh();
      }}
    >
      <h3 className="h4">Give a memorial</h3>
      <p className="small muted" style={{ margin: 0 }}>
        Free for the family and kept out of revenue. They get the same private link as a bought gift.
      </p>
      <div className="give-grid">
        <label className="field">
          <span>Who receives it</span>
          <input className="input" name="name" required placeholder="e.g. Naledi Mokoena" />
        </label>
        <label className="field">
          <span>Their WhatsApp</span>
          <input className="input" name="whatsapp" required inputMode="tel" placeholder="072 123 4567" />
        </label>
        <label className="field">
          <span>Who passed away (optional)</span>
          <input className="input" name="lovedOne" />
        </label>
        <label className="field">
          <span>Funeral date (optional)</span>
          <input className="input" name="funeralDate" type="date" />
        </label>
        <label className="field">
          <span>From</span>
          <input className="input" name="from" defaultValue="The Memora team" />
        </label>
        <label className="field">
          <span>Why (kept in the audit log)</span>
          <input className="input" name="reason" required placeholder="e.g. hardship, partner home, goodwill" />
        </label>
      </div>
      <label className="field">
        <span>Message to the family (optional)</span>
        <textarea className="input" name="message" rows={2} maxLength={1000} />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Making the link…' : 'Create gift link'}
        </button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
