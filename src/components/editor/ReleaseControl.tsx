'use client';

import { fmtDate, type Draft } from '@/lib/memorial';
import type { Update } from './shared';

/** The day of the main service: the first church or hall stop, else the first stop that isn't the vigil. */
export function serviceDate(draft: Draft): string {
  const j = draft.journey;
  return (j.find((s) => s.type === 'church' || s.type === 'hall') ?? j.find((s) => s.type !== 'vigil') ?? j[0])?.date ?? '';
}

const pad = (n: number) => String(n).padStart(2, '0');
/** The release instant as local date + time, for the inputs. */
function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return { date: '', time: '06:00' };
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
const toIso = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`).toISOString() : '');

/**
 * When guests may see the programme. Holding it back until the morning of the
 * funeral keeps last-minute changes (a speaker swapped, a hymn added) within the
 * family; guests see "coming soon" with the time until then.
 */
export function ReleaseControl({ draft, update }: { draft: Draft; update: Update }) {
  const releaseAt = draft.programme.releaseAt ?? '';
  const held = Boolean(releaseAt);
  const { date, time } = localParts(releaseAt);
  const day = serviceDate(draft);
  const set = (iso: string) => update((d) => ({ ...d, programme: { ...d.programme, releaseAt: iso } }));

  return (
    <section className="release-block" aria-labelledby="release-title">
      <h3 className="h4" id="release-title">
        When can guests see the programme?
      </h3>
      <div className="choice-grid">
        <button type="button" className="choice" aria-pressed={!held} onClick={() => set('')}>
          <strong>As soon as the memorial is published</strong>
          <span>Guests can read it straight away.</span>
        </button>
        <button
          type="button"
          className="choice"
          aria-pressed={held}
          onClick={() => !held && set(toIso(day || new Date().toISOString().slice(0, 10), '06:00'))}
        >
          <strong>On the day, at a set time</strong>
          <span>Keep last-minute changes in the family. Guests see “coming soon” until then.</span>
        </button>
      </div>
      {held && (
        <div className="grid-2" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="releaseDate">Share it on</label>
            <input id="releaseDate" className="input" type="date" value={date} onChange={(e) => set(toIso(e.target.value, time))} />
            {day && date !== day && (
              <button type="button" className="text-link small" style={{ justifySelf: 'start' }} onClick={() => set(toIso(day, time))}>
                Use the service day, {fmtDate(day)}
              </button>
            )}
          </div>
          <div className="field">
            <label htmlFor="releaseTime">At</label>
            <input id="releaseTime" className="input" type="time" value={time} onChange={(e) => e.target.value && set(toIso(date, e.target.value))} />
            <span className="hint">06:00 gives everyone the morning to read it.</span>
          </div>
        </div>
      )}
    </section>
  );
}
