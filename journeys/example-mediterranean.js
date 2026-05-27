// Example journey — Mediterranean multi-modal loop.
// Showcases all transport modes (flight, train, bus, ferry, car) and
// shows how to structure a journey with revisits and hero stops.
//
// To make this YOUR trip:
//  1. Copy this file to `journeys/your-trip.js`
//  2. Edit the stops + hero set below
//  3. Run `npm run dev` (live preview) or `npm run record` (MP4 export)

/**
 * @typedef {Object} Stop
 * @property {string} id          unique id (kebab-case; reuse the city's id
 *                                with a suffix like `bkk-1`/`bkk-2` for
 *                                revisits — they're separate animation events
 *                                but show the same dot on the map).
 * @property {string} name        display name (shown in HUD + map label).
 * @property {string} region      shown above the name in the HUD (country,
 *                                state, or region).
 * @property {[number, number]} coords  [longitude, latitude] in WGS84.
 *                                Tip: paste from Google Maps / Wikipedia.
 * @property {?('flight'|'train'|'bus'|'car'|'ferry'|'metro')} transport
 *                                how you arrived at this stop. `null` for the
 *                                very first stop. `flight` draws a great-circle
 *                                arc; all other modes fetch a real road route
 *                                from OSRM and animate the matching icon.
 */

/** @type {Stop[]} */
export const journey = [
  { id: 'ath-out', name: 'Athens',    region: 'Greece',   coords: [23.7275, 37.9838],  transport: null     },
  { id: 'ist',     name: 'Istanbul',  region: 'Türkiye',  coords: [28.9784, 41.0082],  transport: 'ferry'  },
  { id: 'sof',     name: 'Sofia',     region: 'Bulgaria', coords: [23.3219, 42.6977],  transport: 'train'  },
  { id: 'bgd',     name: 'Belgrade',  region: 'Serbia',   coords: [20.4489, 44.7866],  transport: 'bus'    },
  { id: 'vie',     name: 'Vienna',    region: 'Austria',  coords: [16.3738, 48.2082],  transport: 'train'  },
  { id: 'muc',     name: 'Munich',    region: 'Germany',  coords: [11.5820, 48.1351],  transport: 'car'    },
  { id: 'rom',     name: 'Rome',      region: 'Italy',    coords: [12.4964, 41.9028],  transport: 'flight' },
  { id: 'ath-end', name: 'Athens',    region: 'Greece',   coords: [23.7275, 37.9838],  transport: 'ferry'  }
];

// Stops that get cinematic treatment (longer transit, closer landing zoom).
// Pick your long-haul flights or the trip's standout moments.
const HERO_STOPS = new Set(['rom']);

// Pacing knobs in milliseconds. transit = travel animation, approach = camera
// landing, dwell = pause on the dot. Tune to fit the duration you want.
export function timingFor(stop, isFirst, isLast) {
  if (isFirst) return { transit: 0,    approach: 1500, dwell: 1500 };
  if (isLast)  return { transit: 1300, approach: 800,  dwell: 800  };
  if (HERO_STOPS.has(stop.id)) return { transit: 1300, approach: 400, dwell: 600 };
  return { transit: 1045, approach: 250, dwell: 350 };
}

// Camera config per landing. Smaller zoom = wider view, larger pitch = more tilt.
export function cameraFor(stop, isFirst, isLast) {
  if (isFirst || isLast) return { zoom: 6.5, pitch: 40, bearing: 0 };
  if (HERO_STOPS.has(stop.id)) return { zoom: 8.5, pitch: 50, bearing: 0 };
  return { zoom: 9, pitch: 48, bearing: 0 };
}
