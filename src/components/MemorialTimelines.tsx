'use client';

import { directionsUrl, fmtDate, partStart, partStartLabel, programmeParts, programmeTypeLabel, routeUrl, stopLabel, type Draft } from '@/lib/memorial';
import { useNow } from '@/lib/hooks';
import { distanceM, etaRange, formatEta } from '@/lib/procession';
import { journeyProgress } from '@/lib/stage';
import { useLiveData } from './LiveMemorial';

/** When the family has chosen to share the programme later: "Saturday 3 October at 06:00". */
export function releaseLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const time = new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${day} at ${time}`;
}

/**
 * Order of service, in its parts: night vigil, the service, at the graveside.
 * On the day it follows the coordinator's running order and marks what's
 * happening now. Before the family releases it, guests see when it will appear.
 */
export function ProgrammeTimeline({ programme, journey = [] }: { programme: Draft['programme']; journey?: Draft['journey'] }) {
  const live = useLiveData({ journey, programme, liveKey: null });
  const stops = live.journey.length ? live.journey : journey;
  const items = live.programme.items.length ? live.programme.items : programme.items;
  if (!items.length) {
    const when = programme.releaseAt ? releaseLabel(programme.releaseAt) : '';
    return (
      <div className="programme-soon">
        <span className="eyebrow">Coming soon</span>
        <p>The family will share the order of service {when ? <strong>on {when}</strong> : 'closer to the day'}. It will appear here, so keep this page.</p>
      </div>
    );
  }
  const groups = programmeParts(items);
  const starts = new Map(groups.map((g) => [g.part, partStartLabel(partStart(stops, items, g.part), g.part)]));
  const showHeadings = groups.length > 1 || groups[0]?.part !== 'service' || Boolean(starts.get(groups[0]?.part));
  // Running number across parts, for items without a time.
  const number = new Map(groups.flatMap((g) => g.items).map((it, i) => [it.id, i + 1]));
  return (
    <div className="programme-parts">
      {groups.map((g) => (
        <section key={g.part} className={`programme-part part-${g.part}`}>
          {showHeadings && (
            <header className="part-title-wrap">
              <h3 className="part-title">{g.label}</h3>
              {starts.get(g.part) && <p className="part-when">{starts.get(g.part)}</p>}
            </header>
          )}
          <div className="timeline">
            {g.items.map((item) => {
              const now = live.liveKey === item.id;
              return (
                <article className={`t-item${now ? ' now' : ''}`} key={item.id} aria-current={now ? 'step' : undefined}>
                  <div className="t-when">
                    <strong>{item.time || String(number.get(item.id) ?? 0).padStart(2, '0')}</strong>
                    {now && <span className="pill live dot">Now</span>}
                  </div>
                  <div className="t-body">
                    <span className="kind">{programmeTypeLabel(item.type)}</span>
                    <h3>{item.title}</h3>
                    {item.presenter && <p>{item.presenter}</p>}
                    {item.detail && <p className="meta">{item.detail}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Funeral journey. Stop times follow the coordinator's changes on the day. */
export function JourneyTimeline({ journey: initial }: { journey: Draft['journey'] }) {
  const live = useLiveData({ journey: initial, programme: { mode: '', items: [] }, liveKey: null });
  const journey = live.journey.length ? live.journey : initial;
  // On the day the line follows what the live view shows: where people are now,
  // what's behind, and the procession filling the line as it nears the next stop.
  const now = useNow();
  const day = now ? journeyProgress(journey, now, live.procession) : null;
  const on = Boolean(day && (day.now || day.moving || day.past.size));
  const road = day?.moving ?? null;
  const p = live.procession;
  const roadTo = road ? journey.find((st) => st.id === road.to) : undefined;
  const eta =
    p?.state === 'moving' && roadTo && Number.isFinite(roadTo.lat) ? formatEta(etaRange(distanceM({ lat: p.lat, lng: p.lng }, { lat: roadTo.lat, lng: roadTo.lng }))) : '';
  return (
    <div className={`timeline journey${on ? ' live' : ''}`}>
      {journey.map((s, i) => {
        const next = journey[i + 1];
        const state = !day ? '' : day.now === s.id ? ' is-now' : day.past.has(s.id) ? ' is-past' : road?.to === s.id ? ' is-next' : '';
        const seg = !day || !next ? '' : road?.from === s.id && road.to === next.id ? ' seg-moving' : day.past.has(next.id) || day.now === next.id || (day.past.has(s.id) && road?.to === next.id) ? ' seg-done' : '';
        return (
          <article
            className={`t-item${state}${seg}`}
            key={s.id}
            style={seg === ' seg-moving' ? ({ ['--p' as string]: String(road?.progress ?? 0.5) } as React.CSSProperties) : undefined}
          >
            {seg === ' seg-moving' && <span className="t-road" aria-hidden="true" />}
            <div className="t-when">
              <strong>{s.time}</strong>
              {state === ' is-now' && <span className="t-now">Now</span>}
              {fmtDate(s.date)}
              {s.departTime && <div>until {s.departTime}</div>}
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
              {seg === ' seg-moving' && next && (
                <p className="t-live-road" role="status">
                  <span className="sl-dot" aria-hidden="true" />
                  {p && p.state !== 'paused' ? 'The procession is on its way' : 'On the way'} to {next.title}
                  {eta ? ` · ${eta.toLowerCase()}` : ''}
                </p>
              )}
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
  );
}
