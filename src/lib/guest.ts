'use client';

import { emptyDraft, hasMeaningfulDraft, normaliseDraft, type Draft } from './memorial';

// Guest drafts never leave the browser until the person creates an account.
const KEY = 'memora:v2:guest-draft';

export function loadGuestDraft(): Draft {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normaliseDraft(JSON.parse(raw)) : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

/** Returns false when the browser refused to store it (private mode or full storage). */
export function saveGuestDraft(draft: Draft): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearGuestDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export function hasGuestDraft(): boolean {
  return hasMeaningfulDraft(loadGuestDraft());
}
