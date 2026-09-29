import Link from 'next/link';
import { dispositionLabel, displayName, initials, lifeDates, slugify, type Draft } from '@/lib/memorial';
import { Brand } from './Brand';
import { LivePanel } from './LivePanel';
import { LiveProvider } from './LiveMemorial';
import { MemorialShare } from './MemorialShare';
import { ProcessionCard } from './ProcessionCard';
import { JourneyTimeline, ProgrammeTimeline } from './MemorialTimelines';

/**
 * The public memorial. Also used for owner and guest previews (with a banner).
 * With `live`, the funeral-day parts follow the coordinator's run-sheet.
 */
export function MemorialView({ draft, path, banner, live }: { draft: Draft; path: string; banner?: React.ReactNode; live?: { slug: string; liveKey: string | null } }) {
  const p = draft.person;
  const name = displayName(p, 'In loving memory');
  const formal = draft.programme.mode === 'formal' && draft.programme.items.length > 0;
  const hasJourney = draft.journey.length > 0;

  return (
    <div className="memorial">
      {banner}
      <section className="m-hero">
        <div className="m-hero-glow" aria-hidden="true" />
        <div className="container m-topbar">
          <Brand />
        </div>
        <div className="container m-hero-inner">
          <div>
            <span className="eyebrow">In loving memory</span>
            <h1 className="display">{name}</h1>
            <div className="dates">{lifeDates(p)}</div>
            <div className="row no-print">
              {hasJourney && (
                <a className="btn on-night primary" href="#journey">
                  Funeral details
                </a>
              )}
              <a className="btn on-night" href="#story">
                Their story
              </a>
            </div>
          </div>
          <div className="m-portrait">
            {p.portraitUrl ? <img src={p.portraitUrl} alt={`Portrait of ${name}`} /> : <span className="mono">{initials(p)}</span>}
          </div>
        </div>
      </section>

      <nav className="m-nav no-print" aria-label="Memorial sections">
        <div className="container">
          <a href="#story">Story</a>
          {formal && <a href="#programme">Programme</a>}
          {hasJourney && <a href="#journey">Funeral journey</a>}
          {draft.story.familyMessage && <a href="#family">From the family</a>}
          <a href="#share">Share</a>
        </div>
      </nav>

      <main className="container">
        {live ? (
          <LiveProvider slug={live.slug} initial={{ journey: draft.journey, programme: draft.programme, liveKey: live.liveKey }}>
            <MemorialBody draft={draft} path={path} name={name} formal={formal} hasJourney={hasJourney} />
          </LiveProvider>
        ) : (
          <MemorialBody draft={draft} path={path} name={name} formal={formal} hasJourney={hasJourney} />
        )}
      </main>

      <footer className="m-footer">
        <Brand />
        <div>
          Made with Memora · <Link href="/">Create a memorial</Link>
        </div>
      </footer>
    </div>
  );
}

function MemorialBody({ draft, path, name, formal, hasJourney }: { draft: Draft; path: string; name: string; formal: boolean; hasJourney: boolean }) {
  return (
    <>
      <ProcessionCard journey={draft.journey} />
      <LivePanel journey={draft.journey} programme={draft.programme} />

      <section className="m-section" id="story">
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
        <section className="m-section" id="programme">
          <div className="m-section-grid">
            <header>
              <span className="eyebrow">Order of service</span>
            </header>
            <div>
              <h2 className="h2">The programme.</h2>
              <ProgrammeTimeline programme={draft.programme} />
            </div>
          </div>
        </section>
      )}

      {hasJourney && (
        <section className="m-section" id="journey">
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
        <section className="m-section" id="family">
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
