// The restored island lives in localStorage: three recorded performances, what was found,
// and the player's settings. Nothing leaves the device.

import { SAVE_KEY, SETTINGS_KEY, SEA_KEY } from '../core/Constants.js';

const VERSION = 1;
// the sea is versioned on its own: changing the lighthouse save must never empty a child's sea
const SEA_VERSION = 1;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const Save = {
  /** @returns {{records:(object|null)[], discoveries:string[], seen:object}|null} */
  load() {
    const data = read(SAVE_KEY);
    if (!data || data.v !== VERSION || !Array.isArray(data.records)) return null;
    return { records: [0, 1, 2].map((i) => data.records[i] ?? null), discoveries: data.discoveries ?? [], seen: data.seen ?? {} };
  },

  store({ records, discoveries, seen }) {
    return write(SAVE_KEY, { v: VERSION, at: Date.now(), records, discoveries, seen });
  },

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* nothing to clear */
    }
  },

  /** The Sea of Bridges: where Kite is, which places are awake, and every bridge's score. Checked by sanitizeSea(). */
  loadSea() {
    const data = read(SEA_KEY);
    return data && data.v === SEA_VERSION ? data.sea ?? null : null;
  },

  storeSea(sea) {
    return write(SEA_KEY, { v: SEA_VERSION, at: Date.now(), sea });
  },

  /** A saved sea could not be read: set what is there aside, so nothing overwrites it for good. */
  setSeaAside() {
    try {
      const raw = localStorage.getItem(SEA_KEY);
      if (raw && !localStorage.getItem(`${SEA_KEY}.kept`)) localStorage.setItem(`${SEA_KEY}.kept`, raw);
    } catch {
      /* nothing can be done */
    }
  },

  /** Ask the browser not to clear this site's storage when it is short of room. */
  keepSafe() {
    try {
      navigator.storage?.persist?.()?.catch?.(() => {});
    } catch {
      /* not offered here */
    }
  },

  loadSettings() {
    return read(SETTINGS_KEY);
  },

  storeSettings(settings) {
    return write(SETTINGS_KEY, settings);
  },
};

/**
 * Replace one movement's record, leaving the others untouched. Returns a new array.
 * A later movement's crossings that answered the replaced part stay as they were played:
 * they are part of that later recording.
 */
export function replaceRecord(records, index, record) {
  const out = records.slice();
  out[index] = record;
  return out;
}
