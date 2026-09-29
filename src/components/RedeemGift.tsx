'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from './Toast';

export function RedeemGift({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn on-night primary lg"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch('/api/gifts/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.id) {
          toast(body?.error || 'Could not open the gift.', 'error');
          setBusy(false);
          return;
        }
        router.push(`/memorials/${body.id}`);
      }}
    >
      {busy ? 'Opening…' : 'Start the memorial'}
    </button>
  );
}
