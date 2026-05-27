// Output presets — each picks the recording resolution and the on-screen
// safe zones for the HUD so text doesn't get clipped or covered by the
// host platform's UI overlays.
//
// Apply via the `?preset=…` URL query param (live preview) or the
// `PRESET=…` env var when running `npm run record`.

/**
 * @typedef {Object} Preset
 * @property {string} label         human-readable name
 * @property {number} width         render width in px
 * @property {number} height        render height in px
 * @property {number} safeTop       distance from top reserved for platform UI
 * @property {number} safeBottom    distance from bottom reserved for platform UI
 * @property {number} safeLeft      distance from left edge (HUD inset)
 * @property {number} safeRight     distance from right edge (HUD inset)
 */

/** @type {Record<string, Preset>} */
export const PRESETS = {
  'ig-reel': {
    label: 'Instagram Reel',
    width: 1080, height: 1920,
    // Top header overlay ~250px, bottom caption+UI ~320px, action buttons right ~120px
    safeTop: 240, safeBottom: 290, safeLeft: 28, safeRight: 28
  },
  'ig-feed': {
    label: 'Instagram Feed Post (4:5)',
    width: 1080, height: 1350,
    safeTop: 60, safeBottom: 60, safeLeft: 28, safeRight: 28
  },
  'tiktok': {
    label: 'TikTok',
    width: 1080, height: 1920,
    // TikTok overlays caption + author bottom-left, action buttons right
    safeTop: 200, safeBottom: 320, safeLeft: 28, safeRight: 200
  },
  'yt-shorts': {
    label: 'YouTube Shorts',
    width: 1080, height: 1920,
    // YT Shorts overlays smaller header + bottom progress + side actions
    safeTop: 120, safeBottom: 260, safeLeft: 28, safeRight: 180
  }
};

export const DEFAULT_PRESET = 'ig-reel';

/** Resolves a preset from URL query or env, falling back to default. */
export function resolvePreset(name) {
  return PRESETS[name] || PRESETS[DEFAULT_PRESET];
}
