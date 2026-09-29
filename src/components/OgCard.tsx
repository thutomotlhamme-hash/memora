// Shared 1200×630 link-preview card (WhatsApp, Facebook, X, LinkedIn), rendered by next/og.
export function OgCard({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#ffffff', padding: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: '#1d1d1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 600, color: '#ffffff' }}>
          M
        </div>
        <div style={{ fontSize: 36, color: '#1d1d1f', fontWeight: 600 }}>Memora</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 30, color: '#b64400', fontWeight: 600 }}>{kicker}</div>
        <div style={{ fontSize: 84, lineHeight: 1.05, color: '#1d1d1f', letterSpacing: -2, fontWeight: 600, marginTop: 18, maxWidth: 980 }}>{title}</div>
        <div style={{ fontSize: 32, color: '#6e6e73', marginTop: 24, maxWidth: 940, lineHeight: 1.35 }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', height: 10, width: 180, background: '#0071e3', borderRadius: 5 }} />
    </div>
  );
}
