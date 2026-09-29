import Link from 'next/link';
import { contact } from '@/lib/config';
import { SiteFooter, SiteHeader } from './SiteHeader';

export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="narrow legal">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="h1" style={{ margin: '12px 0 8px' }}>
          {title}
        </h1>
        <p className="small muted">Last updated {updated}</p>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

/** The email if one is configured, otherwise the contact form. */
export function ContactLink() {
  return contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : <Link href="/contact">our contact form</Link>;
}
