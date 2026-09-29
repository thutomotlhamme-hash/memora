'use client';

import { clearGuestDraft, loadGuestDraft } from './guest';
import { hasMeaningfulDraft, type Draft } from './memorial';

export async function createMemorial(draft?: Draft): Promise<string> {
  const res = await fetch('/api/memorials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft ? { draft } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.id) throw new Error(body?.error || 'Could not create the memorial.');
  return body.id as string;
}

/**
 * Right after someone signs in from the guest editor: move the draft from this
 * browser into their account and return where to continue. Null when there was
 * nothing to move.
 */
export async function moveGuestDraftIntoAccount(step?: string | null): Promise<string | null> {
  const draft = loadGuestDraft();
  if (!hasMeaningfulDraft(draft)) return null;
  const id = await createMemorial(draft);
  clearGuestDraft();
  return `/memorials/${id}${step ? `?step=${encodeURIComponent(step)}` : ''}`;
}
