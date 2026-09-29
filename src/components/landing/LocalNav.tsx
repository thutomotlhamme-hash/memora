'use client';

import { useEffect, useRef, useState } from 'react';
import { Brand } from '../Brand';
import { HeaderAccount } from '../HeaderAccount';

/**
 * The home page's one header: the brand, the page's sections and the account
 * links in a single bar. Clear at rest; once it sticks to the top it turns into
 * frosted glass with a hairline.
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
      <header className={`local-nav${stuck ? ' stuck' : ''}`}>
        <div className="container local-nav-bar">
          <Brand />
          <nav className="local-links" aria-label="On this page">
            {links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="local-account">
            <HeaderAccount hideCreate={false} />
          </div>
        </div>
      </header>
    </>
  );
}
