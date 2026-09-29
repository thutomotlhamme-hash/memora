'use client';

import { useId, useState } from 'react';
import { VIGIL_TEMPLATES, vigilTemplate, type Draft, type ProgrammeItem, type VigilKind } from '@/lib/memorial';

/**
 * Start the night vigil from a light template: the deceased arriving home, then
 * a short prayer evening or a whole-night vigil. Scripture is optional.
 */
export function VigilTemplate({ draft, name, onUse }: { draft: Draft; name: string; onUse: (items: ProgrammeItem[]) => void }) {
  const uid = useId();
  const vigilStop = draft.journey.find((s) => s.type === 'vigil');
  const [kind, setKind] = useState<VigilKind>('prayer');
  const [arrival, setArrival] = useState(vigilStop?.time || '18:00');
  const [scripture, setScripture] = useState(true);

  return (
    <div className="vigil-template">
      <p className="vt-intro">Most vigils begin when {name} arrives home. Pick how the evening goes; you can change every line afterwards.</p>
      <div className="vt-choices" role="radiogroup" aria-label="Kind of vigil">
        {VIGIL_TEMPLATES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={kind === t.id} className="vt-choice" onClick={() => setKind(t.id)}>
            <strong>{t.label}</strong>
            <span>{t.hint}</span>
          </button>
        ))}
      </div>
      <div className="vt-options">
        <div className="field">
          <label htmlFor={`${uid}-arr`}>Arrives home at</label>
          <input className="input" id={`${uid}-arr`} type="time" value={arrival} onChange={(e) => setArrival(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={scripture} onChange={(e) => setScripture(e.target.checked)} />
          <span>Include a scripture reading</span>
        </label>
      </div>
      <div className="row">
        <button className="btn accent" type="button" onClick={() => onUse(vigilTemplate(kind, { arrival, name, scripture }))}>
          Use this vigil programme
        </button>
      </div>
      {!vigilStop && (
        <p className="vt-note">
          Add the night vigil to the funeral journey (step 2) too, with the address. Then guests get the live view that evening and directions to the home.
        </p>
      )}
    </div>
  );
}
