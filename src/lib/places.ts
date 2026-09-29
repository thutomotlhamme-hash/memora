// Place search helpers. Suggestions come from Photon (komoot's OpenStreetMap
// geocoder, built for search-as-you-type and partial words); Nominatim remains
// the fallback for a full search on Enter. Pure functions so they are testable.

export type Place = { name: string; address: string; kind: string; lat: number; lng: number; country: string };

/** Roughly the centre of South Africa: suggestions lean local when we know nothing better. */
export const SA_CENTRE = { lat: -28.5, lng: 24.7 };

const KIND: Record<string, string> = {
  place_of_worship: 'Church',
  church: 'Church',
  cathedral: 'Church',
  chapel: 'Chapel',
  mosque: 'Mosque',
  synagogue: 'Synagogue',
  temple: 'Temple',
  grave_yard: 'Cemetery',
  cemetery: 'Cemetery',
  crematorium: 'Crematorium',
  funeral_hall: 'Funeral hall',
  funeral_directors: 'Funeral parlour',
  community_centre: 'Community hall',
  events_venue: 'Venue',
  school: 'School',
  hall: 'Hall',
  house: 'Address',
  street: 'Street',
  suburb: 'Suburb',
  city: 'City',
  town: 'Town',
  village: 'Village',
};

export function photonUrl(query: string, near: { lat: number; lng: number } = SA_CENTRE, limit = 7): string {
  const p = new URLSearchParams({ q: query, limit: String(limit), lang: 'en', lat: String(near.lat), lon: String(near.lng), location_bias_scale: '0.4' });
  return `https://photon.komoot.io/api/?${p}`;
}

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> };

/** Photon GeoJSON → places, Southern African results first, duplicates removed. */
export function parsePhoton(data: unknown): Place[] {
  const features = (data as { features?: PhotonFeature[] })?.features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of features) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const name = p.name || street || p.city || p.county || '';
    if (!name) continue;
    const address = [p.name ? street : '', p.district || p.locality, p.city || p.county, p.state]
      .filter((x, i, a) => x && x !== name && a.indexOf(x) === i)
      .join(', ');
    const key = `${name}|${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      name,
      address: address || p.country || '',
      kind: KIND[p.osm_value ?? ''] ?? KIND[p.type ?? ''] ?? '',
      lat: Number(lat),
      lng: Number(lng),
      country: (p.countrycode ?? '').toUpperCase(),
    });
  }
  const local = new Set(['ZA', 'LS', 'SZ', 'BW', 'NA', 'ZW', 'MZ']);
  return places.sort((a, b) => Number(local.has(b.country)) - Number(local.has(a.country)));
}

/** Nominatim JSON → places (the Enter-key fallback). */
export function parseNominatim(data: unknown): Place[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((r: Record<string, string>) => ({
      name: String(r.name || r.display_name || '').split(',')[0],
      address: String(r.display_name || '').split(',').slice(1, 4).join(',').trim(),
      kind: KIND[r.type] ?? '',
      lat: Number(r.lat),
      lng: Number(r.lon),
      country: '',
    }))
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
