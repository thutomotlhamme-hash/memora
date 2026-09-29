'use client';

import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER: [number, number] = [-25.7461, 28.1881]; // Pretoria

/**
 * Exact-pin picker. Tap the map or drag the pin. Search is only a shortcut: the
 * saved coordinates are the source of truth, so a rural gate or graveside can be
 * pinned even when no address exists.
 */
export function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const placeRef = useRef<((at: [number, number]) => void) | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        let loadedAny = false;
        if (cancelled || !box.current || map.current) return;
        const start: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
        const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(start, lat != null ? 16 : 11);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on('tileload', () => {
            loadedAny = true;
            setFailed(false);
          })
          .on('tileerror', () => {
            if (!loadedAny) setFailed(true);
          })
          .addTo(m);
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#b5552f;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.35)"></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        // No pin until the family chooses one, so nobody saves the default city centre by accident.
        const place = (at: Leaflet.LatLngExpression) => {
          if (marker.current) return marker.current.setLatLng(at);
          const mk = L.marker(at, { draggable: true, icon, autoPan: true }).addTo(m);
          mk.on('dragend', () => {
            const p = mk.getLatLng();
            onChangeRef.current(p.lat, p.lng);
          });
          marker.current = mk;
        };
        placeRef.current = place;
        if (lat != null && lng != null) place(start);
        m.on('click', (e: Leaflet.LeafletMouseEvent) => {
          place(e.latlng);
          onChangeRef.current(e.latlng.lat, e.latlng.lng);
        });
        map.current = m;
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
      placeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once; later moves go through the effect below.
  }, []);

  // Follow coordinates set from outside (place search, typing, "use my location").
  useEffect(() => {
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || !map.current) return;
    const current = marker.current?.getLatLng();
    if (current && Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;
    placeRef.current?.([lat, lng]);
    map.current.setView([lat, lng], Math.max(map.current.getZoom(), 16));
  }, [lat, lng]);

  return (
    <div className="map-box">
      <div ref={box} style={{ position: 'absolute', inset: 0 }} aria-label="Map. Tap to place the pin, or drag the pin." />
      {failed && <div className="map-fallback" style={{ pointerEvents: 'none', background: 'rgba(240,238,230,.85)' }}>The map couldn’t load. You can still type the coordinates below.</div>}
    </div>
  );
}
