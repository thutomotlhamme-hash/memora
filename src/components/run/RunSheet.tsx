'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useNow } from '@/lib/hooks';
import { PROGRAMME_PARTS, PROGRAMME_TYPE_LABELS, partLabel, partOf, partStart, partStartLabel, sortByPart, fmtDate, journeyOrderProblem, localDateKey, newId, programmeTypeLabel, stopLabel, type ProgrammeItem, type ProgrammePart, type ProgrammeType, type Stop } from '@/lib/memorial';
import type { ProcessionRecord } from '@/lib/procession';
import { ProcessionControl } from './ProcessionControl';
import { FUNERAL_ENDED, dayOfPart, endedDay, endedKey, type RunDay } from '@/lib/live';
import { insertItem, moveItem, shiftFrom, shiftTodaysStops, startItem, toMinutes } from '@/lib/runsheet';

// The funeral-day coordinator's console. Every change is shown at once, saved in
// the background, and reaches guests' memorial pages within half a minute.
// Two coordinators on two phones never overwrite each other: a save based on an
// old version is refused, and the console switches to the latest one.

export type RunSnapshot = {
  name: string;
  slug: string;
  status: string;
  journey: Stop[];
  programme: ProgrammeItem[];
  liveKey: string | null;
  updatedAt: string;
  procession?: ProcessionRecord | null;
};

type Pending = { programme?: ProgrammeItem[]; stopTimes?: Map<string, { id: string; time: string; departTime: string }>; liveKey?: string | null };
type SaveState = 'saved' | 'saving' | 'offline' | 'error';

const POLL_MS = 15_000;
const blank = (part: ProgrammePart = 'service'): ProgrammeItem => ({ id: newId('item'), part, type: 'custom', time: '', title: '', presenter: '', detail: '' });

export function RunSheet({ token, initial }: { token: string; initial: RunSnapshot }) {
  const toast = useToast();
  const now = useNow();
  const [snap, setSnap] = useState<RunSnapshot>(initial);
  const [save, setSave] = useState<SaveState>('saved');
  const [revoked, setRevoked] = useState(false);
  const [moveStops, setMoveStops] = useState(true);
  const [shiftOnStart, setShiftOnStart] = useState(true);
  const [chosenDay, setChosenDay] = useState<RunDay | null>(null);
  const [editing, setEditing] = useState<{ item: ProgrammeItem; afterIndex: number | null } | null>(null);

  // ---- Saving ---------------------------------------------------------------
  const base = useRef(initial.updatedAt);
  const pending = useRef<Pending | null>(null);
  const busy = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const api = `/api/run/${encodeURIComponent(token)}`;

  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (pending.current) {
        const p = pending.current;
        pending.current = null;
        setSave('saving');
        let res: Response;
        try {
          res = await fetch(api, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base: base.current,
              ...(p.programme ? { programme: p.programme } : {}),
              ...(p.stopTimes ? { stopTimes: [...p.stopTimes.values()] } : {}),
              ...(p.liveKey !== undefined ? { liveKey: p.liveKey } : {}),
            }),
          });
        } catch {
          // No signal. Keep the change and try again shortly (newer edits win).
          pending.current = merge(p, pending.current);
          setSave('offline');
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => void flush(), 5000);
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body?.snapshot) {
          pending.current = null;
          base.current = body.snapshot.updatedAt;
          setSnap(body.snapshot);
          setSave('saved');
          toast('Someone else changed the programme a moment ago. You’re now on the latest version; please redo your last change.', 'error');
          return;
        }
        if (res.status === 404) {
          setRevoked(true);
          return;
        }
        if (!res.ok) {
          setSave('error');
          toast(body?.error || 'That change could not be saved.', 'error');
          return;
        }
        base.current = body.updatedAt;
        // Only adopt the server's copy when nothing newer is waiting to be sent.
        if (!pending.current) setSnap(body);
      }
      setSave('saved');
    } finally {
      busy.current = false;
    }
  }, [api, toast]);

  /** Apply a change on screen immediately and queue it for saving. */
  const commit = useCallback(
    (next: Partial<Pick<RunSnapshot, 'programme' | 'journey' | 'liveKey'>>, change: Pending) => {
      setSnap((s) => ({ ...s, ...next }));
      pending.current = merge(pending.current, change);
      void flush();
    },
    [flush],
  );

  // ---- Keeping up with other phones and the family's editor ----------------
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = Boolean(editing);
  }, [editing]);

  useEffect(() => {
    const poll = async () => {
      if (document.hidden || busy.current || pending.current || editingRef.current) return;
      try {
        const res = await fetch(api, { cache: 'no-store' });
        if (res.status === 404) return setRevoked(true);
        if (!res.ok) return;
        const body = (await res.json()) as RunSnapshot;
        // Another phone may have started or ended the procession without changing the programme.
        if (body.updatedAt === base.current) return setSnap((s) => ({ ...s, procession: body.procession ?? null }));
        if (busy.current || pending.current) return;
        base.current = body.updatedAt;
        setSnap(body);
      } catch {
        // Offline: the next poll will catch up.
      }
    };
    const t = setInterval(() => void poll(), POLL_MS);
    const online = () => {
      if (pending.current) void flush();
      else void poll();
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', online);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', online);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [api, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || busy.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // ---- Actions --------------------------------------------------------------
  const items = snap.programme;
  const liveIndex = snap.liveKey ? items.findIndex((i) => i.id === snap.liveKey) : -1;
  // The night vigil and the funeral day run on their own: start, move through, finish.
  const todays = snap.journey.filter((st) => st.date === localDateKey());
  const vigilNight = todays.some((st) => st.type === 'vigil') && !todays.some((st) => st.type !== 'vigil');
  const hasVigil = items.some((i) => partOf(i) === 'vigil');
  const runDay: RunDay = liveIndex >= 0 ? dayOfPart(partOf(items[liveIndex])) : (chosenDay ?? (hasVigil && vigilNight ? 'vigil' : 'day'));
  const inDay = (i: ProgrammeItem) => dayOfPart(partOf(i)) === runDay;
  const firstItem = items.find(inDay) ?? null;
  const nextItem = liveIndex >= 0 ? (items.slice(liveIndex + 1).find(inDay) ?? null) : null;
  const dayDone = endedDay(snap.liveKey) === runDay;
  const funeralDone = snap.liveKey === FUNERAL_ENDED;
  const dayName = runDay === 'vigil' ? 'the vigil' : 'the service';
  const today = now ? localDateKey(now) : '';
  const todaysStops = snap.journey.filter((s) => s.date === today);

  /** Later stops today move with the programme when the toggle is on. */
  const stopShift = (minutes: number): { journey?: Stop[]; stopTimes?: Pending['stopTimes'] } => {
    if (!moveStops || !minutes) return {};
    const shifted = shiftTodaysStops(snap.journey, localDateKey(), new Date(), minutes);
    if (!shifted.length) return {};
    const byId = new Map(shifted.map((s) => [s.id, s]));
    const journey = snap.journey.map((s) => (byId.has(s.id) ? { ...s, time: byId.get(s.id)!.time, departTime: byId.get(s.id)!.departTime } : s));
    if (journeyOrderProblem(journey)) {
      toast('Today’s stops weren’t moved: that would put a stop before the one ahead of it. Adjust them below.', 'error');
      return {};
    }
    return { journey, stopTimes: byId };
  };

  const start = (key: string) => {
    const { items: next, delay } = startItem(items, key, new Date(), shiftOnStart);
    const stops = shiftOnStart ? stopShift(delay) : {};
    commit({ programme: next, liveKey: key, ...(stops.journey ? { journey: stops.journey } : {}) }, { programme: next, liveKey: key, stopTimes: stops.stopTimes });
    const title = items.find((i) => i.id === key)?.title ?? 'Item';
    if (shiftOnStart && delay > 0) toast(`${title} started ${delay} min late. Everything after it moved ${delay} min later.`);
    else if (shiftOnStart && delay < 0) toast(`${title} started ${-delay} min early. Everything after it moved earlier.`);
    else toast(`${title} is now showing as “happening now” for guests.`);
  };

  const finish = () => {
    const key = endedKey(runDay);
    commit({ liveKey: key }, { liveKey: key });
    toast(runDay === 'vigil' ? 'The vigil is finished. Guests now see a thank-you and tomorrow’s details.' : 'The service is finished. Guests keep seeing the rest of the day’s journey.');
  };

  const endFuneral = () => {
    if (!window.confirm('End the funeral? Guests will see a thank-you and where the refreshments and after-tears are.')) return;
    commit({ liveKey: FUNERAL_ENDED }, { liveKey: FUNERAL_ENDED });
  };

  const late = (minutes: number) => {
    // Everything not yet started moves: after the live item, or from the next timed item.
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const from =
      liveIndex >= 0 ? items.findIndex((i, n) => n > liveIndex && inDay(i)) : items.findIndex((i) => inDay(i) && (toMinutes(i.time) ?? -1) >= nowMin);
    const hasProgramme = from >= 0 && from < items.length;
    const next = hasProgramme ? shiftFrom(items, from, minutes) : items;
    const stops = stopShift(minutes);
    if (!hasProgramme && !stops.stopTimes) return toast('There’s nothing still to come today to move.', 'error');
    commit({ programme: next, ...(stops.journey ? { journey: stops.journey } : {}) }, { ...(hasProgramme ? { programme: next } : {}), stopTimes: stops.stopTimes });
    toast(minutes > 0 ? `Everything still to come moved ${minutes} min later.` : `Everything still to come moved ${-minutes} min earlier.`);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = moveItem(items, from, to);
    commit({ programme: next }, { programme: next });
  };

  const remove = (item: ProgrammeItem) => {
    if (items.length <= 1) return toast('Keep at least one item in the programme.', 'error');
    if (!window.confirm(`Remove “${item.title}” from the programme?`)) return;
    const next = items.filter((i) => i.id !== item.id);
    const liveGone = snap.liveKey === item.id;
    commit({ programme: next, ...(liveGone ? { liveKey: null } : {}) }, { programme: next, ...(liveGone ? { liveKey: null } : {}) });
    setEditing(null);
    toast(`Removed “${item.title}”.`);
  };

  const saveEdit = (item: ProgrammeItem, afterIndex: number | null) => {
    if (!item.title.trim()) return toast('Give the item a title.', 'error');
    let next: ProgrammeItem[];
    if (afterIndex !== null) next = insertItem(items, afterIndex, item);
    else {
      if (!items.some((i) => i.id === item.id)) return toast('That item was removed on another phone.', 'error');
      const before = items.find((i) => i.id === item.id);
      next = items.map((i) => (i.id === item.id ? item : i));
      // Moved to another part of the day: file it under that part.
      if (before && partOf(before) !== partOf(item)) next = sortByPart(next);
    }
    commit({ programme: next }, { programme: next });
    setEditing(null);
  };

  const setStopTime = (stop: Stop, field: 'time' | 'departTime', value: string) => {
    if (field === 'time' && !value) return;
    const updated = { ...stop, [field]: value };
    if (updated.departTime && updated.departTime < updated.time) return toast('A stop can’t end before it starts.', 'error');
    const journey = snap.journey.map((s) => (s.id === stop.id ? updated : s));
    // The procession runs in order: never before the stop ahead of it has finished.
    const problem = journeyOrderProblem(journey);
    if (problem) return toast(problem, 'error');
    commit(
      { journey },
      { stopTimes: new Map([[stop.id, { id: stop.id, time: updated.time, departTime: updated.departTime }]]) },
    );
  };

  // ---- Drag and drop (pointer events: works with a finger or a mouse) -------
  const rows = useRef<(HTMLElement | null)[]>([]);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const onHandleDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: index, over: index });
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag) return;
    let over = drag.over;
    rows.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientY > r.top && e.clientY < r.bottom) over = i;
    });
    const first = rows.current[0]?.getBoundingClientRect();
    const last = rows.current[items.length - 1]?.getBoundingClientRect();
    if (first && e.clientY < first.top) over = 0;
    if (last && e.clientY > last.bottom) over = items.length - 1;
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const onHandleUp = () => {
    if (drag) reorder(drag.from, drag.over);
    setDrag(null);
  };
  const order = drag ? moveItem(items, drag.from, drag.over) : items;

  // ---- Render ---------------------------------------------------------------
  if (revoked) {
    return (
      <div className="run-shell">
        <div className="note error" role="alert">
          <span>
            <strong>This run-sheet link has been switched off.</strong> The family reset it or the memorial was taken down. Ask them for the new link.
          </span>
        </div>
      </div>
    );
  }

  const clock = now ? now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="run-shell">
      <header className="run-top">
        <div>
          <span className="eyebrow plain">Funeral-day run-sheet</span>
          <h1 className="h3">{snap.name}</h1>
        </div>
        <div className="run-status">
          {clock && <span className="run-clock">{clock}</span>}
          <SaveBadge state={save} onRetry={() => void flush()} />
        </div>
      </header>

      {snap.status !== 'PUBLISHED' && (
        <div className="note warn" style={{ marginBottom: 14 }}>
          <span>
            <strong>The memorial isn’t published yet.</strong> You can prepare the running order here; guests see it once the family publishes.
          </span>
        </div>
      )}

      {funeralDone ? (
        <section className="run-now run-thanks" aria-live="polite">
          <div className="k">The funeral has ended</div>
          <div className="t">Thank you. You carried the family through today.</div>
          <p className="run-note">
            Guests now see a thank-you, with directions to the refreshments{snap.journey.some((st) => st.type === 'aftertears') ? ' and, later, the after-tears' : ''}. Rest
            well.
          </p>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn on-night" type="button" onClick={() => commit({ liveKey: null }, { liveKey: null })}>
              Undo: the funeral isn’t over
            </button>
          </div>
        </section>
      ) : (
      <section className={`run-now${runDay === 'vigil' ? ' vigil' : ''}`} aria-live="polite">
        {hasVigil && liveIndex < 0 && (
          <div className="segmented on-night" role="group" aria-label="What are you running?">
            {(['vigil', 'day'] as const).map((d) => (
              <button key={d} type="button" aria-pressed={runDay === d} onClick={() => setChosenDay(d)}>
                {d === 'vigil' ? 'Night vigil' : 'Funeral day'}
              </button>
            ))}
          </div>
        )}
        {liveIndex >= 0 ? (
          <>
            <div className="k">{runDay === 'vigil' ? 'Night vigil · happening now' : `${partLabel(partOf(items[liveIndex]))} · happening now`}</div>
            <div className="t">{items[liveIndex].title}</div>
            {items[liveIndex].presenter && <div className="p">{items[liveIndex].presenter}</div>}
          </>
        ) : dayDone ? (
          <>
            <div className="k">Finished</div>
            <div className="t">{runDay === 'vigil' ? 'The night vigil has ended. Thank you.' : 'The service has ended.'}</div>
          </>
        ) : (
          <>
            <div className="k">{runDay === 'vigil' ? 'Night vigil · not started' : 'Not started yet'}</div>
            <div className="t">{firstItem ? `Tap Start when ${dayName} begins.` : runDay === 'vigil' ? 'The vigil has no programme yet. Add items below.' : 'Add the first item below.'}</div>
          </>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          {liveIndex < 0 && firstItem && (
            <button className="btn on-night primary" type="button" onClick={() => start(firstItem.id)}>
              {dayDone ? 'Start again' : 'Start'}: {firstItem.title}
            </button>
          )}
          {liveIndex >= 0 && nextItem && (
            <button className="btn on-night primary" type="button" onClick={() => start(nextItem.id)}>
              Next: {nextItem.title}
            </button>
          )}
          {liveIndex >= 0 && (
            <button className="btn on-night" type="button" onClick={finish}>
              {runDay === 'vigil' ? 'Finish the vigil' : 'Finish the service'}
            </button>
          )}
          {runDay === 'day' && (liveIndex >= 0 || dayDone) && (
            <button className="btn on-night candle" type="button" onClick={endFuneral}>
              End the funeral
            </button>
          )}
        </div>
        {snap.status === 'PUBLISHED' && <p className="run-note">Guests with the memorial open see this full-screen within about 15 seconds.</p>}
      </section>
      )}

      <ProcessionControl
        token={token}
        journey={snap.journey}
        record={snap.procession ?? null}
        onRecord={(r) => setSnap((s) => ({ ...s, procession: r }))}
        onRevoked={() => setRevoked(true)}
      />

      <section className="run-late">
        <div>
          <strong>Running late?</strong>
          <span className="tiny muted"> Moves everything still to come.</span>
        </div>
        <div className="row">
          <button className="btn sm" type="button" onClick={() => late(-5)}>
            −5 min
          </button>
          {[5, 10, 15].map((m) => (
            <button key={m} className="btn sm" type="button" onClick={() => late(m)}>
              +{m} min
            </button>
          ))}
        </div>
        <div className="row">
          <label className="check-row small">
            <input type="checkbox" checked={shiftOnStart} onChange={(e) => setShiftOnStart(e.target.checked)} />
            When I tap Start, move the items after it too
          </label>
          <label className="check-row small">
            <input type="checkbox" checked={moveStops} onChange={(e) => setMoveStops(e.target.checked)} />
            Also move today’s later stops (e.g. the cemetery)
          </label>
        </div>
      </section>

      <section>
        <div className="run-section-head">
          <h2 className="h3">Programme</h2>
          <span className="tiny muted">Drag ⠿ to reorder. Times follow the new order.</span>
        </div>
        <ol className="run-list">
          {order.map((item, i) => {
            const realIndex = items.findIndex((x) => x.id === item.id);
            const state = item.id === snap.liveKey ? 'now' : liveIndex >= 0 && realIndex < liveIndex ? 'done' : liveIndex >= 0 && realIndex === liveIndex + 1 ? 'next' : '';
            const isDragged = drag && items[drag.from]?.id === item.id;
            // A heading wherever the part of the day changes: night vigil, the service, the graveside.
            const partChanged = i === 0 ? partOf(item) !== 'service' || order.some((x) => partOf(x) !== 'service') : partOf(order[i - 1]) !== partOf(item);
            return (
              <Fragment key={item.id}>
              {partChanged && (
                <li className="run-part-head" aria-hidden="true">
                  {partLabel(partOf(item))}
                  {partStartLabel(partStart(snap.journey, items, partOf(item)), partOf(item)) && <span> · {partStartLabel(partStart(snap.journey, items, partOf(item)), partOf(item))}</span>}
                </li>
              )}
              <li ref={(el) => void (rows.current[i] = el)} className={`run-item ${state} ${isDragged ? 'dragging' : ''}`}>
                <button
                  type="button"
                  className="run-handle"
                  aria-label={`Drag to move ${item.title}`}
                  onPointerDown={(e) => onHandleDown(e, i)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={() => setDrag(null)}
                >
                  ⠿
                </button>
                <div className="run-time">{item.time || '—'}</div>
                <div className="run-body">
                  <span className="kind">
                    {programmeTypeLabel(item.type)}
                    {state === 'now' && <span className="pill live dot">Now</span>}
                    {state === 'next' && <span className="pill">Next</span>}
                    {state === 'done' && <span className="pill ok">Done</span>}
                  </span>
                  <strong>{item.title}</strong>
                  {(item.presenter || item.detail) && <p>{[item.presenter, item.detail].filter(Boolean).join(' · ')}</p>}
                </div>
                <div className="run-actions">
                  {state !== 'now' && (
                    <button className={`btn sm ${state === 'done' ? '' : 'accent'}`} type="button" onClick={() => start(item.id)}>
                      {state === 'done' ? 'Restart' : 'Start'}
                    </button>
                  )}
                  <button className="btn sm" type="button" onClick={() => setEditing({ item, afterIndex: null })}>
                    Edit
                  </button>
                  <button className="icon-btn" type="button" aria-label={`Move ${item.title} up`} disabled={i === 0 || Boolean(drag)} onClick={() => reorder(i, i - 1)}>
                    ↑
                  </button>
                  <button className="icon-btn" type="button" aria-label={`Move ${item.title} down`} disabled={i === order.length - 1 || Boolean(drag)} onClick={() => reorder(i, i + 1)}>
                    ↓
                  </button>
                  <button className="icon-btn" type="button" aria-label={`Add an item after ${item.title}`} onClick={() => setEditing({ item: blank(partOf(item)), afterIndex: i })}>
                    +
                  </button>
                </div>
              </li>
              </Fragment>
            );
          })}
        </ol>
        {items.length === 0 && <div className="empty-line">No programme yet. Add the first item.</div>}
        <button className="btn block" type="button" style={{ marginTop: 12 }} onClick={() => setEditing({ item: blank(items.length ? partOf(items[items.length - 1]) : 'service'), afterIndex: items.length - 1 })}>
          + Add an item
        </button>
      </section>

      {todaysStops.length > 0 && (
        <section>
          <div className="run-section-head">
            <h2 className="h3">Today’s stops</h2>
            <span className="tiny muted">Guests see these times on the memorial.</span>
          </div>
          <div className="run-stops">
            {todaysStops.map((s) => (
              <div key={s.id} className="run-stop">
                <div>
                  <span className="kind">{stopLabel(s.type)}</span>
                  <strong>{s.title}</strong>
                </div>
                <label className="field">
                  <span className="tiny muted">Starts</span>
                  <input className="input" type="time" value={s.time} onChange={(e) => setStopTime(s, 'time', e.target.value)} />
                </label>
                <label className="field">
                  <span className="tiny muted">Ends</span>
                  <input className="input" type="time" value={s.departTime} onChange={(e) => setStopTime(s, 'departTime', e.target.value)} />
                </label>
              </div>
            ))}
          </div>
        </section>
      )}
      {todaysStops.length === 0 && snap.journey.length > 0 && (
        <p className="tiny muted">The funeral journey starts {fmtDate(snap.journey[0].date)}. Stop times you can adjust will appear here on the day.</p>
      )}

      {editing && (
        <ItemEditor
          key={editing.item.id}
          initial={editing.item}
          isNew={editing.afterIndex !== null}
          onCancel={() => setEditing(null)}
          onSave={(item) => saveEdit(item, editing.afterIndex)}
          onRemove={editing.afterIndex === null ? () => remove(editing.item) : undefined}
        />
      )}
    </div>
  );
}

function merge(older: Pending | null, newer: Pending | null): Pending | null {
  if (!older) return newer;
  if (!newer) return older;
  const stopTimes = older.stopTimes || newer.stopTimes ? new Map([...(older.stopTimes ?? []), ...(newer.stopTimes ?? [])]) : undefined;
  return {
    programme: newer.programme ?? older.programme,
    stopTimes,
    liveKey: newer.liveKey !== undefined ? newer.liveKey : older.liveKey,
  };
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'saving') return <span className="save-state saving">Saving…</span>;
  if (state === 'offline')
    return (
      <button type="button" className="save-state error run-retry" onClick={onRetry}>
        No signal · will retry
      </button>
    );
  if (state === 'error')
    return (
      <button type="button" className="save-state error run-retry" onClick={onRetry}>
        Not saved · retry
      </button>
    );
  return <span className="save-state">Saved · guests see it</span>;
}

function ItemEditor({
  initial,
  isNew,
  onSave,
  onCancel,
  onRemove,
}: {
  initial: ProgrammeItem;
  isNew: boolean;
  onSave: (item: ProgrammeItem) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [item, setItem] = useState(initial);
  const set = <K extends keyof ProgrammeItem>(k: K, v: ProgrammeItem[K]) => setItem((i) => ({ ...i, [k]: v }));
  return (
    <div className="run-sheet-modal" role="dialog" aria-modal="true" aria-label={isNew ? 'Add a programme item' : 'Edit programme item'}>
      <form
        className="run-sheet-card"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...item, title: item.title.trim(), presenter: item.presenter.trim(), detail: item.detail.trim() });
        }}
      >
        <h2 className="h3">{isNew ? 'Add an item' : 'Edit item'}</h2>
        <div className="field">
          <label htmlFor="run-title">Title</label>
          <input id="run-title" className="input" value={item.title} maxLength={200} autoFocus onChange={(e) => set('title', e.target.value)} placeholder="e.g. Tribute from the grandchildren" />
        </div>
        <div className="field">
          <label htmlFor="run-part">Part of the day</label>
          <select id="run-part" className="select" value={item.part ?? 'service'} onChange={(e) => set('part', e.target.value as ProgrammePart)}>
            {PROGRAMME_PARTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="run-type">Type</label>
            <select id="run-type" className="select" value={item.type} onChange={(e) => set('type', e.target.value as ProgrammeType)}>
              {Object.entries(PROGRAMME_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="run-time">Time</label>
            <input id="run-time" className="input" type="time" value={item.time} onChange={(e) => set('time', e.target.value)} />
            {isNew && !item.time && <span className="hint">Leave empty to fit it in after the item above.</span>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="run-presenter">Who</label>
          <input id="run-presenter" className="input" value={item.presenter} maxLength={200} onChange={(e) => set('presenter', e.target.value)} placeholder="Optional" />
        </div>
        <div className="field">
          <label htmlFor="run-detail">Note for guests</label>
          <input id="run-detail" className="input" value={item.detail} maxLength={1000} onChange={(e) => set('detail', e.target.value)} placeholder="Optional, e.g. Hymn 42, page 18" />
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {onRemove ? (
            <button className="btn sm danger" type="button" onClick={onRemove}>
              Remove item
            </button>
          ) : (
            <span />
          )}
          <div className="row">
            <button className="btn" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn primary" type="submit">
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
