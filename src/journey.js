// Full itinerary: 49 stops, 48 legs. No dates.
// Tokyo repeats 9x — each revisit is a distinct entry, all sharing same coords.

export const journey = [
  { id: 'hyd-out',  name: 'Hyderabad',       region: 'India',       coords: [78.4867, 17.3850],   transport: null   },

  // --- Thailand ---
  { id: 'bkk-1',    name: 'Bangkok',         region: 'Thailand',    coords: [100.5018, 13.7563],  transport: 'flight' },
  { id: 'cnx-1',    name: 'Chiang Mai',      region: 'Thailand',    coords: [98.9853, 18.7883],   transport: 'bus'    },
  { id: 'cei',      name: 'Chiang Rai',      region: 'Thailand',    coords: [99.8325, 19.9105],   transport: 'bus'    },
  { id: 'cnx-2',    name: 'Chiang Mai',      region: 'Thailand',    coords: [98.9853, 18.7883],   transport: 'bus'    },
  { id: 'bkk-2',    name: 'Bangkok',         region: 'Thailand',    coords: [100.5018, 13.7563],  transport: 'train'  },

  // --- Taiwan ---
  { id: 'khh',      name: 'Kaohsiung',       region: 'Taiwan',      coords: [120.3014, 22.6273],  transport: 'flight' },
  { id: 'txg-1',    name: 'Taichung',        region: 'Taiwan',      coords: [120.6839, 24.1378],  transport: 'train'  },
  { id: 'sml',      name: 'Sun Moon Lake',   region: 'Taiwan',      coords: [120.9166, 23.8628],  transport: 'bus'    },
  { id: 'txg-2',    name: 'Taichung',        region: 'Taiwan',      coords: [120.6839, 24.1378],  transport: 'bus'    },
  { id: 'tpe',      name: 'Taipei',          region: 'Taiwan',      coords: [121.5654, 25.0330],  transport: 'train'  },

  // --- Japan: Kyushu ---
  { id: 'fuk',      name: 'Fukuoka',         region: 'Japan',       coords: [130.4017, 33.5904],  transport: 'flight' },
  { id: 'ngs',      name: 'Nagasaki',        region: 'Japan',       coords: [129.8779, 32.7503],  transport: 'train'  },
  { id: 'koj-1',    name: 'Kagoshima',       region: 'Japan',       coords: [130.5571, 31.5966],  transport: 'bus'    },
  { id: 'kij',      name: 'Kirishima',       region: 'Japan',       coords: [130.7634, 31.7406],  transport: 'bus'    },
  { id: 'koj-2',    name: 'Kagoshima',       region: 'Japan',       coords: [130.5571, 31.5966],  transport: 'train'  },

  // --- Japan: Chugoku / Shikoku ---
  { id: 'hij',      name: 'Hiroshima',       region: 'Japan',       coords: [132.4553, 34.3853],  transport: 'train'  },
  { id: 'him',      name: 'Himeji',          region: 'Japan',       coords: [134.6877, 34.8154],  transport: 'bus'    },
  { id: 'tak',      name: 'Takamatsu',       region: 'Japan',       coords: [134.0434, 34.3401],  transport: 'train'  },
  { id: 'okj',      name: 'Okayama',         region: 'Japan',       coords: [133.9344, 34.6551],  transport: 'train'  },

  // --- Tokyo + Hokkaido ---
  { id: 'tyo-1',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'bus'    },
  { id: 'spk-1',    name: 'Sapporo',         region: 'Japan',       coords: [141.3545, 43.0618],  transport: 'flight' },
  { id: 'otaru',    name: 'Otaru',           region: 'Japan',       coords: [141.0021, 43.1907],  transport: 'train'  },
  { id: 'asa',      name: 'Asahikawa',       region: 'Japan',       coords: [142.3649, 43.7708],  transport: 'bus'    },
  { id: 'biei',     name: 'Biei',            region: 'Japan',       coords: [142.4691, 43.5882],  transport: 'train'  },
  { id: 'wak',      name: 'Wakkanai',        region: 'Japan',       coords: [141.6730, 45.4116],  transport: 'train'  },
  { id: 'spk-2',    name: 'Sapporo',         region: 'Japan',       coords: [141.3545, 43.0618],  transport: 'bus'    },

  // --- Back to Tokyo + Japanese Alps ---
  { id: 'tyo-2',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'flight' },
  { id: 'matsu',    name: 'Matsumoto',       region: 'Japan',       coords: [137.9719, 36.2380],  transport: 'bus'    },
  { id: 'hkb',      name: 'Hakuba',          region: 'Japan',       coords: [137.8623, 36.6981],  transport: 'train'  },
  { id: 'ngn',      name: 'Nagano',          region: 'Japan',       coords: [138.1812, 36.6485],  transport: 'train'  },
  { id: 'tyo-3',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'bus'    },

  // --- Day trips from Tokyo ---
  { id: 'fkk',      name: 'Fujikawaguchiko', region: 'Japan',       coords: [138.7570, 35.4868],  transport: 'train'  },
  { id: 'tyo-4',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'train'  },
  { id: 'yok',      name: 'Yokohama',        region: 'Japan',       coords: [139.6380, 35.4437],  transport: 'train'  },
  { id: 'tyo-5',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'train'  },
  { id: 'eno',      name: 'Enoshima',        region: 'Japan',       coords: [139.4811, 35.3030],  transport: 'train'  },
  { id: 'tyo-6',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'train'  },
  { id: 'cch',      name: 'Chichibu',        region: 'Japan',       coords: [139.0853, 35.9920],  transport: 'train'  },
  { id: 'tyo-7',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'train'  },
  { id: 'shin',     name: 'Shin-Fuji',       region: 'Japan',       coords: [138.6739, 35.1369],  transport: 'train'  },
  { id: 'tyo-8',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'train'  },

  // --- Tohoku ---
  { id: 'sdj-1',    name: 'Sendai',          region: 'Japan',       coords: [140.8694, 38.2682],  transport: 'bus'    },
  { id: 'yma',      name: 'Yamadera',        region: 'Japan',       coords: [140.4429, 38.3093],  transport: 'train'  },
  { id: 'mts',      name: 'Matsushima',      region: 'Japan',       coords: [141.0710, 38.3679],  transport: 'train'  },
  { id: 'sdj-2',    name: 'Sendai',          region: 'Japan',       coords: [140.8694, 38.2682],  transport: 'train'  },
  { id: 'tyo-9',    name: 'Tokyo',           region: 'Japan',       coords: [139.6917, 35.6895],  transport: 'train'  },

  // --- Return ---
  { id: 'hkg',      name: 'Hong Kong',       region: 'Hong Kong',   coords: [114.1694, 22.3193],  transport: 'flight' },
  { id: 'hyd-end',  name: 'Hyderabad',       region: 'India',       coords: [78.4867, 17.3850],   transport: 'flight' }
];

// Long international flights — get cinematic treatment.
const HERO_STOPS = new Set(['bkk-1', 'khh', 'fuk', 'spk-1', 'tyo-2', 'hkg', 'hyd-end']);

export function timingFor(stop, isFirst, isLast) {
  // Tight intro/outro; saved time reinvested into slower ground transits.
  if (isFirst) return { transit: 0,    approach: 800,  dwell: 400 };
  if (isLast)  return { transit: 1235, approach: 700,  dwell: 400 };
  if (HERO_STOPS.has(stop.id)) return { transit: 1235, approach: 400, dwell: 600 };
  return { transit: 1045, approach: 250, dwell: 350 };
}

export function cameraFor(stop, isFirst, isLast) {
  if (isFirst || isLast) return { zoom: 6.5, pitch: 40, bearing: 0 };
  if (HERO_STOPS.has(stop.id)) return { zoom: 8.5, pitch: 50, bearing: 0 };
  return { zoom: 9, pitch: 48, bearing: 0 };
}
