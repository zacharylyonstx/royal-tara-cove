// The restored island lives in localStorage: three recorded performances, what was found,
// and the player's settings. Nothing leaves the device.

import { SAVE_KEY, SETTINGS_KEY } from '../core/Constants.js';

const VERSION = 1;

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
