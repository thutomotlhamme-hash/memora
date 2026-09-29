'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Get the highlights": a horizontal row of large white cards that advances on
 * its own while in view, with dots and a play/pause pill. Swipe or scroll it too.
 * Autoplay stays off for people who prefer reduced motion.
 */
export function Highlights({ children, labels }: { children: React.ReactNode[]; labels: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(false);
  const count = children.length;

  // Start playing once, unless the viewer prefers reduced motion.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setPlaying(!reduce), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = Array.from(el.children) as HTMLElement[];
        const left = el.scrollLeft + el.clientWidth * 0.3;
        let i = 0;
        cards.forEach((c, idx) => {
          if (c.offsetLeft - el.offsetLeft <= left) i = idx;
        });
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) i = cards.length - 1;
        setActive(i);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const go = useCallback((i: number) => {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;
    const t = setTimeout(() => go(active + 1 >= count ? 0 : active + 1), 5200);
    return () => clearTimeout(t);
  }, [playing, inView, active, count, go]);

  return (
    <div className="hl">
      <div
        ref={track}
        className="hl-track"
        onPointerDown={() => setPlaying(false)}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) setPlaying(false);
        }}
      >
        {children.map((c, i) => (
          <div key={labels[i]} className={`hl-item${i === active ? ' on' : ''}`} aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${labels[i]}`}>
            {c}
          </div>
        ))}
      </div>
      <div className="hl-controls">
        <div className="hl-dots" role="tablist" aria-label="Highlights">
          {labels.map((l, i) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={l}
              className={i === active ? 'on' : ''}
              onClick={() => {
                setPlaying(false);
                go(i);
              }}
            >
              <span style={i === active && playing && inView ? { animationDuration: '5.2s' } : undefined} className={i === active && playing && inView ? 'fill' : ''} />
            </button>
          ))}
        </div>
        <button type="button" className="hl-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="3" y="2" width="2.6" height="10" rx="1" fill="currentColor" />
              <rect x="8.4" y="2" width="2.6" height="10" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M4 2.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L4.9 1.7A.6.6 0 0 0 4 2.2Z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
