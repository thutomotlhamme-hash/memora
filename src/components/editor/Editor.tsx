'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { loadGuestDraft, saveGuestDraft } from '@/lib/guest';
import { useHydrated } from '@/lib/hooks';
import { ACCEPTED_IMAGES, MAX_UPLOAD_BYTES, blobToDataUrl, compressImage } from '@/lib/image';
import { MEDIA_BUCKET } from '@/lib/config';
import { displayName, fmtDate, initials, readiness, type CaseMeta, type Draft } from '@/lib/memorial';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { JourneyStep } from './JourneyStep';
import { PersonStep } from './PersonStep';
import { PublishStep } from './PublishStep';
import { ReviewStep } from './ReviewStep';
import { StoryStep } from './StoryStep';
import { SaveSheet } from './SaveSheet';
import { STEPS, type StepId } from './shared';

export type EditorProps =
  | { mode: 'guest' }
  | { mode: 'owner'; caseId: string; initialDraft: Draft; initialMeta: CaseMeta; paymentsReady: boolean; gift?: { buyerName: string; funeralDate: string | null } | null };

type SaveState = { kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string; stale?: boolean };

/** Guest drafts live in localStorage, so the guest editor renders only in the browser. */
export function GuestEditor() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="container editor" aria-busy="true">
        <div />
        <div className="panel" style={{ minHeight: 480 }} />
      </div>
    );
  }
  return <Editor mode="guest" />;
}

export function Editor(props: EditorProps) {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const owner = props.mode === 'owner' ? props : null;

  const [draft, setDraft] = useState<Draft>(() => (owner ? owner.initialDraft : loadGuestDraft()));
  const [meta, setMeta] = useState<CaseMeta | null>(owner ? owner.initialMeta : null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const initialStep = (STEPS.find((s) => s.id === params.get('step'))?.id ?? 'person') as StepId;
  const [step, setStep] = useState<StepId>(initialStep);
  const dirty = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const update = useCallback((fn: (d: Draft) => Draft) => {
    dirty.current = true;
    setDraft((d) => fn(d));
  }, []);

  // ---- Persistence --------------------------------------------------------
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  const inFlight = useRef(false);
  const queued = useRef(false);
  // The version this editor last saw. If the funeral-day coordinator changes the
  // programme meanwhile, the server refuses the save instead of overwriting it.
  const base = useRef<string | null>(owner?.initialMeta.updatedAt ?? null);
  const metaUpdatedAt = meta?.updatedAt ?? null;
  useEffect(() => {
    if (metaUpdatedAt && (!base.current || metaUpdatedAt > base.current)) base.current = metaUpdatedAt;
  }, [metaUpdatedAt]);

  const caseId = owner?.caseId ?? null;
  const pushRemote = useCallback(async () => {
    if (!caseId) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setSave({ kind: 'saving' });
    try {
      // Keep sending until no newer edit arrived while the previous request was in flight.
      do {
        queued.current = false;
        const res = await fetch(`/api/memorials/${caseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: latest.current, baseUpdatedAt: base.current }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body?.code === 'STALE') throw Object.assign(new Error(body.error), { stale: true });
        if (!res.ok) throw new Error(body?.error || 'Could not save your changes.');
        if (body?.updatedAt) base.current = body.updatedAt;
      } while (queued.current);
      dirty.current = false;
      setSave({ kind: 'saved' });
    } catch (err) {
      queued.current = false;
      const stale = Boolean((err as { stale?: boolean })?.stale);
      setSave({ kind: 'error', message: err instanceof Error ? err.message : 'Could not save.', stale });
    } finally {
      inFlight.current = false;
    }
  }, [caseId]);

  useEffect(() => {
    if (!dirty.current) return;
    if (props.mode === 'guest') {
      const t = setTimeout(() => {
        if (!saveGuestDraft(draft)) setSave({ kind: 'error', message: 'This browser could not store the draft. Try a smaller photo or create an account.' });
        else {
          dirty.current = false;
          setSave({ kind: 'saved' });
        }
      }, 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => void pushRemote(), 800);
    return () => clearTimeout(t);
  }, [draft, props.mode, pushRemote]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // ---- Portrait -------------------------------------------------------------
  const [portraitBusy, setPortraitBusy] = useState(false);
  const onPortrait = useCallback(
    async (file: File) => {
      if (!ACCEPTED_IMAGES.includes(file.type)) return toast('Choose a JPG, PNG or WebP photo.', 'error');
      if (file.size > MAX_UPLOAD_BYTES) return toast('Choose a photo under 10 MB.', 'error');
      setPortraitBusy(true);
      try {
        if (!owner) {
          const blob = await compressImage(file, 1100, 0.8);
          const dataUrl = await blobToDataUrl(blob);
          update((d) => ({ ...d, person: { ...d.person, portraitUrl: dataUrl, portraitPath: '' } }));
          toast('Portrait added. It stays on this device until you create an account.');
          return;
        }
        const supabase = getBrowserSupabase();
        if (!supabase) throw new Error('Uploads are not configured.');
        const blob = await compressImage(file);
        const path = `${owner.caseId}/portrait-${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw new Error(error.message);
        const previous = latest.current.person.portraitPath;
        update((d) => ({ ...d, person: { ...d.person, portraitPath: path, portraitUrl: URL.createObjectURL(blob) } }));
        if (previous && previous !== path) void supabase.storage.from(MEDIA_BUCKET).remove([previous]);
        toast('Portrait saved privately.');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'The portrait could not be added.', 'error');
      } finally {
        setPortraitBusy(false);
      }
    },
    [owner, toast, update],
  );

  // ---- Navigation -----------------------------------------------------------
  const r = useMemo(() => readiness(draft), [draft]);
  const done: Record<StepId, boolean> = {
    person: r.person.ready,
    journey: r.journey.ready,
    story: r.story.ready && r.programme.ready,
    review: r.complete,
    publish: meta?.status === 'PUBLISHED',
  };
  const index = STEPS.findIndex((s) => s.id === step);
  const go = (id: StepId) => {
    setStep(id);
    const url = new URL(window.location.href);
    url.searchParams.set('step', id);
    url.searchParams.delete('payment');
    window.history.replaceState(null, '', url);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const nav = {
    back: index > 0 ? () => go(STEPS[index - 1].id) : null,
    next: index < STEPS.length - 1 ? () => go(STEPS[index + 1].id) : null,
    nextLabel: index < STEPS.length - 1 ? `Continue to ${STEPS[index + 1].label.toLowerCase()}` : '',
  };

  const flush = useCallback(async () => {
    if (!caseId) return;
    // Wait for any save in flight, then send the latest edits if they are still unsaved.
    while (inFlight.current) await new Promise((r) => setTimeout(r, 120));
    if (dirty.current) await pushRemote();
  }, [caseId, pushRemote]);

  const previewHref = owner ? `/memorials/${owner.caseId}/preview` : '/m/preview';

  return (
    <>
      <div className="container editor" ref={topRef} style={{ scrollMarginTop: 80 }}>
        <aside className="editor-side">
          <div className="who">
            <div className="avatar">{draft.person.portraitUrl ? <img src={draft.person.portraitUrl} alt="" /> : initials(draft.person)}</div>
            <div>
              <span className="eyebrow plain">{meta?.status === 'PUBLISHED' ? 'Published memorial' : 'Memorial draft'}</span>
              <strong>{displayName(draft.person)}</strong>
            </div>
          </div>
          <div>
            <div className="progress" aria-label={`${r.pct}% complete`}>
              <span style={{ width: `${r.pct}%` }} />
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="tiny muted">{r.pct}% ready</span>
              <SaveIndicator state={save} guest={!owner} />
            </div>
          </div>
          {!owner && (
            <div className="guest-save">
              <p className="guest-note">
                <strong>Saved on this device only.</strong> Save it to your cellphone number so you can come back from any phone.
              </p>
              <button className="btn primary sm" type="button" onClick={() => setSaving(true)}>
                Save it
              </button>
            </div>
          )}
          {owner?.gift && (
            <div className="note" style={{ fontSize: 14 }}>
              <span>
                <strong>A gift from {owner.gift.buyerName}.</strong> It’s already paid for.
                {owner.gift.funeralDate && meta?.status !== 'PUBLISHED' ? ` The funeral is expected around ${fmtDate(owner.gift.funeralDate)}; publish before then so guests have the directions.` : ''}
              </span>
            </div>
          )}
          <ol className="steps" aria-label="Memorial steps">
            {STEPS.map((s, i) => (
              <li key={s.id} className={done[s.id] ? 'done' : ''}>
                <button type="button" aria-current={s.id === step ? 'step' : undefined} onClick={() => go(s.id)}>
                  <span className="dot">{done[s.id] ? '✓' : i + 1}</span>
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
          <div className="desk-only row">
            <Link className="btn sm" href={previewHref} target="_blank">
              Preview memorial ↗
            </Link>
            {owner && (
              <Link className="btn sm ghost" href="/memorials">
                All memorials
              </Link>
            )}
          </div>
          <nav className="mobile-steps" aria-label="Memorial steps">
            {STEPS.map((s) => (
              <button key={s.id} type="button" className={done[s.id] ? 'done' : ''} aria-current={s.id === step ? 'step' : undefined} onClick={() => go(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <section>
          {save.kind === 'error' && (
            <div className="note error" role="alert" style={{ marginBottom: 16 }}>
              <span>
                <strong>Not saved.</strong> {save.message}
              </span>
              {owner && save.stale && (
                <button
                  className="btn sm"
                  type="button"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    dirty.current = false;
                    window.location.reload();
                  }}
                >
                  Reload latest
                </button>
              )}
              {owner && !save.stale && (
                <button className="btn sm" type="button" onClick={() => void pushRemote()} style={{ marginLeft: 'auto' }}>
                  Retry
                </button>
              )}
            </div>
          )}
          {step === 'person' && <PersonStep draft={draft} update={update} onPortrait={onPortrait} portraitBusy={portraitBusy} nav={nav} />}
          {step === 'journey' && <JourneyStep draft={draft} update={update} nav={nav} />}
          {step === 'story' && <StoryStep draft={draft} update={update} nav={nav} caseId={owner?.caseId ?? null} />}
          {step === 'review' && <ReviewStep draft={draft} readiness={r} go={go} previewHref={previewHref} nav={nav} />}
          {step === 'publish' && (
            <PublishStep
              draft={draft}
              readiness={r}
              owner={owner ? { caseId: owner.caseId, paymentsReady: owner.paymentsReady } : null}
              meta={meta}
              setMeta={setMeta}
              flush={flush}
              go={go}
              refresh={() => router.refresh()}
              nav={nav}
            />
          )}
        </section>
      </div>
      {saving && <SaveSheet step={step} onClose={() => setSaving(false)} />}
    </>
  );
}

function SaveIndicator({ state, guest }: { state: SaveState; guest: boolean }) {
  if (state.kind === 'idle') return <span className="save-state">{guest ? 'On this device' : 'Saved'}</span>;
  if (state.kind === 'saving') return <span className="save-state saving">Saving…</span>;
  if (state.kind === 'error') return <span className="save-state error">Not saved</span>;
  return <span className="save-state">{guest ? 'Saved on this device' : 'All changes saved'}</span>;
}
