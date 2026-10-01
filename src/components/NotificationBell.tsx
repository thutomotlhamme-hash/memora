'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Item = { id: string; kind: string; tone: 'info' | 'action' | 'warn' | 'good'; title: string; body: string; href: string; createdAt: string; read: boolean };

const POLL_MS = 60_000;

async function fetchNotes(sync: boolean): Promise<{ items?: Item[]; unread?: number } | null> {
  const res = await fetch(`/api/notifications${sync ? '?sync=1' : ''}`, { cache: 'no-store' }).catch(() => null);
  return res?.ok ? res.json().catch(() => null) : null;
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/**
 * The bell: what needs this person, for their role. It checks their situations
 * (a funeral close by, a first year ending) when it loads and when opened, and
 * quietly refreshes the count every minute while the page is in view.
 */
export function NotificationBell({ tone = 'light' }: { tone?: 'light' | 'studio' }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const apply = useCallback((body: { items?: Item[]; unread?: number } | null) => {
    if (!body) return;
    setItems(body.items ?? []);
    setUnread(body.unread ?? 0);
  }, []);
  const load = useCallback((sync = false) => fetchNotes(sync).then(apply), [apply]);

  useEffect(() => {
    let live = true;
    const get = (sync: boolean) =>
      fetchNotes(sync).then((b) => {
        if (live) apply(b);
      });
    void get(true);
    const tick = () => {
      if (!document.hidden) void get(false);
    };
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      live = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [apply]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const mark = async (id: string) => {
    const res = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null);
    apply(res?.ok ? await res.json().catch(() => null) : null);
  };

  return (
    <div className={`bell ${tone}`} ref={box}>
      <button
        type="button"
        className="bell-btn"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load(true);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6 1.8 6H4.2S6 14 6 9.5Z" />
          <path d="M10 19a2.2 2.2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="bell-all" onClick={() => void mark('all')}>
                Mark all read
              </button>
            )}
          </header>
          <div className="bell-list">
            {items.length === 0 && <p className="bell-empty">You’re all caught up. We’ll let you know when something needs you.</p>}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`bell-item ${n.tone}${n.read ? ' read' : ''}`}
                onClick={() => {
                  if (!n.read) void mark(n.id);
                  if (n.href) {
                    setOpen(false);
                    router.push(n.href);
                  }
                }}
              >
                <span className="bell-dot" aria-hidden="true" />
                <span className="bell-text">
                  <strong>{n.title}</strong>
                  {n.body && <span>{n.body}</span>}
                  <small>{ago(n.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
