'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from './Toast';

export function DeleteMemorial({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="text-link small muted"
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Delete the draft for ${name}? This removes its photo and details and cannot be undone.`)) return;
        setBusy(true);
        const res = await fetch(`/api/memorials/${id}`, { method: 'DELETE' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(body?.error || 'Could not delete this draft.', 'error');
          setBusy(false);
          return;
        }
        toast('Draft deleted.');
        router.replace('/memorials');
        router.refresh();
      }}
    >
      Delete this draft
    </button>
  );
}
