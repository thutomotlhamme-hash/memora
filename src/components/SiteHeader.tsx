import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/config';
import { getSessionUser } from '@/lib/supabase/server';
import { Brand } from './Brand';

/** `hideCreate` drops the "Create a memorial" button on pages where you're already creating one. */
export async function SiteHeader({ hideCreate = false }: { hideCreate?: boolean } = {}) {
  const user = isSupabaseConfigured() ? await getSessionUser() : null;
  return (
    <header className="site-header">
      <div className="container bar">
        <Brand />
        <nav className="site-nav" aria-label="Main">
          <Link className="btn ghost hide-sm" href="/m/preview">
            See an example
          </Link>
          <Link className="btn ghost hide-sm" href="/gift">
            Give a memorial
          </Link>
          {user ? (
            <>
              <Link className="btn ghost" href="/account">
                Account
              </Link>
              <Link className="btn primary" href="/memorials">
                My memorials
              </Link>
            </>
          ) : (
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
          )}
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
          <Link href="/gift">Give a memorial</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact us</Link>
        </nav>
      </div>
    </footer>
  );
}
