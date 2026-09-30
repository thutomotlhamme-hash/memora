import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { PRO_ONBOARDING_MINOR, PRO_PLANS, formatMoney, type ProPlan } from '@/lib/plans';

export const metadata = {
  title: 'Memora Pro for funeral homes',
  description: 'Your funeral home’s name on every memorial, programme and QR card. Live updates for guests on the day. Run-sheets for your directors.',
};

const ORDER: ProPlan[] = ['payg', 'pro', 'pro_plus', 'enterprise'];

export default function ProPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="pro-hero">
          <div className="container pro-hero-inner">
            <span className="eyebrow">Memora Pro · for funeral homes</span>
            <h1 className="display pro-title">
              Every family you serve, <em>beautifully remembered.</em>
            </h1>
            <p className="lede">
              Your name on every memorial, programme booklet and QR card. Live directions and “happening now” for every guest on the day. Run-sheets for
              your directors. One dashboard for every funeral.
            </p>
            <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
              <Link className="btn primary lg" href="/contact?topic=pro&message=We%27d%20like%20a%20demo%20of%20Memora%20Pro%20for%20our%20funeral%20home.">
                Book a demo
              </Link>
              <Link className="link chev" href="/m/preview?demo=1">
                See a memorial
              </Link>
            </div>
          </div>
        </section>

        <section className="container pro-why">
          {[
            ['A profit line, not a cost', 'Include a Memora memorial in your packages and price it as the premium it is. Families feel the difference on the day.'],
            ['Your brand in every guest’s hand', 'Each funeral puts your name in front of hundreds of guests: on their phones, in the printed booklet and on the QR card at the door.'],
            ['Fewer calls, calmer days', '“Where is it? What time?” answered for everyone, live. Your directors move the programme on from their phones and guests follow.'],
            ['Your team, your rules', 'Owners, managers, directors and arrangements staff each see and do exactly what their role allows. Nothing more.'],
          ].map(([t, b]) => (
            <article key={t} className="card pro-why-card">
              <h2 className="h4">{t}</h2>
              <p className="small muted">{b}</p>
            </article>
          ))}
        </section>

        <section className="container pro-plans" id="plans">
          <h2 className="h2" style={{ textAlign: 'center' }}>
            Plans
          </h2>
          <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
            Prices exclude VAT. 12-month agreement. Once-off onboarding {formatMoney(PRO_ONBOARDING_MINOR)}: your branding, templates and staff training done for
            you.
          </p>
          <div className="pro-plan-grid">
            {ORDER.map((id) => {
              const p = PRO_PLANS[id];
              return (
                <article key={id} className={`card pro-plan${id === 'pro' ? ' featured' : ''}`}>
                  {id === 'pro' && <span className="pill">Most homes start here</span>}
                  <h3 className="h3">{p.name}</h3>
                  <span className="muted small">{p.forWho}</span>
                  <div className="pro-price">
                    {p.quoted ? (
                      <>
                        <strong>From {formatMoney(p.monthlyMinor)}</strong>
                        <span>per month, quoted</span>
                      </>
                    ) : p.monthlyMinor ? (
                      <>
                        <strong>{formatMoney(p.monthlyMinor)}</strong>
                        <span>per month</span>
                      </>
                    ) : (
                      <>
                        <strong>No monthly fee</strong>
                        <span>pay per memorial</span>
                      </>
                    )}
                  </div>
                  <div className="pro-per">+ {formatMoney(p.perMemorialMinor)} per published memorial</div>
                  <ul className="cc-cans">
                    {p.features.map((f) => (
                      <li key={f} className="can">
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link className={`btn ${id === 'pro' ? 'primary' : ''} block`} href={`/contact?topic=pro&message=${encodeURIComponent(`We’re interested in ${p.name} for our funeral home.`)}`}>
                    {p.quoted ? 'Talk to us' : 'Get started'}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
