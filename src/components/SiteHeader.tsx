import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/config';
import { getSessionUser } from '@/lib/supabase/server';
import { Brand } from './Brand';

export async function SiteHeader() {
  const user = isSupabaseConfigured() ? await getSessionUser() : null;
  return (
    <header className="site-header">
      <div className="container bar">
        <Brand />
        <nav className="site-nav" aria-label="Main">
          <Link className="btn ghost hide-sm" href="/m/preview">
            See an example
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
              <Link className="btn primary" href="/create">
                Create a memorial
              </Link>
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
        <span>Create · Coordinate · Share · Preserve</span>
      </div>
    </footer>
  );
}
