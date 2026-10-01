'use client';

import Link from 'next/link';
import { NotificationBell } from './NotificationBell';
import { MenuGuard } from './pro/MenuGuard';
import { useEffect, useSyncExternalStore } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

// The signed-in part of the header, worked out in the browser so the pages
// around it can be served straight from the CDN instead of rendered per visit.

type State = { known: boolean; userId: string | null; team: boolean; pro: boolean; group?: boolean };
let state: State = { known: false, userId: null, team: false, pro: false };
const listeners = new Set<() => void>();
let started = false;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

type Access = { team: boolean; pro: boolean; group?: boolean };
const keyFor = (userId: string) => `memora:access:${userId}`;

function cachedAccess(userId: string): Access | null {
  try {
    const raw = sessionStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Access) : null;
  } catch {
    return null;
  }
}

/**
 * What this person may open: the command centre (team) and/or a funeral home's
 * dashboard (pro). The last answer shows at once; a fresh one is always fetched,
 * so being added to (or removed from) a group shows up on the next page.
 */
async function freshAccess(userId: string): Promise<Access | null> {
  const res = await fetch('/api/account/me', { cache: 'no-store' }).catch(() => null);
  const body = res?.ok ? await res.json().catch(() => null) : null;
  if (!body) return null;
  const out = { team: Boolean(body.team), pro: Boolean(body.pro), group: Boolean(body.group) };
  try {
    sessionStorage.setItem(keyFor(userId), JSON.stringify(out));
  } catch {
    /* storage blocked */
  }
  return out;
}

function start() {
  if (started) return;
  started = true;
  const supabase = getBrowserSupabase();
  if (!supabase) return set({ known: true });
  const apply = (userId: string | null) => {
    if (userId === state.userId && state.known) return;
    set({ known: true, userId, ...((userId && cachedAccess(userId)) || { team: false, pro: false }) });
    if (userId) void freshAccess(userId).then((a) => a && state.userId === userId && set(a));
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
const serverState: State = { known: false, userId: null, team: false, pro: false };

export function HeaderAccount({ hideCreate }: { hideCreate: boolean }) {
  const s = useSyncExternalStore(subscribe, () => state, () => serverState);
  useEffect(start, []);

  if (!s.known) return <span className="nav-pending" aria-hidden="true" />;
  if (s.userId) {
    const more = [
      s.team && { href: '/admin', label: 'Command centre' },
      s.group && { href: '/pro/group', label: 'Group' },
      s.pro && { href: '/pro/dashboard', label: 'Funeral home' },
      { href: '/account', label: 'Account' },
    ].filter((l): l is { href: string; label: string } => Boolean(l));
    return (
      <>
        <MenuGuard />
        {/* Wide screens: every link in the bar. Phones: the same links behind one Menu button. */}
        <span className="nav-wide">
          {more.map((l) => (
            <Link key={l.href} className="btn ghost" href={l.href}>
              {l.label}
            </Link>
          ))}
        </span>
        <NotificationBell />
        <details className="st-menu nav-more">
          <summary>Menu</summary>
          <div className="st-menu-list right">
            {more.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </details>
        <Link className="btn primary" href="/memorials">
          My memorials
        </Link>
      </>
    );
  }
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
