'use client';

import { useState } from 'react';
import { emptyPrayers, localDateKey, partOf, prayerEvenings, type Draft, type PrayerEvening, type PrayerWeek, type Stop } from '@/lib/memorial';
import type { Update } from './shared';

// Prayers during the week before the funeral. One tap sets up every evening with
// sensible defaults (the right dates, 18:00, the family home); everything else is
// optional and filled in right where it's shown.

const SCRIPTURES = [
  'Psalm 23',
  'Psalm 121',
  'John 14:1–3',
  'John 11:25–26',
  'Romans 8:38–39',
  '1 Thessalonians 4:13–18',
  'Isaiah 41:10',
  'Matthew 5:4',
  '2 Corinthians 5:1',
  'Revelation 21:4',
  'Ecclesiastes 3:1–8',
];

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
};
const dayLabel = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return { wd: d.toLocaleDateString('en-ZA', { weekday: 'short' }), day: d.getDate(), month: d.toLocaleDateString('en-ZA', { month: 'short' }) };
};

/** The evening before the vigil (or the funeral), and a start that isn't in the past. */
function defaultRange(draft: Draft): { from: string; to: string } {
  const dated = draft.journey.filter((s) => s.date).sort((a, b) => a.date.localeCompare(b.date));
  const vigil = dated.find((s) => s.type === 'vigil');
  const first = vigil ?? dated[0];
  const today = localDateKey();
  const to = first ? shift(first.date, -1) : shift(today, 5);
  const afterPassing = draft.person.passingDate ? shift(draft.person.passingDate, 1) : today;
  const from = [today, afterPassing].sort().pop()!;
  return { from: from > to ? to : from, to };
}

/** Where the family gathers: the home or vigil stop, if the journey has one. */
function homeStop(journey: Stop[]): Stop | null {
  return journey.find((s) => s.type === 'home') ?? journey.find((s) => s.type === 'vigil') ?? null;
}

export function PrayerWeekEditor({ draft, update }: { draft: Draft; update: Update }) {
  const week = draft.prayers ?? emptyPrayers();
  const [open, setOpen] = useState<string | null>(null);
  const set = (fn: (w: PrayerWeek) => PrayerWeek) => update((d) => ({ ...d, prayers: fn(d.prayers ?? emptyPrayers()) }));
  const setEvening = (date: string, patch: Partial<PrayerEvening>) =>
    set((w) => ({ ...w, evenings: w.evenings.map((e) => (e.date === date ? { ...e, ...patch } : e)) }));

  const start = () => {
    const { from, to } = defaultRange(draft);
    const home = homeStop(draft.journey);
    set((w) => ({
      ...w,
      enabled: true,
      evenings: prayerEvenings(w.evenings, from, to),
      ...(home && !w.place
        ? { place: home.type === 'vigil' ? 'Family home' : home.title, address: home.address, landmark: home.landmark, lat: home.lat, lng: home.lng }
        : {}),
    }));
  };

  const from = week.evenings[0]?.date ?? '';
  const to = week.evenings[week.evenings.length - 1]?.date ?? '';
  const setRange = (f: string, t: string) => set((w) => ({ ...w, evenings: prayerEvenings(w.evenings, f, t) }));
  const on = week.evenings.filter((e) => e.on).length;
  const home = homeStop(draft.journey);
  const vigil = draft.journey.find((s) => s.type === 'vigil');
  const vigilItems = draft.programme.items.filter((i) => partOf(i) === 'vigil');

  if (!week.enabled) {
    return (
      <section className="subsection prayer-week">
        <div className="subsection-head">
          <span className="eyebrow plain">The week before</span>
          <h2 className="h3">Are there prayers at home during the week?</h2>
        </div>
        <button type="button" className="part-add prayer-start" onClick={start}>
          <strong>+ Yes, set up evening prayers</strong>
          <span>Every evening until the {vigil ? 'night vigil' : 'funeral'}, at 18:00{home ? ` at ${home.type === 'vigil' ? 'the family home' : home.title}` : ''}. Change anything after.</span>
        </button>
      </section>
    );
  }

  return (
    <section className="subsection prayer-week">
      <div className="subsection-head row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="eyebrow plain">The week before</span>
          <h2 className="h3">
            Evening prayers · {on} evening{on === 1 ? '' : 's'}
          </h2>
        </div>
        <button type="button" className="text-link small" onClick={() => set((w) => ({ ...w, enabled: false }))}>
          Remove prayers
        </button>
      </div>

      <div className="pw-basics">
        <div className="field">
          <label htmlFor="pwFrom">From</label>
          <input className="input" id="pwFrom" type="date" value={from} max={to || undefined} onChange={(e) => setRange(e.target.value, to || e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pwTo">Until</label>
          <input className="input" id="pwTo" type="date" value={to} min={from || undefined} onChange={(e) => setRange(from || e.target.value, e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pwTime">Usual time</label>
          <input className="input" id="pwTime" type="time" value={week.time} onChange={(e) => set((w) => ({ ...w, time: e.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="pwEnd">Ends (optional)</label>
          <input className="input" id="pwEnd" type="time" value={week.endTime} onChange={(e) => set((w) => ({ ...w, endTime: e.target.value }))} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="pwPlace">Where</label>
        <div className="pw-where">
          <input className="input" id="pwPlace" value={week.place} placeholder="e.g. Family home" onChange={(e) => set((w) => ({ ...w, place: e.target.value }))} />
          <input className="input" aria-label="Address" value={week.address} placeholder="Street address" onChange={(e) => set((w) => ({ ...w, address: e.target.value }))} />
        </div>
        {draft.journey.some((s) => Number.isFinite(s.lat)) && (
          <div className="pw-same">
            <span className="hint">Same place as:</span>
            {draft.journey
              .filter((s) => Number.isFinite(s.lat))
              .slice(0, 4)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip${week.lat === s.lat && week.lng === s.lng ? ' on' : ''}`}
                  onClick={() => set((w) => ({ ...w, place: s.type === 'vigil' ? 'Family home' : s.title, address: s.address, landmark: s.landmark, lat: s.lat, lng: s.lng }))}
                >
                  {s.title}
                </button>
              ))}
          </div>
        )}
      </div>

      <p className="hint" style={{ margin: '18px 0 8px' }}>
        Tap an evening to add its service title, word of the day and scripture. Tap the date to switch an evening off.
      </p>
      <datalist id="pwScriptures">
        {SCRIPTURES.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <ol className="pw-evenings">
        {week.evenings.map((e) => {
          const l = dayLabel(e.date);
          const isOpen = open === e.date;
          const summary = [e.title, e.scripture, e.word && `“${e.word}”`].filter(Boolean).join(' · ');
          return (
            <li key={e.date} className={`pw-evening${e.on ? '' : ' off'}${isOpen ? ' open' : ''}`}>
              <div className="pw-row">
                <button
                  type="button"
                  className="pw-date"
                  aria-pressed={e.on}
                  aria-label={`${e.on ? 'Switch off' : 'Switch on'} prayers on ${l.wd} ${l.day} ${l.month}`}
                  onClick={() => setEvening(e.date, { on: !e.on })}
                >
                  <span>{l.wd}</span>
                  <strong>{l.day}</strong>
                  <span>{l.month}</span>
                </button>
                <button type="button" className="pw-summary" disabled={!e.on} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.date)}>
                  <strong>{e.on ? e.title || 'Evening prayers' : 'No prayers'}</strong>
                  <span>{e.on ? [e.time || week.time, summary || 'Add title, word of the day, scripture'].filter(Boolean).join(' · ') : 'Tap the date to switch back on'}</span>
                </button>
              </div>
              {isOpen && e.on && (
                <div className="pw-details">
                  <div className="field">
                    <label htmlFor={`pwTitle-${e.date}`}>Title of the service</label>
                    <input
                      className="input"
                      id={`pwTitle-${e.date}`}
                      value={e.title}
                      placeholder="e.g. A service of comfort"
                      onChange={(ev) => setEvening(e.date, { title: ev.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`pwWord-${e.date}`}>Word of the day</label>
                    <input className="input" id={`pwWord-${e.date}`} value={e.word} placeholder="e.g. Hope" onChange={(ev) => setEvening(e.date, { word: ev.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor={`pwScr-${e.date}`}>Scripture</label>
                    <input
                      className="input"
                      id={`pwScr-${e.date}`}
                      list="pwScriptures"
                      value={e.scripture}
                      placeholder="e.g. Psalm 23"
                      onChange={(ev) => setEvening(e.date, { scripture: ev.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`pwLead-${e.date}`}>Led by</label>
                    <input
                      className="input"
                      id={`pwLead-${e.date}`}
                      value={e.leader}
                      placeholder="e.g. Pastor Dube, St John’s"
                      onChange={(ev) => setEvening(e.date, { leader: ev.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`pwTime-${e.date}`}>Time</label>
                    <input className="input" id={`pwTime-${e.date}`} type="time" value={e.time || week.time} onChange={(ev) => setEvening(e.date, { time: ev.target.value })} />
                  </div>
                  <div className="row" style={{ alignItems: 'flex-end' }}>
                    <button type="button" className="btn sm" onClick={() => setOpen(nextOpen(week.evenings, e.date))}>
                      Next evening →
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="pw-vigil">
        <span className="eyebrow plain">{vigil ? `${dayLabel(vigil.date).wd} ${dayLabel(vigil.date).day} ${dayLabel(vigil.date).month}` : 'The night before'}</span>
        <strong>Night vigil{vigil?.time ? ` · from ${vigil.time}` : ''}</strong>
        <span className="hint">
          {vigilItems.length
            ? `${vigilItems.length} items, starting with “${vigilItems[0].title}”. Edit it in step 3.`
            : 'The arrival home, then a short prayer service or a whole-night vigil. Set it up in step 3 with one tap.'}
        </span>
      </div>
    </section>
  );
}

function nextOpen(evenings: PrayerEvening[], date: string): string | null {
  const i = evenings.findIndex((e) => e.date === date);
  return evenings.slice(i + 1).find((e) => e.on)?.date ?? null;
}

