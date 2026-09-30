'use client';

import { useId, useState } from 'react';
import { useToast } from './Toast';

/**
 * Near the end of a memorial's first year: the unveiling is coming. Memora's
 * events (invitations, directions, the day, another year online) are on the
 * way; for now a family can ask to be told, with a date if they have one.
 */
export function UnveilingPrompt({ caseId, name, daysLeft, until, asked }: { caseId: string; name: string; daysLeft: number; until: string; asked: boolean }) {
  const uid = useId();
  const toast = useToast();
  const [done, setDone] = useState(asked);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const untilLabel = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${until}T12:00:00Z`));
  return (
    <article className="unveil">
      <span className="unveil-k">The first year · {daysLeft === 1 ? '1 day' : `${daysLeft} days`} left</span>
      <h2 className="h3">Planning {name}’s unveiling?</h2>
      <p>
        {name}’s memorial stays public until {untilLabel}. Most families unveil the tombstone around the first anniversary. Memora is making unveiling pages: one link
        with the date, directions and the programme, for everyone who came to the funeral, and another year online for the memorial.
      </p>
      {done ? (
        <p className="unveil-done">You’re on the list. We’ll WhatsApp you as soon as it’s ready.</p>
      ) : (
        <div className="unveil-form">
          <div className="field">
            <label htmlFor={`${uid}-d`}>Unveiling date, if you know it</label>
            <input id={`${uid}-d`} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button
            className="btn primary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch(`/api/memorials/${caseId}/unveiling`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plannedFor: date || undefined }) }).catch(() => null);
              const out = res ? await res.json().catch(() => ({})) : {};
              setBusy(false);
              toast(out?.message || out?.error || 'Something went wrong.', res?.ok ? 'info' : 'error');
              if (res?.ok) setDone(true);
            }}
          >
            {busy ? 'Saving…' : 'Tell me when it’s ready'}
          </button>
        </div>
      )}
    </article>
  );
}
