'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { fmtDate, localDateKey, stopLabel, type Stop } from '@/lib/memorial';
import { ARRIVAL_RADIUS_M, SHARING_HOURS, distanceM, etaRange, formatDistance, formatEta, shouldSend, type ProcessionRecord } from '@/lib/procession';
import { toMinutes } from '@/lib/runsheet';

// The coordinator rides in the lead car with the run-sheet open. This phone
// shares where the procession is until it arrives, is paused or ended, or six
// hours pass. Only the latest position is kept; guests see it on the memorial.

type Fix = { lat: number; lng: number; at: number; accuracy: number };

const hasCoords = (s: Stop) => Number.isFinite(s.lat) && Number.isFinite(s.lng);

function defaultDestination(journey: Stop[]): string {
  const today = localDateKey();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const todays = journey.filter((s) => s.date === today && hasCoords(s));
  const next = todays.find((s) => (toMinutes(s.time) ?? 0) >= nowMin) ?? todays[todays.length - 1];
  return (next ?? journey.find(hasCoords))?.id ?? '';
}

export function ProcessionControl({
  token,
  journey,
  record,
  onRecord,
  onRevoked,
}: {
  token: string;
  journey: Stop[];
  record: ProcessionRecord | null;
  onRecord: (r: ProcessionRecord | null) => void;
  onRevoked: () => void;
}) {
  const toast = useToast();
  const [toStop, setToStop] = useState(() => record?.toStopId ?? defaultDestination(journey));
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [fix, setFix] = useState<Fix | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<Fix | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const api = `/api/run/${encodeURIComponent(token)}/procession`;

  const status = record?.status ?? 'ENDED';
  const dest = journey.find((s) => s.id === (status !== 'ENDED' ? record?.toStopId : toStop)) ?? null;
  const destRef = useRef(dest);
  useEffect(() => {
    destRef.current = dest;
  }, [dest]);

  const send = useCallback(
    async (body: Record<string, unknown>): Promise<ProcessionRecord | null | 'failed'> => {
      try {
        const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json().catch(() => ({}));
        if (res.status === 404) {
          onRevoked();
          return 'failed';
        }
        if (!res.ok) {
          setProblem(json?.error || 'That didn’t go through.');
          return 'failed';
        }
        setProblem('');
        onRecord(json.procession ?? null);
        return json.procession ?? null;
      } catch {
        setProblem('No signal. Positions will send again when the connection returns.');
        return 'failed';
      }
    },
    [api, onRecord, onRevoked],
  );

  // ---- Keep the screen awake while sharing (phones stop GPS when it sleeps) --
  const holdScreen = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && !wakeLock.current) wakeLock.current = await nav.wakeLock.request('screen');
    } catch {
      // Not supported or refused: the on-screen reminder covers it.
    }
  }, []);
  const releaseScreen = useCallback(() => {
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    lastSent.current = null;
    setWatching(false);
    releaseScreen();
  }, [releaseScreen]);

  const end = useCallback(
    async (message?: string) => {
      stopWatching();
      setBusy(true);
      await send({ action: 'end' });
      setBusy(false);
      setFix(null);
      toast(message ?? 'Location sharing has ended. Guests no longer see the procession.');
    },
    [send, stopWatching, toast],
  );

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setProblem('This phone’s browser can’t share location. Try Chrome or Safari.');
      return;
    }
    if (watchId.current != null) return;
    setWatching(true);
    void holdScreen();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now(), accuracy: pos.coords.accuracy };
        setFix(next);
        const d = destRef.current;
        if (d && hasCoords(d) && distanceM(next, d) <= ARRIVAL_RADIUS_M && pos.coords.accuracy < 200) {
          void end(`Arrived at ${d.title}. Location sharing has ended.`);
          return;
        }
        if (!shouldSend(lastSent.current, next)) return;
        lastSent.current = next;
        void send({ action: 'position', lat: next.lat, lng: next.lng, accuracy: next.accuracy }).then((r) => {
          if (r === 'failed') lastSent.current = null;
          else if (!r || r.status === 'ENDED') {
            stopWatching();
            toast('Location sharing ended (it stops by itself after 6 hours).', 'error');
          }
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stopWatching();
          setProblem('Location is blocked for this site. Allow it in your browser settings (Site settings → Location), then tap the button again.');
        } else {
          setProblem('Looking for GPS… Move to an open area if this takes long.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );
  }, [end, holdScreen, send, stopWatching, toast]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && watchId.current != null) void holdScreen();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      void wakeLock.current?.release().catch(() => {});
    };
  }, [holdScreen]);

  const start = async () => {
    if (!toStop) return setProblem('Choose where the procession is going.');
    if (!('geolocation' in navigator)) return setProblem('This phone’s browser can’t share location. Try Chrome or Safari.');
    setBusy(true);
    setProblem('');
    // Ask for permission first, so guests never see "about to leave" from a phone that can't share.
    navigator.geolocation.getCurrentPosition(
      async () => {
        const r = await send({ action: 'start', toStopId: toStop });
        setBusy(false);
        if (r !== 'failed') {
          startWatching();
          toast('Sharing the procession. Keep this page open with the screen on.');
        }
      },
      (err) => {
        setBusy(false);
        setProblem(
          err.code === err.PERMISSION_DENIED
            ? 'Location is blocked for this site. Allow it in your browser settings (Site settings → Location), then try again.'
            : 'Couldn’t get a GPS fix yet. Step outside or wait a moment, then try again.',
        );
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  const pause = async () => {
    stopWatching();
    setBusy(true);
    await send({ action: 'pause' });
    setBusy(false);
    toast('Paused. Guests don’t see the position until you resume.');
  };

  const resume = async () => {
    setBusy(true);
    const r = await send({ action: 'resume' });
    setBusy(false);
    if (r !== 'failed') startWatching();
  };

  const choices = journey.filter(hasCoords);
  const metres = fix && dest && hasCoords(dest) ? distanceM(fix, dest) : null;
  const expires = record?.expiresAt ? new Date(record.expiresAt) : null;

  return (
    <section className={`run-proc ${status === 'SHARING' ? 'on' : ''}`}>
      <div className="run-section-head" style={{ marginBottom: 0 }}>
        <h2 className="h3">Procession</h2>
        <span className={`pill ${status === 'SHARING' ? 'live dot' : status === 'PAUSED' ? 'warn' : ''}`}>
          {status === 'SHARING' ? (watching ? 'Sharing from this phone' : 'Sharing') : status === 'PAUSED' ? 'Paused' : 'Not sharing'}
        </span>
      </div>

      {status === 'ENDED' && (
        <>
          <p className="tiny muted" style={{ margin: 0 }}>
            Riding in the lead car? Share where the procession is, so guests can follow it on the memorial with a live estimate of when it arrives.
          </p>
          <label className="field">
            <span className="label">Going to</span>
            <select className="select" value={toStop} onChange={(e) => setToStop(e.target.value)}>
              {choices.map((s) => (
                <option key={s.id} value={s.id}>
                  {stopLabel(s.type)}: {s.title} ({s.date === localDateKey() ? s.time : `${fmtDate(s.date)} ${s.time}`})
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" type="button" disabled={busy || !choices.length} onClick={() => void start()}>
            {busy ? 'Starting…' : 'Start sharing the procession'}
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Anyone with the memorial link can see the procession while this is on. Only the latest position is kept, never a history. It stops by itself on
            arrival or after {SHARING_HOURS} hours.
          </p>
        </>
      )}

      {status !== 'ENDED' && (
        <>
          {dest && (
            <p style={{ margin: 0 }}>
              Heading to <strong>{dest.title}</strong>
              {metres != null && (
                <span className="muted">
                  {' '}
                  · {formatDistance(metres)} · {formatEta(etaRange(metres))}
                </span>
              )}
            </p>
          )}
          {status === 'SHARING' && !watching && (
            <div className="note warn">
              <span>Sharing is on, but this phone isn’t sending its location. If you’re in the lead car, continue from this phone.</span>
            </div>
          )}
          {watching && (
            <p className="tiny muted" style={{ margin: 0 }}>
              Keep this page open with the screen on. Phones stop sharing location when the screen locks.
              {!fix ? ' Waiting for GPS…' : fix.accuracy > 0 ? ` GPS accurate to about ${Math.round(fix.accuracy)} m.` : ''}
            </p>
          )}
          <div className="row">
            {status === 'SHARING' && !watching && (
              <button className="btn primary" type="button" disabled={busy} onClick={startWatching}>
                Continue from this phone
              </button>
            )}
            {status === 'SHARING' && (
              <button className="btn" type="button" disabled={busy} onClick={() => void pause()}>
                Pause
              </button>
            )}
            {status === 'PAUSED' && (
              <button className="btn primary" type="button" disabled={busy} onClick={() => void resume()}>
                Resume sharing
              </button>
            )}
            <button className="btn danger" type="button" disabled={busy} onClick={() => void end()}>
              End sharing
            </button>
          </div>
          {expires && <p className="tiny muted" style={{ margin: 0 }}>Stops by itself at {expires.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })} if not ended sooner.</p>}
        </>
      )}

      {problem && (
        <div className="note error" role="alert">
          <span>{problem}</span>
        </div>
      )}
    </section>
  );
}
