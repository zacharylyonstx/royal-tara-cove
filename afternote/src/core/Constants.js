// Every tunable lives here. This file is DOM-free so the pure rule modules can import it.

// ---------------------------------------------------------------------------------
// Rules of play (Explore experience)
// ---------------------------------------------------------------------------------
export const RULES = {
  // (Opened up for young players: a press anywhere near its beat counts, right up to the
  //  halfway point between two notes. The original windows were 0.24 s early / 0.3 s late.)
  EARLY_SEC: 0.5, // how early a press may arrive and still count
  LATE_SEC: 0.5, // how late; after this the note is absent and a rescue step appears
  PERFECT_SEC: 0.085, // "well timed" flourish threshold
  NEIGHBOR_FRACTION: 0.5, // a window never takes more than this share of the gap to its neighbour
  REACH: 2, // open beats offer pitches within this many lanes of Kite
  LEAP_SEC: 0.34, // time from press to landing
  LEAP_GAP_FRACTION: 0.8, // ...but never more than this share of the gap to the next note
  LEAP_MIN_BEATS: 0.25,
  LAND_LEAD_BEATS: 0.22, // a new surface begins this far before the landing point
  HOLD_RELEASE_TOL_BEATS: 0.7, // letting go this close to the end marker counts as a full hold
  HOLD_LATE_START_TAIL_BEATS: 0.75, // a hold can still be joined late until this close to its end
  HOLD_MIN_BRIDGE_BEATS: 0.3,
  GATE_LIP_BEATS: 0.45, // ground past a gated seed, so Kite stands at an edge, not on one
  GLIDE_BEATS: 1.0, // how long a breath current takes to drift Kite to its anchor lane
};

// ---------------------------------------------------------------------------------
// Lanes: where each pitch lives relative to the route centerline (world units).
// X follows key order; Y follows the size of the musical interval.
// ---------------------------------------------------------------------------------
export const LANES = {
  X: [-3.2, -1.6, 0, 1.6, 3.2],
  Y: [0, 0.5, 1.0, 1.75, 2.25],
};

export const PACE = {
  FLOWING: { id: 'flowing', label: 'Flowing', scale: 1.0 },
  UNHURRIED: { id: 'unhurried', label: 'Unhurried', scale: 0.8 },
  GENTLE: { id: 'gentle', label: 'Gentle', scale: 0.66 },
};

// A helping hand for the keys: 'near' lets the key next door to a glowing note play it,
// 'any' lets every key play the nearest glowing note, 'off' asks for the exact key.
export const HELP = { OFF: 'off', NEAR: 'near', ANY: 'any', DEFAULT: 'near' };

// ---------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------
export const WORLD = {
  UNITS_PER_BEAT: 3.3, // route length Kite covers per beat at cruising speed
  SEA_LEVEL: 0,
  // The tower stands on its island at the far end of everything.
  LIGHTHOUSE: { x: 14, z: -218, baseY: 8, towerHeight: 36, radiusBase: 5.6, radiusTop: 3.9, galleryRadius: 6.6 },
  FOG_DENSITY: 0.0034,
};

export const KITE = {
  HEIGHT: 1.15,
  SCALE: 1.36, // the model is authored 1.15 tall; this is how big Kite stands in the world
  SURFACE_OFFSET: 0.0,
  LEAP_ARC: 0.55,
  LEAP_ARC_PER_Y: 0.22,
  LEAP_ARC_PER_X: 0.05,
};

export const STONE = {
  WIDTH: 1.5,
  THICKNESS: 0.56,
  HEAD_BEATS: 0.95, // the engraved head stone covers at most this much of a long note
  TRAIL_BEATS: 0.55, // then smaller follower stones this long
  GAP: 0.14,
};

export const CAMERA = {
  FOV: 50,
  NEAR: 0.3,
  FAR: 2400,
  BACK: 10.6, // world units behind Kite along the route
  HEIGHT: 4.5,
  LOOK_AHEAD: 7.7,
  LOOK_HEIGHT: 1.0,
  LATERAL_FOLLOW: 0.42,
  VERTICAL_FOLLOW: 0.55,
};

export const SEEDS = {
  HORIZON_BEATS: 5.0, // how far ahead possible landings are shown
  RING_LEAD_BEATS: 2.0, // the timing ring starts closing this long before the beat
};

// ---------------------------------------------------------------------------------
// Palette. Player-built things are warm; the sea answers in teal; the unfinished
// world is charcoal and violet-grey.
// ---------------------------------------------------------------------------------
export const COLORS = {
  // per-pitch accents (never the only identifier: lane, letter and key position also mark pitch)
  PITCH: [0xffb65c, 0xffcf78, 0xfff0b8, 0xb8f0d8, 0x9fd8ff],
  GOLD: 0xffc870,
  GOLD_DEEP: 0xff9a3c,
  EMBER: 0xffa54a,
  MARBLE: 0xe9e2d6,
  MARBLE_SHADE: 0x8f8a96,
  RUIN: 0x4a4658,
  RUIN_DARK: 0x2b2936,
  RESCUE: 0xb9c4d6,
  BREATH: 0xcfe6f2,
  ECHO: [0xa9d8ff, 0xc4b8ff, 0xffe6b0],
  TEAL: 0x2fd6c8,
  TEAL_DEEP: 0x0b5c66,
  SEA_DEEP: 0x0b1524,
  SKY_TOP: 0x1a1f38,
  SKY_MID: 0x4b3f63,
  SKY_HORIZON: 0xd9909a,
  FOG: 0x6b6480,
  CLOAK: 0x2a2f5c,
  CLOAK_LIGHT: 0x454c8a,
  CLOAK_TRIM: 0xe8b860,
};

// ---------------------------------------------------------------------------------
// Audio mix (linear gains). The player's instrument always sits on top.
// ---------------------------------------------------------------------------------
export const MIX = {
  MASTER: 0.85,
  PLAYER: 0.9,
  ECHO: 0.34,
  PAD: 0.18,
  BASS: 0.24,
  PULSE: 0.16,
  // the sea's kit, each level measured against the rest of the backing
  // (measured alone: the drum peaks about 5 dB under a played note, the tap 4 dB under the drum)
  KICK: 0.26,
  SNARE: 0.22,
  HAT: 0.07,
  ARP: 0.09,
  FLOURISH: 0.2, // a key that builds nothing still sings (it was 0.1: easy to miss)
  GRACE: 0.42, // a free-play key that builds no stone: its own note, short and soft
  WORLD: 0.4,
  AMBIENCE: 0.22,
  REVERB_SEND: 0.42,
  REVERB_SECONDS: 3.8,
  SCHEDULE_AHEAD_SEC: 0.14,
};

export const TIMING = {
  MAX_DT: 0.1,
  TEST_STEP: 1 / 60,
  ECHO_BIRTH_SEC: 7.5,
  TRANSIT_SEC: 6.5,
  IGNITE_SEC: 7.0,
  COUNT_IN_BEATS: 4,
};

// ---------------------------------------------------------------------------------
// The Sea of Bridges: free crossings between places.
// ---------------------------------------------------------------------------------
export const CROSSING = {
  GRID: 0.5, // one stone per half-beat at most; this is also the grid a kept bridge is tidied to
  START_BEAT: -5.5, // Kite walks out to the edge of the landing before the first note
  TAIL_BEATS: 6, // ...and in along the far landing after the last one
  RING_BEATS: 1.6, // how long a tapped note is left to ring
  MAX_LAYERS: 3, // parts that can be stacked on one bridge
  AFAR_MAX: 12, // bridges that came by link and are kept beside the player's own
  REACH: 4, // every key is always in reach
  // each part of a bridge runs beside the others and rejoins them at both landings: [sideways, up]
  LAYER_OFFSET: [[0, 0], [-7.2, 1.5], [7.2, 3.0]],
  BRAID: 0.16, // share of the crossing over which the parts spread apart and come together
  LAND_Y: 2.3, // height of a landing above the sea
};

export const SAVE_KEY = 'afternote.lighthouse.v1';
export const SEA_KEY = 'afternote.sea.v1';

/** Watching for a device that cannot keep up (see Game._watchPace). */
export const PACE_WATCH = {
  SECONDS: 4, // judged over this much unbroken play
  SLOW_FPS: 26, // below this the picture is lightened (30 is a tablet saving power, and is fine)
  STEPS: [0.8, 0.64, 0.5], // each step: this share of the usual sharpness
};
export const SETTINGS_KEY = 'afternote.settings.v1';

// Numbers are keys, letters are notes: the default keys can never be mistaken for a note name.
export const DEFAULT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
export const NUMPAD_KEYS = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'];
// Typing a note's own letter plays it (index = pitch: C D E G A).
export const NOTE_LETTER_KEYS = ['KeyC', 'KeyD', 'KeyE', 'KeyG', 'KeyA'];
