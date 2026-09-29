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
        const out = await run({ action: 'team.add', who: email });
        setBusy(false);
        toast(out.message, out.ok ? 'info' : 'error');
        if (out.ok) {
          setEmail('');
          router.refresh();
        }
      }}
    >
      <input className="input" required placeholder="Their cellphone number or email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Cellphone number or email of their Memora account" />
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add'}
      </button>
    </form>
  );
}

/**
 * Someone forgot their password (phone accounts can't reset by email). After
 * checking it's really them on WhatsApp, set a temporary password and send it.
 */
export function HelpLogin() {
  const toast = useToast();
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ password: string; who: string; whatsapp: string; text: string } | null>(null);
  return (
    <div className="stack" style={{ ['--stack' as string]: '12px' }}>
      <form
        className="row"
        style={{ flexWrap: 'nowrap' }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!window.confirm(`Set a temporary password for ${who}? Only do this after checking on WhatsApp that it’s really them.`)) return;
          setBusy(true);
          setResult(null);
          const res = await fetch('/api/admin/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'account.resetPassword', who }) });
          const out = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) return toast(out?.error || 'That didn’t work.', 'error');
          setResult({ password: out.password, who: out.who, whatsapp: out.whatsapp, text: out.text });
          toast(out.message);
        }}
      >
        <input className="input" required placeholder="Their cellphone number or email" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Account to help" />
        <button className="btn primary" type="submit" disabled={busy || !who.trim()}>
          {busy ? 'Setting…' : 'Set temporary password'}
        </button>
      </form>
      {result && (
        <div className="note ok" role="status">
          <span>
            <strong>{result.who}</strong> can now log in with <strong className="mono-pw">{result.password}</strong>. Send it only to them.
            <span className="row" style={{ marginTop: 10 }}>
              {result.whatsapp && (
                <a className="btn sm primary" href={`https://wa.me/${result.whatsapp}?text=${encodeURIComponent(result.text)}`} target="_blank" rel="noopener noreferrer">
                  Send on WhatsApp
                </a>
              )}
              <CopyButton text={result.text} label="Copy message" />
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
