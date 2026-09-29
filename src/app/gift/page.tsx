import { Suspense } from 'react';
import { GiftForm } from '@/components/GiftForm';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { PRICE_LABEL, PRODUCT } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Give a memorial',
  description: 'Pay for a Memora memorial on behalf of a grieving family. We send them a private link to create it.',
};

export default function GiftPage() {
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
            When someone you care about loses a loved one, give them Memora. You pay; they receive a private link to create the memorial, already
            paid for, with the funeral journey, programme, QR code and keepsakes.
          </p>
          <ol className="gift-steps">
            <li>
              <strong>You pay {PRICE_LABEL}</strong>
              <span>Tell us who it’s for and roughly when the funeral is.</span>
            </li>
            <li>
              <strong>We send them the link</strong>
              <span>By email and WhatsApp, with your message.</span>
            </li>
            <li>
              <strong>We help them finish in time</strong>
              <span>Gentle reminders as the funeral gets close, and our team watches the date.</span>
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
