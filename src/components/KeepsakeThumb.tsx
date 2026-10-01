'use client';

import { useEffect, useRef, useState } from 'react';
import type { Draft } from '@/lib/memorial';
import type { PrintBrand, ThumbKind } from '@/lib/artifacts';

// A small, real preview of a keepsake: the actual card or cover, drawn from the
// live memorial. Drawn only when it scrolls into view, one at a time so the
// page stays smooth, and remembered while the page is open.

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

function draw(kind: ThumbKind, draft: Draft, url: string, brand: PrintBrand | null, width: number): Promise<string> {
  const key = `${kind}|${width}|${url}|${brand?.name ?? ''}|${JSON.stringify(draft)}`;
  if (!cache.has(key)) {
    const job = queue.then(async () => {
      const A = await import('@/lib/artifacts');
      return A.thumbnail(kind, { draft, url, brand }, width);
    });
    queue = job.catch(() => undefined);
    cache.set(key, job);
    job.catch(() => cache.delete(key));
  }
  return cache.get(key)!;
}

export function KeepsakeThumb({
  kind,
  draft,
  url,
  brand = null,
  width = 520,
  alt,
  className = '',
}: {
  kind: ThumbKind;
  draft: Draft;
  url: string;
  brand?: PrintBrand | null;
  width?: number;
  alt: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || !url) return;
    let live = true;
    const start = () =>
      draw(kind, draft, url, brand, width).then(
        (s) => live && setSrc(s),
        () => live && setFailed(true),
      );
    if (!('IntersectionObserver' in window)) {
      void start();
      return () => {
        live = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [kind, draft, url, brand, width]);
  return (
    <div ref={box} className={`ks-thumb ${className}${src ? ' ready' : failed ? ' failed' : ''}`}>
      {src ? <img src={src} alt={alt} /> : <span className="ks-thumb-wait" aria-hidden="true" />}
    </div>
  );
}
