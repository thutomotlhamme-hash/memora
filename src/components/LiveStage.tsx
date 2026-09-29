'use client';

import { useEffect, useState } from 'react';
import { useNow } from '@/lib/hooks';
import { liveFuneralState, liveProgrammeState, type LivePhase } from '@/lib/live';
import { directionsUrl, partOf, stopLabel, type Draft, type ProgrammePart, type Stop } from '@/lib/memorial';
import { distanceM, etaRange, formatEta } from '@/lib/procession';
import { BrandMark } from './Brand';
import { useLiveData, type LiveData } from './LiveMemorial';

// While a gathering is on (the night vigil, the service, the graveside), the
// memorial opens on a full-screen night view of what's happening now, driven by
// the coordinator's run-sheet. Everything else is one scroll below. When guests
// scroll away, a small bar keeps "now" in reach and changes as the day moves on.

type StageMoment = Extract<LivePhase, { phase: 'before_start' | 'at_stop' | 'in_transit' }>;

/** The stage shows from the first gathering of the day until the last one ends. */
export function stageMoment(live: LivePhase): StageMoment | null {
  return live.phase === 'before_start' || live.phase === 'at_stop' || live.phase === 'in_transit' ? live : null;
}

const PART_WHERE: Record<ProgrammePart, string> = { vigil: 'At the vigil', service: 'In the service', graveside: 'At the graveside' };

/** Which part of the programme belongs to a stop (none for a reception or a home). */
function partsForStop(stop: Stop): ProgrammePart[] {
  if (stop.type === 'vigil') return ['vigil'];
  if (stop.type === 'cemetery' || stop.type === 'crematorium') return ['graveside'];
  if (stop.type === 'church' || stop.type === 'hall' || stop.type === 'other') return ['service'];
  return [];
}

function programmeNow(programme: Draft['programme'], liveKey: string | null, stop: Stop, now: Date) {
  // The coordinator's "started" item wins, wherever it sits in the programme.
  const started = liveKey ? programme.items.find((i) => i.id === liveKey) : undefined;
  const parts = started ? [partOf(started)] : partsForStop(stop);
  if (!parts.length) return null;
  const state = liveProgrammeState(programme, now, liveKey, parts);
  return state ? { ...state, where: PART_WHERE[parts[0]] } : null;
}

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

export function LiveStage({ journey, programme, name, portraitUrl }: { journey: Draft['journey']; programme: Draft['programme']; name: string; portraitUrl: string }) {
  const now = useNow();
  const data = useLiveData({ journey, programme, liveKey: null, procession: null });
  const moment = now ? stageMoment(liveFuneralState(data.journey, now)) : null;
  if (!now || !moment) return null;
  return <Stage moment={moment} data={data} now={now} name={name} portraitUrl={portraitUrl} />;
}

function Stage({ moment, data, now, name, portraitUrl }: { moment: StageMoment; data: LiveData; now: Date; name: string; portraitUrl: string }) {
  const [away, setAway] = useState(false);

  useEffect(() => {
    const el = document.getElementById('now');
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const focus = moment.phase === 'before_start' ? moment.nextStop : moment.phase === 'in_transit' ? moment.nextStop : moment.currentStop;
  const vigil = focus.type === 'vigil';
  const prog = moment.phase === 'at_stop' ? programmeNow(data.programme, data.liveKey, moment.currentStop, now) : null;
  const after = moment.phase === 'at_stop' ? moment.nextStop : moment.phase === 'before_start' ? nextAfter(data.journey, moment.nextStop) : null;

  const day = vigil ? 'Tonight' : now.toLocaleDateString('en-ZA', { weekday: 'long' });
  const kicker = moment.phase === 'before_start' ? `${vigil ? 'Tonight' : 'Today'} · ${now.toLocaleDateString('en-ZA', { weekday: 'long' })}` : `Live · ${day}`;
  const startsIn = moment.phase === 'before_start' ? minutesUntil(focus.time, now) : null;
  const headline =
    moment.phase === 'at_stop' ? 'Happening now.' : moment.phase === 'in_transit' ? 'On the way.' : vigil ? 'Tonight.' : 'Today.';
  const cardKicker =
    moment.phase === 'at_stop' ? `Now · ${focus.time}` : moment.phase === 'in_transit'
        ? `Heading to · ${focus.time}`
        : `Starts at ${focus.time}${startsIn != null ? ` · ${formatIn(startsIn)}` : ''}`;

  const procession = data.procession ?? null;
  const dest = procession ? (data.journey.find((s) => s.id === procession.toStopId) ?? null) : null;
  const eta =
    procession?.state === 'moving' && dest && hasPin(dest) ? formatEta(etaRange(distanceM({ lat: procession.lat, lng: procession.lng }, { lat: dest.lat, lng: dest.lng }))) : '';

  // The bar's key changes with what's on, so it replays its arrival when the day moves on.
  const barKey = `${prog?.current?.id ?? ''}|${focus.id}|${moment.phase}`;
  const barText = prog?.current ? prog.current.title : moment.phase === 'in_transit' ? `On the way to ${focus.title}` : focus.title;

  return (
    <>
      <section className="stage-live" id="now" aria-labelledby="now-title" aria-live="polite">
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
            <span className="sl-dot" aria-hidden="true" />
            {kicker}
          </div>
          <h2 className="sl-title" id="now-title">
            {headline}
          </h2>

          <article className="sl-card now" key={`${focus.id}-${moment.phase}`}>
            <div className="k">{cardKicker}</div>
            <div className="t">{focus.title}</div>
            {where(focus) && <div className="s">{where(focus)}</div>}
            {prog?.current && (
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
            {moment.phase !== 'at_stop' && focus.parking && <div className="sl-row"><span>Parking</span><strong>{focus.parking}</strong></div>}
            {hasPin(focus) && (
              <div className="sl-actions">
                <a className="sl-btn" href={directionsUrl(focus, 'google')} target="_blank" rel="noopener noreferrer">
                  Directions
                </a>
                <a className="sl-link" href={directionsUrl(focus, 'waze')} target="_blank" rel="noopener noreferrer">
                  Waze
                </a>
                <a className="sl-link" href={directionsUrl(focus, 'apple')} target="_blank" rel="noopener noreferrer">
                  Apple Maps
                </a>
              </div>
            )}
          </article>

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
              <div className="k soft">Next · {after.time}</div>
              <div className="p">{place(after)}</div>
              <div className="s">{stopLabel(after.type)}</div>
            </article>
          )}

          <a className="sl-more" href="#programme-or-story" onClick={(e) => scrollOn(e)}>
            <span>Programme, story and directions</span>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>

      <a className={`now-bar${away ? ' on' : ''}`} href="#now" aria-hidden={!away} tabIndex={away ? 0 : -1} key={barKey}>
        <span className="sl-dot" aria-hidden="true" />
        <span className="nb-k">{moment.phase === 'at_stop' ? 'Now' : moment.phase === 'in_transit' ? 'Live' : vigil ? 'Tonight' : 'Today'}</span>
        <span className="nb-t">{barText}</span>
        <span className="nb-go">View</span>
      </a>
    </>
  );
}

function nextAfter(journey: Stop[], stop: Stop): Stop | null {
  const same = journey.filter((s) => s.date === stop.date).sort((a, b) => a.time.localeCompare(b.time));
  const i = same.findIndex((s) => s.id === stop.id);
  return i >= 0 ? (same[i + 1] ?? null) : null;
}

/** Scroll to the first section under the stage: the programme when there is one. */
function scrollOn(e: React.MouseEvent) {
  const target = document.getElementById('programme') ?? document.getElementById('story');
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
