# trip_mapper

Turn a list of places into a cinematic 9:16 map video — animated camera
flyovers, great-circle flights, real road routes, persistent labels, and a
running odometer. Output is an MP4 sized for Instagram Reels (or TikTok /
YouTube Shorts / Feed posts via the preset switch).

Built on MapLibre GL JS + ESRI World Imagery + OSRM. No accounts, no API
keys, no credit card.

## Quick start

```bash
git clone https://github.com/<you>/trip_mapper.git
cd trip_mapper
npm install
npm run dev          # http://127.0.0.1:5173/
```

Out of the box you'll see the bundled Mediterranean example (Athens →
Istanbul → Sofia → Belgrade → Vienna → Munich → Rome → Athens) using all
six transport modes.

## Make it your trip

1. Open `journeys/your-trip.js`.
2. Replace its export with your own `journey`, `timingFor`, and
   `cameraFor` — or copy `journeys/example-mediterranean.js` into
   `your-trip.js` and edit it directly.
3. Save. The dev server hot-reloads.

Schema and tips: [`journeys/README.md`](journeys/README.md).

A minimal stop looks like this:

```js
{
  id: 'tyo-1',
  name: 'Tokyo',
  region: 'Japan',
  coords: [139.6917, 35.6895],   // [longitude, latitude]
  transport: 'flight'            // or train / bus / car / ferry / metro / null
}
```

## Record an MP4

In a second terminal, with the dev server still running:

```bash
npm run record
```

The renderer drives the page frame-by-frame with headless Chromium,
saves each frame as PNG, and assembles them with ffmpeg. Output lands at
`out/journey-<timestamp>.mp4`.

Requires `ffmpeg` on your PATH:

```bash
brew install ffmpeg          # macOS
sudo apt install ffmpeg      # Debian/Ubuntu
```

### Recording options

| Variable | Default | What it does |
|---|---|---|
| `FPS` | `30` | 30 is Instagram-recommended; 60 doubles file size with minimal visible gain after IG re-encodes |
| `PRESET` | `ig-reel` | `ig-reel` / `ig-feed` / `tiktok` / `yt-shorts` — sets resolution + HUD safe zones |
| `URL` | `http://127.0.0.1:5173/` | Where the dev server is running |

Examples:

```bash
PRESET=tiktok npm run record
FPS=60 PRESET=ig-reel npm run record
```

## Customise visuals

| What | Where |
|---|---|
| Colours, trail width, dot/glow sizes, map grading | `src/config.js` (`THEME`) |
| Transport icons and which ones rotate / flip | `src/config.js` (`TRANSPORT`) |
| Map tile sources | `src/config.js` (`MAP_SOURCES`) |
| Per-platform safe zones + resolution | `src/presets.js` |
| Camera pitch/zoom per stop type | `cameraFor()` in your journey file |
| Pacing (transit/approach/dwell durations) | `timingFor()` in your journey file |

The dev server hot-reloads on every edit.

## How it works

```
journey.js  →  buildTimeline  →  per-frame stateAtTime  →  MapLibre setData/jumpTo
                                          ↑                        ↓
                                          ├── trail cache          ├── trail (GeoJSON)
                                          ├── camera interp        ├── stops (GeoJSON)
                                          └── HUD opacity          └── transport icon (DOM)
```

- **Timeline** is a flat list of `transit` / `approach` / `dwell`
  segments with absolute start times. `stateAtTime(t)` linearly searches
  the active segment and produces the camera pose, trail geometry, and
  HUD state for that frame.
- **Trail** is a single GeoJSON LineString. Completed legs are cached;
  the in-progress leg is rebuilt each frame with the tip interpolated to
  the icon's exact position. Throttled to ~100 updates per leg.
- **Ground routes** come from [OSRM's public demo
  server](https://project-osrm.org) — fetched once at startup, then
  downsampled to ~40 points to keep MapLibre's tessellation fast.
- **Flights** use [Turf's great-circle](https://turfjs.org/docs/api/greatCircle).
- **Ocean colour** stays uniform across zoom levels by overlaying
  OpenFreeMap's water polygons on top of the satellite raster.
- **Recording** uses Puppeteer + `window.__renderFrame(t_ms)`, which
  awaits MapLibre's `sourcedata` + `idle` events before screenshotting
  to avoid the partial-trail flash that async tessellation causes.

## Project layout

```
trip_mapper/
├── index.html
├── journeys/
│   ├── README.md                     ← schema docs
│   ├── example-mediterranean.js      ← reference example
│   └── your-trip.js                  ← what you edit
├── src/
│   ├── main.js                       ← app entry, sources & layers, playback
│   ├── animation.js                  ← timeline, stateAtTime, trail cache
│   ├── journey.js                    ← re-export shim → journeys/your-trip.js
│   ├── config.js                     ← theme + tunable constants
│   ├── presets.js                    ← platform output presets
│   └── styles.css
├── scripts/
│   └── record.js                     ← headless MP4 renderer
└── package.json
```

## Acknowledgments

- **Map tiles**: ESRI World Imagery (anonymous, attribution required).
- **Water polygons**: [OpenFreeMap](https://openfreemap.org/) (free, no signup).
- **Road routing**: [OSRM](https://project-osrm.org/) demo server.
- **Rendering**: [MapLibre GL JS](https://maplibre.org).
- **Geometry**: [Turf.js](https://turfjs.org).

## License

[MIT](LICENSE)
