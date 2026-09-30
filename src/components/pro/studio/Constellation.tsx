// Memora's constellation: a quiet field of falling jacaranda petals and candle
// lights for the night stage. Deterministic (seeded), so server and browser draw
// the same sky, and light enough to sit behind text.

const PALETTE = ['#c9b8e8', '#a78bd4', '#e8a94a', '#f4f1f8', '#8f6cc4', '#d9c9f0'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function Constellation({ seed = 7, count = 90, className = '' }: { seed?: number; count?: number; className?: string }) {
  const r = rng(seed);
  const items = Array.from({ length: count }, (_, i) => {
    // Denser towards the right and the middle, like a bough in bloom.
    // Gathered to the right, like a bough in bloom; a few strays drift left.
    const x = 420 - Math.pow(r(), 1.35) * 410;
    const y = 8 + Math.pow(r(), 1.2) * 284;
    const kind = r();
    return { i, x, y, rot: Math.round(r() * 360), size: 1.8 + r() * 3, color: PALETTE[Math.floor(r() * PALETTE.length)], o: 0.3 + r() * 0.55, kind, d: (r() * 6).toFixed(2) };
  });
  return (
    <svg className={`constellation ${className}`} viewBox="0 0 420 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {items.map((p) =>
        p.kind < 0.62 ? (
          // A petal: a soft almond, stroked, never filled.
          <ellipse
            key={p.i}
            cx={p.x}
            cy={p.y}
            rx={p.size}
            ry={p.size * 0.48}
            transform={`rotate(${p.rot} ${p.x} ${p.y})`}
            fill="none"
            stroke={p.color}
            strokeWidth={0.7}
            opacity={p.o}
            style={{ animationDelay: `-${p.d}s` }}
          />
        ) : p.kind < 0.9 ? (
          <circle key={p.i} cx={p.x} cy={p.y} r={p.size * 0.22} fill={p.color} opacity={p.o} style={{ animationDelay: `-${p.d}s` }} />
        ) : (
          // A candle light: a warm point with a halo.
          <g key={p.i} opacity={p.o} style={{ animationDelay: `-${p.d}s` }}>
            <circle cx={p.x} cy={p.y} r={p.size * 0.9} fill="#e8a94a" opacity={0.18} />
            <circle cx={p.x} cy={p.y} r={p.size * 0.28} fill="#f3c77c" />
          </g>
        ),
      )}
    </svg>
  );
}
