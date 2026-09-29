'use client';

import dynamic from 'next/dynamic';
import { useNow } from '@/lib/hooks';
import { directionsUrl, stopLabel, type Draft } from '@/lib/memorial';
import { distanceM, etaRange, formatDistance, formatEta } from '@/lib/procession';
import { useLiveData } from './LiveMemorial';

const ProcessionMap = dynamic(() => import('./ProcessionMap').then((m) => m.ProcessionMap), { ssr: false });

/** Guests follow the procession while the coordinator shares it. Nothing shows otherwise. */
export function ProcessionCard({ journey }: { journey: Draft['journey'] }) {
  const now = useNow();
  const live = useLiveData({ journey, programme: { mode: '', items: [] }, liveKey: null, procession: null });
  const p = live.procession;
  if (!p || !now) return null;

  const stops = live.journey.length ? live.journey : journey;
  const dest = stops.find((s) => s.id === p.toStopId) ?? null;
  const destPoint = dest && Number.isFinite(dest.lat) && Number.isFinite(dest.lng) ? { lat: dest.lat, lng: dest.lng } : null;
  const car = p.state === 'moving' ? { lat: p.lat, lng: p.lng } : null;
  const metres = car && destPoint ? distanceM(car, destPoint) : null;
  const eta = metres != null ? formatEta(etaRange(metres)) : '';
  const ago = 'positionAt' in p && p.positionAt ? Math.max(0, Math.round((now.getTime() - new Date(p.positionAt).getTime()) / 60_000)) : null;

  let headline = 'The procession is on its way.';
  let detail = '';
  if (p.state === 'waiting') {
    headline = 'The procession is about to leave.';
    detail = 'Its position will appear here in a moment.';
  } else if (p.state === 'paused') {
    headline = 'Procession updates are paused.';
    detail = 'The family’s coordinator paused location sharing. It will return here if they resume.';
  } else if (p.state === 'signal_lost') {
    headline = 'Waiting for the next update.';
    detail = `The coordinator’s phone hasn’t sent a position${ago != null ? ` for ${ago} min` : ''}. It may be out of signal.`;
  } else if (metres != null && metres <= 150) {
    headline = `The procession has arrived${dest ? ` at ${dest.title}` : ''}.`;
  }

  return (
    <section className="proc-card" id="procession" aria-live="polite">
      <div className="proc-head">
        <div>
          <span className="pill live dot">{p.state === 'moving' ? 'Live' : 'Procession'}</span>
          <h2 className="h3" style={{ marginTop: 10 }}>
            {headline}
          </h2>
          {dest && (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Heading to <strong>{dest.title}</strong> · {stopLabel(dest.type)}
            </p>
          )}
        </div>
        {eta && p.state === 'moving' && (
          <div className="proc-eta">
            <span className="tiny muted">Estimated arrival</span>
            <strong>{eta}</strong>
            {metres != null && <span className="tiny muted">{formatDistance(metres)} away in a straight line</span>}
          </div>
        )}
      </div>
      {detail && <p className="muted" style={{ margin: 0 }}>{detail}</p>}
      {(car || destPoint) && <ProcessionMap car={car} destination={destPoint} destinationLabel={dest?.title ?? 'the destination'} />}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tiny muted">
          {p.state === 'moving' && ago != null ? (ago === 0 ? 'Updated just now' : `Updated ${ago} min ago`) : ''} · A broad guide only; traffic and stops change it.
        </span>
        {dest && (
          <a className="btn sm" href={directionsUrl(dest, 'google')} target="_blank" rel="noopener noreferrer">
            Directions to {dest.title}
          </a>
        )}
      </div>
    </section>
  );
}
