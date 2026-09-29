'use client';

import { useEffect, useRef, useState } from 'react';

export type Place = { name: string; address: string; lat: number; lng: number };

const cache = new Map<string, Place[]>();
let lastRequestAt = 0;

/**
 * OpenStreetMap Nominatim search. Their usage policy allows at most one request per
 * second with no autocomplete-as-you-type, so this searches on submit only, caches
 * results and closes the dropdown on outside click or Escape.
 */
export function PlaceSearch({ onPick }: { onPick: (place: Place) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const wrap = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function search() {
    const query = q.trim();
    if (query.length < 3) return setStatus('error');
    const key = query.toLowerCase();
    if (cache.has(key)) return setResults(cache.get(key)!);
    const wait = 1100 - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    abort.current?.abort();
    abort.current = new AbortController();
    setStatus('loading');
    try {
      const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '0', limit: '6', 'accept-language': 'en' });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: abort.current.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('unavailable');
      const data = (await res.json()) as any[];
      const places = (Array.isArray(data) ? data : [])
        .map((r) => ({
          name: String(r.name || r.display_name || '').split(',')[0],
          address: String(r.display_name || ''),
          lat: Number(r.lat),
          lng: Number(r.lon),
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      cache.set(key, places);
      setResults(places);
      setStatus('idle');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setResults(null);
      setStatus('error');
    }
  }

  return (
    <div className="field place-search" ref={wrap}>
      <label htmlFor="placeSearch">Find the place</label>
      <div className="row">
        <input
          id="placeSearch"
          className="input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
            if (e.key === 'Escape') setResults(null);
          }}
          placeholder="Church, hall, cemetery, crematorium or street address"
          autoComplete="off"
          role="combobox"
          aria-controls="placeResults"
          aria-expanded={Boolean(results)}
        />
        <button className="btn" type="button" onClick={() => void search()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </div>
      <span className="hint" role={status === 'error' ? 'alert' : undefined}>
        {status === 'error'
          ? 'Type at least 3 characters. If search is unavailable, tap the map or enter coordinates instead.'
          : 'Pick a result, then drag the pin to the exact gate or entrance. Search © OpenStreetMap contributors.'}
      </span>
      {results && (
        <div className="place-results" id="placeResults" role="listbox" aria-label="Places">
          {results.length === 0 ? (
            <div style={{ padding: 14 }} className="small muted">
              No places found. Try a nearby landmark or suburb, or drop the pin by hand.
            </div>
          ) : (
            results.map((p, i) => (
              <button
                key={`${p.lat},${p.lng},${i}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick(p);
                  setQ(p.name);
                  setResults(null);
                }}
              >
                <strong>{p.name}</strong>
                <span>{p.address}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
