import Link from 'next/link';
import { dispositionLabel, displayName, initials, lifeDates, slugify, type Draft } from '@/lib/memorial';
import { Brand } from './Brand';
import { LivePanel } from './LivePanel';
import { LiveProvider } from './LiveMemorial';
import { LiveStage } from './LiveStage';
import { MemorialShare } from './MemorialShare';
import { PrayerWeekSection } from './PrayerWeekSection';
import { ProcessionCard } from './ProcessionCard';
import { JourneyTimeline, ProgrammeTimeline } from './MemorialTimelines';

/**
 * The public memorial. Also used for owner and guest previews (with a banner).
 * With `live`, the funeral-day parts follow the coordinator's run-sheet.
 */
/** A funeral home's branding, when the memorial belongs to one. */
export type HomeBrand = { name: string; logoUrl: string; brandColour: string } | null;

export function MemorialView({
  draft,
  path,
  banner,
  live,
  brand = null,
}: {
  draft: Draft;
  path: string;
  banner?: React.ReactNode;
  live?: { slug: string; liveKey: string | null };
  brand?: HomeBrand;
}) {
  const p = draft.person;
  const name = displayName(p, 'In loving memory');
  // A programme the family is still finalising shows as "coming soon" until it's released.
  const formal = draft.programme.mode === 'formal' && (draft.programme.items.length > 0 || Boolean(draft.programme.releaseAt));
  const hasJourney = draft.journey.length > 0;

  return (
    <div className="memorial">
      {banner}
      {live ? (
        <LiveProvider slug={live.slug} initial={{ journey: draft.journey, programme: draft.programme, liveKey: live.liveKey, prayers: draft.prayers }}>
          <MemorialPage draft={draft} path={path} name={name} formal={formal} hasJourney={hasJourney} />
        </LiveProvider>
      ) : (
        <MemorialPage draft={draft} path={path} name={name} formal={formal} hasJourney={hasJourney} />
      )}
      {brand && (
        <div className="m-brand" style={brand.brandColour ? ({ ['--home' as string]: brand.brandColour } as React.CSSProperties) : undefined}>
          {brand.logoUrl && <img src={brand.logoUrl} alt="" />}
          <span>
            Arranged with care by <strong>{brand.name}</strong>
          </span>
        </div>
      )}
      <footer className="m-footer">
        <Brand />
        <div>
          Made with Memora · <Link href="/">Create a memorial</Link>
        </div>
      </footer>
    </div>
  );
}

type BodyProps = { draft: Draft; path: string; name: string; formal: boolean; hasJourney: boolean };

/** Everything inside the live data: the on-the-day stage first, then the memorial itself. */
function MemorialPage({ draft, path, name, formal, hasJourney }: BodyProps) {
  const p = draft.person;
  return (
    <>
      <LiveStage journey={draft.journey} programme={draft.programme} prayers={draft.prayers} name={displayName(p, '')} portraitUrl={p.portraitUrl} dates={lifeDates(p)} initials={initials(p)} />
      <section className="m-hero">
        <div className="m-sky" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="petal" style={{ ['--i' as string]: i }} />
          ))}
        </div>
        <div className="container m-topbar">
          <Brand />
        </div>
        <div className="container m-hero-inner">
          <div className="m-portrait">
            {p.portraitUrl ? <img src={p.portraitUrl} alt={`Portrait of ${name}`} /> : <span className="mono">{initials(p)}</span>}
          </div>
          <div className="m-hero-copy">
            <div className="m-name-card">
              <span className="eyebrow">In loving memory</span>
              <h1 className="display">{name}</h1>
              <div className="dates">{lifeDates(p)}</div>
            </div>
            <div className="row no-print">
              {hasJourney && (
                <a className="btn primary" href="#journey">
                  Funeral details
                </a>
              )}
              <a className="link chev" href="#story">
                Read their story
              </a>
            </div>
          </div>
        </div>
      </section>

      <nav className="m-nav no-print" aria-label="Memorial sections">
        <div className="container">
          <a href="#story">Story</a>
          {draft.prayers?.enabled && draft.prayers.evenings.some((e) => e.on) && <a href="#prayers">Prayers</a>}
          {formal && <a href="#programme">Programme</a>}
          {hasJourney && <a href="#journey">Funeral journey</a>}
          {draft.story.familyMessage && <a href="#family">From the family</a>}
          <a href="#share">Share</a>
        </div>
      </nav>

      <main className="container">
        <MemorialBody draft={draft} path={path} name={name} formal={formal} hasJourney={hasJourney} />
      </main>
    </>
  );
}

function MemorialBody({ draft, path, name, formal, hasJourney }: BodyProps) {
  return (
    <>
      <ProcessionCard journey={draft.journey} />
      <LivePanel journey={draft.journey} programme={draft.programme} prayers={draft.prayers} />

      <section className="m-section reveal" id="story">
        <div className="m-section-grid">
          <header>
            <span className="eyebrow">Their story</span>
          </header>
          <div>
            <h2 className="h2">A life remembered.</h2>
            <div className="prose">{draft.story.obituary || 'The family is still preparing this story.'}</div>
          </div>
        </div>
      </section>

      {formal && (
        <section className="m-section band reveal" id="programme">
          <div className="m-section-grid">
            <header>
              <span className="eyebrow">Order of service</span>
            </header>
            <div>
              <h2 className="h2">The programme.</h2>
              <ProgrammeTimeline programme={draft.programme} journey={draft.journey} />
            </div>
          </div>
        </section>
      )}

      <PrayerWeekSection draft={draft} />

      {hasJourney && (
        <section className="m-section reveal" id="journey">
          <div className="m-section-grid">
            <header>
              <span className="eyebrow">Funeral journey</span>
            </header>
            <div>
              <h2 className="h2">Join the family.</h2>
              {draft.disposition.type && (
                <span className="pill disposition-tag">
                  {dispositionLabel(draft.disposition.type)}
                  {draft.disposition.notes ? ` · ${draft.disposition.notes}` : ''}
                </span>
              )}
              <JourneyTimeline journey={draft.journey} />
            </div>
          </div>
        </section>
      )}

      {draft.story.familyMessage && (
        <section className="m-section band reveal" id="family">
          <div className="m-section-grid">
            <header>
              <span className="eyebrow">From the family</span>
            </header>
            <div>
              <h2 className="h2">With gratitude.</h2>
              <div className="prose">{draft.story.familyMessage}</div>
            </div>
          </div>
        </section>
      )}

      <section className="m-section no-print" id="share">
        <MemorialShare path={path} name={name} qrName={slugify(name) || 'memorial'} />
      </section>
    </>
  );
}

export function StatusScreen({ eyebrow, title, body, action }: { eyebrow: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="status-screen">
      <div className="inner">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="h1">{title}</h1>
        <p>{body}</p>
        {action ?? (
          <Link className="btn" href="/">
            Go to Memora
          </Link>
        )}
      </div>
    </div>
  );
}
