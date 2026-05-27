// Centralised visual + behavioural knobs. Tweak here instead of hunting
// magic numbers across the codebase.

export const THEME = {
  // Trail
  trailColor: '#ffffff',
  trailWidth: 2.8,
  trailHaloColor: '#ffe4a8',
  trailHaloWidth: 8,
  trailHaloBlur: 6,
  trailHaloOpacity: 0.32,

  // Stop markers
  ringColor: '#ffffff',
  ringWidth: 1.3,
  dotInactiveColor: '#ffffff',
  dotActiveColor: '#ffd089',
  activeGlowColor: '#ffd089',
  activeGlowRadius: 8,
  activeGlowOpacity: 0.22,

  // Map basemap colour grading
  rasterSaturation: -0.15,
  rasterContrast: 0.12,
  rasterBrightnessMin: 0.05,

  // Water mask (overlaid on satellite for consistent oceans)
  waterColor: '#0a1828',
  waterOpacity: 0.92
};

export const MAP_SOURCES = {
  satelliteTiles:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  // Vector tiles for the water mask. OpenFreeMap = free, no signup.
  openFreeMapStyle: 'https://tiles.openfreemap.org/planet'
};

export const RENDER = {
  // Live-preview throttle for trail setData (1% of segment progress)
  trailFracQuantum: 100,
  // OSRM driving routes get downsampled to this many points to keep
  // MapLibre's tessellation fast and avoid runaway vertex counts.
  osrmRouteSamples: 40,
  // Per-leg HTTP timeout for the OSRM route fetch (ms).
  osrmTimeoutMs: 6000,
  // Maximum tile cache MapLibre will keep in memory.
  maxTileCacheSize: 2048
};

export const TRANSPORT = {
  emoji: {
    flight: '✈️', // ✈️
    train:  '🚄', // 🚄
    bus:    '🚌', // 🚌
    car:    '🚗', // 🚗
    ferry:  '🚢', // 🚢
    metro:  '🚊'  // 🚊
  },
  rotates: new Set(['flight']),               // rotates to bearing
  flipsHorizontal: new Set(['train', 'bus', 'car', 'ferry', 'metro'])
};
