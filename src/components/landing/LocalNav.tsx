'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * The product bar under the global header. Transparent at rest; once it sticks
 * to the top it turns into frosted glass with a hairline, like Apple's.
 */
export function LocalNav({ links }: { links: { href: string; label: string }[] }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
      <nav className={`local-nav${stuck ? ' stuck' : ''}`} aria-label="Memora">
        <div className="container local-nav-bar">
          <a className="local-title" href="#top">
            Memora
          </a>
          <div className="local-links">
            {links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
            <Link className="btn primary sm local-cta" href="/create">
              Create
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
