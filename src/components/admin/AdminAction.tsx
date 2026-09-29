'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '../Toast';

type Props = {
  action: string;
  id?: string;
  label: string;
  variant?: 'primary' | 'danger' | 'ghost' | '';
  /** Ask "are you sure?" first. */
  confirm?: string;
  /** Ask for a value first (e.g. a reason or a new number). */
  prompt?: { field: 'reason' | 'whatsapp' | 'email'; question: string; initial?: string };
  extra?: Record<string, string>;
};

async function run(body: Record<string, string | undefined>) {
  const res = await fetch('/api/admin/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  return { ok: res.ok, message: (out?.message || out?.error || (res.ok ? 'Done.' : 'That didn’t work.')) as string };
}

export function AdminAction({ action, id, label, variant = '', confirm, prompt, extra }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn sm ${variant}`}
      type="button"
      disabled={busy}
      onClick={async () => {
        const body: Record<string, string | undefined> = { action, id, ...extra };
        if (prompt) {
          const value = window.prompt(prompt.question, prompt.initial ?? '');
          if (value == null || !value.trim()) return;
          body[prompt.field] = value.trim();
        }
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        const out = await run(body);
        setBusy(false);
        toast(out.message, out.ok ? 'info' : 'error');
        if (out.ok) router.refresh();
      }}
    >
      {busy ? '…' : label}
    </button>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <button className="btn sm" type="button" onClick={() => navigator.clipboard.writeText(text).then(() => toast('Copied.'), () => toast('Copy failed.', 'error'))}>
      {label}
    </button>
  );
}

export function AddTeamMember() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="row"
      style={{ flexWrap: 'nowrap' }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const out = await run({ action: 'team.add', email });
        setBusy(false);
        toast(out.message, out.ok ? 'info' : 'error');
        if (out.ok) {
          setEmail('');
          router.refresh();
        }
      }}
    >
      <input className="input" type="email" required placeholder="their@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to add" />
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add'}
      </button>
    </form>
  );
}
