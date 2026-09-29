'use client';

import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';

type Point = { lat: number; lng: number };

const carIcon = (L: typeof Leaflet) =>
  L.divIcon({
    className: '',
    html: '<div class="proc-dot"><span></span></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const pinIcon = (L: typeof Leaflet) =>
  L.divIcon({
    className: '',
    html: '<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#141413;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.35)"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });

/** The procession (a pulsing dot) and where it's heading (a pin). Follows updates without resetting the guest's zoom. */
export function ProcessionMap({ car, destination, destinationLabel }: { car: Point | null; destination: Point | null; destinationLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const carMarker = useRef<Leaflet.Marker | null>(null);
  const destMarker = useRef<Leaflet.Marker | null>(null);
  const framed = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = (await import('leaflet')).default;
        if (cancelled || !box.current || map.current) return;
        let loadedAny = false;
        const m = lib.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([-25.7461, 28.1881], 12);
        lib
          .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
        L.current = lib;
        map.current = m;
        setReady(true);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      carMarker.current = null;
      destMarker.current = null;
      framed.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const lib = L.current;
    if (!ready || !m || !lib) return;
    if (destination) {
      if (!destMarker.current) destMarker.current = lib.marker([destination.lat, destination.lng], { icon: pinIcon(lib), title: destinationLabel }).addTo(m);
      else destMarker.current.setLatLng([destination.lat, destination.lng]);
    }
    if (car) {
      if (!carMarker.current) carMarker.current = lib.marker([car.lat, car.lng], { icon: carIcon(lib), title: 'The procession', zIndexOffset: 1000 }).addTo(m);
      else carMarker.current.setLatLng([car.lat, car.lng]);
    } else if (carMarker.current) {
      carMarker.current.remove();
      carMarker.current = null;
    }
    // Frame both once; after that, leave the view to the guest.
    if (!framed.current && (car || destination)) {
      const pts = [car, destination].filter(Boolean).map((p) => [p!.lat, p!.lng] as [number, number]);
      if (pts.length === 2) m.fitBounds(lib.latLngBounds(pts), { padding: [64, 64], maxZoom: 16 });
      else m.setView(pts[0], 15);
      framed.current = Boolean(car);
    }
  }, [ready, car, destination, destinationLabel]);

  return (
    <div className="map-box proc-map">
      <div ref={box} style={{ position: 'absolute', inset: 0 }} aria-label={`Map showing the procession and ${destinationLabel}`} />
      {failed && (
        <div className="map-fallback" style={{ pointerEvents: 'none', background: 'rgba(240,238,230,.9)' }}>
          The map couldn’t load. The estimate and directions still work.
        </div>
      )}
    </div>
  );
}
