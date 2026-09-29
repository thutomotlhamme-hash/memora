import { Suspense } from 'react';
import Link from 'next/link';
import { GiftForm } from '@/components/GiftForm';
import { StatusScreen } from '@/components/MemorialView';
import { paymentsOn } from '@/lib/config';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { PRICE_LABEL, PRODUCT } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Give a memorial',
  description: 'Pay for a Memora memorial on behalf of a grieving family. We send them a private link to create it.',
};

export default function GiftPage() {
  if (!paymentsOn) {
    return (
      <StatusScreen
        eyebrow="Give a memorial"
        title="Gifting opens soon."
        body="During our launch, publishing a memorial is free, so there’s nothing to pay for yet. You can create one for the family, or send them Memora so they can start their own."
        action={
          <Link className="btn primary" href="/create">
            Create a memorial
          </Link>
        }
      />
    );
  }
  const ready =
    Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(process.env.MEMORA_LINK_SECRET) &&
    (Boolean(process.env.YOCO_SECRET_KEY) || (process.env.MEMORA_SIMULATE_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production'));
  return (
    <>
      <SiteHeader />
      <main className="container gift-layout">
        <section className="gift-intro">
          <span className="eyebrow">Give a memorial</span>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 6vw, 68px)', margin: '16px 0 20px' }}>
            One less thing for the family to carry.
          </h1>
          <p className="lede">
            When someone you care about loses a loved one, give them Memora. You pay; they get a private link to create the memorial, already
            paid for, with the funeral journey, programme, QR code and keepsakes.
          </p>
          <ol className="gift-steps">
            <li>
              <strong>You pay {PRICE_LABEL}</strong>
              <span>Tell us who it’s for and roughly when the funeral is.</span>
            </li>
            <li>
              <strong>You send them the link</strong>
              <span>One tap opens WhatsApp with your message and their private link.</span>
            </li>
            <li>
              <strong>We help them finish in time</strong>
              <span>Our team checks in with them on WhatsApp before the funeral.</span>
            </li>
          </ol>
          <p className="small muted">
            {PRODUCT.name}: public for a year, every feature and download included.
          </p>
        </section>
        <Suspense>
          <GiftForm ready={ready} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
