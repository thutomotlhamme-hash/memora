// Shared 1200×630 link-preview card (WhatsApp, Facebook, X, LinkedIn), rendered by next/og.
export function OgCard({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#faf9f5', padding: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, border: '2px solid #141413', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#141413' }}>
          M
        </div>
        <div style={{ fontSize: 38, color: '#141413', letterSpacing: -1 }}>Memora</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 24, letterSpacing: 4, color: '#9f4829', textTransform: 'uppercase', fontWeight: 700 }}>{kicker}</div>
        <div style={{ fontSize: 84, lineHeight: 1.02, color: '#141413', letterSpacing: -3, marginTop: 18, maxWidth: 980 }}>{title}</div>
        <div style={{ fontSize: 32, color: '#3d3d3a', marginTop: 24, maxWidth: 940, lineHeight: 1.35 }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', height: 10, width: 180, background: '#b5552f', borderRadius: 5 }} />
    </div>
  );
}
