import Link from 'next/link';
import { paymentsOn } from '@/lib/config';
import { Brand } from './Brand';
import { HeaderAccount } from './HeaderAccount';

/** `hideCreate` drops the "Create a memorial" button on pages where you're already creating one. */
export function SiteHeader({ hideCreate = false, sticky = true }: { hideCreate?: boolean; sticky?: boolean } = {}) {
  return (
    <header className={`site-header${sticky ? '' : ' static'}`}>
      <div className="container bar">
        <Brand />
        <nav className="site-nav" aria-label="Main">
          <Link className="btn ghost hide-sm" href="/m/preview">
            See an example
          </Link>
          {paymentsOn && (
            <Link className="btn ghost hide-sm" href="/gift">
              Give a memorial
            </Link>
          )}
          <HeaderAccount hideCreate={hideCreate} />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container bar">
        <span>Memora · Remember beautifully</span>
        <nav className="row" aria-label="Footer" style={{ gap: 18 }}>
          {paymentsOn && <Link href="/gift">Give a memorial</Link>}
          <Link href="/pro">For funeral homes</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact us</Link>
        </nav>
      </div>
    </footer>
  );
}
