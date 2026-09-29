import Link from 'next/link';
import {
  dispositionLabel,
  displayName,
  fmtDate,
  initials,
  lifeDates,
  programmeTypeLabel,
  routeUrl,
  slugify,
  stopLabel,
  directionsUrl,
  type Draft,
} from '@/lib/memorial';
import { Brand } from './Brand';
import { LivePanel } from './LivePanel';
import { MemorialShare } from './MemorialShare';

/** The public memorial. Also used for owner and guest previews (with a banner). */
export function MemorialView({ draft, path, banner }: { draft: Draft; path: string; banner?: React.ReactNode }) {
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
                <div className="timeline">
                  {draft.programme.items.map((item, i) => (
                    <article className="t-item" key={item.id}>
                      <div className="t-when">
                        <strong>{item.time || String(i + 1).padStart(2, '0')}</strong>
                      </div>
                      <div className="t-body">
                        <span className="kind">{programmeTypeLabel(item.type)}</span>
                        <h3>{item.title}</h3>
                        {item.presenter && <p>{item.presenter}</p>}
                        {item.detail && <p className="meta">{item.detail}</p>}
                      </div>
                    </article>
                  ))}
                </div>
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
                <div className="timeline">
                  {draft.journey.map((s, i) => {
                    const next = draft.journey[i + 1];
                    return (
                      <article className="t-item" key={s.id}>
                        <div className="t-when">
                          <strong>{s.time}</strong>
                          {fmtDate(s.date)}
                          {s.departTime && <div>Departs {s.departTime}</div>}
                        </div>
                        <div className="t-body">
                          <span className="kind">{stopLabel(s.type)}</span>
                          <h3>{s.title}</h3>
                          {s.address && <p>{s.address}</p>}
                          {s.landmark && <p className="meta">Entrance: {s.landmark}</p>}
                          {s.parking && <p className="meta">Parking: {s.parking}</p>}
                          {s.transport && <p className="meta">Procession: {s.transport}</p>}
                          {s.notes && <p className="meta">{s.notes}</p>}
                          <div className="row no-print">
                            <a className="btn sm" target="_blank" rel="noopener noreferrer" href={directionsUrl(s, 'google')}>
                              Google Maps
                            </a>
                            <a className="btn sm" target="_blank" rel="noopener noreferrer" href={directionsUrl(s, 'apple')}>
                              Apple Maps
                            </a>
                            <a className="btn sm" target="_blank" rel="noopener noreferrer" href={directionsUrl(s, 'waze')}>
                              Waze
                            </a>
                          </div>
                          {next && (
                            <a className="t-next no-print" target="_blank" rel="noopener noreferrer" href={routeUrl(s, next)}>
                              Route to {next.title} →
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
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
