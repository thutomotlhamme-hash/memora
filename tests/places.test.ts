import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNominatim, parsePhoton, photonUrl } from '../src/lib/places.ts';

const feature = (name: string, lat: number, lng: number, extra: Record<string, string> = {}) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { name, ...extra },
});

test('Photon suggestions become places, local results first, no duplicates', () => {
  const places = parsePhoton({
    features: [
      feature("St Peter's Church", 51.5, -0.1, { countrycode: 'GB', city: 'London', osm_value: 'place_of_worship' }),
      feature("St Peter's Anglican Church", -25.75, 28.19, { countrycode: 'ZA', street: 'Church Street', housenumber: '12', district: 'Arcadia', city: 'Pretoria', state: 'Gauteng', osm_value: 'place_of_worship' }),
      feature("St Peter's Anglican Church", -25.75, 28.19, { countrycode: 'ZA' }),
      feature('', -25.7, 28.2, {}),
      { geometry: { coordinates: [NaN, NaN] }, properties: { name: 'Broken' } },
    ],
  });
  assert.equal(places.length, 2);
  assert.equal(places[0].country, 'ZA');
  assert.equal(places[0].name, "St Peter's Anglican Church");
  assert.equal(places[0].address, '12 Church Street, Arcadia, Pretoria, Gauteng');
  assert.equal(places[0].kind, 'Church');
  assert.equal(places[1].country, 'GB');
});

test('a street address with no name still reads well', () => {
  const [p] = parsePhoton({ features: [feature('', -26.2, 28.04, { street: 'Vilakazi Street', housenumber: '8115', city: 'Soweto', osm_value: 'house' })] });
  assert.equal(p.name, '8115 Vilakazi Street');
  assert.equal(p.address, 'Soweto');
});

test('bad responses give no suggestions instead of crashing', () => {
  assert.deepEqual(parsePhoton(null), []);
  assert.deepEqual(parsePhoton({ features: 'nope' }), []);
  assert.deepEqual(parseNominatim({}), []);
});

test('suggestions lean towards the previous stop', () => {
  const url = new URL(photonUrl('st pet', { lat: -25.75, lng: 28.19 }));
  assert.equal(url.searchParams.get('q'), 'st pet');
  assert.equal(url.searchParams.get('lat'), '-25.75');
  assert.equal(url.searchParams.get('lon'), '28.19');
});
