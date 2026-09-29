'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useHydrated } from '@/lib/hooks';
import { demoDraft } from '@/lib/demo';
import { loadGuestDraft } from '@/lib/guest';
import { hasMeaningfulDraft, type Draft } from '@/lib/memorial';
import { MemorialView } from './MemorialView';

/** /m/preview: the guest's own browser draft if there is one, otherwise the example memorial. */
export function GuestPreview() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const demo = params.get('demo') === '1';
  const state = useMemo<{ draft: Draft; own: boolean } | null>(() => {
    if (!hydrated) return null;
    const own = loadGuestDraft();
    const useOwn = !demo && hasMeaningfulDraft(own);
    return { draft: useOwn ? own : demoDraft(), own: useOwn };
  }, [hydrated, demo]);
  if (!state) return <div className="memorial" aria-busy="true" />;
  return (
    <MemorialView
      draft={state.draft}
      path="/m/preview?demo=1"
      banner={
        <div className="preview-bar">
          <div className="container">
            <span>{state.own ? 'Preview of your guest draft. Only you can see this.' : 'Example memorial. The funeral is set to today so you can see Live Funeral Mode.'}</span>
            <Link href="/create">{state.own ? '← Back to editing' : 'Create your own →'}</Link>
          </div>
        </div>
      }
    />
  );
}
