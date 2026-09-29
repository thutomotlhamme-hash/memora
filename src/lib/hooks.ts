'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** false during SSR and hydration, true afterwards. For browser-only values. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** window.location.origin in the browser, '' on the server. */
export function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => '',
  );
}

function subscribeMinute(callback: () => void) {
  const t = setInterval(callback, 15_000);
  return () => clearInterval(t);
}
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);

/** The current minute (re-renders when it changes); null on the server. */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeMinute, minuteSnapshot, () => null);
  return minute == null ? null : new Date();
}
