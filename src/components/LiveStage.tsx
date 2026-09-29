'use client';

import { useEffect, useState } from 'react';
import { useNow } from '@/lib/hooks';
import { directionsUrl, fmtDate, stopLabel, type Draft, type Stop } from '@/lib/memorial';
import { distanceM, etaRange, formatEta } from '@/lib/procession';
import { stageView, type StageView } from '@/lib/stage';
import { BrandMark } from './Brand';
import { useLiveData, type LiveData } from './LiveMemorial';

// While a gathering is on (the night vigil, the service, the graveside), the
// memorial opens on a full-screen night view of what's happening now, driven by
// the coordinator's run-sheet. Everything else is one scroll below. When guests
// scroll away, a small bar keeps "now" in reach and changes as the day moves on.

const hasPin = (s: Stop) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && !(s.lat === 0 && s.lng === 0);
const place = (s: Stop) => (s.landmark ? `${s.title} · ${s.landmark}` : s.title);
/** The address, plus the entrance when the address doesn't already name it. */
const where = (s: Stop) => (s.landmark && !s.address.includes(s.landmark) ? [s.address, s.landmark].filter(Boolean).join(' · ') : s.address);

function minutesUntil(time: string, now: Date): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const left = Number(m[1]) * 60 + Number(m[2]) - (now.getHours() * 60 + now.getMinutes());
  return left > 0 ? left : null;
}
const formatIn = (min: number) => (min < 60 ? `in ${min} min` : `in ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`);
const weekday = (d: Date) => d.toLocaleDateString('en-ZA', { weekday: 'long' });

export function LiveStage({
  journey,
  programme,
  name,
  portraitUrl,
}: {
  journey: Draft['journey'];
  programme: Draft['programme'];
  name: string;
  portraitUrl: string;
}) {
  const now = useNow();
  const data = useLiveData({
    journey,
    programme,
    liveKey: null,
    procession: null,
  });
  const view = now ? stageView(data.journey, data.programme, data.liveKey, now) : null;
  if (!now || !view) return null;
  return <Stage view={view} data={data} now={now} name={name} portraitUrl={portraitUrl} />;
}

function Stage({ view, data, now, name, portraitUrl }: { view: StageView; data: LiveData; now: Date; name: string; portraitUrl: string }) {
  const [away, setAway] = useState(false);

  useEffect(() => {
    const el = document.getElementById('now');
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { mode, vigil, focus, programme: prog, after } = view;
  const tonight = vigil ? 'Tonight' : 'Today';

  const kicker =
    mode === 'before'
      ? `${tonight} · ${weekday(now)}`
      : mode === 'vigil_ended'
        ? 'Night vigil · Ended'
        : mode === 'after'
          ? 'The funeral has ended'
          : `Live · ${vigil ? 'Night vigil' : weekday(now)}`;
  const afterWhat = focus?.type === 'aftertears' ? 'the after-tears' : 'refreshments';
  const headline =
    mode === 'now' || mode === 'broadcast'
      ? 'Happening now.'
      : mode === 'transit'
        ? 'On the way.'
        : mode === 'vigil_ended'
          ? 'Thank you for being here tonight.'
          : mode === 'after'
            ? 'Thank you for walking with us.'
            : `${tonight}.`;

  const startsIn = mode === 'before' && focus ? minutesUntil(focus.time, now) : null;
  const cardKicker = !focus
    ? (prog?.where ?? 'Now')
    : mode === 'after'
      ? view.arrived
        ? `Now · ${focus.type === 'aftertears' ? 'After-tears' : 'Refreshments'}`
        : `From ${focus.time} · ${focus.type === 'aftertears' ? 'After-tears' : 'Refreshments'}`
      : mode === 'now'
        ? `Now · ${focus.time}`
        : mode === 'transit'
          ? `Heading to · ${focus.time}`
          : `Starts at ${focus.time}${startsIn != null ? ` · ${formatIn(startsIn)}` : ''}`;

  const procession = data.procession ?? null;
  const dest = procession ? (data.journey.find((s) => s.id === procession.toStopId) ?? null) : null;
  const eta =
    procession?.state === 'moving' && dest && hasPin(dest)
      ? formatEta(etaRange(distanceM({ lat: procession.lat, lng: procession.lng }, { lat: dest.lat, lng: dest.lng })))
      : '';

  // The bar's key changes with what's on, so it replays its arrival when the coordinator moves on.
  const barKey = `${prog?.current?.id ?? ''}|${focus?.id ?? ''}|${mode}`;
  const barText = prog?.current
    ? prog.current.title
    : mode === 'transit' && focus
      ? `On the way to ${focus.title}`
      : mode === 'vigil_ended'
        ? 'The vigil has ended'
        : mode === 'after' && focus
          ? `${afterWhat === 'refreshments' ? 'Refreshments' : 'After-tears'} at ${focus.title}`
          : (focus?.title ?? '');
  const barLabel =
    mode === 'now' || mode === 'broadcast' || (mode === 'after' && view.arrived) ? 'Now' : mode === 'transit' ? 'Live' : mode === 'after' ? 'Next' : tonight;

  return (
    <>
      <section className={`stage-live${vigil ? ' vigil' : ''}`} id="now" aria-labelledby="now-title" aria-live="polite">
        <div className="sl-glow" aria-hidden="true" />
        <div className="sl-inner">
          <div className="sl-top">
            <BrandMark size={24} />
            <span className="sl-who">
              {portraitUrl ? <img src={portraitUrl} alt="" /> : null}
              <span>{name ? `In loving memory of ${name}` : 'In loving memory'}</span>
            </span>
          </div>

          <div className="sl-kicker">
            <span className={`sl-dot${mode === 'vigil_ended' || mode === 'after' ? ' still' : ''}`} aria-hidden="true" />
            {kicker}
          </div>
          <h2 className="sl-title" id="now-title" key={headline}>
            {headline}
          </h2>

          {mode === 'after' && <p className="sl-lede">The funeral has ended. The family invites you to join them for {afterWhat}.</p>}
          {mode === 'vigil_ended' ? (
            <p className="sl-lede">The family thanks everyone who came to pray and remember. Tomorrow’s details are below.</p>
          ) : (
            <article className="sl-card now" key={`${focus?.id ?? 'prog'}-${mode}`}>
              <div className="k">{cardKicker}</div>
              {focus ? (
                <>
                  <div className="t">{focus.title}</div>
                  {where(focus) && <div className="s">{where(focus)}</div>}
                </>
              ) : (
                prog?.current && (
                  <>
                    <div className="t" key={prog.current.id}>
                      {prog.current.title}
                    </div>
                    {prog.current.presenter && <div className="s">{prog.current.presenter}</div>}
                  </>
                )
              )}
              {focus && prog?.current && (
                <div className="sl-row live" key={prog.current.id}>
                  <span>{prog.where}</span>
                  <strong>
                    {prog.current.title}
                    {prog.current.presenter && <small>{prog.current.presenter}</small>}
                  </strong>
                </div>
              )}
              {prog?.next && (
                <div className="sl-row">
                  <span>Then{prog.next.time ? ` · ${prog.next.time}` : ''}</span>
                  <strong>{prog.next.title}</strong>
                </div>
              )}
              {focus && mode !== 'now' && focus.parking && (
                <div className="sl-row">
                  <span>Parking</span>
                  <strong>{focus.parking}</strong>
                </div>
              )}
              {focus && hasPin(focus) && <Directions stop={focus} />}
            </article>
          )}

          {procession && (
            <a className="sl-card sl-proc" href="#procession">
              <div>
                <div className="k soft">The procession</div>
                <div className="p">
                  {procession.state === 'moving'
                    ? eta
                      ? `About ${eta} away${dest ? ` from ${dest.title}` : ''}`
                      : 'On the road now'
                    : procession.state === 'waiting'
                      ? 'About to leave'
                      : procession.state === 'paused'
                        ? 'Updates paused'
                        : 'Waiting for the next update'}
                </div>
              </div>
              <span className="sl-follow">Follow</span>
            </a>
          )}

          {after && (
            <article className="sl-card next">
              <div className="k soft">
                {mode === 'vigil_ended'
                  ? `Tomorrow · ${fmtDate(after.date)} · ${after.time}`
                  : mode === 'after'
                    ? `Later · ${after.time}`
                    : `Next · ${after.time}`}
              </div>
              <div className="p">{place(after)}</div>
              <div className="s">{stopLabel(after.type)}</div>
              {(mode === 'vigil_ended' || mode === 'after') && hasPin(after) && <Directions stop={after} />}
            </article>
          )}

          <a className="sl-more" href="#story" onClick={scrollOn}>
            <span>Programme, story and directions</span>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>

      <a className={`now-bar${away ? ' on' : ''}`} href="#now" aria-hidden={!away} tabIndex={away ? 0 : -1} key={barKey}>
        <span className={`sl-dot${mode === 'vigil_ended' ? ' still' : ''}`} aria-hidden="true" />
        <span className="nb-k">{barLabel}</span>
        <span className="nb-t">{barText}</span>
        <span className="nb-go">View</span>
      </a>
    </>
  );
}

function Directions({ stop }: { stop: Stop }) {
  return (
    <div className="sl-actions">
      <a className="sl-btn" href={directionsUrl(stop, 'google')} target="_blank" rel="noopener noreferrer">
        Directions
      </a>
      <a className="sl-link" href={directionsUrl(stop, 'waze')} target="_blank" rel="noopener noreferrer">
        Waze
      </a>
      <a className="sl-link" href={directionsUrl(stop, 'apple')} target="_blank" rel="noopener noreferrer">
        Apple Maps
      </a>
    </div>
  );
}

/** Scroll to the first section under the stage: the programme when there is one. */
function scrollOn(e: React.MouseEvent) {
  const target = document.getElementById('programme') ?? document.getElementById('story');
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}
