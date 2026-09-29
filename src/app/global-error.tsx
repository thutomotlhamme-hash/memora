'use client';

/** Last resort when even the layout fails: plain, readable and with a way to retry. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fbfaf8', color: '#1e1a24', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div role="alert">
          <p style={{ color: '#5b3e8c', fontWeight: 600 }}>Memora</p>
          <h1 style={{ fontWeight: 500 }}>Something went wrong.</h1>
          <p>Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 20px', borderRadius: 999, border: 0, background: '#5b3e8c', color: '#fff', fontSize: 16 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
