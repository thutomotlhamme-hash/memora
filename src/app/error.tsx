'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Anything that breaks while a page renders lands here, calmly, with a way back. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="status-screen" role="alert">
      <div className="inner">
        <span className="eyebrow">Something went wrong</span>
        <h1 className="h1">This page didn’t load properly.</h1>
        <p>Nothing you entered has been lost. Try again, or go back to the start. If it keeps happening, WhatsApp us and we’ll sort it out.</p>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn primary" type="button" onClick={reset}>
            Try again
          </button>
          <Link className="btn" href="/">
            Go to Memora
          </Link>
        </div>
      </div>
    </div>
  );
}
