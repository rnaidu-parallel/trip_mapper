import * as turf from '@turf/turf';
import { timingFor, cameraFor } from './journey.js';

// Easing
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpLngLat = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// Build a flat timeline of segments. Each segment has start time, duration, kind, and state-builder.
export function buildTimeline(journey) {
  const segments = [];
  let t = 0;
  let cumKm = 0; // running total of great-circle distance after each transit

  for (let i = 0; i < journey.length; i++) {
    const stop = journey[i];
    const prev = i > 0 ? journey[i - 1] : null;
    const isFirst = i === 0;
    const isLast = i === journey.length - 1;
    const timing = timingFor(stop, isFirst, isLast);
    const cam = cameraFor(stop, isFirst, isLast);

    // Trail geometry from prev → current
    let segCoords = null;
    if (prev) {
      if (stop.transport === 'flight') {
        const gc = turf.greatCircle(prev.coords, stop.coords, { npoints: 96 });
        // greatCircle returns MultiLineString when crossing antimeridian; flatten.
        if (gc.geometry.type === 'MultiLineString') {
          segCoords = gc.geometry.coordinates.flat();
        } else {
          segCoords = gc.geometry.coordinates;
        }
        // Guarantee endpoints exactly match stop coords (avoid rounding gaps)
        if (segCoords.length > 0) {
          segCoords[0] = prev.coords;
          segCoords[segCoords.length - 1] = stop.coords;
        }
      } else if (stop.routeCoords && stop.routeCoords.length >= 2) {
        // Pre-fetched real road/rail route (OSRM)
        segCoords = stop.routeCoords;
      } else {
        // fallback: straight line
        segCoords = [prev.coords, stop.coords];
      }
    }

    // Transit segment: trail draws, camera lifts and arcs toward next stop
    if (!isFirst && timing.transit > 0) {
      const prevCam = cameraFor(prev, i - 1 === 0, false);
      // Distance-aware peak zoom: zoom out enough to see both endpoints with margin
      const distKm = turf.distance(prev.coords, stop.coords, { units: 'kilometers' });
      // Scale transit duration by distance — keeps perceived vehicle speed
      // believable. Floor prevents short hops from feeling like teleports.
      // 50km → 0.95×, 200km → 1.05×, 500km → 1.15×, 1500km → 1.4×, 3000km+ → 1.7×.
      let distFactor;
      if (distKm < 100)       distFactor = 0.95;
      else if (distKm < 300)  distFactor = 1.05;
      else if (distKm < 800)  distFactor = 1.15;
      else if (distKm < 2000) distFactor = 1.4;
      else                    distFactor = 1.7;
      timing.transit = Math.round(timing.transit * distFactor);
      // World circumference ~40075km. At zoom z, viewport spans ~40075 / 2^z km.
      // Solve for z such that span >= distKm * 1.8 (safety margin).
      const peakZoomAbsolute = Math.max(2.8, Math.log2(40075 / (distKm * 1.8 + 1)));
      const baseZoomMid = (prevCam.zoom + cam.zoom) / 2;
      // Cap zoom-out so swing isn't too dramatic
      const zoomDelta = Math.max(-5, peakZoomAbsolute - baseZoomMid);
      // Steeper pitch flattening on long hops
      const pitchDelta = distKm > 800 ? -40 : -20;
      segments.push({
        kind: 'transit',
        start: t,
        duration: timing.transit,
        stopIdx: i,
        prev,
        stop,
        segCoords,
        distKm,
        cumKmAtStart: cumKm,
        segKm: distKm,
        from: { center: prev.coords, zoom: prevCam.zoom, pitch: prevCam.pitch, bearing: prevCam.bearing },
        peak: { zoomDelta, pitchDelta },
        to: { center: stop.coords, zoom: cam.zoom + 0.5, pitch: cam.pitch - 5, bearing: cam.bearing }
      });
      cumKm += distKm;
      t += timing.transit;
    }

    // Approach: descend to landing
    segments.push({
      kind: 'approach',
      start: t,
      duration: timing.approach,
      stopIdx: i,
      stop,
      cumKmAtStart: cumKm,
      from: !isFirst
        ? { center: stop.coords, zoom: cam.zoom + 0.5, pitch: cam.pitch - 5, bearing: cam.bearing }
        : { center: stop.coords, zoom: 2, pitch: 20, bearing: 0 },
      to: { center: stop.coords, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing }
    });
    t += timing.approach;

    // Dwell: slow orbit
    segments.push({
      kind: 'dwell',
      start: t,
      duration: timing.dwell,
      stopIdx: i,
      stop,
      cumKmAtStart: cumKm,
      cam
    });
    t += timing.dwell;
  }

  return { segments, duration: t };
}

export function stateAtTime(timeline, time) {
  const { segments, duration } = timeline;
  const t = Math.max(0, Math.min(duration, time));

  // Binary search for active segment
  let lo = 0, hi = segments.length - 1, idx = 0;
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

  // Compute camera state + trail progress + active stop label
  let camera, trailToIdx, trailFrac, activeStop, hudOpacity;

  let transit = null; // { coord, bearing, transport } if in flight
  if (seg.kind === 'approach') {
    const e = easeOutCubic(localT);
    camera = {
      center: lerpLngLat(seg.from.center, seg.to.center, e),
      zoom: lerp(seg.from.zoom, seg.to.zoom, e),
      pitch: lerp(seg.from.pitch, seg.to.pitch, e),
      bearing: lerp(seg.from.bearing, seg.to.bearing, e)
    };
    trailToIdx = seg.stopIdx - 1;
    trailFrac = 1;
    activeStop = seg.stop;
    hudOpacity = easeOutCubic(localT);
  } else if (seg.kind === 'dwell') {
    // slow orbit: bearing drifts
    const e = localT;
    camera = {
      center: seg.stop.coords,
      zoom: seg.cam.zoom + Math.sin(e * Math.PI) * 0.15,
      pitch: seg.cam.pitch,
      bearing: seg.cam.bearing + e * 8
    };
    trailToIdx = seg.stopIdx - 1;
    trailFrac = 1;
    activeStop = seg.stop;
    hudOpacity = 1;
  } else if (seg.kind === 'transit') {
    const e = easeInOutCubic(localT);
    // arc camera: zoom dips down at midpoint (pull back)
    const arc = Math.sin(localT * Math.PI); // 0→1→0
    camera = {
      center: lerpLngLat(seg.from.center, seg.to.center, e),
      zoom: lerp(seg.from.zoom, seg.to.zoom, e) + seg.peak.zoomDelta * arc,
      pitch: lerp(seg.from.pitch, seg.to.pitch, e) + seg.peak.pitchDelta * arc,
      bearing: lerp(seg.from.bearing, seg.to.bearing, e)
    };
    trailToIdx = seg.stopIdx - 1; // previous stop already finished
    trailFrac = e; // draw progressively
    // HUD keeps showing source until camera lands; B's label appears only on approach.
    activeStop = seg.prev;
    hudOpacity = Math.max(0, 1 - localT * 2); // fade out source's label

    // Transport icon: sample current point along segCoords at trailFrac
    if (seg.segCoords && seg.segCoords.length >= 2) {
      const sc = seg.segCoords;
      const fi = e * (sc.length - 1);
      const i0 = Math.floor(fi);
      const i1 = Math.min(sc.length - 1, i0 + 1);
      const lt = fi - i0;
      const coord = lerpLngLat(sc[i0], sc[i1], lt);
      const ahead = sc[Math.min(sc.length - 1, i0 + 1)];
      const behind = sc[Math.max(0, i0)];
      const bearing = turf.bearing(behind, ahead);
      transit = { coord, bearing, transport: seg.stop.transport };
    }
  }

  // Cumulative distance (great-circle)
  let cumKm = seg.cumKmAtStart ?? 0;
  if (seg.kind === 'transit' && seg.segKm) {
    cumKm += easeInOutCubic(localT) * seg.segKm;
  }

  const activeStopIdx = seg.kind === 'transit' ? seg.stopIdx - 1 : seg.stopIdx;
  return { camera, trailToIdx, trailFrac, activeStop, segKind: seg.kind, hudOpacity, time: t, transit, activeStopIdx, transitFrac: seg.kind === 'transit' ? localT : null, cumKm };
}

// Cached trail builder. Keeps the locked-in portion (completed segments) as a
// stable coord array and only mutates the trailing in-progress slice each frame.
export class TrailCache {
  constructor(timeline) {
    this.segMap = new Map();
    for (const s of timeline.segments) {
      if (s.kind === 'transit' && s.segCoords) this.segMap.set(s.stopIdx, s.segCoords);
    }
    this.lockedIdx = -1; // highest fully-locked trailToIdx
    this.lockedCoords = []; // coords for segments [1 .. lockedIdx]
  }

  // Returns a GeoJSON FeatureCollection for the trail at (trailToIdx, trailFrac).
  build(trailToIdx, trailFrac) {
    if (trailToIdx < 0 && !this.segMap.get(0 + 1)) {
      // possibly an in-progress first segment? handled below
    }

    // Extend locked coords if trailToIdx advanced
    while (this.lockedIdx < trailToIdx) {
      const next = this.lockedIdx + 1;
      const seg = this.segMap.get(next);
      if (seg) {
        if (this.lockedCoords.length === 0) this.lockedCoords.push(...seg);
        else this.lockedCoords.push(...seg.slice(1));
      }
      this.lockedIdx = next;
    }
    // Rewind locked coords if going backwards (scrub)
    while (this.lockedIdx > trailToIdx) {
      const cur = this.lockedIdx;
      const seg = this.segMap.get(cur);
      if (seg) {
        const removeCount = this.lockedCoords.length === seg.length ? seg.length : seg.length - 1;
        this.lockedCoords.length = this.lockedCoords.length - removeCount;
      }
      this.lockedIdx = cur - 1;
    }

    // In-progress segment (the one being drawn)
    const inIdx = trailToIdx + 1;
    const inSeg = this.segMap.get(inIdx);
    let coords;
    if (inSeg && trailFrac > 0 && trailFrac < 1) {
      // Interpolate the exact tip position so trail ends precisely where the
      // plane is, not snapped to the previous vertex. Eliminates the trailing
      // "1 segment short" gap as transit nears completion.
      const exactPos = trailFrac * (inSeg.length - 1);
      const i0 = Math.floor(exactPos);
      const lt = exactPos - i0;
      const a = inSeg[i0];
      const b = inSeg[Math.min(inSeg.length - 1, i0 + 1)];
      const tip = [a[0] + (b[0] - a[0]) * lt, a[1] + (b[1] - a[1]) * lt];
      const head = inSeg.slice(0, i0 + 1);
      coords = this.lockedCoords.length === 0
        ? head.concat([tip])
        : this.lockedCoords.concat(head.slice(1)).concat([tip]);
    } else if (inSeg && trailFrac >= 1) {
      coords = this.lockedCoords.concat(this.lockedCoords.length === 0 ? inSeg : inSeg.slice(1));
    } else {
      coords = this.lockedCoords;
    }

    if (coords.length < 2) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
    };
  }
}

// Active markers: rebuilt once at init. Active state is mutated via feature-state.
export function buildStopsGeoJSON(journey) {
  const features = journey.map((s, idx) => ({
    type: 'Feature',
    id: idx, // required for feature-state
    properties: { stopId: s.id, name: s.name, idx },
    geometry: { type: 'Point', coordinates: s.coords }
  }));
  return { type: 'FeatureCollection', features };
}
