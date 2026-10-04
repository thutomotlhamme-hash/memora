'use client';

import { useState } from 'react';
import { useToast } from '../Toast';

/** Start a small real payment through iKhokha, to see the whole flow work. */
export function TestPaymentButton({ ready }: { ready: boolean }) {
  const toast = useToast();
  const [amount, setAmount] = useState('5');
  const [busy, setBusy] = useState(false);
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/admin/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'payments.test', amount }) }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && typeof out.url === 'string' && out.url.startsWith('https://')) {
      window.location.href = out.url;
      return;
    }
    setBusy(false);
    toast(out.error || 'That didn’t work.', 'error');
  };
  return (
    <form className="test-pay-form" onSubmit={start}>
      <label htmlFor="test-amount" className="small">
        Amount (R2 to R50)
      </label>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <span className="test-pay-r">R</span>
        <input id="test-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} style={{ maxWidth: 110 }} />
        <button className="btn primary" type="submit" disabled={busy || !ready}>
          {busy ? 'Opening iKhokha…' : `Pay R${amount || '0'} with iKhokha`}
        </button>
      </div>
    </form>
  );
}
