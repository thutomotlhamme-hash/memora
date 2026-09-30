'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { localDateKey, withPrayers, type Draft } from '@/lib/memorial';
import type { PublicProcession } from '@/lib/procession';

// Guests' pages follow the coordinator. The coordinator starts items, finishes the
// vigil or the funeral and pushes times back on /run/<token>; every open memorial
// picks it up within seconds, without reloading, and again the moment the phone
// comes back to the page.

export type LiveData = {
  journey: Draft['journey'];
  programme: Draft['programme'];
  liveKey: string | null;
  procession?: PublicProcession | null;
  prayers?: Draft['prayers'];
};

const LiveContext = createContext<LiveData | null>(null);
/**
 * How often guests' pages check in: every few seconds on the day (with the CDN's
 * 2-second cache, a change reaches every guest within about 5 seconds), gently
 * the rest of the time.
 */
const RUNNING_POLL_MS = 3_000;
const DAY_POLL_MS = 3_000;
const QUIET_POLL_MS = 60_000;

function pollEvery(d: LiveData): number {
  if (d.procession?.state === 'moving' || (d.liveKey && !d.liveKey.startsWith('ended:'))) return RUNNING_POLL_MS;
  const today = localDateKey();
  return d.liveKey || d.procession || withPrayers(d.journey, d.prayers).some((s) => s.date === today) ? DAY_POLL_MS : QUIET_POLL_MS;
}

export function LiveProvider({ slug, initial, children }: { slug: string; initial: LiveData; children: React.ReactNode }) {
  const [data, setData] = useState<LiveData>(initial);

  useEffect(() => {
    let stopped = false;
    let current = initial;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as LiveData;
        if (stopped || !Array.isArray(body.journey) || !body.programme) return;
        current = { journey: body.journey, programme: body.programme, liveKey: body.liveKey ?? null, procession: body.procession ?? null, prayers: body.prayers ?? current.prayers };
        setData(current);
      } catch {
        // Offline for a moment: keep showing what we have.
      }
    };
    const loop = async () => {
      await tick();
      if (!stopped) timer = setTimeout(() => void loop(), pollEvery(current));
    };
    void loop();
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug, initial]);

  return <LiveContext.Provider value={data}>{children}</LiveContext.Provider>;
}

/** The freshest funeral-day data: live when inside a LiveProvider, else the page's own. */
export function useLiveData(fallback: LiveData): LiveData {
  return useContext(LiveContext) ?? fallback;
}
