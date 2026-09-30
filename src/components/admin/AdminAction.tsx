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
  endpoint?: string;
};

async function run(body: Record<string, string | undefined>, endpoint = '/api/admin/actions') {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  return { ok: res.ok, message: (out?.message || out?.error || (res.ok ? 'Done.' : 'That didn’t work.')) as string };
}

export function AdminAction({ action, id, label, variant = '', confirm, prompt, extra, endpoint }: Props) {
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
        const out = await run(body, endpoint);
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

type HelpResult = { kind: 'link' | 'password'; who: string; whatsapp: string; text: string; secret: string };

/** Get someone back in: a reset link they use themselves (best), or a temporary password. */
export function AccountHelp({ id, label }: { id: string; label: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'link' | 'password'>('');
  const [result, setResult] = useState<HelpResult | null>(null);
  const go = async (kind: 'link' | 'password') => {
    const ask =
      kind === 'link'
        ? `Make a password reset link for ${label}? Check on WhatsApp that it’s really them first. Any older link stops working.`
        : `Set a temporary password for ${label}? Check on WhatsApp that it’s really them first. A reset link is safer: only they will know the new password.`;
    if (!window.confirm(ask)) return;
    setBusy(kind);
    setResult(null);
    const res = await fetch('/api/admin/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: kind === 'link' ? 'account.resetLink' : 'account.resetPassword', id }),
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    setBusy('');
    if (!res?.ok) return toast(out?.error || 'That didn’t work.', 'error');
    setResult({ kind, who: out.who, whatsapp: out.whatsapp, text: out.text, secret: kind === 'link' ? out.url : out.password });
    toast(out.message);
    router.refresh();
  };
  return (
    <div className="stack" style={{ ['--stack' as string]: '10px' }}>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary sm" type="button" disabled={Boolean(busy)} onClick={() => go('link')}>
          {busy === 'link' ? 'Making link…' : 'Send reset link'}
        </button>
        <button className="btn sm" type="button" disabled={Boolean(busy)} onClick={() => go('password')}>
          {busy === 'password' ? 'Setting…' : 'Set temporary password'}
        </button>
      </div>
      {result && (
        <div className="note ok" role="status">
          <span>
            {result.kind === 'link' ? (
              <>
                Send this link to <strong>{result.who}</strong>. They choose their own new password; it works once, for 24 hours.
              </>
            ) : (
              <>
                <strong>{result.who}</strong> can now log in with <strong className="mono-pw">{result.secret}</strong>. Send it only to them.
              </>
            )}
            <span className="row" style={{ marginTop: 10 }}>
              {result.whatsapp && (
                <a className="btn sm primary" href={`https://wa.me/${result.whatsapp}?text=${encodeURIComponent(result.text)}`} target="_blank" rel="noopener noreferrer">
                  Send on WhatsApp
                </a>
              )}
              <CopyButton text={result.text} label="Copy message" />
              {result.kind === 'link' && <CopyButton text={result.secret} label="Copy link" />}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
