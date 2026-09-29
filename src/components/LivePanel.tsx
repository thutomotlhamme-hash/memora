'use client';

import { useNow } from '@/lib/hooks';
import { useLiveData } from './LiveMemorial';
import { liveFuneralState, liveProgrammeState } from '@/lib/live';
import { stageView } from '@/lib/stage';
import { directionsUrl, fmtDate, stopLabel, withPrayers, type Draft, type ProgrammePart, type Stop } from '@/lib/memorial';

function StopCard({ stop, kind }: { stop: Stop; kind: 'now' | 'next' }) {
  return (
    <article className={`live-card ${kind}`}>
      <div className="k">{kind === 'now' ? 'Happening now' : 'Next'}</div>
      <div className="t">{stopLabel(stop.type)}</div>
      <h3>{stop.title}</h3>
      <div className="time">
        {stop.time}
        {stop.departTime ? `–${stop.departTime}` : ''}
      </div>
      {stop.address && <p>{stop.address}</p>}
      {stop.landmark && <p>Entrance: {stop.landmark}</p>}
      {stop.parking && <p>Parking: {stop.parking}</p>}
      {stop.transport && <p>Procession: {stop.transport}</p>}
      <div className="row">
        <a className="btn on-night sm" target="_blank" rel="noopener noreferrer" href={directionsUrl(stop, 'google')}>
          Google Maps
        </a>
        <a className="btn on-night sm" target="_blank" rel="noopener noreferrer" href={directionsUrl(stop, 'apple')}>
          Apple Maps
        </a>
        <a className="btn on-night sm" target="_blank" rel="noopener noreferrer" href={directionsUrl(stop, 'waze')}>
          Waze
        </a>
      </div>
    </article>
  );
}

/**
 * Funeral-day guide. Rendered only after mount (it depends on the guest's own
 * clock and time zone) and refreshed every minute while the page is open.
 */
export function LivePanel(props: { journey: Draft['journey']; programme: Draft['programme']; prayers?: Draft['prayers'] }) {
  const now = useNow();
  const data = useLiveData({ ...props, liveKey: null });
  const { programme, liveKey } = data;
  const journey = withPrayers(data.journey, data.prayers ?? props.prayers);
  if (!now) return null;

  const live = liveFuneralState(journey, now);
  // While a gathering is on, the full-screen stage at the top of the page shows it.
  if (live.phase === 'none' || stageView(journey, programme, liveKey, now)) return null;
  const stopNow = live.phase === 'at_stop' || live.phase === 'in_transit' ? live.currentStop : live.phase === 'before_start' ? live.nextStop : null;
  const parts: ProgrammePart[] = stopNow?.type === 'vigil' ? ['vigil'] : ['service', 'graveside'];
  const prog = stopNow ? liveProgrammeState(programme, now, liveKey, parts) : null;

  let pill = '';
  let headline = '';
  let body: React.ReactNode = null;
  switch (live.phase) {
    case 'upcoming':
      headline = live.daysUntil === 1 ? 'The funeral is tomorrow.' : `The funeral is in ${live.daysUntil} days.`;
      body = <p>{fmtDate(live.date)}. On the day, this page becomes a live guide showing where to be and when.</p>;
      break;
    case 'between':
      headline = 'This funeral spans more than one day.';
      body = <p>The next gathering is on {fmtDate(live.date)}.</p>;
      break;
    case 'before_start':
      pill = 'Today';
      headline = 'Today. The first stop hasn’t started yet.';
      body = (
        <div className="live-grid single">
          <StopCard stop={live.nextStop} kind="next" />
        </div>
      );
      break;
    case 'at_stop':
    case 'in_transit':
      pill = 'Live';
      headline = live.phase === 'at_stop' ? 'Happening now.' : 'On the way to the next stop.';
      body = (
        <div className="live-grid">
          <StopCard stop={live.currentStop} kind="now" />
          {live.nextStop && <StopCard stop={live.nextStop} kind="next" />}
        </div>
      );
      break;
    case 'concluded_today':
      headline = 'Today’s gatherings have ended.';
      body = <p>Thank you for being with the family today. The full journey and programme remain below.</p>;
      break;
    case 'concluded':
      headline = 'The funeral has taken place.';
      body = <p>Thank you for your love and support. Their story, the programme and the journey remain below.</p>;
      break;
  }

  return (
    <section className="live-panel" id="live" aria-live="polite">
      <div className="top">
        {pill && <span className="pill live dot">{pill}</span>}
        <h2 className="h2">{headline}</h2>
      </div>
      {body}
      {prog && (
        <div className="live-programme">
          {prog.current && (
            <div className="r now">
              <span>Now</span>
              <div>
                <strong>{prog.current.title}</strong>
                {prog.current.presenter ? <span className="muted"> · {prog.current.presenter}</span> : null}
              </div>
            </div>
          )}
          {prog.next && (
            <div className="r">
              <span>Next{prog.next.time ? ` · ${prog.next.time}` : ''}</span>
              <div>
                <strong>{prog.next.title}</strong>
                {prog.next.presenter ? <span className="muted"> · {prog.next.presenter}</span> : null}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
