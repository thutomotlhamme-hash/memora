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
