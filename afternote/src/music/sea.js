// THE SEA OF BRIDGES — the places beyond the lighthouse, the bridges that can join them,
// and the sounds and moods a crossing can be played in.
//
// A crossing is free play: every half-beat is open, every key builds a stone, and a beat
// left alone is only a rest. What is kept of a crossing is its score (which stone on which
// half-beat), so a bridge and every part stacked on it stay perfectly in time together.
//
// Pure data and pure functions: no three.js, no DOM, no audio.

import { CROSSING, RULES } from '../core/Constants.js';
import { CH } from './charts/lighthouse.js';

/** Tempo of a crossing before the mood and the player's pace are applied. */
export const SEA_BPM = 96;
/** The slowest and fastest a bridge may be (a little wider than the game itself ever makes them). */
const BPM_MIN = 44, BPM_MAX = 132;

// ---------------------------------------------------------------------------------
// Sounds. Three come from the lighthouse; every place across the sea gives one more.
// ---------------------------------------------------------------------------------
export const SOUNDS = {
  bell: { id: 'bell', name: 'Bell', octave: 5, hint: 'warm and ringing' },
  root: { id: 'root', name: 'Deep Root', octave: 3, hint: 'low and round' },
  glass: { id: 'glass', name: 'Glass', octave: 4, hint: 'bright and long' },
  musicbox: { id: 'musicbox', name: 'Music Box', octave: 6, hint: 'tiny and twinkling' },
  harp: { id: 'harp', name: 'Harp', octave: 4, hint: 'plucked and gentle' },
  marimba: { id: 'marimba', name: 'Marimba', octave: 4, hint: 'woody and bouncy' },
  flute: { id: 'flute', name: 'Wind Flute', octave: 5, hint: 'soft and breathy' },
  pan: { id: 'pan', name: 'Steel Pan', octave: 4, hint: 'sunny and shimmering' },
  firefly: { id: 'firefly', name: 'Firefly', octave: 5, hint: 'blinking and bright' },
};
export const HOME_SOUNDS = ['bell', 'root', 'glass'];

// ---------------------------------------------------------------------------------
// Moods: the harmony and feel underneath a crossing, and the light it is played in.
// Every chord is voiced so the five keys all sit well on it (see charts/lighthouse.js).
//
// What makes one mood unlike another, so that bridges built in different places are different
// music and not the same music turned up or down:
//   key     the whole mood, chords and keys together, moved by this many semitones; `names`
//           are the notes the five keys play there
//   harmony four bars, looped; `final` is the chord the crossing comes to rest on (a mood that
//           rests on a minor or an open chord feels minor or open, on the same five keys)
//   groove  its drums and broken chords: each line is eight half-beats, or bars in turn
//           ('x' a hit, 'o' a soft one); `arp` picks tones of the bar's chord, low to high
//   scene   how full each sustained part of the backing is; `sky` tints the dusk (null = as it is)
// ---------------------------------------------------------------------------------
export const MOODS = {
  firstlight: {
    id: 'firstlight', name: 'First Light', hint: 'calm and hopeful', tempo: 1.0,
    key: 0, names: ['C', 'D', 'E', 'G', 'A'],
    harmony: [CH.Cadd9, CH.Am7, CH.Fmaj9, CH.Gsus], final: CH.C,
    groove: null,
    scene: { pad: 1.0, bass: 0.9, pulse: 1.0, air: 0, shaker: 0, bassOn3: false },
    sky: null,
  },
  lullaby: {
    // a music box turning: no beat at all, only a slow broken chord
    id: 'lullaby', name: 'Lullaby', hint: 'slow and sleepy', tempo: 0.84,
    key: 5, names: ['F', 'G', 'A', 'C', 'D'],
    harmony: [CH.C, CH.Fmaj9, CH.CoverE, CH.Gsus], final: CH.C,
    groove: { arp: ['0.2.3.4.', '1.2.4.3.'] },
    scene: { pad: 0.9, bass: 0.55, pulse: 0, air: 0.5, shaker: 0, bassOn3: false },
    sky: { top: 0x0f1430, mid: 0x2a2f66, horizon: 0x7f86c8, fog: 0x4a4f86 },
  },
  tide: {
    // a little dance: drum on one and three, a tap on two and four, hats bouncing between
    id: 'tide', name: 'Tide Dance', hint: 'quick and bouncy', tempo: 1.1,
    key: 2, names: ['D', 'E', 'F♯', 'A', 'B'],
    harmony: [CH.Am7, CH.Fmaj9, CH.Cadd9, CH.Gsus], final: CH.Cadd9,
    groove: { kick: 'x...x...', snare: '..o...o.', hat: '.x.x.x.x' },
    scene: { pad: 0.65, bass: 1.0, pulse: 0, air: 0, shaker: 0, bassOn3: true },
    sky: { top: 0x10283a, mid: 0x1f5a66, horizon: 0x7fe0c8, fog: 0x3f7480 },
  },
  golden: {
    // unhurried and warm: a lazy drum that leans into the beat, a soft backbeat
    id: 'golden', name: 'Golden Hour', hint: 'warm and easy', tempo: 0.92,
    key: -2, names: ['B♭', 'C', 'D', 'F', 'G'],
    harmony: [CH.Fmaj9, CH.Cadd9, CH.Dm11, CH.Gsus], final: CH.Cadd9,
    groove: { kick: ['x..x....', 'x....x..'], snare: '..x...x.', hat: 'oxoxoxox' },
    scene: { pad: 1.0, bass: 0.85, pulse: 0, air: 0.4, shaker: 0, bassOn3: false },
    sky: { top: 0x2a2040, mid: 0x7a4a52, horizon: 0xffb86a, fog: 0x8a6660 },
  },
  starfall: {
    // wide and still: no beat, a single high note falling now and then, and it never quite resolves
    id: 'starfall', name: 'Starfall', hint: 'quiet and far away', tempo: 0.9,
    key: -3, names: ['A', 'B', 'C♯', 'E', 'F♯'],
    harmony: [CH.Dm11, CH.Am7, CH.Fmaj9, CH.Dm11], final: CH.Dm11,
    groove: { arp: ['....5...', '..4.....', '......5.', '3.......'] },
    scene: { pad: 0.7, bass: 0.45, pulse: 0, air: 1.1, shaker: 0, bassOn3: false },
    sky: { top: 0x080a1c, mid: 0x1c1c48, horizon: 0x5a52a0, fog: 0x34305e },
  },
  clockwork: {
    // a little machine: tick on every beat, tock between, a drum that keeps it marching
    id: 'clockwork', name: 'Clockwork', hint: 'ticking and busy', tempo: 1.06,
    key: -5, names: ['G', 'A', 'B', 'D', 'E'],
    harmony: [CH.C, CH.CoverE, CH.Fmaj9, CH.Gsus], final: CH.C,
    groove: { kick: 'x...x...', hat: '..x...x.' },
    scene: { pad: 0.6, bass: 0.9, pulse: 1.0, air: 0, shaker: 0, bassOn3: true, tock: true },
    sky: { top: 0x1c2238, mid: 0x4a4860, horizon: 0xe0a880, fog: 0x6c6470 },
  },
  deep: {
    // minor, low and slow: it rests on a minor chord, over a heartbeat
    id: 'deep', name: 'Deep Water', hint: 'slow and mysterious', tempo: 0.8,
    key: -4, names: ['A♭', 'B♭', 'C', 'E♭', 'F'],
    harmony: [CH.Am7, CH.Fmaj9, CH.Dm11, CH.Am7], final: CH.Am7,
    groove: { kick: 'x.o.....' },
    scene: { pad: 0.85, bass: 0.8, pulse: 0, air: 0.9, shaker: 0, bassOn3: false, padDown: true },
    sky: { top: 0x060e1c, mid: 0x0e2c44, horizon: 0x3aa0a8, fog: 0x1e4658 },
  },
};
export const HOME_MOODS = ['firstlight'];
/** The chord a crossing comes to rest on, whatever its mood. */
export const FINAL_CHORD = CH.C;

// ---------------------------------------------------------------------------------
// Places. x/z are world units; the lighthouse stands at (14, -218) and the sea beyond it
// is open water. `gift` is what a place gives the first time a bridge reaches it.
// ---------------------------------------------------------------------------------
export const HOME = 'lighthouse';
export const PLACES = [
  { id: 'lighthouse', name: 'The Lighthouse', x: 14, z: -268, kind: 'home', gift: null, blurb: 'Home. Every bridge begins somewhere.' },
  { id: 'chimes', name: 'Chime Rocks', x: -78, z: -342, kind: 'chimes', gift: { sound: 'musicbox', mood: 'lullaby', cloak: 'moon' }, blurb: 'Old chimes hang still, waiting for a song.' },
  { id: 'harp', name: 'Harp Shoals', x: 106, z: -340, kind: 'harp', gift: { sound: 'harp', mood: 'tide', cloak: 'seaglass' }, blurb: 'Two stones lean together like a great harp.' },
  { id: 'garden', name: 'Drift Garden', x: 14, z: -428, kind: 'garden', gift: { sound: 'marimba', mood: 'golden', cloak: 'blossom' }, blurb: 'A stone tree, bare until it hears music.' },
  { id: 'stacks', name: 'Whistling Stacks', x: -182, z: -456, kind: 'stacks', gift: { sound: 'flute', mood: 'starfall', cloak: 'wind' }, blurb: 'Tall rocks the wind plays like pipes.' },
  { id: 'harbor', name: 'Tin Harbor', x: 202, z: -450, kind: 'harbor', gift: { sound: 'pan', mood: 'clockwork', cloak: 'copper' }, blurb: 'A little wheel that has forgotten how to turn.' },
  { id: 'deep', name: 'Firefly Deep', x: 14, z: -552, kind: 'deep', gift: { sound: 'firefly', mood: 'deep', cloak: 'glow' }, blurb: 'Lanterns under dark water, not yet lit.' },
];
export const PLACE = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------------
// Cloaks for Kite: something of the player's own to choose, and something to find. Each place
// gives one when it wakes, and the sea as a whole gives three more. Colours only: cloth, its lit
// side, trim, ember, scarf. `how` is said under one that has not been found yet.
// ---------------------------------------------------------------------------------
export const CLOAKS = {
  dusk: { id: 'dusk', name: 'Dusk', how: '', cloak: 0x2a2f5c, light: 0x454c8a, trim: 0xe8b860, ember: 0xffa54a, tail: 0xc8963c },
  moon: { id: 'moon', name: 'Moonsilver', how: 'Wake Chime Rocks', cloak: 0x6f7b9e, light: 0xc4cee8, trim: 0xf6f8ff, ember: 0xdfe8ff, tail: 0xaab4d0 },
  seaglass: { id: 'seaglass', name: 'Seaglass', how: 'Wake Harp Shoals', cloak: 0x1d6a66, light: 0x46ac9f, trim: 0xc8fff0, ember: 0x8fe8d8, tail: 0x3a9a90 },
  blossom: { id: 'blossom', name: 'Blossom', how: 'Wake Drift Garden', cloak: 0x47733a, light: 0x86ba66, trim: 0xffc8d8, ember: 0xffc4d6, tail: 0xd88aa0 },
  wind: { id: 'wind', name: 'Windsong', how: 'Wake Whistling Stacks', cloak: 0x4f6dbe, light: 0x94b2f2, trim: 0xffffff, ember: 0xcfe4ff, tail: 0x8aa8e8 },
  copper: { id: 'copper', name: 'Copper', how: 'Wake Tin Harbor', cloak: 0x823622, light: 0xc4683a, trim: 0xffd28a, ember: 0xffb06a, tail: 0xe08a4a },
  glow: { id: 'glow', name: 'Firefly', how: 'Wake Firefly Deep', cloak: 0x0e2a3a, light: 0x1c5a6e, trim: 0x7df0ff, ember: 0x7df0ff, tail: 0x3ad0e0 },
  dawn: { id: 'dawn', name: 'Dawn', how: 'Wake every place', cloak: 0xe6dccc, light: 0xfffaf0, trim: 0xffc870, ember: 0xfff0c0, tail: 0xffb86a },
  starlight: { id: 'starlight', name: 'Starlight', how: 'Build every bridge', cloak: 0x1c1236, light: 0x5a3a9a, trim: 0xd9b8ff, ember: 0xe6ccff, tail: 0x9a7ae0 },
  aurora: { id: 'aurora', name: 'Aurora', how: 'Give every bridge three parts', cloak: 0x163a4a, light: 0x3fd0a0, trim: 0xff9ad8, ember: 0xa8ffd8, tail: 0x8a7af0 },
};
export const HOME_CLOAK = 'dusk';

/** The cloaks a sea has earned, in the order they are shown. */
export function cloaksOf(sea) {
  const list = [HOME_CLOAK];
  for (const p of PLACES) if (p.gift?.cloak && sea.awake.includes(p.id)) list.push(p.gift.cloak);
  const bridges = Object.values(sea.bridges);
  if (sea.awake.length >= PLACES.length) list.push('dawn');
  if (bridges.length >= EDGES.length) list.push('starlight');
  if (bridges.length >= EDGES.length && bridges.every((b) => b.layers.length >= CROSSING.MAX_LAYERS)) list.push('aurora');
  return list;
}

/** The bridges that can be played. `bars` sets how long the crossing is. */
export const EDGES = [
  { a: 'lighthouse', b: 'chimes', bars: 8 },
  { a: 'lighthouse', b: 'harp', bars: 8 },
  { a: 'lighthouse', b: 'garden', bars: 12 },
  { a: 'chimes', b: 'garden', bars: 8 },
  { a: 'harp', b: 'garden', bars: 8 },
  { a: 'chimes', b: 'stacks', bars: 12 },
  { a: 'harp', b: 'harbor', bars: 12 },
  { a: 'garden', b: 'deep', bars: 8 },
  { a: 'stacks', b: 'deep', bars: 16 },
  { a: 'harbor', b: 'deep', bars: 16 },
].map((e) => ({ ...e, id: `${e.a}~${e.b}` }));
export const EDGE = Object.fromEntries(EDGES.map((e) => [e.id, e]));

export function edgesOf(placeId) {
  return EDGES.filter((e) => e.a === placeId || e.b === placeId);
}
export function otherEnd(edge, placeId) {
  return edge.a === placeId ? edge.b : edge.a;
}

// ---------------------------------------------------------------------------------
// Charts and scores
// ---------------------------------------------------------------------------------

/** The rules a crossing is judged by: the game's own, with every key always in reach. */
export function crossingRules(rules = RULES) {
  return { ...rules, REACH: CROSSING.REACH };
}

/**
 * The chart of one part of a bridge: an open beat on every half-beat, the first one waiting
 * for the player. `from`/`to` are place ids; the part is played in that direction.
 */
export function crossingChart({ edge, from, sound, layer = 0, mood = null }) {
  const beats = edge.bars * 4;
  const s = SOUNDS[sound] ?? SOUNDS.bell;
  const m = mood ? MOODS[mood] : null;
  const to = otherEnd(edge, from);
  const events = [];
  for (let b = 0; b < beats - 1e-9; b += CROSSING.GRID) events.push({ b, k: 'open', d: CROSSING.GRID, gate: b === 0 });
  return {
    id: `${edge.id}#${layer}`,
    title: `${PLACE[from].name} to ${PLACE[to].name}`,
    numeral: ['I', 'II', 'III'][layer] ?? '',
    instrument: s.id,
    octave: s.octave,
    // the key the mood is in: every note of the part is moved by this, and the keys are named for it
    key: m?.key ?? 0,
    names: m?.names ?? null,
    startBeat: CROSSING.START_BEAT,
    endBeat: beats + CROSSING.TAIL_BEATS,
    startLane: 2,
    endLane: 2,
    free: true,
    beats,
    edge: edge.id,
    from,
    to,
    layer,
    events,
  };
}

/** What is kept of a played part: which stone on which half-beat. @returns {Array<[number, number]>} */
export function scoreOf(record) {
  return record.entries.filter((e) => e.outcome === 'hit').map((e) => [e.i, e.p]).sort((a, b) => a[0] - b[0]);
}

/**
 * Perform a score exactly on its beats and return the record. This is what a kept bridge,
 * its Echo and its sound are all built from, so they always agree.
 * @param {Function} Runner  the MovementRunner class (passed in to keep this module free of cycles)
 */
export function performScore(Runner, chart, bpm, score, rules = RULES) {
  const runner = new Runner(chart, { bpm, rules: crossingRules(rules) });
  for (const [i, p] of score) {
    const slot = runner.slots[i];
    if (!slot || p < 0 || p > 4) continue;
    runner.advance(slot.b);
    if (runner.nextSlot() !== slot) continue; // out of order or doubled: leave it out
    runner.press(p, slot.b);
  }
  runner.advance(chart.endBeat + 4);
  return tidyRests(runner.record());
}

/** Join the light between stones into single runs (a record made of many small rests draws as one). */
export function tidyRests(record) {
  const out = [];
  for (const piece of record.pieces) {
    const last = out[out.length - 1];
    if (piece.rest && last && last.rest && last.lane === piece.lane && piece.b0 <= last.b1 + 1e-6) {
      last.b1 = Math.max(last.b1, piece.b1);
      continue;
    }
    out.push({ ...piece });
  }
  return { ...record, pieces: out };
}

/** A fresh, empty sea. */
export function emptySea() {
  return { at: HOME, awake: [HOME], bridges: {}, afar: [], seen: {}, cloak: HOME_CLOAK };
}

/** Sounds and moods the player has, given the places that are awake. */
export function unlocked(awake) {
  const sounds = [...HOME_SOUNDS];
  const moods = [...HOME_MOODS];
  for (const id of awake) {
    const g = PLACE[id]?.gift;
    if (!g) continue;
    if (!sounds.includes(g.sound)) sounds.push(g.sound);
    if (!moods.includes(g.mood)) moods.push(g.mood);
  }
  return { sounds, moods };
}

/**
 * Check and repair a sea read from storage (or from a link). Unknown places, bridges,
 * sounds and moods are dropped; a score keeps only stones that fit its bridge.
 */
/** One bridge on one edge, checked piece by piece. Anything that is not a bridge comes back null. */
export function sanitizeBridge(edgeId, b) {
  // (own keys only: a save edited by hand must not reach 'constructor' or 'toString')
  const edge = typeof edgeId === 'string' && Object.hasOwn(EDGE, edgeId) ? EDGE[edgeId] : null;
  if (!edge || !b || typeof b !== 'object' || (b.from !== edge.a && b.from !== edge.b) || !Array.isArray(b.layers)) return null;
  const slots = (edge.bars * 4) / CROSSING.GRID;
  const layers = [];
  for (const l of b.layers) {
    if (layers.length >= CROSSING.MAX_LAYERS) break;
    if (!l || !Array.isArray(l.score)) continue;
    const seenSlot = new Set();
    const score = [];
    for (const n of l.score) {
      if (!Array.isArray(n)) continue;
      const [i, p] = n;
      if (!Number.isInteger(i) || !Number.isInteger(p) || i < 0 || i >= slots || p < 0 || p > 4 || seenSlot.has(i)) continue;
      seenSlot.add(i);
      score.push([i, p]);
    }
    score.sort((x, y) => x[0] - y[0]);
    // every crossing begins with the note that sets Kite out: a part without its first half-beat
    // was never played, could not be played back, and could not be sent
    if (!score.length || score[0][0] !== 0) continue;
    layers.push({ sound: typeof l.sound === 'string' && Object.hasOwn(SOUNDS, l.sound) ? l.sound : 'bell', score });
  }
  if (!layers.length) return null;
  const bpm = Number(b.bpm);
  return {
    from: b.from,
    mood: typeof b.mood === 'string' && Object.hasOwn(MOODS, b.mood) ? b.mood : 'firstlight',
    bpm: bpm >= BPM_MIN && bpm <= BPM_MAX ? bpm : SEA_BPM,
    layers,
  };
}

export function sanitizeSea(raw) {
  const sea = emptySea();
  if (!raw || typeof raw !== 'object') return sea;
  const isPlace = (id) => typeof id === 'string' && Object.hasOwn(PLACE, id);
  if (Array.isArray(raw.awake)) for (const id of raw.awake) if (isPlace(id) && !sea.awake.includes(id)) sea.awake.push(id);
  if (raw.seen && typeof raw.seen === 'object') sea.seen = { ...raw.seen };
  for (const [id, b] of Object.entries(raw.bridges && typeof raw.bridges === 'object' ? raw.bridges : {})) {
    const bridge = sanitizeBridge(id, b);
    if (!bridge) continue;
    sea.bridges[id] = bridge;
    // a bridge can only stand between places that are awake
    for (const end of [EDGE[id].a, EDGE[id].b]) if (!sea.awake.includes(end)) sea.awake.push(end);
  }
  if (isPlace(raw.at) && sea.awake.includes(raw.at)) sea.at = raw.at;
  // the cloak Kite wears: only one this sea has earned
  if (typeof raw.cloak === 'string' && Object.hasOwn(CLOAKS, raw.cloak) && cloaksOf(sea).includes(raw.cloak)) sea.cloak = raw.cloak;
  // bridges that came from another sea are kept beside the player's own; they wake nothing
  if (Array.isArray(raw.afar)) {
    for (const g of raw.afar) {
      if (sea.afar.length >= CROSSING.AFAR_MAX) break;
      const bridge = g && sanitizeBridge(g.edge, g);
      if (bridge) sea.afar.push({ edge: g.edge, ...bridge });
    }
  }
  return sea;
}

// ---------------------------------------------------------------------------------
// Sending a bridge to someone: the whole bridge written as a short code that fits in a
// link. No names, nothing about who made it: only the edge, the mood and the stones.
//
// The order of these three lists is the wire format. Only ever add to their ends, or links
// that have already been sent will stop meaning what they meant.
// ---------------------------------------------------------------------------------
const WIRE_EDGES = [
  'lighthouse~chimes', 'lighthouse~harp', 'lighthouse~garden', 'chimes~garden', 'harp~garden',
  'chimes~stacks', 'harp~harbor', 'garden~deep', 'stacks~deep', 'harbor~deep',
];
const WIRE_MOODS = ['firstlight', 'lullaby', 'tide', 'golden', 'starfall', 'clockwork', 'deep'];
const WIRE_SOUNDS = ['bell', 'root', 'glass', 'musicbox', 'harp', 'marimba', 'flute', 'pan', 'firefly'];
const WIRE_VERSION = '1';
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * A bridge as text: version, edge, which end it starts from, mood, tempo, then each part as
 * its sound and its stones (two half-beats to a letter). About 40 letters a part.
 * @returns {string|null} null if this is not something that can be sent
 */
export function encodeBridge(edgeId, bridge) {
  const b = sanitizeBridge(edgeId, bridge);
  const e = WIRE_EDGES.indexOf(edgeId);
  const m = b ? WIRE_MOODS.indexOf(b.mood) : -1;
  if (!b || e < 0 || m < 0) return null;
  const edge = EDGE[edgeId];
  const slots = (edge.bars * 4) / CROSSING.GRID;
  const tempo = Math.round(b.bpm * 10).toString(36).padStart(3, '0');
  let code = WIRE_VERSION + B36[e] + (b.from === edge.a ? '0' : '1') + B36[m] + tempo;
  for (const l of b.layers) {
    const s = WIRE_SOUNDS.indexOf(l.sound);
    if (s < 0 || !l.score.length) return null;
    const cells = new Array(slots).fill(0);
    for (const [i, p] of l.score) cells[i] = p + 1;
    let stones = '';
    for (let i = 0; i < slots; i += 2) stones += B36[cells[i] * 6 + (cells[i + 1] ?? 0)];
    code += '-' + B36[s] + stones.replace(/0+$/, '');
  }
  return code;
}

/**
 * Read a code back. It comes from outside, so every letter is checked and the result goes
 * through the same door as a saved bridge.
 * @returns {{edge:string, bridge:object}|null}
 */
export function decodeBridge(code) {
  if (typeof code !== 'string' || code.length > 260 || !/^1[0-9a-z]{6}(-[0-9a-z]{1,65}){1,3}$/.test(code)) return null;
  const [head, ...parts] = code.split('-');
  const edgeId = WIRE_EDGES[B36.indexOf(head[1])];
  const edge = EDGE[edgeId];
  const mood = WIRE_MOODS[B36.indexOf(head[3])];
  if (!edge || !mood || (head[2] !== '0' && head[2] !== '1')) return null;
  const slots = (edge.bars * 4) / CROSSING.GRID;
  const layers = [];
  for (const part of parts) {
    const sound = WIRE_SOUNDS[B36.indexOf(part[0])];
    const stones = part.slice(1);
    if (!sound || stones.length * 2 > slots) return null;
    const score = [];
    for (let k = 0; k < stones.length; k++) {
      const v = B36.indexOf(stones[k]);
      const first = Math.floor(v / 6), second = v % 6;
      if (first) score.push([k * 2, first - 1]);
      if (second) score.push([k * 2 + 1, second - 1]);
    }
    // every crossing begins with the note that sets Kite out, so every real part has its first half-beat
    if (!score.length || score[0][0] !== 0) return null;
    layers.push({ sound, score });
  }
  const bridge = sanitizeBridge(edgeId, { from: head[2] === '0' ? edge.a : edge.b, mood, bpm: parseInt(head.slice(4, 7), 36) / 10, layers });
  return bridge && bridge.layers.length === parts.length ? { edge: edgeId, bridge } : null;
}

const samePart = (a, b) => a.sound === b.sound && a.score.length === b.score.length && a.score.every((n, i) => n[0] === b.score[i][0] && n[1] === b.score[i][1]);

/**
 * How two tellings of a bridge stand to each other: 'same', 'grown' (the second is the first
 * with more parts laid over it), 'older' (the other way round), or null if they are simply
 * different bridges.
 */
export function compareBridges(edgeA, a, edgeB, b) {
  if (edgeA !== edgeB || a.from !== b.from || a.mood !== b.mood || Math.abs(a.bpm - b.bpm) > 0.051) return null;
  const n = Math.min(a.layers.length, b.layers.length);
  for (let k = 0; k < n; k++) if (!samePart(a.layers[k], b.layers[k])) return null;
  return a.layers.length === b.layers.length ? 'same' : a.layers.length < b.layers.length ? 'grown' : 'older';
}

/**
 * Take a bridge that arrived by link into a sea. A bridge the player already has comes back
 * grown in the same place (their own on the chart, or one from afar); anything else is set
 * beside their own as a bridge from afar. Nothing of the player's is ever replaced by
 * something that is not the same bridge with more on it, and when there is no room left
 * nothing is pushed out: the newcomer waits ('full') until the player lets one go.
 * @returns {{what:'new'|'grown'|'same'|'full', ref?:string}} ref is the edge id for the player's own, 'afar:<n>' otherwise
 */
export function receiveBridge(sea, edgeId, bridge) {
  const own = sea.bridges[edgeId];
  const mine = own && compareBridges(edgeId, own, edgeId, bridge);
  if (mine) {
    if (mine === 'grown') own.layers = bridge.layers.map((l) => ({ sound: l.sound, score: l.score.map((n) => [...n]) }));
    return { what: mine === 'grown' ? 'grown' : 'same', ref: edgeId };
  }
  for (let i = 0; i < sea.afar.length; i++) {
    const rel = compareBridges(sea.afar[i].edge, sea.afar[i], edgeId, bridge);
    if (!rel) continue;
    if (rel === 'grown') sea.afar[i] = { edge: edgeId, ...copyBridge(bridge) };
    return { what: rel === 'grown' ? 'grown' : 'same', ref: `afar:${i}` };
  }
  if (sea.afar.length >= CROSSING.AFAR_MAX) return { what: 'full' };
  sea.afar.push({ edge: edgeId, ...copyBridge(bridge) });
  return { what: 'new', ref: `afar:${sea.afar.length - 1}` };
}

const copyBridge = (b) => ({ from: b.from, mood: b.mood, bpm: b.bpm, layers: b.layers.map((l) => ({ sound: l.sound, score: l.score.map((n) => [...n]) })) });

/**
 * Two tellings of one player's sea: the one open in this tab (`mine`), and what another tab
 * has saved since (`theirs`): a link opens a second tab, so this is an ordinary thing to
 * happen. Everything either of them has is kept. Where they disagree about a bridge, the
 * one being played now stands on the chart and the other waits among the bridges from afar.
 * `mine`'s bridges from afar keep their places, so the names this tab holds stay true.
 */
export function mergeSeas(theirs, mine) {
  const sea = emptySea();
  sea.at = mine.at;
  sea.seen = { ...theirs.seen, ...mine.seen };
  for (const id of [...mine.awake, ...theirs.awake]) if (!sea.awake.includes(id)) sea.awake.push(id);
  const spare = [];
  for (const e of EDGES) {
    const a = mine.bridges[e.id], b = theirs.bridges[e.id];
    if (a && b) {
      const rel = compareBridges(e.id, a, e.id, b);
      sea.bridges[e.id] = copyBridge(rel === 'grown' ? b : a);
      if (rel === null) spare.push({ edge: e.id, ...b });
    } else if (a || b) sea.bridges[e.id] = copyBridge(a ?? b);
  }
  for (const g of [...mine.afar, ...theirs.afar, ...spare]) {
    const { edge, ...bridge } = g;
    // the same bridge the player already has on the chart is not also a bridge from afar
    const own = sea.bridges[edge];
    const toOwn = own ? compareBridges(edge, own, edge, bridge) : null;
    if (toOwn === 'grown') sea.bridges[edge] = copyBridge(bridge);
    if (toOwn) continue;
    const i = sea.afar.findIndex((x) => compareBridges(x.edge, x, edge, bridge));
    if (i < 0) {
      if (sea.afar.length < CROSSING.AFAR_MAX) sea.afar.push({ edge, ...copyBridge(bridge) });
    } else if (compareBridges(sea.afar[i].edge, sea.afar[i], edge, bridge) === 'grown') sea.afar[i] = { edge, ...copyBridge(bridge) };
  }
  if (!sea.awake.includes(sea.at)) sea.at = HOME;
  sea.cloak = cloaksOf(sea).includes(mine.cloak) ? mine.cloak : HOME_CLOAK;
  return sea;
}
