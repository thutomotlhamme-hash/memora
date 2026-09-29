'use client';

import { useEffect, useRef, useState } from 'react';
import { parseNominatim, parsePhoton, photonUrl, type Place } from '@/lib/places';

export type { Place } from '@/lib/places';

const cache = new Map<string, Place[]>();
let lastNominatimAt = 0;

/**
 * Search as you type. After 3 letters, suggestions appear from Photon, which
 * matches partial words ("st pet" finds St Peter's) and leans towards the
 * family's previous stop, or South Africa. Arrow keys move through them, Enter
 * picks one. If Photon can't be reached, Enter runs a full search on Nominatim.
 */
export function PlaceSearch({ onPick, near }: { onPick: (place: Place) => void; near?: { lat: number; lng: number } | null }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'short'>('idle');
  const wrap = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bias = near && Number.isFinite(near.lat) && Number.isFinite(near.lng) ? { lat: near.lat, lng: near.lng } : undefined;
  const biasKey = bias ? `${bias.lat.toFixed(1)},${bias.lng.toFixed(1)}` : 'za';

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    };
  }, []);

  async function suggest(query: string) {
    const key = `p:${biasKey}:${query.toLowerCase()}`;
    if (cache.has(key)) {
      setResults(cache.get(key)!);
      setActive(-1);
      return;
    }
    abort.current?.abort();
    abort.current = new AbortController();
    setStatus('loading');
    try {
      const res = await fetch(photonUrl(query, bias), { signal: abort.current.signal });
      if (!res.ok) throw new Error('unavailable');
      const places = parsePhoton(await res.json());
      cache.set(key, places);
      setResults(places);
      setActive(-1);
      setStatus('idle');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setStatus('idle'); // Stay quiet while typing; Enter falls back to a full search.
    }
  }

  async function fullSearch() {
    const query = q.trim();
    if (query.length < 3) return setStatus('short');
    const key = `n:${query.toLowerCase()}`;
    if (cache.has(key)) return setResults(cache.get(key)!);
    // Nominatim allows one request a second and no autocomplete.
    const wait = 1100 - (Date.now() - lastNominatimAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    abort.current?.abort();
    abort.current = new AbortController();
    setStatus('loading');
    try {
      const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '7', 'accept-language': 'en', countrycodes: 'za,ls,sz,bw,na,zw,mz' });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: abort.current.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('unavailable');
      const places = parseNominatim(await res.json());
      cache.set(key, places);
      setResults(places);
      setActive(-1);
      setStatus('idle');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setResults(null);
      setStatus('error');
    }
  }

  function onType(value: string) {
    setQ(value);
    setStatus('idle');
    if (timer.current) clearTimeout(timer.current);
    const query = value.trim();
    if (query.length < 3) {
      abort.current?.abort();
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => void suggest(query), 280);
  }

  function pick(p: Place) {
    onPick(p);
    setQ(p.name);
    setResults(null);
    setActive(-1);
  }

  const open = Boolean(results);
  const optionId = (i: number) => `place-opt-${i}`;

  return (
    <div className="field place-search" ref={wrap}>
      <label htmlFor="placeSearch">Find the place</label>
      <div className="row">
        <input
          id="placeSearch"
          className="input"
          value={q}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => {
            if (q.trim().length >= 3 && !results) void suggest(q.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && results?.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === 'ArrowUp' && results?.length) {
              e.preventDefault();
              setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (results && active >= 0 && results[active]) pick(results[active]);
              else void fullSearch();
            } else if (e.key === 'Escape') {
              setResults(null);
              setActive(-1);
            }
          }}
          placeholder="Start typing: church, hall, cemetery or street"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="placeResults"
          aria-expanded={open}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        />
        <button className="btn" type="button" onClick={() => void fullSearch()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </div>
      <span className="hint" role={status === 'error' || status === 'short' ? 'alert' : undefined}>
        {status === 'short'
          ? 'Type at least 3 letters.'
          : status === 'error'
            ? 'Search isn’t available right now. Tap the map or use your location instead.'
            : 'Suggestions appear as you type. Pick one, then drag the pin to the exact gate or entrance. © OpenStreetMap contributors.'}
      </span>
      {results && (
        <div className="place-results" id="placeResults" role="listbox" aria-label="Suggested places">
          {results.length === 0 ? (
            <div style={{ padding: 14 }} className="small muted">
              No matches yet. Try the suburb or a landmark nearby, press Search for a wider look, or drop the pin by hand.
            </div>
          ) : (
            results.map((p, i) => (
              <button
                key={`${p.lat},${p.lng},${i}`}
                id={optionId(i)}
                type="button"
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <strong>
                  <Highlight text={p.name} query={q} />
                  {p.kind && <em className="place-kind">{p.kind}</em>}
                </strong>
                {p.address && <span>{p.address}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Bold the part of the name that matches what was typed. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return <>{text}</>;
  const lower = text.toLowerCase();
  const marks = new Array(text.length).fill(false);
  for (const w of words) {
    let i = lower.indexOf(w);
    while (i >= 0) {
      for (let k = i; k < i + w.length; k++) marks[k] = true;
      i = lower.indexOf(w, i + w.length);
    }
  }
  const parts: { t: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.on === marks[i]) last.t += text[i];
    else parts.push({ t: text[i], on: marks[i] });
  }
  return (
    <>
      {parts.map((p, i) => (p.on ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  );
}
