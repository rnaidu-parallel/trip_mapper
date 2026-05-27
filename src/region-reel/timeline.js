// Region-reel timeline builder + state-at-time calculator.
// Each stop expands into a fixed scene sequence: pan → land → transition-in
// → photo-hold → transition-out. Bookended with intro (earth → region) and
// outro (region overview → stats card).

import { region, stops, timing } from '../../journeys/regions/hokkaido.js';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpLngLat = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// Globe-view starting camera (rotates slowly above the region)
const earthCam = { center: [0, 20], zoom: 1.4, pitch: 0, bearing: 0 };
// Per-stop landing camera
const stopCam = (stop) => ({ center: stop.coords, zoom: 10.5, pitch: 55, bearing: 0 });

export function buildTimeline() {
  const segments = [];
  let t = 0;

  // --- Intro: globe hold → zoom to region ---
  segments.push({
    kind: 'intro_hold',
    start: t,
    duration: timing.intro.earthHold,
    from: earthCam,
    to: earthCam
  });
  t += timing.intro.earthHold;

  segments.push({
    kind: 'intro_zoom',
    start: t,
    duration: timing.intro.earthToRegion,
    from: earthCam,
    to: region.overview
  });
  t += timing.intro.earthToRegion;

  // --- Per-stop sequence ---
  let prevCam = region.overview;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const targetCam = stopCam(stop);

    // Pan from prev camera to stop
    segments.push({
      kind: 'pan',
      start: t,
      duration: timing.perStop.pan,
      stopIdx: i,
      stop,
      from: prevCam,
      to: targetCam
    });
    t += timing.perStop.pan;

    // Land — hold at stop
    segments.push({
      kind: 'land',
      start: t,
      duration: timing.perStop.land,
      stopIdx: i,
      stop,
      cam: targetCam
    });
    t += timing.perStop.land;

    // Punch-zoom into photo
    segments.push({
      kind: 'transition_in',
      start: t,
      duration: timing.perStop.transitionIn,
      stopIdx: i,
      stop,
      cam: targetCam
    });
    t += timing.perStop.transitionIn;

    // Photo hold (with Ken Burns)
    segments.push({
      kind: 'photo_hold',
      start: t,
      duration: timing.perStop.photoHold,
      stopIdx: i,
      stop
    });
    t += timing.perStop.photoHold;

    // Reverse punch-zoom back to map
    segments.push({
      kind: 'transition_out',
      start: t,
      duration: timing.perStop.transitionOut,
      stopIdx: i,
      stop,
      cam: targetCam
    });
    t += timing.perStop.transitionOut;

    prevCam = targetCam;
  }

  // --- Outro ---
  segments.push({
    kind: 'outro_pullback',
    start: t,
    duration: timing.outro.pullBack,
    from: prevCam,
    to: region.overview
  });
  t += timing.outro.pullBack;

  segments.push({
    kind: 'outro_hold',
    start: t,
    duration: timing.outro.statsHold,
    cam: region.overview
  });
  t += timing.outro.statsHold;

  return { segments, duration: t };
}

// Locate the active segment at time t and produce all state needed to render
// a single frame.
export function stateAtTime(timeline, time) {
  const { segments, duration } = timeline;
  const t = Math.max(0, Math.min(duration, time));

  let lo = 0,
    hi = segments.length - 1,
    idx = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid];
    if (t < s.start) hi = mid - 1;
    else if (t >= s.start + s.duration) lo = mid + 1;
    else { idx = mid; break; }
    idx = mid;
  }
  const seg = segments[idx];
  const localT = Math.max(0, Math.min(1, (t - seg.start) / seg.duration));

  // Per-scene state
  let camera = null;
  let photoOpacity = 0;    // 0..1
  let photoScale = 1;      // for transitions + Ken Burns
  let mapScale = 1;        // for punch-zoom inward push on map
  let flashOpacity = 0;    // 0..1
  let activeStopIdx = seg.stopIdx ?? null;
  let activeStop = seg.stop ?? null;
  let hudOpacity = 0;

  if (seg.kind === 'intro_hold') {
    camera = { ...seg.to, bearing: seg.to.bearing + localT * 6 };
  } else if (seg.kind === 'intro_zoom') {
    const e = easeInOutCubic(localT);
    camera = {
      center: lerpLngLat(seg.from.center, seg.to.center, e),
      zoom: lerp(seg.from.zoom, seg.to.zoom, e),
      pitch: lerp(seg.from.pitch, seg.to.pitch, e),
      bearing: lerp(seg.from.bearing, seg.to.bearing, e)
    };
  } else if (seg.kind === 'pan') {
    const e = easeInOutCubic(localT);
    // gentle altitude lift mid-pan so it feels like a flight
    const arc = Math.sin(localT * Math.PI);
    camera = {
      center: lerpLngLat(seg.from.center, seg.to.center, e),
      zoom: lerp(seg.from.zoom, seg.to.zoom, e) - arc * 1.2,
      pitch: lerp(seg.from.pitch, seg.to.pitch, e) - arc * 6,
      bearing: lerp(seg.from.bearing, seg.to.bearing, e)
    };
    hudOpacity = 0;
  } else if (seg.kind === 'land') {
    camera = seg.cam;
    hudOpacity = easeOutCubic(localT);
  } else if (seg.kind === 'transition_in') {
    // Map continues to dive in (zoom up); photo scales from 1.6 → 1.0 with rising opacity.
    // White flash crests at localT = 0.6.
    const e = easeInCubic(localT);
    camera = { ...seg.cam, zoom: seg.cam.zoom + e * 1.3 };
    mapScale = 1 + e * 0.15; // CSS scale on map container for extra dive feel
    photoOpacity = Math.min(1, localT * 2); // ramps in over first half
    photoScale = lerp(1.6, 1.0, easeOutCubic(localT));
    // Flash: triangle wave peaking at 0.6 with quick fall-off
    const flashPeak = 0.6;
    flashOpacity = localT < flashPeak
      ? (localT / flashPeak) * 0.9
      : Math.max(0, 1 - (localT - flashPeak) / (1 - flashPeak)) * 0.9;
    hudOpacity = 1 - localT; // fade map HUD as we leave map
  } else if (seg.kind === 'photo_hold') {
    photoOpacity = 1;
    // Ken Burns: subtle scale + drift
    photoScale = lerp(1.0, 1.08, easeInOutCubic(localT));
    camera = seg.cam || null; // keep map underneath so transition_out has consistent state
  } else if (seg.kind === 'transition_out') {
    const e = easeOutCubic(localT);
    camera = { ...seg.cam, zoom: seg.cam.zoom + 1.3 * (1 - e) };
    mapScale = 1 + 0.15 * (1 - e);
    photoOpacity = Math.max(0, 1 - localT * 2);
    photoScale = lerp(1.08, 1.3, easeInCubic(localT)); // scale up as it fades (echoes the dive)
    hudOpacity = Math.max(0, localT - 0.5) * 2; // map HUD fades back in
  } else if (seg.kind === 'outro_pullback') {
    const e = easeInOutCubic(localT);
    camera = {
      center: lerpLngLat(seg.from.center, seg.to.center, e),
      zoom: lerp(seg.from.zoom, seg.to.zoom, e),
      pitch: lerp(seg.from.pitch, seg.to.pitch, e),
      bearing: lerp(seg.from.bearing, seg.to.bearing, e)
    };
  } else if (seg.kind === 'outro_hold') {
    camera = { ...seg.cam, bearing: seg.cam.bearing + localT * 8 };
  }

  return {
    time: t,
    seg,
    camera,
    photoOpacity,
    photoScale,
    mapScale,
    flashOpacity,
    activeStopIdx,
    activeStop,
    hudOpacity,
    segKind: seg.kind
  };
}
