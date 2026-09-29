'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHydrated } from '@/lib/hooks';
import { clearGuestDraft, loadGuestDraft } from '@/lib/guest';
import { displayName, hasMeaningfulDraft, type Draft } from '@/lib/memorial';
import { useToast } from './Toast';

async function createMemorial(draft?: Draft): Promise<string> {
  const res = await fetch('/api/memorials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft ? { draft } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.id) throw new Error(body?.error || 'Could not create the memorial.');
  return body.id as string;
}

export function NewMemorialButton({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const start = async () => {
    setBusy(true);
    try {
      const id = await createMemorial();
      router.push(`/memorials/${id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create the memorial.', 'error');
      setBusy(false);
    }
  };

  useEffect(() => {
    // Arriving from "Create a memorial" with no memorials and no guest draft: go straight in.
    if (autoStart && !started.current && !hasMeaningfulDraft(loadGuestDraft())) {
      started.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <button className="btn primary lg" type="button" onClick={start} disabled={busy}>
      {busy ? 'Creating…' : '+ New memorial'}
    </button>
  );
}

/** Offers to move a memorial started as a guest in this browser into the account. */
export function GuestImport() {
  const router = useRouter();
  const toast = useToast();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const draft = useMemo<Draft | null>(() => {
    if (!hydrated) return null;
    const d = loadGuestDraft();
    return hasMeaningfulDraft(d) ? d : null;
  }, [hydrated]);
  if (!draft || dismissed) return null;

  return (
    <div className="card tint" style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <span className="eyebrow">Draft found in this browser</span>
        <h2 className="h3" style={{ margin: '8px 0 4px' }}>
          Save “{displayName(draft.person, 'your guest memorial')}” to your account?
        </h2>
        <p className="muted small" style={{ margin: 0 }}>
          It moves the story, journey, programme and photo into your private account and removes the copy from this browser.
        </p>
      </div>
      <div className="row">
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm('Discard the guest draft stored in this browser? This cannot be undone.')) {
              clearGuestDraft();
              setDismissed(true);
            }
          }}
        >
          Discard
        </button>
        <button
          className="btn primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const id = await createMemorial(draft);
              clearGuestDraft();
              toast('Draft saved to your account.');
              router.push(`/memorials/${id}`);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not save the draft.', 'error');
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : 'Save to my account'}
        </button>
      </div>
    </div>
  );
}
