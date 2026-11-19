// The five-note palette. Pitch indices are used everywhere: 0..4 = C D E G A.
// Lane order = key order = pitch order.

export const PITCH_NAMES = ['C', 'D', 'E', 'G', 'A'];
export const SEMITONES = [0, 2, 4, 7, 9];
export const PITCH_COUNT = 5;

// A sea mood can be in another key: the five keys keep their order and their colours, and
// take the names of the notes they play there. The lighthouse is always in C.
let names = PITCH_NAMES;
export function noteName(pitch) {
  return names[pitch];
}
export function setNoteNames(list) {
  names = Array.isArray(list) && list.length === PITCH_COUNT ? list : PITCH_NAMES;
}

export function midiOf(pitch, octave) {
  return 12 * (octave + 1) + SEMITONES[pitch];
}

export function freqOf(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

// Partners that ring well against each pitch, best first (fifth/fourth, then thirds).
const PARTNERS = [
  [3, 2, 4], // C -> G, E, A
  [4, 3, 0], // D -> A, G, C
  [4, 3, 0], // E -> A, G, C
  [0, 1, 2], // G -> C, D, E
  [2, 1, 0], // A -> E, D, C
];

/** The pitch that most clearly "answers" another: used by Resonance Crossings. */
export function complementOf(pitch) {
  return PARTNERS[pitch][0];
}

export function partnersOf(pitch) {
  return PARTNERS[pitch];
}
