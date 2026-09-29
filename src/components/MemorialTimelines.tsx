'use client';

import { directionsUrl, fmtDate, programmeParts, programmeTypeLabel, routeUrl, stopLabel, type Draft } from '@/lib/memorial';
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
export function ProgrammeTimeline({ programme }: { programme: Draft['programme'] }) {
  const live = useLiveData({ journey: [], programme, liveKey: null });
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
  const showHeadings = groups.length > 1 || groups[0]?.part !== 'service';
  // Running number across parts, for items without a time.
  const number = new Map(groups.flatMap((g) => g.items).map((it, i) => [it.id, i + 1]));
  return (
    <div className="programme-parts">
      {groups.map((g) => (
        <section key={g.part} className={`programme-part part-${g.part}`}>
          {showHeadings && <h3 className="part-title">{g.label}</h3>}
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
  return (
    <div className="timeline journey">
      {journey.map((s, i) => {
        const next = journey[i + 1];
        return (
          <article className="t-item" key={s.id}>
            <div className="t-when">
              <strong>{s.time}</strong>
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
