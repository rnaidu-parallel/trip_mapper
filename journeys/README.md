# Journeys

This folder holds the trip data the renderer animates. Pick or create a
journey file, then point `src/journey.js` at it (the default is
`your-trip.js`, which re-exports `example-mediterranean.js`).

## Quick start

Edit `your-trip.js`. Either:

- replace the `export … from './example-mediterranean.js'` line with your
  own `journey`, `timingFor`, and `cameraFor` definitions, or
- copy `example-mediterranean.js` to `your-trip.js` and edit it directly.

The dev server hot-reloads on save.

## Schema

```js
{
  id: 'unique-kebab-case',         // for revisits use suffixes: 'tyo-1', 'tyo-2'
  name: 'Display Name',            // shown in HUD + on map label
  region: 'Country or Region',     // shown above the name in HUD
  coords: [longitude, latitude],   // WGS84; copy from Google Maps / Wikipedia
  transport: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'metro' | null
                                   // how you arrived; null for first stop
}
```

- **`flight`** draws a great-circle arc and animates ✈️.
- All other modes fetch a real road route from [OSRM](https://project-osrm.org)
  at load time and animate the matching icon (🚄 🚌 🚗 🚢 🚊). If OSRM
  can't route a leg, the line falls back to a straight segment.

## Tips

- **Revisits**: list the city multiple times with distinct `id`s
  (`'tyo-1'`, `'tyo-2'`). They share coordinates so the dot stays at the
  same point, but each entry plays as a separate landing.
- **Hero stops**: put long-haul or marquee legs in `HERO_STOPS` for a
  more cinematic landing (longer transit, closer zoom, longer dwell).
- **Pacing budget**: the renderer doesn't auto-tune. Sum the `timingFor`
  outputs across all stops to target your platform's video length
  (Instagram Reels max 90s, TikTok up to 3 min, YouTube Shorts 60s).
- **Coordinates**: right-click in Google Maps → "What's here?" gives
  `(lat, lng)` — **swap them** for the `[lng, lat]` schema.
