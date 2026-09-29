import Link from 'next/link';
import { Highlights } from '@/components/landing/Highlights';
import { LocalNav } from '@/components/landing/LocalNav';
import { ArchPortrait, HeroJourneyLine, KeepsakeStack, LiveVisual, MapVisual, PhoneMemorial, ProcessionVisual, ProgrammeSheet, QrCard, RunSheetVisual } from '@/components/landing/Visuals';
import { SiteFooter } from '@/components/SiteHeader';
import { paymentsOn } from '@/lib/config';
import { PRICE_LABEL, PRODUCT } from '@/lib/plans';

const d = (s: number) => ({ ['--d' as string]: `${s}s` });

export default function Home() {
  const price = paymentsOn ? `${PRICE_LABEL} once-off` : 'Free while we launch';
  return (
    <>
      <LocalNav
        links={[
          { href: '#highlights', label: 'Highlights' },
          { href: '#overview', label: 'How it works' },
          { href: '#day', label: 'On the day' },
          { href: '#pricing', label: 'Pricing' },
        ]}
      />
      <main id="top">
        {/* ---------------------------------------------------------------- Hero */}
        <section className="stage">
          <div className="container stage-copy">
            <p className="stage-new">New · Follow the procession live</p>
            <h1 className="stage-title">
              Remember <em>beautifully.</em>
            </h1>
            <p className="stage-sub">The memorial, the funeral journey and every keepsake. One link for everyone who loved them.</p>
            <div className="stage-cta">
              <Link className="btn primary" href="/create">
                Create a memorial
              </Link>
              <Link className="link chev" href="/m/preview">
                See an example
              </Link>
            </div>
          </div>
          <div className="stage-scene zoom" aria-hidden="true">
            <ProgrammeSheet className="scene-left" />
            <ArchPortrait className="scene-phone" />
            <QrCard className="scene-right" />
          </div>
          <HeroJourneyLine />
          <div className="stage-callout reveal">
            <div>
              <strong>{price}</strong>
              <span>No account needed to start. Private until you publish.</span>
            </div>
            <Link className="btn primary sm" href="/create">
              Start
            </Link>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Highlights */}
        <section className="band" id="highlights">
          <div className="container band-head reveal">
            <h2 className="chapter-title">Get the highlights.</h2>
            <Link className="link chev" href="/m/preview">
              See an example memorial
            </Link>
          </div>
          <Highlights labels={['Their story', 'Every stop', 'On the day', 'The procession', 'Keepsakes']}>
            <article className="hl-card">
              <p className="hl-cap">
                <strong>Their story, told with care.</strong> Portrait, names, dates, a life story and a message from the family.
              </p>
              <div className="hl-visual hl-story">
                <div className="hl-story-card">
                  <div className="v-portrait" />
                  <div>
                    <span className="v-kicker">In loving memory</span>
                    <strong>Naledi Magumba</strong>
                    <p>A teacher for thirty-one years, she knew every child by name and every parent by their worries.</p>
                  </div>
                </div>
              </div>
            </article>
            <article className="hl-card">
              <p className="hl-cap">
                <strong>Every stop, pinned to the right gate.</strong> Home, church, cemetery and reception, with one-tap directions between them.
              </p>
              <div className="hl-visual">
                <MapVisual />
              </div>
            </article>
            <article className="hl-card dark">
              <p className="hl-cap">
                <strong>On the day, it shows what’s happening now.</strong> Guests see the current stop, what’s next and where the service is up to.
              </p>
              <div className="hl-visual">
                <LiveVisual />
              </div>
            </article>
            <article className="hl-card">
              <p className="hl-cap">
                <strong>Follow the procession.</strong> The lead car shares its position, so nobody gets lost on the way to the cemetery.
              </p>
              <div className="hl-visual">
                <ProcessionVisual />
              </div>
            </article>
            <article className="hl-card">
              <p className="hl-cap">
                <strong>One QR code. Every keepsake.</strong> WhatsApp cards, a printable programme and a keepsake book, made for you.
              </p>
              <div className="hl-visual">
                <KeepsakeStack />
              </div>
            </article>
          </Highlights>
        </section>

        {/* ---------------------------------------------------------------- How it works */}
        <section className="chapter" id="overview">
          <div className="container split">
            <div className="split-copy">
              <p className="chapter-kicker reveal">How it works</p>
              <h2 className="chapter-title reveal" style={d(0.05)}>
                Made in an evening.
                <br />
                <span className="soft">Ready for everyone.</span>
              </h2>
              <p className="chapter-body reveal" style={d(0.1)}>
                Memora treats the funeral as one living memorial, not a pile of separate documents. Change a venue or a time once, and the page,
                the programme and every card agree.
              </p>
              <ol className="how">
                {[
                  ['Tell their story', 'Portrait, names, dates and a few words from the family.'],
                  ['Map the journey', 'Every stop in order, with an exact pin at the right entrance.'],
                  ['Build the programme', 'Prayers, hymns, tributes and eulogy, in the order they’ll happen.'],
                  ['Share one link', 'A QR code and WhatsApp cards for everyone who needs to know.'],
                ].map(([t, b], i) => (
                  <li key={t} className="reveal" style={d(0.1 + i * 0.07)}>
                    <strong>{t}</strong>
                    <span>{b}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="split-visual reveal from-right">
              <PhoneMemorial className="how-phone" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- On the day (dark chapter) */}
        <section className="chapter dark" id="day">
          <div className="container center-head">
            <p className="chapter-kicker reveal">On the day</p>
            <h2 className="chapter-title xl reveal" style={d(0.05)}>
              The page becomes
              <br />
              the guide.
            </h2>
            <p className="chapter-body reveal" style={d(0.1)}>
              No app to install. The same link everyone already has turns into a live, calm guide to where to be and when.
            </p>
          </div>
          <div className="container day-grid">
            <div className="reveal zoom-soft">
              <LiveVisual />
            </div>
            <div className="reveal zoom-soft" style={d(0.08)}>
              <ProcessionVisual />
            </div>
          </div>
          <div className="container facts">
            {[
              ['Now & next.', 'Uses the stop and programme times to show the current stop, the next one and the part of the service under way.'],
              ['The right entrance.', 'Pins go on the exact gate, hall or graveside, even on unmarked rural roads. Google Maps, Apple Maps or Waze.'],
              ['A live procession.', 'Only while the coordinator shares it. Only the latest position, never a history. It ends by itself on arrival.'],
            ].map(([t, b], i) => (
              <p key={t} className="reveal" style={d(i * 0.08)}>
                <strong>{t}</strong> {b}
              </p>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- Run-sheet */}
        <section className="chapter" id="coordinator">
          <div className="container split reverse">
            <div className="split-visual reveal from-left">
              <RunSheetVisual className="run-phone" />
            </div>
            <div className="split-copy">
              <p className="chapter-kicker reveal">For the programme director</p>
              <h2 className="chapter-title reveal" style={d(0.05)}>
                Things change.
                <br />
                <span className="soft">The programme keeps up.</span>
              </h2>
              <p className="chapter-body reveal" style={d(0.1)}>
                The family hands the day to whoever runs it with one private link. They start each item, drag the running order around, and push
                everything back when things run late. Every guest’s page follows within seconds.
              </p>
              <ul className="ticks reveal" style={d(0.15)}>
                <li>Drag and drop the order of service</li>
                <li>Running late? +5, +10 or +15 minutes for everything still to come</li>
                <li>Two phones, no clashes: nobody overwrites anyone</li>
                <li>No account needed. Reset the link any time.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Privacy */}
        <section className="band" id="privacy">
          <div className="container center-head">
            <svg className="glyph reveal" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
              <rect x="12" y="24" width="32" height="24" rx="6" fill="#1d1d1f" />
              <path d="M19 24v-6a9 9 0 0 1 18 0v6" stroke="#1d1d1f" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
            <h2 className="chapter-title reveal" style={d(0.05)}>
              Private by design.
            </h2>
            <p className="chapter-body reveal" style={d(0.1)}>
              A memorial is personal. Memora keeps it that way.
            </p>
          </div>
          <div className="container tiles">
            {[
              ['Yours until you publish.', 'Drafts are private. Start without an account and nothing leaves your phone until you sign up.'],
              ['Unlisted, not indexed.', 'Memorials are shared by link and kept out of search engines.'],
              ['A year, then private.', 'The page stays up long enough for the unveiling, then quietly goes private.'],
            ].map(([t, b], i) => (
              <article key={t} className="tile reveal" style={d(i * 0.08)}>
                <strong>{t}</strong>
                <p>{b}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- Gift */}
        {paymentsOn && (
          <section className="chapter" id="gift">
            <div className="container center-head">
              <p className="chapter-kicker reveal">Give a memorial</p>
              <h2 className="chapter-title reveal" style={d(0.05)}>
                One less thing to carry.
              </h2>
              <p className="chapter-body reveal" style={d(0.1)}>
                Pay for the memorial on a grieving family’s behalf and send them a private link on WhatsApp. Our team helps them finish before the
                funeral.
              </p>
              <div className="stage-cta reveal" style={d(0.15)}>
                <Link className="btn primary" href="/gift">
                  Give a memorial
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------- Pricing */}
        <section className={paymentsOn ? 'band' : 'chapter'} id="pricing">
          <div className="container center-head">
            <p className="chapter-kicker reveal">Pricing</p>
            <h2 className="chapter-title xl reveal" style={d(0.05)}>
              {paymentsOn ? PRICE_LABEL : 'Free.'}
            </h2>
            <p className="chapter-body reveal" style={d(0.1)}>
              {paymentsOn
                ? 'Build and preview everything for free. Pay once when you publish. No subscriptions.'
                : `Every feature is free while we launch (usually ${PRICE_LABEL}). Memorials published now stay free.`}
            </p>
          </div>
          <div className="container">
            <article className="plan reveal" style={d(0.12)}>
              <div>
                <strong className="plan-title">{PRODUCT.name}</strong>
                <span className="plan-sub">{paymentsOn ? 'Once-off, per memorial · public for a year' : 'Public for a full year'}</span>
              </div>
              <ul>
                {PRODUCT.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link className="btn primary" href="/create">
                Start free
              </Link>
            </article>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Close */}
        <section className="band closing">
          <div className="container center-head">
            <h2 className="stage-title reveal">
              Remember <em>beautifully.</em>
            </h2>
            <div className="stage-cta reveal" style={d(0.08)}>
              <Link className="btn primary" href="/create">
                Create a memorial
              </Link>
              <Link className="link chev" href="/m/preview">
                See an example
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
