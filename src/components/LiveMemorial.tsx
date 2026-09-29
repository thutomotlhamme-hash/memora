'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { localDateKey, type Draft } from '@/lib/memorial';

// Guests' pages on the funeral day. The coordinator reshuffles the programme,
// starts items and pushes times back on /run/<token>; guests with the memorial
// open see it within half a minute, without reloading.

export type LiveData = { journey: Draft['journey']; programme: Draft['programme']; liveKey: string | null };

const LiveContext = createContext<LiveData | null>(null);
const POLL_MS = 25_000;

export function LiveProvider({ slug, initial, children }: { slug: string; initial: LiveData; children: React.ReactNode }) {
  const [data, setData] = useState<LiveData>(initial);

  useEffect(() => {
    let stopped = false;
    const shouldPoll = (d: LiveData) => Boolean(d.liveKey) || d.journey.some((s) => s.date === localDateKey());
    let current = initial;

    const tick = async () => {
      if (stopped || document.hidden || !shouldPoll(current)) return;
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as LiveData;
        if (stopped || !Array.isArray(body.journey) || !body.programme) return;
        current = { journey: body.journey, programme: body.programme, liveKey: body.liveKey ?? null };
        setData(current);
      } catch {
        // Offline for a moment: keep showing what we have.
      }
    };
    const t = setInterval(() => void tick(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug, initial]);

  return <LiveContext.Provider value={data}>{children}</LiveContext.Provider>;
}

/** The freshest funeral-day data: live when inside a LiveProvider, else the page's own. */
export function useLiveData(fallback: LiveData): LiveData {
  return useContext(LiveContext) ?? fallback;
}
