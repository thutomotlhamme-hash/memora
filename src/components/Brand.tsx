import Link from 'next/link';

/** The journey-line M: one continuous path between two pins, jacaranda to candle. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path className="brand-path" d="M8 32V10l12 16L32 10v22" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="32" r="3.8" fill="currentColor" />
      <circle cx="32" cy="32" r="3.8" fill="var(--candle)" />
    </svg>
  );
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Memora home">
      <BrandMark />
      <span className="brand-word">Memora</span>
    </Link>
  );
}
