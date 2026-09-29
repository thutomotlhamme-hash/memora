import { ContactForm } from '@/components/ContactForm';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';

export const metadata = { title: 'Contact us', description: 'Questions about a memorial, a gift or a payment? Send us a message.' };

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v.slice(0, 500) : undefined);
  return (
    <>
      <SiteHeader />
      <main className="container gift-layout">
        <section className="gift-intro">
          <span className="eyebrow">Contact us</span>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 6vw, 64px)', margin: '16px 0 20px' }}>
            We’re here to help.
          </h1>
          <p className="lede">
            Stuck on a memorial, a gift or a payment? Want to remove something or work with us? Send a message and a real person will reply, usually
            within a day.
          </p>
        </section>
        <ContactForm defaults={{ topic: one(q.topic), message: one(q.message), whatsapp: one(q.whatsapp) }} />
      </main>
      <SiteFooter />
    </>
  );
}
