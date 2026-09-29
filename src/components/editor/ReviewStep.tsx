'use client';

import Link from 'next/link';
import { dispositionLabel, displayName, fmtDate, initials, programmeTypeLabel, stopLabel, type Draft, type Readiness } from '@/lib/memorial';
import { PanelFoot, type Nav, type StepId } from './shared';

export function ReviewStep({ draft, readiness: r, go, previewHref, nav }: { draft: Draft; readiness: Readiness; go: (s: StepId) => void; previewHref: string; nav: Nav }) {
  const p = draft.person;
  const checks: { ok: boolean; title: string; detail: string; step: StepId }[] = [
    { ok: r.person.ready, title: 'Loved one and portrait', detail: r.person.message, step: 'person' },
    { ok: r.journey.ready, title: 'Service and funeral journey', detail: r.journey.message, step: 'journey' },
    { ok: r.story.ready, title: 'Life story', detail: r.story.message, step: 'story' },
    { ok: r.programme.ready, title: 'Programme', detail: r.programme.message, step: 'story' },
  ];
  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Step 4 · Review</span>
        <h1 className="h1">Read it through, together.</h1>
        <p className="lede">Nothing is public yet. Check the names, dates and times with the family before you publish.</p>
      </header>

      <div className="review-grid">
        <div className="review-portrait">{p.portraitUrl ? <img src={p.portraitUrl} alt={`Portrait of ${displayName(p)}`} /> : initials(p)}</div>
        <div>
          <div className="kv">
            <span>Name</span>
            <strong>{[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}</strong>
          </div>
          {p.preferredName && (
            <div className="kv">
              <span>Known as</span>
              <strong>{p.preferredName}</strong>
            </div>
          )}
          <div className="kv">
            <span>Born</span>
            <span>{fmtDate(p.birthDate)}</span>
          </div>
          <div className="kv">
            <span>Passed</span>
            <span>{fmtDate(p.passingDate)}</span>
          </div>
          <div className="kv">
            <span>Service</span>
            <span>
              {dispositionLabel(draft.disposition.type)}
              {draft.disposition.notes ? ` · ${draft.disposition.notes}` : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="subsection">
        <div className="subsection-head">
          <span className="eyebrow plain">Readiness</span>
          <h2 className="h3">{r.complete ? 'Everything needed to publish is here.' : `${r.missing.length} thing${r.missing.length > 1 ? 's' : ''} left to add.`}</h2>
        </div>
        <div className="checklist">
          {checks.map((c) => (
            <div key={c.title} className={`check ${c.ok ? 'ok' : ''}`}>
              <span className="mark" aria-hidden="true">
                {c.ok ? '✓' : '!'}
              </span>
              <div style={{ flex: 1 }}>
                <strong>{c.title}</strong>
                <small>{c.detail}</small>
              </div>
              {!c.ok && (
                <button className="btn sm" type="button" onClick={() => go(c.step)}>
                  Fix
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="subsection">
        <div className="subsection-head">
          <span className="eyebrow plain">Funeral journey</span>
        </div>
        {draft.journey.length === 0 ? (
          <p className="muted">No stops yet.</p>
        ) : (
          draft.journey.map((s, i) => (
            <div className="kv" key={s.id}>
              <span>
                {i + 1}. {fmtDate(s.date)} · {s.time}
                {s.departTime ? `–${s.departTime}` : ''}
              </span>
              <span>
                <strong>{s.title}</strong> <span className="muted">· {stopLabel(s.type)}</span>
              </span>
            </div>
          ))
        )}
      </div>

      {draft.programme.mode === 'formal' && (
        <div className="subsection">
          <div className="subsection-head">
            <span className="eyebrow plain">Order of service</span>
          </div>
          {draft.programme.items.map((item, i) => (
            <div className="kv" key={item.id}>
              <span>
                {item.time || String(i + 1).padStart(2, '0')} · {programmeTypeLabel(item.type)}
              </span>
              <span>
                <strong>{item.title}</strong>
                {item.presenter ? <span className="muted"> · {item.presenter}</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}

      <PanelFoot nav={nav}>
        <div className="row">
          <Link className="btn" href={previewHref} target="_blank">
            Preview memorial ↗
          </Link>
          {nav.next && (
            <button className="btn primary" type="button" onClick={nav.next}>
              {nav.nextLabel}
            </button>
          )}
        </div>
      </PanelFoot>
    </div>
  );
}
