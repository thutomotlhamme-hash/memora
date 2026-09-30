'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CopyField } from '@/components/Share';
import { useToast } from '@/components/Toast';
import { createMemorial } from '@/lib/memorials-client';

/** Starts a memorial in one of the home's branches (a short menu when there are several), then opens it. */
export function NewHomeMemorial({ orgId, branches }: { orgId: string; branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!branches.length) return null;
  const start = async (branch: string) => {
    setBusy(true);
    try {
      const id = await createMemorial(undefined, orgId, branch);
      router.push(`/memorials/${id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start the memorial.', 'error');
      setBusy(false);
    }
  };
  if (branches.length === 1)
    return (
      <button className="btn primary" type="button" disabled={busy} onClick={() => start(branches[0].id)}>
        {busy ? 'Starting…' : '+ New memorial'}
      </button>
    );
  return (
    <details className="st-menu st-new">
      <summary className="btn primary">{busy ? 'Starting…' : '+ New memorial'}</summary>
      <div className="st-menu-list right">
        <span className="st-menu-note">Which branch is it for?</span>
        {branches.map((b) => (
          <button key={b.id} type="button" className="st-menu-btn" disabled={busy} onClick={() => start(b.id)}>
            {b.name}
          </button>
        ))}
      </div>
    </details>
  );
}

/** Publishes a funeral home's finished memorial (its arrangers, managers and owners). */
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
        const res = await fetch(`/api/memorials/${caseId}/publish`, {
          method: 'POST',
        }).catch(() => null);
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

/** The run-sheet link for a funeral the arranger is running. */
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
        const res = await fetch(`/api/memorials/${caseId}/run-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(() => null);
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
