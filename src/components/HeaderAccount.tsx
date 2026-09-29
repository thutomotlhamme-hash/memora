'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

// The signed-in part of the header, worked out in the browser so the pages
// around it can be served straight from the CDN instead of rendered per visit.

type State = { known: boolean; userId: string | null; team: boolean };
let state: State = { known: false, userId: null, team: false };
const listeners = new Set<() => void>();
let started = false;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

async function teamFor(userId: string): Promise<boolean> {
  const key = `memora:team:${userId}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return cached === '1';
  } catch {
    /* storage blocked */
  }
  const res = await fetch('/api/account/me').catch(() => null);
  const body = res?.ok ? await res.json().catch(() => null) : null;
  const team = Boolean(body?.team);
  try {
    sessionStorage.setItem(key, team ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  return team;
}

function start() {
  if (started) return;
  started = true;
  const supabase = getBrowserSupabase();
  if (!supabase) return set({ known: true });
  const apply = (userId: string | null) => {
    if (userId === state.userId && state.known) return;
    set({ known: true, userId, team: false });
    if (userId) void teamFor(userId).then((team) => state.userId === userId && set({ team }));
  };
  void supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user;
    apply(u && !u.is_anonymous ? u.id : null);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    apply(u && !u.is_anonymous ? u.id : null);
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const serverState: State = { known: false, userId: null, team: false };

export function HeaderAccount({ hideCreate }: { hideCreate: boolean }) {
  const s = useSyncExternalStore(subscribe, () => state, () => serverState);
  useEffect(start, []);

  if (!s.known) return <span className="nav-pending" aria-hidden="true" />;
  if (s.userId)
    return (
      <>
        {s.team && (
          <Link className="btn ghost" href="/admin">
            Admin
          </Link>
        )}
        <Link className="btn ghost" href="/account">
          Account
        </Link>
        <Link className="btn primary" href="/memorials">
          My memorials
        </Link>
      </>
    );
  return (
    <>
      <Link className="btn ghost" href="/account/login">
        Log in
      </Link>
      {!hideCreate && (
        <Link className="btn primary" href="/create">
          Create a memorial
        </Link>
      )}
    </>
  );
}
