'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from './Toast';

export function AdminGiftActions({ giftId, whatsapp, text, link }: { giftId: string; whatsapp: string; text: string; link: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <a className="btn sm primary" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      {link && (
        <button
          className="btn sm"
          type="button"
          onClick={() => navigator.clipboard.writeText(link).then(() => toast('Gift link copied.'), () => toast('Copy failed.', 'error'))}
        >
          Copy link
        </button>
      )}
      <button
        className="btn sm ghost"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/admin/gifts/${giftId}/contacted`, { method: 'POST' });
          setBusy(false);
          if (!res.ok) return toast('Could not save.', 'error');
          toast('Marked as contacted.');
          router.refresh();
        }}
      >
        Mark contacted
      </button>
    </div>
  );
}
