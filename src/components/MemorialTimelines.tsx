'use client';

import { directionsUrl, fmtDate, programmeTypeLabel, routeUrl, stopLabel, type Draft } from '@/lib/memorial';
import { useLiveData } from './LiveMemorial';

/** Order of service. On the day it follows the coordinator's running order and marks the item happening now. */
export function ProgrammeTimeline({ programme }: { programme: Draft['programme'] }) {
  const live = useLiveData({ journey: [], programme, liveKey: null });
  const items = live.programme.items.length ? live.programme.items : programme.items;
  return (
    <div className="timeline">
      {items.map((item, i) => {
        const now = live.liveKey === item.id;
        return (
          <article className={`t-item${now ? ' now' : ''}`} key={item.id} aria-current={now ? 'step' : undefined}>
            <div className="t-when">
              <strong>{item.time || String(i + 1).padStart(2, '0')}</strong>
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
  );
}

/** Funeral journey. Stop times follow the coordinator's changes on the day. */
export function JourneyTimeline({ journey: initial }: { journey: Draft['journey'] }) {
  const live = useLiveData({ journey: initial, programme: { mode: '', items: [] }, liveKey: null });
  const journey = live.journey.length ? live.journey : initial;
  return (
    <div className="timeline">
      {journey.map((s, i) => {
        const next = journey[i + 1];
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
  );
}
