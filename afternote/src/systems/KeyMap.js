// Which key plays which note. Pure, so it can be tested without a browser.
//
// The rule the player sees: NUMBERS ARE KEYS, LETTERS ARE NOTES.
//   - the five chosen keys (digits 1–5 by default) play the five lanes, left to right
//   - typing a note's own letter (C D E G A) also plays that note, so reading "C" and
//     pressing C is never a mistake
//   - a key the player chose for a lane always wins if it happens to be a note letter too

import { DEFAULT_KEYS, NOTE_LETTER_KEYS, NUMPAD_KEYS } from '../core/Constants.js';

export const KEY_PRESETS = {
  numbers: { id: 'numbers', label: '1 2 3 4 5', codes: [...DEFAULT_KEYS] },
  home: { id: 'home', label: 'H J K L ;', codes: ['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'] },
};

/** @returns {number} pitch index 0..4, or -1 if this key plays nothing */
export function pitchForCode(code, keys = DEFAULT_KEYS) {
  let i = keys.indexOf(code);
  if (i !== -1) return i;
  i = NUMPAD_KEYS.indexOf(code);
  if (i !== -1) return i;
  return NOTE_LETTER_KEYS.indexOf(code);
}

/** The preset a set of keys matches, or null if it is the player's own. */
export function presetOf(keys) {
  const k = keys ?? DEFAULT_KEYS;
  for (const p of Object.values(KEY_PRESETS)) if (p.codes.every((c, i) => c === k[i])) return p.id;
  return null;
}

/** What is written on things: 'both' (note + key), 'keys', or 'notes'. Reads old saves too. */
export function labelMode(settings) {
  if (settings.labels === 'both' || settings.labels === 'keys' || settings.labels === 'notes') return settings.labels;
  return settings.noteNames === false ? 'keys' : 'both';
}

/** Short text for a key code, as printed on a keycap. */
export function keyLabel(code, layout = null) {
  if (!code) return '';
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return code.slice(6);
  const mapped = layout?.get?.(code);
  if (mapped && mapped.length === 1) return mapped.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  const map = { Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Space: '␣', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=' };
  return map[code] ?? code.replace('Arrow', '');
}
