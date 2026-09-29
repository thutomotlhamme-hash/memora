import { GiftThanks } from '@/components/GiftThanks';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata = { title: 'Your gift', robots: { index: false } };

export default async function GiftThanksPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <SiteHeader />
      <main className="narrow" style={{ padding: 'clamp(40px, 7vw, 88px) 0' }}>
        <GiftThanks token={decodeURIComponent(token)} />
      </main>
    </>
  );
}
