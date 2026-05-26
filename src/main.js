import maplibregl from 'maplibre-gl';
import { journey } from './journey.js';
import { buildTimeline, stateAtTime, TrailCache, buildStopsGeoJSON } from './animation.js';

const SAT_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const style = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    // Low-zoom global base — always visible, fills gaps during fast pans
    satelliteBase: {
      type: 'raster',
      tiles: [SAT_TILES],
      tileSize: 256,
      maxzoom: 5,
      attribution: 'Imagery © Esri'
    },
    satellite: {
      type: 'raster',
      tiles: [SAT_TILES],
      tileSize: 256,
      maxzoom: 17,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
    },
    // OpenFreeMap vector tiles — used here only for a uniform water mask
    ofm: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet'
    }
  },
  layers: [
    {
      id: 'satellite-base',
      type: 'raster',
      source: 'satelliteBase',
      paint: {
        'raster-saturation': -0.15,
        'raster-contrast': 0.12,
        'raster-brightness-min': 0.05,
        'raster-fade-duration': 0
      }
    },
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      paint: {
        'raster-saturation': -0.15,
        'raster-contrast': 0.12,
        'raster-brightness-min': 0.05,
        'raster-fade-duration': 0
      }
    },
    // Uniform dark ocean — eliminates per-zoom satellite-blue shifts
    {
      id: 'water-mask',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'water',
      paint: {
        'fill-color': '#0a1828',
        'fill-opacity': 0.92,
        'fill-antialias': true
      }
    }
  ],
  sky: {
    'sky-color': '#0b1d3a',
    'sky-horizon-blend': 0.6,
    'horizon-color': '#9bb4d6',
    'horizon-fog-blend': 0.6,
    'fog-color': '#0b1d3a',
    'fog-ground-blend': 0.1
  }
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: journey[0].coords,
  zoom: 3,
  pitch: 0,
  bearing: 0,
  antialias: true,
  attributionControl: false,
  maxTileCacheSize: 2048,
  fadeDuration: 0,
  refreshExpiredTiles: false
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
window.__map = map;

// Evenly-spaced subsample of a coord list. Keeps first + last, reduces vertex
// count for fast MapLibre tessellation. OSRM returns thousands of points; we
// only need ~40 to render a smooth-looking road curve at our zoom levels.
function subsampleCoords(coords, target = 40) {
  if (coords.length <= target) return coords;
  const out = [];
  const step = (coords.length - 1) / (target - 1);
  for (let i = 0; i < target; i++) {
    out.push(coords[Math.round(i * step)]);
  }
  // ensure exact last
  out[out.length - 1] = coords[coords.length - 1];
  return out;
}

// Fetch realistic road routes from OSRM for non-flight segments. Runs in
// parallel; falls back to straight line on failure. We block timeline build
// until done so the cache hits the right geometry from frame 0.
async function fetchGroundRoutes(journey) {
  const profileFor = (t) => (t === 'ferry' ? null : 'driving'); // OSRM has no maritime profile
  const tasks = [];
  for (let i = 1; i < journey.length; i++) {
    const stop = journey[i];
    const prev = journey[i - 1];
    if (!stop.transport || stop.transport === 'flight') continue;
    const profile = profileFor(stop.transport);
    if (!profile) continue;
    const url = `https://router.project-osrm.org/route/v1/${profile}/${prev.coords.join(',')};${stop.coords.join(',')}?overview=full&geometries=geojson`;
    tasks.push(
      Promise.race([
        fetch(url).then((r) => r.json()),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
      ])
        .then((json) => {
          const coords = json?.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const sampled = subsampleCoords(coords, 40);
            sampled[0] = prev.coords;
            sampled[sampled.length - 1] = stop.coords;
            stop.routeCoords = sampled;
          }
        })
        .catch((e) => {
          console.warn(`OSRM route ${prev.name}→${stop.name} failed:`, e.message);
        })
    );
  }
  await Promise.all(tasks);
}

// Fetch routes + build timeline in parallel with map load.
const routesPromise = fetchGroundRoutes(journey);
const mapLoadPromise = new Promise((resolve) => {
  if (map.loaded()) resolve();
  else map.once('load', resolve);
});

await routesPromise;
const timeline = buildTimeline(journey);
const trailCache = new TrailCache(timeline);
window.__timeline = timeline;
console.log('Timeline duration (s):', (timeline.duration / 1000).toFixed(1));

await mapLoadPromise;

function setupMap() {
  // Sources
  map.addSource('trail', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  map.addSource('stops', { type: 'geojson', data: buildStopsGeoJSON(journey) });

  // Layer order: glow (bottom) → trail → ring/dot/label (top).
  // This keeps the active dot's amber glow from covering the trail's last
  // ~30px near the destination; ring and dot sit on top of trail end.

  // Soft amber glow on active stop only — drawn UNDER the trail
  map.addLayer({
    id: 'stops-active-glow',
    type: 'circle',
    source: 'stops',
    paint: {
      'circle-radius': ['case', ['boolean', ['feature-state', 'active'], false], 16, 0],
      'circle-color': '#ffd089',
      'circle-opacity': 0.35,
      'circle-blur': 0.6
    }
  });

  // Trail: warm halo + crisp white core
  map.addLayer({
    id: 'trail-halo',
    type: 'line',
    source: 'trail',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffe4a8',
      'line-width': 8,
      'line-blur': 6,
      'line-opacity': 0.32
    }
  });
  map.addLayer({
    id: 'trail',
    type: 'line',
    source: 'trail',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffffff',
      'line-width': 2.2,
      'line-opacity': 0.95
    }
  });

  // Outer ring (visited stops only) — drawn ON TOP of trail
  map.addLayer({
    id: 'stops-ring',
    type: 'circle',
    source: 'stops',
    filter: ['<=', ['get', 'idx'], -1],
    paint: {
      'circle-radius': ['case', ['boolean', ['feature-state', 'active'], false], 7, 4.5],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.3,
      'circle-stroke-opacity': 0.95
    }
  });
  // Inner dot (visited stops only)
  map.addLayer({
    id: 'stops-dot',
    type: 'circle',
    source: 'stops',
    filter: ['<=', ['get', 'idx'], -1],
    paint: {
      'circle-radius': ['case', ['boolean', ['feature-state', 'active'], false], 3.2, 1.8],
      'circle-color': ['case',
        ['boolean', ['feature-state', 'active'], false], '#ffd089',
        '#ffffff'
      ]
    }
  });

  // Persistent labels for visited stops — refined typography
  map.addLayer({
    id: 'stops-label',
    type: 'symbol',
    source: 'stops',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Semibold'],
      'text-size': 12,
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-letter-spacing': 0.08,
      'text-transform': 'uppercase'
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.6)',
      'text-halo-width': 1.1,
      'text-halo-blur': 0.4
    },
    // Will be overwritten each frame with current activeStopIdx
    filter: ['<=', ['get', 'idx'], -1]
  });

  startUI();
}

// --- UI / playback ---
const playBtn = document.getElementById('play');
const preloadBtn = document.getElementById('preload');
const restartBtn = document.getElementById('restart');
const preloadOverlay = document.getElementById('preload-overlay');
const preloadFill = document.getElementById('preload-fill');
const preloadText = document.getElementById('preload-text');
const scrub = document.getElementById('scrub');
const timeEl = document.getElementById('time');
const regionEl = document.getElementById('region-label');
const stopEl = document.getElementById('stop-label');
const counterEl = document.getElementById('counter');
const distanceEl = document.getElementById('distance');
const hudEl = document.getElementById('hud');
const iconEl = document.getElementById('transport-icon');

// Side-view emojis where possible. All face right (east) by default; we flip
// horizontally when the vehicle is heading west.
const TRANSPORT_EMOJI = {
  flight: '✈️',
  train: '🚄',
  bus: '🚌',
  car: '🚗',
  ferry: '🚢',
  metro: '🚊'
};
// Plane rotates to heading. Ground vehicles only flip on east/west.
const ROTATES = new Set(['flight']);
const FLIPS_HORIZONTAL = new Set(['train', 'bus', 'car', 'ferry', 'metro']);

let playing = false;
let startedAt = 0;
let pausedAt = 0;
let lastT = -1;
let lastActiveIdx = -1;
let lastLabelUpTo = -2;
let lastVisibleUpTo = -2;
let lastTrailKey = '';

function setTime(t) {
  const state = stateAtTime(timeline, t);
  map.jumpTo({
    center: state.camera.center,
    zoom: state.camera.zoom,
    pitch: state.camera.pitch,
    bearing: state.camera.bearing
  });
  // Throttle trail updates — quantize trailFrac to 1% so we don't push setData every frame.
  const quantFrac = Math.round(state.trailFrac * 100) / 100;
  const trailKey = `${state.trailToIdx}:${quantFrac}`;
  if (trailKey !== lastTrailKey) {
    const trail = trailCache.build(state.trailToIdx, state.trailFrac);
    const trailSrc = map.getSource('trail');
    if (trailSrc) trailSrc.setData(trail);
    lastTrailKey = trailKey;
  }

  regionEl.textContent = state.activeStop.region;
  stopEl.textContent = state.activeStop.name;
  hudEl.style.opacity = state.hudOpacity;
  const idx = state.activeStopIdx ?? journey.findIndex((s) => s.id === state.activeStop.id);
  counterEl.textContent = `${String(idx + 1).padStart(2, '0')} — ${String(journey.length).padStart(2, '0')}`;
  const km = Math.round(state.cumKm || 0);
  distanceEl.textContent = `${km.toLocaleString('en-US')} KM`;

  // Active dot via feature-state — no setData
  if (idx !== lastActiveIdx) {
    if (lastActiveIdx >= 0) map.setFeatureState({ source: 'stops', id: lastActiveIdx }, { active: false });
    map.setFeatureState({ source: 'stops', id: idx }, { active: true });
    lastActiveIdx = idx;
  }

  // Label + visible-stop visibility: show for stops at or before the active one.
  // During transit, only show up to previous stop until we land.
  const visibleUpTo = state.segKind === 'transit' ? idx - 1 : idx;
  if (visibleUpTo !== lastVisibleUpTo) {
    const filt = ['<=', ['get', 'idx'], visibleUpTo];
    if (map.getLayer('stops-label')) map.setFilter('stops-label', filt);
    if (map.getLayer('stops-ring')) map.setFilter('stops-ring', filt);
    if (map.getLayer('stops-dot')) map.setFilter('stops-dot', filt);
    lastVisibleUpTo = visibleUpTo;
    lastLabelUpTo = visibleUpTo;
  }

  // Transport icon overlay — scale by zoom, fade in/out at segment ends
  if (state.transit && state.transit.transport) {
    const tr = state.transit;
    const emoji = TRANSPORT_EMOJI[tr.transport] || '•';
    const pt = map.project(tr.coord);
    // Fade in/out: full opacity 0.1-0.85 of segment, ramps at edges
    const f = state.transitFrac ?? 0.5;
    let opacity = 1;
    if (f < 0.08) opacity = f / 0.08;
    else if (f > 0.92) opacity = Math.max(0, (1 - f) / 0.08);
    // Scale down at high zoom so icon doesn't dominate city closeups
    const z = state.camera.zoom;
    const scale = z >= 9 ? Math.max(0.55, 1 - (z - 9) * 0.12) : 1;
    iconEl.hidden = false;
    iconEl.textContent = emoji;
    iconEl.style.left = `${pt.x}px`;
    iconEl.style.top = `${pt.y}px`;
    iconEl.style.opacity = String(opacity);
    let transform = '';
    if (ROTATES.has(tr.transport)) {
      transform = `rotate(${tr.bearing - 45}deg) scale(${scale})`;
    } else if (FLIPS_HORIZONTAL.has(tr.transport)) {
      // Emoji face right; flip when heading west (bearing 90..180 or -180..-90)
      const goingWest = Math.abs(tr.bearing) > 90;
      transform = `scale(${(goingWest ? -1 : 1) * scale}, ${scale})`;
    } else {
      transform = `scale(${scale})`;
    }
    iconEl.style.transform = transform;
  } else {
    iconEl.hidden = true;
  }

  scrub.value = Math.round((t / timeline.duration) * 1000);
  timeEl.textContent = `${(t / 1000).toFixed(1)}s / ${(timeline.duration / 1000).toFixed(1)}s`;
  lastT = t;
}

function tick(now) {
  if (!playing) return;
  const t = now - startedAt;
  if (t >= timeline.duration) {
    setTime(timeline.duration);
    playing = false;
    playBtn.textContent = '▶ Play';
    return;
  }
  setTime(t);
  requestAnimationFrame(tick);
}

async function waitIdle(timeoutMs = 2500) {
  // Fast-bail if everything's already loaded.
  if (map.areTilesLoaded() && !map.isMoving() && !map.isZooming() && !map.isRotating()) {
    return;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const done = () => { clearTimeout(timer); resolve(); };
    map.once('idle', done);
  });
}

async function preload({ stepMs = 700 } = {}) {
  preloadOverlay.hidden = false;
  const total = timeline.duration;
  const steps = Math.max(1, Math.ceil(total / stepMs));
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(total, i * stepMs);
    setTime(t);
    await waitIdle();
    const pct = (i / steps) * 100;
    preloadFill.style.width = `${pct}%`;
    preloadText.textContent = `Preloading tiles… ${Math.round(pct)}%`;
  }
  setTime(0);
  // Brief pause then hide
  await new Promise((r) => setTimeout(r, 200));
  preloadOverlay.hidden = true;
}

function startUI() {
  setTime(0);
  preloadBtn.addEventListener('click', () => {
    preloadBtn.disabled = true;
    preload().finally(() => { preloadBtn.disabled = false; });
  });
  playBtn.addEventListener('click', () => {
    if (playing) {
      playing = false;
      pausedAt = lastT;
      playBtn.textContent = '▶ Play';
    } else {
      playing = true;
      startedAt = performance.now() - pausedAt;
      playBtn.textContent = '⏸ Pause';
      requestAnimationFrame(tick);
    }
  });
  restartBtn.addEventListener('click', () => {
    playing = false;
    pausedAt = 0;
    playBtn.textContent = '▶ Play';
    setTime(0);
  });
  scrub.addEventListener('input', () => {
    playing = false;
    playBtn.textContent = '▶ Play';
    const t = (Number(scrub.value) / 1000) * timeline.duration;
    pausedAt = t;
    setTime(t);
  });
}

// Hook for Puppeteer frame-by-frame rendering.
// Sets the timeline to time `t_ms`, waits for tiles, resolves.
window.__renderFrame = async function (t_ms) {
  setTime(t_ms);
  // Wait for map to finish loading tiles for new position
  await new Promise((resolve) => {
    if (map.loaded() && !map.isMoving() && !map.isZooming() && !map.isRotating()) {
      // still wait one tick to ensure paint
      requestAnimationFrame(() => requestAnimationFrame(resolve));
      return;
    }
    map.once('idle', () => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
};

window.__totalDuration = () => timeline.duration;

// All state declarations are now in scope — run map setup.
setupMap();
