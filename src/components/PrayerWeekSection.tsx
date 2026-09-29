'use client';

import { useNow } from '@/lib/hooks';
import { directionsUrl, localDateKey, prayerStops, stopLabel, type Draft, type Stop } from '@/lib/memorial';
import { timeToMinutes } from '@/lib/live';
import { useLiveData } from './LiveMemorial';

/** When a gathering ends: its end time, else two hours after it starts. */
const endOf = (s: Stop) => timeToMinutes(s.departTime) ?? (timeToMinutes(s.time) ?? 0) + 120;

const dayParts = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return { wd: d.toLocaleDateString('en-ZA', { weekday: 'long' }), day: d.getDate(), month: d.toLocaleDateString('en-ZA', { month: 'short' }) };
};

/**
 * Prayers during the week: every evening with its service title, word of the day
 * and scripture, and the vigil and funeral that follow. "Tonight" and "Up next"
 * make the next gathering easy to spot; evenings already held fade back.
 */
export function PrayerWeekSection({ draft }: { draft: Draft }) {
  const now = useNow();
  const live = useLiveData({ journey: draft.journey, programme: draft.programme, liveKey: null, prayers: draft.prayers });
  const week = live.prayers ?? draft.prayers;
  const evenings = week?.enabled ? week.evenings.filter((e) => e.on) : [];
  if (!evenings.length) return null;

  const today = now ? localDateKey(now) : '';
  const minutes = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const stops = prayerStops(week);
  // Up next: tonight's prayers until they end, else the next evening, the vigil or the funeral.
  const later = [...stops, ...live.journey.filter((s) => s.type === 'vigil' || s.type === 'church' || s.type === 'hall')].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );
  const nextId = now
    ? later.find((s) => {
        if (s.date > today) return true;
        if (s.date < today) return false;
        return minutes < endOf(s);
      })?.id
    : undefined;
  const vigil = live.journey.find((s) => s.type === 'vigil');
  const service = live.journey.find((s) => s.type === 'church' || s.type === 'hall');
  const hasPin = Number.isFinite(week.lat) && Number.isFinite(week.lng);

  return (
    <section className="m-section reveal" id="prayers">
      <div className="m-section-grid">
        <header>
          <span className="eyebrow">Prayers during the week</span>
        </header>
        <div>
          <h2 className="h2">Pray with the family.</h2>
          <p className="pw-where-line">
            Each evening at {week.time}
            {week.endTime ? `–${week.endTime}` : ''}
            {week.place ? ` · ${week.place}` : ''}
            {week.address && week.address !== week.place ? `, ${week.address}` : ''}
          </p>
          {hasPin && (
            <a className="btn sm" href={directionsUrl({ lat: week.lat, lng: week.lng }, 'google')} target="_blank" rel="noopener noreferrer">
              Directions
            </a>
          )}
          <ol className="pw-list">
            {evenings.map((e) => {
              const id = `prayer-${e.date}`;
              const d = dayParts(e.date);
              const stop = stops.find((st) => st.id === id);
              const held = Boolean(now) && (e.date < today || (e.date === today && Boolean(stop) && minutes >= endOf(stop!)));
              const tonight = e.date === today && id === nextId;
              const upNext = !tonight && id === nextId;
              return (
                <li key={e.date} className={`pw-card${held ? ' held' : ''}${tonight || upNext ? ' next' : ''}`}>
                  <div className="pw-card-date">
                    <span>{d.wd.slice(0, 3)}</span>
                    <strong>{d.day}</strong>
                    <span>{d.month}</span>
                  </div>
                  <div className="pw-card-body">
                    <div className="pw-card-top">
                      <span className="pw-time">{e.time || week.time}</span>
                      {tonight && <span className="pill live dot">Tonight</span>}
                      {upNext && <span className="pill">Up next</span>}
                      {held && <span className="pw-held">Held</span>}
                    </div>
                    <h3>{e.title || 'Evening prayers'}</h3>
                    {(e.word || e.scripture) && (
                      <p className="pw-word">
                        {e.word && <em>“{e.word}”</em>}
                        {e.word && e.scripture ? ' · ' : ''}
                        {e.scripture}
                      </p>
                    )}
                    {e.leader && <p className="pw-lead">Led by {e.leader}</p>}
                  </div>
                </li>
              );
            })}
            {vigil && (
              <li className={`pw-card vigil${nextId === vigil.id ? ' next' : ''}`}>
                <div className="pw-card-date">
                  <span>{dayParts(vigil.date).wd.slice(0, 3)}</span>
                  <strong>{dayParts(vigil.date).day}</strong>
                  <span>{dayParts(vigil.date).month}</span>
                </div>
                <div className="pw-card-body">
                  <div className="pw-card-top">
                    <span className="pw-time">{vigil.time}</span>
                    {nextId === vigil.id && <span className="pill">Up next</span>}
                  </div>
                  <h3>Night vigil</h3>
                  <p className="pw-word">{[vigil.title !== stopLabel(vigil.type) ? vigil.title : '', vigil.address].filter(Boolean).join(' · ') || 'The programme is below'}</p>
                </div>
              </li>
            )}
            {service && (
              <li className={`pw-card service${nextId === service.id ? ' next' : ''}`}>
                <div className="pw-card-date">
                  <span>{dayParts(service.date).wd.slice(0, 3)}</span>
                  <strong>{dayParts(service.date).day}</strong>
                  <span>{dayParts(service.date).month}</span>
                </div>
                <div className="pw-card-body">
                  <div className="pw-card-top">
                    <span className="pw-time">{service.time}</span>
                    {nextId === service.id && <span className="pill">Up next</span>}
                  </div>
                  <h3>The funeral</h3>
                  <p className="pw-word">{service.title} · see the journey below</p>
                </div>
              </li>
            )}
          </ol>
          {week.notes && <p className="pw-notes">{week.notes}</p>}
        </div>
      </div>
    </section>
  );
}
