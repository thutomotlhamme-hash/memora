import Link from 'next/link';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Memora home">
      <span className="brand-mark" aria-hidden="true">M</span>
      <span className="brand-word">Memora</span>
    </Link>
  );
}
