// Hokkaido region template. Edit the stops, photo paths, and timing knobs
// to retarget this template to any region.
//
// Photos go in `photos/hokkaido/`. Filenames are referenced below. If a
// photo file is missing, the renderer falls back to a generated card with
// the city name — so the workflow runs end-to-end before you have real
// images.

export const region = {
  id: 'hokkaido',
  name: 'Hokkaido',
  country: 'Japan',
  // Wide-view camera framing for the region overview at intro/outro.
  // Choose center + zoom so the whole route fits comfortably.
  overview: {
    center: [142.4, 43.5],
    zoom: 6.4,
    pitch: 30,
    bearing: 0
  }
};

export const stops = [
  {
    id: 'sapporo',
    name: 'Sapporo',
    coords: [141.3545, 43.0618],
    photos: ['photos/hokkaido/01-sapporo.jpg']
  },
  {
    id: 'otaru',
    name: 'Otaru',
    coords: [141.0021, 43.1907],
    photos: ['photos/hokkaido/02-otaru.jpg']
  },
  {
    id: 'asahikawa',
    name: 'Asahikawa',
    coords: [142.3649, 43.7708],
    photos: ['photos/hokkaido/03-asahikawa.jpg']
  },
  {
    id: 'biei',
    name: 'Biei',
    coords: [142.4691, 43.5882],
    photos: ['photos/hokkaido/04-biei.jpg']
  },
  {
    id: 'wakkanai',
    name: 'Wakkanai',
    coords: [141.6730, 45.4116],
    photos: ['photos/hokkaido/05-wakkanai.jpg']
  }
];

// Per-scene timing in milliseconds.
export const timing = {
  intro: {
    earthHold: 800,     // tight shot of the globe before zoom
    earthToRegion: 2200 // zoom-in from globe → region wide view
  },
  perStop: {
    pan: 1500,          // camera flies to the stop
    land: 500,          // hold at stop, label fades in, dot pulses
    transitionIn: 400,  // punch-zoom into photo (with flash mid-way)
    photoHold: 2400,    // photo onscreen with subtle Ken Burns
    transitionOut: 400  // reverse punch-zoom back to map
  },
  outro: {
    pullBack: 1800,     // camera pulls back to region overview
    statsHold: 2400     // final stats card
  }
};

// Photo treatment during the hold.
export const photoStyle = {
  kenBurnsZoom: 1.08,   // scale factor at end of hold
  fit: 'cover'          // 'cover' (crop) | 'contain' (letterbox)
};
