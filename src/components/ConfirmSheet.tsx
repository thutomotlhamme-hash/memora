'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * A short, calm pop-up before a step that matters: what happens, in plain
 * words, and (when it's a promise the person makes) a box they tick before
 * the button works. Escape or "Not yet" closes it; nothing happens.
 */
export function ConfirmSheet({
  open,
  title,
  points,
  check,
  confirm,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  /** What will happen, one short line each. */
  points: React.ReactNode[];
  /** A promise the person ticks before going on. */
  check?: React.ReactNode;
  confirm: string;
  tone?: 'primary' | 'accent' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const uid = useId();
  const [ticked, setTicked] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    card.current?.querySelector<HTMLElement>('input, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="confirm-sheet" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={onCancel}>
      <div className="confirm-card" ref={card} onClick={(e) => e.stopPropagation()}>
        <h2 id={`${uid}-t`} className="h3">
          {title}
        </h2>
        <ul className="confirm-points">
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
        {children}
        {check && (
          <label className="confirm-check">
            <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
            <span>{check}</span>
          </label>
        )}
        <div className="confirm-actions">
          <button className="btn" type="button" onClick={onCancel}>
            Not yet
          </button>
          <button className={`btn ${tone}`} type="button" disabled={busy || (Boolean(check) && !ticked)} onClick={onConfirm}>
            {busy ? 'One moment…' : confirm}
          </button>
        </div>
        {check && !ticked && <p className="confirm-hint">Tick the box above to continue.</p>}
      </div>
    </div>
  );
}
