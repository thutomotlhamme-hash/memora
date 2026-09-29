'use client';

import { useEffect } from 'react';

/**
 * Apple-style scroll reveals. Any element with `.reveal` fades up the first
 * time it scrolls into view; `style={{ '--d': '0.1s' }}` staggers siblings.
 * The `js` class is set before first paint (see layout), so without JavaScript
 * everything is simply visible.
 */
export function RevealObserver() {
  useEffect(() => {
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    const scan = () => {
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
