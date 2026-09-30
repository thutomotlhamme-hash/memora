'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CopyField } from '@/components/Share';
import { useToast } from '@/components/Toast';
import { createMemorial } from '@/lib/memorials-client';

/** Starts a memorial that belongs to the funeral home, then opens it. */
export function NewHomeMemorial({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn primary"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const id = await createMemorial(undefined, orgId);
          router.push(`/memorials/${id}`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Could not start the memorial.', 'error');
          setBusy(false);
        }
      }}
    >
      {busy ? 'Starting…' : `+ New memorial for ${name}`}
    </button>
  );
}

/** Publishes a funeral home's finished memorial (directors and managers). */
export function PublishForHome({ caseId }: { caseId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn sm accent"
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm('Publish this memorial? It goes live for guests and is billed to the funeral home.')) return;
        setBusy(true);
        const res = await fetch(`/api/memorials/${caseId}/publish`, { method: 'POST' }).catch(() => null);
        const body = res ? await res.json().catch(() => ({})) : {};
        setBusy(false);
        toast(res?.ok ? 'Published. The memorial is live.' : body?.error || 'Could not publish.', res?.ok ? 'info' : 'error');
        if (res?.ok) router.refresh();
      }}
    >
      {busy ? 'Publishing…' : 'Publish'}
    </button>
  );
}

/** The run-sheet link for a funeral the director is running. */
export function RunSheetFor({ caseId }: { caseId: string }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  if (url)
    return (
      <div className="pro-runlink">
        <CopyField value={url} />
        <a className="btn sm" href={url} target="_blank" rel="noopener noreferrer">
          Open ↗
        </a>
      </div>
    );
  return (
    <button
      className="btn sm"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/memorials/${caseId}/run-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
        const body = res ? await res.json().catch(() => ({})) : {};
        setBusy(false);
        if (res?.ok && body.url) setUrl(body.url);
        else toast(body?.error || 'Could not get the run-sheet link.', 'error');
      }}
    >
      {busy ? '…' : 'Run-sheet'}
    </button>
  );
}
