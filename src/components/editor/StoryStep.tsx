'use client';

import { useState } from 'react';
import {
  MIN_STORY_LENGTH,
  PROGRAMME_TYPE_LABELS,
  newId,
  programmeGate,
  programmeTypeLabel,
  type Draft,
  type ProgrammeItem,
  type ProgrammeType,
} from '@/lib/memorial';
import { PanelFoot, type Nav, type Update } from './shared';

const blankItem = (): ProgrammeItem => ({ id: '', type: 'prayer', time: '', title: '', presenter: '', detail: '' });

export function StoryStep({ draft, update, nav }: { draft: Draft; update: Update; nav: Nav }) {
  const { story, programme } = draft;
  const gate = programmeGate(draft);
  const [form, setForm] = useState<ProgrammeItem>(blankItem);
  const [formError, setFormError] = useState('');
  const editing = Boolean(form.id);
  const obituaryLength = story.obituary.trim().length;

  const setStory = (key: 'obituary' | 'familyMessage', value: string) => update((d) => ({ ...d, story: { ...d.story, [key]: value } }));
  const setItems = (fn: (items: ProgrammeItem[]) => ProgrammeItem[]) =>
    update((d) => ({ ...d, programme: { ...d.programme, items: fn(d.programme.items) } }));

  const saveItem = () => {
    if (!form.title.trim()) return setFormError('Give this part of the service a title.');
    setFormError('');
    const item = { ...form, title: form.title.trim(), id: form.id || newId('item') };
    setItems((items) => (editing ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]));
    setForm(blankItem());
  };
  const move = (id: string, dir: -1 | 1) =>
    setItems((items) => {
      const i = items.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= items.length) return items;
      const next = [...items];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Step 3 · Story & programme</span>
        <h1 className="h1">Their story, and the order of service.</h1>
        <p className="lede">What you write here appears on the memorial page, the printable programme and the keepsake PDF.</p>
      </header>

      <div className="stack" style={{ ['--stack' as string]: '22px' }}>
        <div className="field">
          <label htmlFor="obituary">Life story</label>
          <textarea
            className="textarea"
            id="obituary"
            rows={9}
            value={story.obituary}
            onChange={(e) => setStory('obituary', e.target.value)}
            placeholder="Where they were born and grew up, the work they did, the people they loved, their faith, what made them laugh, what they’ll be remembered for…"
          />
          <span className="hint">
            {obituaryLength < MIN_STORY_LENGTH ? 'A few meaningful sentences are enough to publish.' : `${story.obituary.trim().split(/\s+/).length} words`}. Leave a blank line between paragraphs.
          </span>
        </div>
        <div className="field">
          <label htmlFor="familyMessage">A message from the family</label>
          <textarea
            className="textarea short"
            id="familyMessage"
            value={story.familyMessage}
            onChange={(e) => setStory('familyMessage', e.target.value)}
            placeholder="Optional. A thank-you, an invitation or a few words of gratitude."
          />
        </div>
      </div>

      <div className="subsection">
        <div className="subsection-head">
          <span className="eyebrow plain">Order of service</span>
          <h2 className="h3">Is there a formal programme?</h2>
        </div>
        <div className="choice-grid" role="group" aria-label="Programme">
          <button
            type="button"
            className="choice"
            aria-pressed={programme.mode === 'formal'}
            onClick={() => update((d) => ({ ...d, programme: { ...d.programme, mode: 'formal' } }))}
          >
            <strong>Yes, build the programme</strong>
            <span>Prayers, hymns, scripture, tributes, eulogy, in order.</span>
          </button>
          <button type="button" className="choice" aria-pressed={programme.mode === 'none'} onClick={() => update((d) => ({ ...d, programme: { ...d.programme, mode: 'none' } }))}>
            <strong>No formal programme</strong>
            <span>The memorial will show the story and funeral journey only.</span>
          </button>
        </div>

        {programme.mode === 'formal' && (
          <>
            <div className="list" style={{ marginTop: 22 }}>
              {programme.items.length === 0 && <div className="empty-line">No items yet. Add the first part of the service below.</div>}
              {programme.items.map((item, i) => (
                <article key={item.id} className={`list-item ${form.id === item.id ? 'editing' : ''}`}>
                  <span className="idx">{i + 1}</span>
                  <div>
                    <span className="kind">{programmeTypeLabel(item.type)}</span>
                    <h4>
                      {item.time && <span className="muted">{item.time} · </span>}
                      {item.title}
                    </h4>
                    {(item.presenter || item.detail) && <p>{[item.presenter, item.detail].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <div className="list-actions">
                    <button className="icon-btn" type="button" aria-label={`Move ${item.title} up`} disabled={i === 0} onClick={() => move(item.id, -1)}>
                      ↑
                    </button>
                    <button className="icon-btn" type="button" aria-label={`Move ${item.title} down`} disabled={i === programme.items.length - 1} onClick={() => move(item.id, 1)}>
                      ↓
                    </button>
                    <button className="btn sm" type="button" onClick={() => setForm(item)}>
                      Edit
                    </button>
                    <button
                      className="btn sm danger"
                      type="button"
                      onClick={() => {
                        setItems((items) => items.filter((x) => x.id !== item.id));
                        if (form.id === item.id) setForm(blankItem());
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="form-block">
              <div className="form-block-head">
                <h3 className="h4">{editing ? 'Edit programme item' : 'Add a programme item'}</h3>
                {editing && (
                  <button className="text-link small" type="button" onClick={() => setForm(blankItem())}>
                    Cancel
                  </button>
                )}
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="itemType">Type</label>
                  <select className="select" id="itemType" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProgrammeType })}>
                    {Object.entries(PROGRAMME_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="itemTime">Time</label>
                  <input className="input" id="itemTime" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  <span className="hint">Optional. Times power the “now / next” view on the day.</span>
                </div>
                <div className="field span-2">
                  <label htmlFor="itemTitle">Title</label>
                  <input
                    className="input"
                    id="itemTitle"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), saveItem())}
                    placeholder="e.g. Opening prayer, Psalm 23, Tribute from the grandchildren"
                  />
                </div>
                <div className="field">
                  <label htmlFor="itemPresenter">Led by</label>
                  <input className="input" id="itemPresenter" value={form.presenter} onChange={(e) => setForm({ ...form, presenter: e.target.value })} placeholder="Optional" />
                </div>
                <div className="field">
                  <label htmlFor="itemDetail">Detail</label>
                  <input className="input" id="itemDetail" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="Hymn number, verse or note" />
                </div>
              </div>
              {formError && (
                <div className="note error" role="alert" style={{ marginTop: 14 }}>
                  {formError}
                </div>
              )}
              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn accent" type="button" onClick={saveItem}>
                  {editing ? 'Update item' : 'Add to programme'}
                </button>
              </div>
            </div>
          </>
        )}

        <div className={`note ${gate.ready ? 'ok' : 'warn'}`} style={{ marginTop: 20 }}>
          <span>
            <strong>{gate.ready ? 'Ready.' : 'Still needed:'}</strong> {gate.message}
          </span>
        </div>
      </div>

      <PanelFoot nav={nav} />
    </div>
  );
}
