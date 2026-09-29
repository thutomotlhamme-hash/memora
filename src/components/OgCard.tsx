// Shared 1200×630 link-preview card (WhatsApp, Facebook, X, LinkedIn), rendered by next/og.
export function OgCard({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fbfaf8', padding: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="52" height="52" viewBox="0 0 40 40">
          <path d="M8 32V10l12 16L32 10v22" fill="none" stroke="#5b3e8c" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="32" r="3.8" fill="#5b3e8c" />
          <circle cx="32" cy="32" r="3.8" fill="#e8a94a" />
        </svg>
        <div style={{ fontSize: 36, color: '#1e1a24', fontWeight: 600 }}>Memora</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 30, color: '#5b3e8c', fontWeight: 600 }}>{kicker}</div>
        <div style={{ fontSize: 84, lineHeight: 1.05, color: '#1e1a24', letterSpacing: -2, fontWeight: 600, marginTop: 18, maxWidth: 980 }}>{title}</div>
        <div style={{ fontSize: 32, color: '#6b6475', marginTop: 24, maxWidth: 940, lineHeight: 1.35 }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', height: 10, width: 180, background: '#5b3e8c', borderRadius: 5 }} />
    </div>
  );
}
