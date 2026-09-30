'use client';

import { useEffect, useId, useState } from 'react';
import { templateToProgramme } from '@/lib/enterprise';
import { newId, type ProgrammeItem } from '@/lib/memorial';

type T = { id: string; name: string; kind: 'programme' | 'wording'; tradition: string; items: { part: 'vigil' | 'service' | 'graveside'; type: string; title: string; minutes: number }[]; wording: string };

const cache = new Map<string, Promise<T[]>>();
function load(caseId: string): Promise<T[]> {
  if (!cache.has(caseId))
    cache.set(
      caseId,
      fetch(`/api/memorials/${caseId}/templates`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { templates: [] }))
        .then((b) => (Array.isArray(b?.templates) ? (b.templates as T[]) : []))
        .catch(() => []),
    );
  return cache.get(caseId)!;
}

/**
 * The funeral home's (or its group's) programme templates, for a memorial that
 * belongs to a home. Nothing shows for a family's own memorial.
 */
export function HomeProgrammeTemplates({ caseId, onUse }: { caseId: string; onUse: (items: ProgrammeItem[]) => void }) {
  const uid = useId();
  const [list, setList] = useState<T[]>([]);
  const [chosen, setChosen] = useState('');
  const [start, setStart] = useState('10:00');
  useEffect(() => {
    let live = true;
    void load(caseId).then((t) => live && setList(t.filter((x) => x.kind === 'programme' && x.items.length)));
    return () => {
      live = false;
    };
  }, [caseId]);
  if (!list.length) return null;
  const pick = list.find((t) => t.id === chosen) ?? list[0];
  return (
    <div className="home-templates">
      <span className="eyebrow plain">From your funeral home</span>
      <p className="muted small">Start from one of your home’s programmes, then change anything.</p>
      <div className="vt-choices" role="radiogroup" aria-label="Programme templates">
        {list.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={pick.id === t.id} className="vt-choice" onClick={() => setChosen(t.id)}>
            <strong>{t.name}</strong>
            <span>
              {t.items.length} items{t.tradition ? ` · ${t.tradition}` : ''}
            </span>
          </button>
        ))}
      </div>
      <div className="vt-options">
        <div className="field">
          <label htmlFor={`${uid}-start`}>Service starts at</label>
          <input className="input" id={`${uid}-start`} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
      </div>
      <button className="btn accent" type="button" onClick={() => onUse(templateToProgramme(pick.items, start || '10:00', () => newId('item')) as ProgrammeItem[])}>
        Use “{pick.name}”
      </button>
    </div>
  );
}

/** Standard wording from the home, to start the life story. */
export function HomeWording({ caseId, name, onUse }: { caseId: string; name: string; onUse: (text: string) => void }) {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    let live = true;
    void load(caseId).then((t) => live && setList(t.filter((x) => x.kind === 'wording' && x.wording)));
    return () => {
      live = false;
    };
  }, [caseId]);
  if (!list.length) return null;
  return (
    <div className="home-wording">
      <span className="muted small">Your home’s wording:</span>
      {list.map((t) => (
        <button key={t.id} type="button" className="chip" onClick={() => onUse(t.wording.replace(/\{name\}/g, name))}>
          {t.name}
        </button>
      ))}
    </div>
  );
}
