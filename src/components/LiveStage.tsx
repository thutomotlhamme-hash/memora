'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useNow } from '@/lib/hooks';
import { directionsUrl, fmtDate, partOf, prayerEveningFor, stopLabel, withPrayers, type Draft, type PrayerEvening, type Stop } from '@/lib/memorial';
import { distanceM, etaRange, formatDistance, formatEta } from '@/lib/procession';
import { stageView, type StageView } from '@/lib/stage';
import { BrandMark } from './Brand';
import { useLiveData, type LiveData } from './LiveMemorial';

// While a gathering is on (the night vigil, the service, the graveside), the
// memorial opens on a full-screen night view of what's happening now, driven by
// the coordinator's run-sheet. Everything else is one scroll below. When guests
// scroll away, a small bar keeps "now" in reach and changes as the day moves on.
//
// The programme item is the headline while it runs. When the procession leaves,
// the stage hands over to the map; when the graveside starts, back to the
// programme. Guests are brought back to the stage only at those handoffs (the
// programme starting, leaving, arriving, the end), never between items, and
// never while they're typing: between items only the bar updates.

const ProcessionMap = dynamic(() => import('./ProcessionMap').then((m) => m.ProcessionMap), { ssr: false });

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
  dates,
  initials,
  prayers,
}: {
  prayers?: Draft['prayers'];
  journey: Draft['journey'];
  programme: Draft['programme'];
  name: string;
  portraitUrl: string;
  dates: string;
  initials: string;
}) {
  const now = useNow();
  const data = useLiveData({
    journey,
    programme,
    liveKey: null,
    procession: null,
    prayers,
  });
  const week = data.prayers ?? prayers;
  const view = now ? stageView(withPrayers(data.journey, week), data.programme, data.liveKey, now) : null;
  if (!now || !view) return null;
  return <Stage view={view} data={data} now={now} name={name} portraitUrl={portraitUrl} dates={dates} initials={initials} evening={view.focus ? prayerEveningFor(week, view.focus.id) : null} />;
}

function Stage({
  view,
  data,
  now,
  name,
  portraitUrl,
  dates,
  initials,
  evening,
}: {
  evening: PrayerEvening | null;
  view: StageView;
  data: LiveData;
  now: Date;
  name: string;
  portraitUrl: string;
  dates: string;
  initials: string;
}) {
  const [away, setAway] = useState(false);

  useEffect(() => {
    const el = document.getElementById('now');
    if (!el || !('IntersectionObserver' in window)) return;
    // Once most of the live view has scrolled away, the bar takes over.
    const io = new IntersectionObserver(([e]) => setAway(e.intersectionRatio < 0.25 && e.boundingClientRect.top < 0), { threshold: [0, 0.25, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { mode, vigil, focus, programme: prog, after } = view;
  const procession = data.procession ?? null;
  const onTheRoad = Boolean(procession && procession.state !== 'paused');

  // The big moments bring guests back to the stage, once each.
  const moment = onTheRoad ? `road:${procession?.toStopId ?? ''}` : prog?.current ? `prog:${partOf(prog.current)}` : `${mode}:${focus?.id ?? ''}`;
  const lastMoment = useRef<string | null>(null);
  useEffect(() => {
    const before = lastMoment.current;
    lastMoment.current = moment;
    if (before === null || before === moment) return;
    const el = document.getElementById('now');
    if (!el) return;
    const typing = document.activeElement instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!typing && el.getBoundingClientRect().top < -40) el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    if (!still) el.querySelector('.sl-inner')?.animate([{ opacity: 0.55, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.25,.1,.25,1)' });
  }, [moment]);
  const tonight = vigil || focus?.type === 'prayers' ? 'Tonight' : 'Today';

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

  const dest = procession ? (data.journey.find((s) => s.id === procession.toStopId) ?? null) : null;
  const eta =
    procession?.state === 'moving' && dest && hasPin(dest)
      ? formatEta(etaRange(distanceM({ lat: procession.lat, lng: procession.lng }, { lat: dest.lat, lng: dest.lng })))
      : '';

  // The bar's key changes with what's on, so it replays its arrival when the coordinator moves on.
  const barKey = `${prog?.current?.id ?? ''}|${focus?.id ?? ''}|${mode}|${onTheRoad ? 'road' : ''}`;
  const barText = onTheRoad
    ? `The procession${dest ? ` to ${dest.title}` : ''}${eta ? ` · ${eta.toLowerCase()}` : ''}`
    : prog?.current
    ? prog.current.title
    : mode === 'transit' && focus
      ? `On the way to ${focus.title}`
      : mode === 'vigil_ended'
        ? 'The vigil has ended'
        : mode === 'after' && focus
          ? `${afterWhat === 'refreshments' ? 'Refreshments' : 'After-tears'} at ${focus.title}`
          : (focus?.title ?? '');
  const barLabel = onTheRoad
    ? 'Live'
    : mode === 'now' || mode === 'broadcast' || (mode === 'after' && view.arrived) ? 'Now' : mode === 'transit' ? 'Live' : mode === 'after' ? 'Next' : tonight;

  const cardSub = focus ? where(focus) : (prog?.current?.presenter ?? '');

  return (
    <>
      <section className={`stage-live${vigil ? ' vigil' : ''}`} id="now" aria-labelledby="now-title" aria-live="polite">
        <div className="sl-glow" aria-hidden="true" />
        <div className="sl-inner">
          <div className="sl-top">
            <BrandMark size={24} />
            <span className="sl-kicker">
              <span className={`sl-dot${mode === 'vigil_ended' || mode === 'after' ? ' still' : ''}`} aria-hidden="true" />
              {kicker}
            </span>
          </div>

          {/* The memorial itself, as on the phone: portrait, name, dates. */}
          <div className="sl-person">
            <div className="sl-portrait">{portraitUrl ? <img src={portraitUrl} alt={`Portrait of ${name || 'our loved one'}`} /> : <span>{initials}</span>}</div>
            <span className="sl-eyebrow">In loving memory</span>
            <h1 className="sl-name">{name || 'Our loved one'}</h1>
            {dates && <div className="sl-dates">{dates}</div>}
          </div>

          {onTheRoad && procession ? (
            <StageProcession procession={procession} dest={dest} eta={eta} now={now} />
          ) : (
          <article className="sl-card now" key={`${focus?.id ?? 'prog'}-${mode}`}>
            <div className="k">
              <span className={`sl-dot${mode === 'vigil_ended' || mode === 'after' ? ' still' : ''}`} aria-hidden="true" />
              <span id="now-title">{headline.replace(/\.$/, '')}</span>
            </div>
            {mode === 'vigil_ended' || mode === 'after' ? (
              <p className="sl-lede">
                {mode === 'after'
                  ? `The funeral has ended. The family invites you to join them for ${afterWhat}.`
                  : 'The family thanks everyone who came to pray and remember. Tomorrow’s details are below.'}
              </p>
            ) : null}
            {mode !== 'vigil_ended' && prog?.current ? (
              // The programme takes centre stage: what's on, who leads it, then where.
              <>
                <div className="sl-card-k2">{prog.where}</div>
                <div className="t sl-item" key={prog.current.id}>
                  {prog.current.title}
                </div>
                {prog.current.presenter && <div className="s">{prog.current.presenter}</div>}
              </>
            ) : (
              mode !== 'vigil_ended' &&
              focus && (
                <>
                  <div className="sl-card-k2">{cardKicker}</div>
                  <div className="t" key={focus.id}>
                    {focus.title}
                  </div>
                  {cardSub && <div className="s">{cardSub}</div>}
                </>
              )
            )}
            {evening && (evening.word || evening.scripture || evening.leader) && (
              <div className="sl-evening">
                {evening.word && (
                  <div className="sl-row">
                    <span>Word of the day</span>
                    <strong>{evening.word}</strong>
                  </div>
                )}
                {evening.scripture && (
                  <div className="sl-row">
                    <span>Scripture</span>
                    <strong>{evening.scripture}</strong>
                  </div>
                )}
                {evening.leader && (
                  <div className="sl-row">
                    <span>Led by</span>
                    <strong>{evening.leader}</strong>
                  </div>
                )}
              </div>
            )}
            {focus && prog?.current && (
              <div className="sl-row">
                <span>Where</span>
                <strong>
                  {focus.title}
                  {cardSub && <small>{cardSub}</small>}
                </strong>
              </div>
            )}
            {prog?.next && (
              <div className="sl-row">
                <span>Then{prog.next.time ? ` · ${prog.next.time}` : ''}</span>
                <strong>{prog.next.title}</strong>
              </div>
            )}
            {focus && mode !== 'now' && mode !== 'vigil_ended' && focus.parking && (
              <div className="sl-row">
                <span>Parking</span>
                <strong>{focus.parking}</strong>
              </div>
            )}
            {focus && mode !== 'vigil_ended' && hasPin(focus) && <Directions stop={focus} />}
          </article>
          )}

          {procession && !onTheRoad && (
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
            <article className="sl-next">
              <span>
                {mode === 'vigil_ended'
                  ? `Tomorrow · ${fmtDate(after.date)} · ${after.time}`
                  : mode === 'after'
                    ? `Later · ${after.time}`
                    : after.date !== focus?.date
                      ? `Up next · ${weekday(new Date(`${after.date}T12:00:00`))} · ${after.time}`
                      : `Next · ${after.time}`}
              </span>
              <strong>{place(after)}</strong>
              {(mode === 'vigil_ended' || mode === 'after') && hasPin(after) && <Directions stop={after} light />}
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

/** On the road: the map is the stage, with how far and how long. */
function StageProcession({ procession, dest, eta, now }: { procession: NonNullable<LiveData['procession']>; dest: Stop | null; eta: string; now: Date }) {
  const car = procession.state === 'moving' ? { lat: procession.lat, lng: procession.lng } : null;
  const destPoint = dest && hasPin(dest) ? { lat: dest.lat, lng: dest.lng } : null;
  const metres = car && destPoint ? distanceM(car, destPoint) : null;
  const arrived = metres != null && metres <= 150;
  const ago = 'positionAt' in procession && procession.positionAt ? Math.max(0, Math.round((now.getTime() - new Date(procession.positionAt).getTime()) / 60_000)) : null;
  return (
    <article className="sl-card now sl-road" key="road">
      <div className="k">
        <span className="sl-dot" aria-hidden="true" />
        <span id="now-title">{arrived ? 'Arriving' : procession.state === 'waiting' ? 'Leaving now' : 'On the road'}</span>
      </div>
      <div className="sl-card-k2">The procession is heading to</div>
      <div className="t">{dest ? dest.title : 'On its way'}</div>
      <div className="s">
        {procession.state === 'waiting'
          ? 'The cars are about to leave. The map fills in within a minute.'
          : procession.state === 'signal_lost'
            ? `Waiting for the next update${ago != null ? ` (${ago} min)` : ''}. The lead car may be out of signal.`
            : arrived
              ? 'The procession is arriving now.'
              : eta
                ? `${eta} away${metres != null ? ` · ${formatDistance(metres)}` : ''}`
                : 'On the road now'}
      </div>
      {(car || destPoint) && (
        <div className="sl-map">
          <ProcessionMap car={car} destination={destPoint} destinationLabel={dest?.title ?? 'the destination'} />
        </div>
      )}
      {dest && hasPin(dest) && <Directions stop={dest} />}
    </article>
  );
}

function Directions({ stop, light = false }: { stop: Stop; light?: boolean }) {
  return (
    <div className={`sl-actions${light ? ' light' : ''}`}>
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
