// Ten families from across South Africa, each with the kind of funeral their
// tradition usually holds. Names are made up; places are real so the place
// search finds them. Dates are relative to the day the demo runs.

export type DemoStop = {
  type: 'home' | 'vigil' | 'church' | 'hall' | 'cemetery' | 'crematorium' | 'reception' | 'aftertears' | 'gathering' | 'other';
  title: string;
  /** Days from today. */
  day: number;
  time: string;
  until?: string;
  /** What to type into the place search. */
  search: string;
  /** Used only if the place search finds nothing. */
  fallback: { lat: number; lng: number; address: string };
  landmark?: string;
  parking?: string;
  transport?: string;
};

export type DemoItem = { part?: 'vigil' | 'service' | 'graveside'; type: string; time?: string; title: string; presenter?: string; detail?: string };

export type DemoFamily = {
  key: string;
  heritage: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  born: string;
  /** Days ago. */
  passed: number;
  disposition: 'burial' | 'cremation' | 'private_burial_later' | 'memorial_only' | 'other';
  dispositionNote?: string;
  stops: DemoStop[];
  prayers?: { title: string; word: string; scripture: string; leader: string }[];
  vigil?: 'prayer' | 'night';
  items?: DemoItem[];
  story: string;
  familyMessage: string;
  /** Holds the funeral today and runs it live from the run-sheet. */
  liveToday?: boolean;
};

export const FAMILIES: DemoFamily[] = [
  {
    key: 'zulu-soweto',
    heritage: 'isiZulu · Soweto · burial with night vigil and a week of prayers',
    firstName: 'Thandeka',
    lastName: 'Dlamini',
    preferredName: 'MaDlamini',
    born: '1949-06-14',
    passed: 3,
    disposition: 'burial',
    stops: [
      { type: 'vigil', title: 'Night vigil at home', day: 3, time: '18:00', search: 'Orlando West Soweto', fallback: { lat: -26.2366, lng: 27.9053, address: 'Orlando West, Soweto' }, landmark: 'White gate, marquee in the yard', parking: 'Street parking on Vilakazi Street' },
      { type: 'church', title: 'Funeral service', day: 4, time: '06:00', until: '09:00', search: 'Regina Mundi Church Soweto', fallback: { lat: -26.2442, lng: 27.8946, address: 'Regina Mundi, Rockville, Soweto' }, transport: 'Buses leave the family home at 05:30.' },
      { type: 'cemetery', title: 'Burial', day: 4, time: '09:45', until: '11:00', search: 'Avalon Cemetery Soweto', fallback: { lat: -26.2847, lng: 27.8791, address: 'Avalon Cemetery, Soweto' }, landmark: 'Gate 3' },
      { type: 'aftertears', title: 'After-tears', day: 4, time: '15:00', search: 'Orlando West Soweto', fallback: { lat: -26.2366, lng: 27.9053, address: 'Orlando West, Soweto' } },
    ],
    prayers: [
      { title: 'A service of comfort', word: 'Comfort', scripture: 'Matthew 5:4', leader: 'Rev. Khumalo, Methodist Church' },
      { title: 'The Lord is my shepherd', word: 'Trust', scripture: 'Psalm 23', leader: 'Manyano women' },
    ],
    vigil: 'night',
    items: [
      { type: 'hymn', time: '06:00', title: 'Opening hymn: Lizalis’ idinga lakho', presenter: 'Congregation' },
      { type: 'prayer', time: '06:15', title: 'Opening prayer', presenter: 'Rev. Khumalo' },
      { type: 'obituary', time: '06:30', title: 'Obituary', presenter: 'Her grandson, Sipho' },
      { type: 'tribute', time: '07:00', title: 'Tributes from the church and family', presenter: 'Family & friends' },
      { type: 'sermon', time: '07:45', title: 'Sermon', presenter: 'Bishop Ntuli', detail: 'John 14:1–3' },
      { part: 'graveside', type: 'committal', time: '09:45', title: 'Committal', presenter: 'Rev. Khumalo' },
      { part: 'graveside', type: 'thanks', time: '10:30', title: 'Vote of thanks', presenter: 'Her son, Bongani' },
    ],
    story: 'Thandeka raised six children and half the street besides. For forty years she led the Manyano women in song on Thursday afternoons, and no child left her kitchen hungry.',
    familyMessage: 'Ngiyabonga. Thank you for every prayer, every plate and every song. Mama would have loved to see you all together.',
  },
  {
    key: 'xhosa-live',
    heritage: 'isiXhosa · Gqeberha · funeral held today, run live from the run-sheet',
    firstName: 'Luyanda',
    lastName: 'Gqabaza',
    born: '1961-11-02',
    passed: 5,
    disposition: 'burial',
    liveToday: true,
    stops: [
      { type: 'church', title: 'Funeral service', day: 0, time: '__NOW-30', until: '__NOW+90', search: 'New Brighton Gqeberha', fallback: { lat: -33.9179, lng: 25.6116, address: 'New Brighton, Gqeberha' } },
      { type: 'cemetery', title: 'Burial', day: 0, time: '__NOW+120', search: 'Motherwell Cemetery', fallback: { lat: -33.8175, lng: 25.5902, address: 'Motherwell, Gqeberha' } },
      { type: 'reception', title: 'Refreshments at home', day: 0, time: '__NOW+180', search: 'Kwazakhele Gqeberha', fallback: { lat: -33.8837, lng: 25.6124, address: 'KwaZakhele, Gqeberha' } },
    ],
    items: [
      { type: 'hymn', time: '__NOW-30', title: 'Opening hymn: Nkosi sikelel’ iAfrika', presenter: 'Congregation' },
      { type: 'prayer', time: '__NOW-20', title: 'Opening prayer', presenter: 'Rev. Mqhayi' },
      { type: 'tribute', time: '__NOW', title: 'Tributes', presenter: 'Colleagues from the school' },
      { type: 'eulogy', time: '__NOW+20', title: 'Eulogy', presenter: 'His brother, Sizwe' },
      { type: 'thanks', time: '__NOW+60', title: 'Vote of thanks', presenter: 'The family' },
    ],
    story: 'Luyanda taught mathematics in New Brighton for thirty years and coached the under-15 rugby team every winter. His students still call him Sir.',
    familyMessage: 'Enkosi kakhulu. Thank you for standing with us.',
  },
  {
    key: 'sotho-bloem',
    heritage: 'Sesotho · Bloemfontein · burial with a short prayer vigil',
    firstName: 'Palesa',
    lastName: 'Moloi',
    born: '1972-03-21',
    passed: 4,
    disposition: 'burial',
    stops: [
      { type: 'vigil', title: 'Evening prayers at home', day: 4, time: '18:30', search: 'Mangaung Bloemfontein', fallback: { lat: -29.1575, lng: 26.2583, address: 'Mangaung, Bloemfontein' } },
      { type: 'church', title: 'Funeral service', day: 5, time: '07:00', until: '09:30', search: 'Bloemfontein Cathedral', fallback: { lat: -29.1177, lng: 26.2172, address: 'Cathedral of St Andrew and St Michael, Bloemfontein' } },
      { type: 'cemetery', title: 'Burial', day: 5, time: '10:15', search: 'Heidedal Bloemfontein', fallback: { lat: -29.1453, lng: 26.2502, address: 'Heidedal, Bloemfontein' } },
    ],
    vigil: 'prayer',
    items: [
      { type: 'hymn', time: '07:00', title: 'Hymn: Modimo o moholo', presenter: 'Congregation' },
      { type: 'scripture', time: '07:15', title: 'Psalm 121', presenter: 'Her daughter, Lerato' },
      { type: 'eulogy', time: '08:00', title: 'Eulogy', presenter: 'Her husband, Teboho' },
    ],
    story: 'Palesa ran the busiest hair salon in Mangaung and never once turned away a bride on her wedding morning.',
    familyMessage: 'Re a leboha. Thank you for your love and support.',
  },
  {
    key: 'tswana-mahikeng',
    heritage: 'Setswana · Mahikeng · memorial service only',
    firstName: 'Boitumelo',
    lastName: 'Seleka',
    born: '1955-08-09',
    passed: 12,
    disposition: 'memorial_only',
    dispositionNote: 'He was laid to rest in Botswana beside his parents.',
    stops: [{ type: 'hall', title: 'Memorial service', day: 6, time: '10:00', until: '12:30', search: 'Mahikeng Civic Centre', fallback: { lat: -25.8652, lng: 25.6442, address: 'Civic Centre, Mahikeng' } }],
    items: [
      { type: 'prayer', time: '10:00', title: 'Opening prayer', presenter: 'Pastor Molefe' },
      { type: 'tribute', time: '10:20', title: 'Tributes from the co-operative', presenter: 'Farmers’ co-operative' },
      { type: 'song', time: '11:00', title: 'Song', presenter: 'Mahikeng Male Choir' },
    ],
    story: 'Boitumelo farmed cattle outside Mahikeng all his life and chaired the farmers’ co-operative for two decades.',
    familyMessage: 'Re lebogela lorato lwa lona.',
  },
  {
    key: 'venda-thohoyandou',
    heritage: 'Tshivenda · Thohoyandou · burial',
    firstName: 'Tshilidzi',
    lastName: 'Ramabulana',
    born: '1968-01-30',
    passed: 3,
    disposition: 'burial',
    stops: [
      { type: 'church', title: 'Funeral service', day: 4, time: '07:00', search: 'Thohoyandou', fallback: { lat: -22.9456, lng: 30.4849, address: 'Thohoyandou' } },
      { type: 'cemetery', title: 'Burial at the family graves', day: 4, time: '10:00', search: 'Sibasa', fallback: { lat: -22.9364, lng: 30.4631, address: 'Sibasa' } },
    ],
    items: [{ type: 'prayer', time: '07:00', title: 'Opening prayer', presenter: 'Rev. Mudau' }],
    story: 'Tshilidzi was a nurse at Tshilidzini Hospital for twenty-five years, known on every ward for her calm hands.',
    familyMessage: 'Ndo livhuwa. Thank you all.',
  },
  {
    key: 'tsonga-giyani',
    heritage: 'Xitsonga · Giyani · burial with evening prayers',
    firstName: 'Hlulani',
    lastName: 'Baloyi',
    born: '1979-04-17',
    passed: 2,
    disposition: 'burial',
    stops: [
      { type: 'church', title: 'Funeral service', day: 5, time: '06:00', search: 'Giyani', fallback: { lat: -23.3025, lng: 30.7187, address: 'Giyani' } },
      { type: 'cemetery', title: 'Burial', day: 5, time: '09:00', search: 'Giyani Section A', fallback: { lat: -23.3122, lng: 30.7061, address: 'Giyani Section A' } },
    ],
    prayers: [{ title: 'Evening prayers', word: 'Peace', scripture: 'John 14:27', leader: 'ZCC congregation' }],
    story: 'Hlulani drove the Giyani–Polokwane taxi route for fifteen years and knew every passenger by name.',
    familyMessage: 'Inkomu swinene.',
  },
  {
    key: 'pedi-polokwane',
    heritage: 'Sepedi · Polokwane · burial',
    firstName: 'Lesiba',
    lastName: 'Mphahlele',
    born: '1947-12-05',
    passed: 6,
    disposition: 'burial',
    stops: [
      { type: 'home', title: 'Family home', day: 3, time: '05:30', search: 'Seshego Polokwane', fallback: { lat: -23.8628, lng: 29.3875, address: 'Seshego, Polokwane' } },
      { type: 'church', title: 'Funeral service', day: 3, time: '07:00', search: 'Polokwane', fallback: { lat: -23.9045, lng: 29.4689, address: 'Polokwane' } },
      { type: 'cemetery', title: 'Burial', day: 3, time: '10:00', search: 'Seshego Cemetery', fallback: { lat: -23.8511, lng: 29.3942, address: 'Seshego Cemetery' } },
    ],
    story: 'Lesiba was a school principal in Seshego and the first in his village to earn a degree.',
    familyMessage: 'Re a leboga.',
  },
  {
    key: 'afrikaans-stellenbosch',
    heritage: 'Afrikaans · Stellenbosch · church service and cremation',
    firstName: 'Johannes',
    lastName: 'van der Merwe',
    preferredName: 'Hannes',
    born: '1940-09-11',
    passed: 5,
    disposition: 'cremation',
    stops: [
      { type: 'church', title: 'Roudiens', day: 6, time: '11:00', until: '12:15', search: 'Moederkerk Stellenbosch', fallback: { lat: -33.9366, lng: 18.8604, address: 'Moederkerk, Drostdy Street, Stellenbosch' } },
      { type: 'reception', title: 'Tea in the church hall', day: 6, time: '12:30', search: 'Stellenbosch', fallback: { lat: -33.9321, lng: 18.8602, address: 'Stellenbosch' } },
      { type: 'crematorium', title: 'Cremation (family only)', day: 6, time: '14:00', search: 'Maitland Crematorium', fallback: { lat: -33.9235, lng: 18.4886, address: 'Maitland, Cape Town' } },
    ],
    items: [
      { type: 'hymn', time: '11:00', title: 'Psalm 23', presenter: 'Gemeente' },
      { type: 'sermon', time: '11:15', title: 'Prediking', presenter: 'Ds. Botha' },
      { type: 'tribute', time: '11:45', title: 'Huldeblyk', presenter: 'His granddaughter, Annelie' },
    ],
    story: 'Hannes made wine on the same farm for fifty harvests and taught his grandchildren to prune vines before they could ride bicycles.',
    familyMessage: 'Baie dankie vir julle liefde en gebede.',
  },
  {
    key: 'cape-malay-bokaap',
    heritage: 'Cape Malay · Bo-Kaap · Muslim burial the same day, no formal programme',
    firstName: 'Faldela',
    lastName: 'Abrahams',
    born: '1958-02-02',
    passed: 0,
    disposition: 'burial',
    stops: [
      { type: 'home', title: 'Ghusl at the family home', day: 0, time: '__NOW+60', search: 'Bo-Kaap Cape Town', fallback: { lat: -33.9208, lng: 18.4153, address: 'Bo-Kaap, Cape Town' } },
      { type: 'other', title: 'Janazah prayer', day: 0, time: '__NOW+120', search: 'Auwal Mosque Cape Town', fallback: { lat: -33.9205, lng: 18.4148, address: 'Auwal Masjid, Dorp Street, Bo-Kaap' } },
      { type: 'cemetery', title: 'Burial', day: 0, time: '__NOW+180', search: 'Mowbray Muslim Cemetery', fallback: { lat: -33.9491, lng: 18.4745, address: 'Mowbray Muslim Cemetery' } },
    ],
    story: 'Faldela cooked for every wedding and every Eid on her street, and her koeksisters were the reason people visited on a Sunday.',
    familyMessage: 'Shukran for your duas and for standing with us.',
  },
  {
    key: 'hindu-chatsworth',
    heritage: 'Hindu · Chatsworth, Durban · prayers at home and cremation',
    firstName: 'Pravesh',
    lastName: 'Naidoo',
    born: '1963-07-22',
    passed: 1,
    disposition: 'cremation',
    stops: [
      { type: 'home', title: 'Prayers at the family home', day: 2, time: '08:00', until: '10:30', search: 'Chatsworth Durban', fallback: { lat: -29.9109, lng: 30.8795, address: 'Chatsworth, Durban' } },
      { type: 'crematorium', title: 'Cremation', day: 2, time: '11:30', search: 'Clare Estate Crematorium Durban', fallback: { lat: -29.8176, lng: 30.9811, address: 'Clare Estate, Durban' } },
    ],
    items: [
      { type: 'prayer', time: '08:00', title: 'Prayers and lighting of the lamp', presenter: 'Pandit Maharaj' },
      { type: 'tribute', time: '09:15', title: 'Family tributes', presenter: 'His children' },
    ],
    story: 'Pravesh ran the corner shop in Unit 3 for thirty-two years, extending credit to half of Chatsworth and forgetting none of their birthdays.',
    familyMessage: 'Thank you for your prayers and your kindness to our family.',
  },
  {
    key: 'coloured-mitchells-plain',
    heritage: 'Cape Coloured · Mitchells Plain · service now, private burial later',
    firstName: 'Charlene',
    lastName: 'Adams',
    born: '1966-05-19',
    passed: 4,
    disposition: 'private_burial_later',
    dispositionNote: 'The family will lay her to rest privately next month.',
    stops: [{ type: 'church', title: 'Thanksgiving service', day: 5, time: '10:00', until: '11:30', search: 'Mitchells Plain Town Centre', fallback: { lat: -34.0478, lng: 18.6186, address: 'Mitchells Plain, Cape Town' } }],
    items: [
      { type: 'hymn', time: '10:00', title: 'Amazing Grace', presenter: 'Congregation' },
      { type: 'tribute', time: '10:20', title: 'Tributes', presenter: 'Her netball team' },
    ],
    story: 'Charlene coached netball at the community centre for twenty years and never missed a Saturday game.',
    familyMessage: 'Thank you for all the love, Mitchells Plain.',
  },
  {
    key: 'english-durban-other',
    heritage: 'English · Durban · something else: ashes scattered at sea',
    firstName: 'Margaret',
    lastName: 'Thompson',
    preferredName: 'Peggy',
    born: '1938-10-03',
    passed: 9,
    disposition: 'other',
    dispositionNote: 'Her ashes will be scattered at sea off Umhlanga, as she wished.',
    stops: [
      { type: 'hall', title: 'Celebration of life', day: 7, time: '15:00', until: '17:00', search: 'Umhlanga Rocks', fallback: { lat: -29.7265, lng: 31.0854, address: 'Umhlanga Rocks, Durban' } },
      { type: 'gathering', title: 'Scattering of ashes at the lighthouse', day: 7, time: '17:30', search: 'Umhlanga Lighthouse', fallback: { lat: -29.7248, lng: 31.0886, address: 'Umhlanga Lighthouse' } },
    ],
    story: 'Peggy swam at Umhlanga every morning until she was eighty-five and taught three generations of children to read the tides.',
    familyMessage: 'Thank you for sharing Peggy with us.',
  },
];

/** "__NOW+90" → the time 90 minutes from now, for the live-today family. */
export function resolveTime(value: string, now = new Date()): string {
  const m = /^__NOW([+-]\d+)?$/.exec(value);
  if (!m) return value;
  const t = new Date(now.getTime() + Number(m[1] ?? 0) * 60_000);
  const mins = Math.min(Math.max(t.getHours() * 60 + t.getMinutes(), 0), 23 * 60 + 58);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
