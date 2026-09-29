import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { PRICE_LABEL, PRODUCT } from '@/lib/plans';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">Memorial · Funeral journey · Keepsake</span>
              <h1 className="display" style={{ marginTop: 20 }}>
                Remember beautifully.
              </h1>
              <p className="lede">
                One calm place to tell their story, map every stop of the funeral, share a single link and QR code with everyone,
                and keep the programme and keepsakes afterwards.
              </p>
              <div className="row">
                <Link className="btn primary lg" href="/create">
                  Create a memorial
                </Link>
                <Link className="btn lg" href="/m/preview">
                  See an example
                </Link>
              </div>
              <div className="hero-meta">
                <span>No account needed to start</span>
                <span>Private until you publish</span>
              </div>
            </div>
            <div aria-hidden="true">
              <div className="keepsake">
                <div className="portrait" />
                <span className="pill live dot live-chip">Live today</span>
                <div className="copy">
                  <span className="eyebrow">In loving memory</span>
                  <h3>Naledi Mokoena</h3>
                  <p>12 April 1958 — 19 August 2026</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section alt">
          <div className="container">
            <div className="section-head">
              <h2 className="h2">Everything the family needs, in one place.</h2>
              <p className="lede">
                Memora treats the funeral as one living memorial, not a pile of separate documents. Change a venue or a time once,
                and the memorial page, programme and cards all agree.
              </p>
            </div>
            <div className="steps-grid">
              <article>
                <span className="num">01</span>
                <h3>Tell their story</h3>
                <p>Portrait, names, dates, life story and a message from the family, at your own pace.</p>
              </article>
              <article>
                <span className="num">02</span>
                <h3>Map the journey</h3>
                <p>Home, church, cemetery, reception: every stop in order, with an exact pin at the right gate.</p>
              </article>
              <article>
                <span className="num">03</span>
                <h3>Build the programme</h3>
                <p>Prayers, hymns, scripture, tributes and eulogy, in the order they will happen.</p>
              </article>
              <article>
                <span className="num">04</span>
                <h3>Share one QR</h3>
                <p>A single memorial link and QR, plus WhatsApp cards, a printable programme and a keepsake PDF.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section night">
          <div className="container">
            <div className="section-head">
              <h2 className="h2">On the day, the page guides everyone.</h2>
              <p className="lede">
                The memorial link turns into a funeral-day guide on its own. Guests see where to be now and where to go next,
                with one-tap directions. No app to install and no location tracking.
              </p>
            </div>
            <div className="feature-list">
              <article>
                <span className="pill live dot">Live</span>
                <h3>Now &amp; next</h3>
                <p>Uses the stop times you entered to show the current stop, the next stop and the part of the service under way.</p>
              </article>
              <article>
                <span className="pill dot" style={{ background: 'rgba(250,249,245,.1)', color: 'var(--on-night)' }}>
                  Exact pins
                </span>
                <h3>The right entrance</h3>
                <p>Search for a place, then drag the pin to the exact gate, hall or graveside, even on unmarked rural roads.</p>
              </article>
              <article>
                <span className="pill dot" style={{ background: 'rgba(250,249,245,.1)', color: 'var(--on-night)' }}>
                  Directions
                </span>
                <h3>Google, Apple or Waze</h3>
                <p>Guests open the saved coordinates in the maps app they already use, and get the route from each stop to the next.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section alt" id="gift">
          <div className="container cta-band">
            <div>
              <span className="eyebrow">Give a memorial</span>
              <h2 className="h2" style={{ marginTop: 12 }}>
                Take one thing off a grieving family’s plate.
              </h2>
              <p className="lede" style={{ marginTop: 14 }}>
                Pay for the memorial on their behalf. We send them a private link by email and WhatsApp, with your message, and help them get it
                ready before the funeral.
              </p>
            </div>
            <Link className="btn primary lg" href="/gift">
              Give a memorial
            </Link>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="container">
            <div className="price-band">
              <div>
                <span className="eyebrow">Pricing</span>
                <h2 className="h2" style={{ marginTop: 12 }}>
                  Start free. Pay once, when you publish.
                </h2>
                <p className="lede" style={{ marginTop: 16 }}>
                  Build and preview the whole memorial without paying. When the family is ready, one payment publishes it for a full year, long
                  enough to update it for the tombstone unveiling. No subscriptions.
                </p>
              </div>
              <article className="plan-card featured">
                <strong className="plan-name">{PRODUCT.name}</strong>
                <span className="plan-price">{PRICE_LABEL}</span>
                <span className="plan-duration">Once-off, per memorial</span>
                <ul className="plan-features">
                  {PRODUCT.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link className="btn primary block" href="/create">
                  Start free
                </Link>
                <span className="tiny muted" style={{ marginTop: 10 }}>
                  Card payments handled securely by Yoco.
                </span>
              </article>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
