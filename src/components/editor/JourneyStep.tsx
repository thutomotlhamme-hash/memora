'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  DISPOSITION_LABELS,
  STOP_TYPE_LABELS,
  fmtDate,
  funeralDate,
  journeyGate,
  newId,
  stopLabel,
  type DispositionType,
  journeyOrderProblem,
  type Draft,
  type Stop,
  type StopType,
} from '@/lib/memorial';
import { PlaceSearch } from './PlaceSearch';
import { PrayerWeekEditor } from './PrayerWeekEditor';
import { LIKELY_TIMES, QuickPicks, likelyDays } from './QuickPicks';
import { PanelFoot, type Nav, type Update } from './shared';

const MapPicker = dynamic(() => import('./MapPicker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="map-box" />,
});

type StopForm = Omit<Stop, 'lat' | 'lng'> & { lat: string; lng: string };

const blankStop = (date: string): StopForm => ({
  id: '',
  type: 'church',
  title: '',
  date,
  time: '',
  departTime: '',
  address: '',
  landmark: '',
  parking: '',
  transport: '',
  notes: '',
  lat: '',
  lng: '',
});

const RULE: Record<string, string> = {
  burial: 'Add the cemetery as a stop in the journey below.',
  cremation: 'Add the crematorium as a stop in the journey below.',
  private_burial_later: 'The burial is private, so no cemetery stop is needed.',
  memorial_only: 'No cemetery or crematorium stop is needed.',
  other: 'Describe the service in the note.',
};

export function JourneyStep({ draft, update, nav }: { draft: Draft; update: Update; nav: Nav }) {
  const toast = useToast();
  const stops = draft.journey;
  const gate = journeyGate(draft);
  const firstDate = funeralDate(draft);
  const [form, setForm] = useState<StopForm | null>(() => (stops.length ? null : blankStop(firstDate)));
  const [error, setError] = useState('');
  const editing = Boolean(form?.id);

  const setStops = (fn: (s: Stop[]) => Stop[]) => update((d) => ({ ...d, journey: fn(d.journey) }));
  const move = (id: string, dir: -1 | 1) => {
    const i = stops.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    // The journey reads in time order, so a move must keep the times in sequence.
    const problem = journeyOrderProblem(next);
    if (problem) return toast('Stops follow the time order. Change the times first, then move it.', 'error');
    setStops(() => next);
  };

  const saveStop = () => {
    if (!form) return;
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!form.title.trim()) return setError('Give this stop a name.');
    if (!form.date || !form.time) return setError('Add the date and the start or arrival time.');
    if (form.lat === '' || form.lng === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return setError('Place the pin on the map, or enter valid coordinates.');
    if (form.departTime && form.departTime < form.time) return setError('The end time is before the start time.');
    const stop: Stop = { ...form, title: form.title.trim(), id: form.id || newId('stop'), lat, lng };
    const previous = stops.find((s) => s.id === stop.id);
    let next = editing ? stops.map((s) => (s.id === stop.id ? stop : s)) : [...stops, stop];
    // Moving the first stop's date carries along every stop that shared the old funeral date.
    if (previous && stops[0]?.id === stop.id && previous.date !== stop.date) {
      next = next.map((s) => (s.id !== stop.id && s.date === previous.date ? { ...s, date: stop.date } : s));
    }
    const problem = journeyOrderProblem(next);
    if (problem) return setError(problem);
    setError('');
    setStops(() => next);
    toast(editing ? 'Stop updated.' : 'Stop added to the journey.');
    setForm(null);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast('Location isn’t available in this browser.', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => (f ? { ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) } : f)),
      () => toast('Location permission was not granted.', 'error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const type = draft.disposition.type;

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Step 2 · Funeral journey</span>
        <h1 className="h1">Map the funeral, stop by stop.</h1>
        <p className="lede">
          Add each place in the order the family will move through it, with an exact pin, so guests can find the right gate on the day.
        </p>
      </header>

      <section>
        <div className="subsection-head">
          <span className="eyebrow plain">Type of service</span>
          <h2 className="h3">What kind of service is it?</h2>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="disposition">Service</label>
            <select
              id="disposition"
              className="select"
              value={type}
              onChange={(e) => update((d) => ({ ...d, disposition: { ...d.disposition, type: e.target.value as DispositionType } }))}
            >
              <option value="">Choose one</option>
              {Object.entries(DISPOSITION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {type && <span className="hint">{RULE[type]}</span>}
          </div>
          <div className="field">
            <label htmlFor="dispositionNotes">Note {type === 'other' ? '(required)' : '(optional)'}</label>
            <input
              id="dispositionNotes"
              className="input"
              value={draft.disposition.notes}
              onChange={(e) => update((d) => ({ ...d, disposition: { ...d.disposition, notes: e.target.value } }))}
              placeholder={type === 'other' ? 'Describe the service' : 'Shown on the memorial next to the service type'}
            />
          </div>
        </div>
      </section>

      <section className="subsection">
        <div className="subsection-head row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="eyebrow plain">The route</span>
            <h2 className="h3">{stops.length ? `${stops.length} stop${stops.length > 1 ? 's' : ''}` : 'No stops yet'}</h2>
          </div>
          {!form && (
            <button className="btn accent" type="button" onClick={() => setForm(blankStop(firstDate))}>
              + Add a stop
            </button>
          )}
        </div>

        <div className="list">
          {stops.length === 0 && !form && (
            <div className="empty-line">A journey can be Church → Cemetery, Home → Church → Cemetery → Reception, or any route that matches the real day.</div>
          )}
          {stops.map((s, i) => (
            <article key={s.id} className={`list-item ${form?.id === s.id ? 'editing' : ''}`}>
              <span className="idx">{i + 1}</span>
              <div>
                <span className="kind">{stopLabel(s.type)}</span>
                <h4>
                  {s.time} · {s.title}
                </h4>
                <p>
                  {fmtDate(s.date)}
                  {s.departTime ? `–${s.departTime}` : ''}
                  {s.address ? ` · ${s.address}` : ''}
                </p>
              </div>
              <div className="list-actions">
                <button className="icon-btn" type="button" aria-label={`Move ${s.title} earlier`} disabled={i === 0} onClick={() => move(s.id, -1)}>
                  ↑
                </button>
                <button className="icon-btn" type="button" aria-label={`Move ${s.title} later`} disabled={i === stops.length - 1} onClick={() => move(s.id, 1)}>
                  ↓
                </button>
                <button className="btn sm" type="button" onClick={() => setForm({ ...s, lat: String(s.lat), lng: String(s.lng) })}>
                  Edit
                </button>
                <button
                  className="btn sm danger"
                  type="button"
                  onClick={() => {
                    setStops((list) => list.filter((x) => x.id !== s.id));
                    if (form?.id === s.id) setForm(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>

        {form && (
          <div className="form-block">
            <div className="form-block-head">
              <h3 className="h4">{editing ? `Edit “${form.title || 'stop'}”` : 'New stop'}</h3>
              {(stops.length > 0 || editing) && (
                <button className="text-link small" type="button" onClick={() => (setForm(null), setError(''))}>
                  Cancel
                </button>
              )}
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="stopType">Type of stop</label>
                <select id="stopType" className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as StopType })}>
                  {Object.entries(STOP_TYPE_LABELS)
                    .filter(([v]) => v !== 'prayers')
                    .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="stopTitle">Name</label>
                <input id="stopTitle" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. St Peter’s Anglican Church" />
              </div>
              <div className="field">
                <label htmlFor="stopDate">Date</label>
                <input id="stopDate" className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                <QuickPicks label="Likely dates" picks={(now) => likelyDays(stops.filter((s) => s.id !== form.id).map((s) => s.date), now)} value={form.date} onPick={(date) => setForm({ ...form, date })} />
                {firstDate && !editing && <span className="hint">Defaults to the funeral date, {fmtDate(firstDate)}.</span>}
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label htmlFor="stopTime">Starts at</label>
                  <input id="stopTime" className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  <QuickPicks label="Usual start times" picks={LIKELY_TIMES} value={form.time} onPick={(time) => setForm({ ...form, time })} />
                </div>
                <div className="field">
                  <label htmlFor="stopDepart">Ends at</label>
                  <input id="stopDepart" className="input" type="time" value={form.departTime} onChange={(e) => setForm({ ...form, departTime: e.target.value })} />
                  <span className="hint">Optional. When everyone leaves for the next stop.</span>
                </div>
              </div>

              <div className="span-2">
                <PlaceSearch
                  near={form.lat !== '' && form.lng !== '' ? { lat: Number(form.lat), lng: Number(form.lng) } : stops[stops.length - 1] ?? null}
                  onPick={(p) =>
                    setForm((f) => (f ? { ...f, title: f.title || p.name, address: p.address, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) } : f))
                  }
                />
              </div>
              <div className="field span-2">
                <span className="label">Exact pin</span>
                <MapPicker
                  lat={form.lat === '' ? null : Number(form.lat)}
                  lng={form.lng === '' ? null : Number(form.lng)}
                  onChange={(lat, lng) => setForm((f) => (f ? { ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) } : f))}
                />
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="hint">Tap the map to move the pin, or drag it to the exact entrance.</span>
                  <button className="btn sm" type="button" onClick={useMyLocation}>
                    Use my location
                  </button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="stopLat">Latitude</label>
                <input id="stopLat" className="input" inputMode="decimal" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="-25.746100" />
              </div>
              <div className="field">
                <label htmlFor="stopLng">Longitude</label>
                <input id="stopLng" className="input" inputMode="decimal" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="28.188100" />
              </div>
              <div className="field span-2">
                <label htmlFor="stopAddress">Address guests will recognise</label>
                <input id="stopAddress" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="stopLandmark">Landmark or entrance</label>
                <input id="stopLandmark" className="input" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} placeholder="e.g. Gate 2, opposite the clinic" />
              </div>
              <div className="field">
                <label htmlFor="stopParking">Parking</label>
                <input id="stopParking" className="input" value={form.parking} onChange={(e) => setForm({ ...form, parking: e.target.value })} placeholder="Where to park, accessibility" />
              </div>
              <div className="field span-2">
                <label htmlFor="stopTransport">Procession or transport</label>
                <textarea
                  id="stopTransport"
                  className="textarea short"
                  value={form.transport}
                  onChange={(e) => setForm({ ...form, transport: e.target.value })}
                  placeholder="e.g. Buses leave the family home at 08:00. Vehicles follow the hearse."
                />
              </div>
              <div className="field span-2">
                <label htmlFor="stopNotes">Anything else guests should know</label>
                <textarea
                  id="stopNotes"
                  className="textarea short"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Dress code, arrival time, a family request"
                />
              </div>
            </div>
            {error && (
              <div className="note error" role="alert" style={{ marginTop: 16 }}>
                {error}
              </div>
            )}
            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn accent" type="button" onClick={saveStop}>
                {editing ? 'Update stop' : 'Add stop'}
              </button>
            </div>
          </div>
        )}
      </section>

      <PrayerWeekEditor draft={draft} update={update} />

      <div className={`note ${gate.ready ? 'ok' : 'warn'}`} style={{ marginTop: 24 }}>
        <span>
          <strong>{gate.ready ? 'Ready.' : 'Still needed:'}</strong> {gate.message}
        </span>
      </div>

      <PanelFoot nav={nav} />
    </div>
  );
}
