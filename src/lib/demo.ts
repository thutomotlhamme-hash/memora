import { emptyDraft, localDateKey, type Draft } from './memorial.ts';

/**
 * The sample memorial behind /m/preview. Its stops are pinned to *today* so the
 * Live Funeral Mode panel always shows whichever phase matches the real clock.
 */
export function demoDraft(now = new Date()): Draft {
  const today = localDateKey(now);
  return {
    ...emptyDraft(),
    person: {
      firstName: 'Naledi',
      lastName: 'Mokoena',
      preferredName: 'Naledi',
      birthDate: '1958-04-12',
      passingDate: '2026-08-19',
      portraitPath: '',
      portraitUrl: '',
    },
    story: {
      obituary:
        'Naledi lived with a quiet generosity that made people feel at home. She treasured family, laughter around a full table and the small rituals that turned ordinary days into memories.\n\nA teacher for thirty-one years, she knew every child by name and every parent by their worries. Her courage, warmth and steady care remain woven through the lives of those who knew her.',
      familyMessage:
        'Thank you for standing with our family, for every message, prayer and act of kindness. We invite you to remember Naledi with us and to carry forward the love she gave so freely.',
    },
    disposition: { type: 'burial', notes: '' },
    journey: [
      { id: 'd1', type: 'church', title: 'Celebration service', date: today, time: '10:00', departTime: '11:45', address: 'Family church · Main entrance', landmark: 'Main entrance', parking: 'Parking behind the church hall', transport: 'Vehicles follow the hearse to the cemetery.', notes: 'Please arrive 20 minutes before the service.', lat: -25.7479, lng: 28.2293 },
      { id: 'd2', type: 'cemetery', title: 'Burial', date: today, time: '12:30', departTime: '13:30', address: 'Memorial cemetery · East gate', landmark: 'East gate', parking: 'Follow marshals on arrival.', transport: 'The procession continues to the family reception after the burial.', notes: 'Use the pinned entrance rather than the street address.', lat: -25.7324, lng: 28.1967 },
      { id: 'd3', type: 'reception', title: 'Reception', date: today, time: '14:00', departTime: '', address: 'Family reception venue', landmark: '', parking: '', transport: '', notes: 'Refreshments will be served after the burial.', lat: -25.7702, lng: 28.2231 },
    ],
    programme: {
      mode: 'formal',
      items: [
        { id: 'p1', type: 'prayer', time: '10:00', title: 'Opening prayer', presenter: 'Pastor Mokoena', detail: '' },
        { id: 'p2', type: 'scripture', time: '10:10', title: 'Psalm 23', presenter: 'Lerato Mokoena', detail: 'Scripture reading' },
        { id: 'p3', type: 'hymn', time: '10:20', title: 'Amazing Grace', presenter: 'Congregation', detail: '' },
        { id: 'p4', type: 'tribute', time: '10:30', title: 'Family tributes', presenter: 'Family & friends', detail: '' },
        { id: 'p5', type: 'eulogy', time: '11:00', title: 'Eulogy', presenter: 'Thabo Mokoena', detail: '' },
      ],
    },
  };
}
