'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

/** The group's master logo: upload a PNG, JPG or WebP (up to 5 MB). */
export function GroupLogoUpload({ accountId, logoUrl }: { accountId: string; logoUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="gc-logo">
      <div className="gc-logo-box">{logoUrl ? <img src={logoUrl} alt="The group’s logo" /> : <span>No logo yet</span>}</div>
      <label className="btn sm">
        {busy ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            const body = new FormData();
            body.set('accountId', accountId);
            body.set('file', file);
            const res = await fetch('/api/pro/logo', { method: 'POST', body }).catch(() => null);
            const out = res ? await res.json().catch(() => ({})) : {};
            setBusy(false);
            toast(out?.message || out?.error || (res?.ok ? 'Logo saved.' : 'Could not upload the logo.'), res?.ok ? 'info' : 'error');
            if (res?.ok) router.refresh();
          }}
        />
      </label>
    </div>
  );
}
