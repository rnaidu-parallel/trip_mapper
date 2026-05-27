import maplibregl from 'maplibre-gl';
import { THEME, MAP_SOURCES, RENDER } from '../config.js';
import { resolvePreset, DEFAULT_PRESET } from '../presets.js';
import { region, stops, photoStyle } from '../../journeys/regions/hokkaido.js';
import { buildTimeline, stateAtTime } from './timeline.js';

// --- Preset → CSS variables ---
const presetName = new URLSearchParams(location.search).get('preset') || DEFAULT_PRESET;
const preset = resolvePreset(presetName);
const root = document.documentElement;
root.style.setProperty('--safe-top', `${preset.safeTop}px`);
root.style.setProperty('--safe-bottom', `${preset.safeBottom}px`);
root.style.setProperty('--safe-left', `${preset.safeLeft}px`);
root.style.setProperty('--safe-right', `${preset.safeRight}px`);
document.body.dataset.preset = presetName;

// --- Map style: identical to v1 except no trail/stops layers needed ---
const rasterGrading = {
  'raster-saturation': THEME.rasterSaturation,
  'raster-contrast': THEME.rasterContrast,
  'raster-brightness-min': THEME.rasterBrightnessMin,
  'raster-fade-duration': 0
};

const style = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    satelliteBase: {
      type: 'raster',
      tiles: [MAP_SOURCES.satelliteTiles],
      tileSize: 256,
      maxzoom: 5,
      attribution: 'Imagery © Esri'
    },
    satellite: {
      type: 'raster',
      tiles: [MAP_SOURCES.satelliteTiles],
      tileSize: 256,
      maxzoom: 17,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
    },
    ofm: { type: 'vector', url: MAP_SOURCES.openFreeMapStyle }
  },
  layers: [
    { id: 'satellite-base', type: 'raster', source: 'satelliteBase', paint: rasterGrading },
    { id: 'satellite',      type: 'raster', source: 'satellite',     paint: rasterGrading },
    {
      id: 'water-mask',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'water',
      paint: {
        'fill-color': THEME.waterColor,
        'fill-opacity': THEME.waterOpacity,
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
  center: [0, 20],
  zoom: 1.4,
  pitch: 0,
  bearing: 0,
  antialias: true,
  attributionControl: false,
  maxTileCacheSize: RENDER.maxTileCacheSize,
  fadeDuration: 0,
  refreshExpiredTiles: false
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
window.__map = map;

const timeline = buildTimeline();
window.__timeline = timeline;
console.log('Region reel duration (s):', (timeline.duration / 1000).toFixed(1));

await new Promise((resolve) => (map.loaded() ? resolve() : map.once('load', resolve)));

// --- Photo preloading + missing-file fallback ---
// Each stop's photo: try to load. If it fails (404, decode error, etc),
// remember the fallback so the renderer paints a generated card instead.
const photoStatus = new Map(); // stopId -> { url, loaded: boolean }

await Promise.all(
  stops.map(async (stop) => {
    const url = stop.photos?.[0];
    if (!url) {
      photoStatus.set(stop.id, { url: null, loaded: false });
      return;
    }
    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('load failed'));
        img.src = url;
      });
      photoStatus.set(stop.id, { url, loaded: true });
    } catch {
      photoStatus.set(stop.id, { url, loaded: false });
    }
  })
);

console.log(
  'Photos loaded:',
  [...photoStatus.values()].filter((s) => s.loaded).length,
  '/',
  stops.length,
  '— missing photos render as a generated city-name card'
);

// --- DOM refs ---
const photoLayer = document.getElementById('photo-layer');
const photoCurrent = document.getElementById('photo-current');
const photoFallback = document.getElementById('photo-fallback');
const flashEl = document.getElementById('flash');
const hudEl = document.getElementById('hud');
const hudRegion = document.getElementById('hud-region');
const hudStop = document.getElementById('hud-stop');
const mapEl = document.getElementById('map');
const playBtn = document.getElementById('play');
const restartBtn = document.getElementById('restart');
const scrub = document.getElementById('scrub');
const timeEl = document.getElementById('time');

// Track what photo is currently mounted so we don't reset background-image
// on every frame (which would flicker).
let mountedStopIdx = -1;

function mountPhotoFor(stopIdx) {
  if (stopIdx === mountedStopIdx) return;
  const stop = stops[stopIdx];
  const status = photoStatus.get(stop.id);
  if (status?.loaded) {
    photoCurrent.style.backgroundImage = `url("${status.url}")`;
    photoCurrent.style.display = 'block';
    photoFallback.style.display = 'none';
    photoFallback.textContent = '';
  } else {
    photoCurrent.style.backgroundImage = 'none';
    photoCurrent.style.display = 'none';
    photoFallback.style.display = 'flex';
    photoFallback.textContent = stop.name;
  }
  mountedStopIdx = stopIdx;
}

// --- Per-frame render ---
function setTime(t) {
  const state = stateAtTime(timeline, t);

  // Map camera
  if (state.camera) {
    map.jumpTo({
      center: state.camera.center,
      zoom: state.camera.zoom,
      pitch: state.camera.pitch,
      bearing: state.camera.bearing
    });
  }
  // Slight CSS scale on the map element during punch transitions for the
  // "dive into the dot" feel (MapLibre's zoom alone isn't quite snappy enough).
  mapEl.style.transformOrigin = 'center';
  mapEl.style.transform = `scale(${state.mapScale.toFixed(4)})`;

  // Photo
  if (state.activeStopIdx != null && state.photoOpacity > 0) {
    mountPhotoFor(state.activeStopIdx);
  }
  photoLayer.style.opacity = state.photoOpacity.toFixed(3);
  const sc = state.photoScale.toFixed(4);
  photoCurrent.style.transform = `scale(${sc})`;
  photoFallback.style.transform = `scale(${sc})`;

  // Flash
  flashEl.style.opacity = state.flashOpacity.toFixed(3);

  // HUD
  hudRegion.textContent = region.country.toUpperCase();
  hudStop.textContent = state.activeStop?.name || region.name;
  hudEl.style.opacity = state.hudOpacity.toFixed(3);

  // Scrub
  scrub.value = Math.round((t / timeline.duration) * 1000);
  timeEl.textContent = `${(t / 1000).toFixed(1)}s / ${(timeline.duration / 1000).toFixed(1)}s`;
}

// --- Playback controls ---
let playing = false;
let startedAt = 0;
let pausedAt = 0;

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

setTime(0);
playBtn.addEventListener('click', () => {
  if (playing) {
    playing = false;
    pausedAt = (performance.now() - startedAt);
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

// --- Recording hook (same contract as v1) ---
window.__renderFrame = async function (t_ms) {
  setTime(t_ms);
  // Wait for map to settle (raster tile loads) before screenshot
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    const done = () => { clearTimeout(timeout); requestAnimationFrame(() => requestAnimationFrame(resolve)); };
    if (map.areTilesLoaded() && !map.isMoving() && !map.isZooming() && !map.isRotating()) done();
    else map.once('idle', done);
  });
};
window.__totalDuration = () => timeline.duration;
