// THE LIGHTHOUSE OF FIRST LIGHT — authored score.
//
// One 16-bar harmonic cycle (64 beats) shared by three movements. Each movement is a
// different part with a different job; later movements are played alongside the Echoes
// of earlier ones, so the three charts are written against each other:
//
//   I   The Causeway        lead bell       — busy, melodic, owns the open phrase
//   II  The Answering Roots low round voice — sparse, answers in the lead's gaps, long tones
//   III Lighting the Lens   bright sustain  — few notes, big consequences
//
// Event kinds
//   note      guided tap                 { b, k:'note', p, d, accent?, gate? }
//   hold      guided sustained note      { b, k:'hold', p, d, accent? }
//   open      free pitch within reach    { b, k:'open', d }
//   choice    two routes, same rhythm    { b, k:'choice', id, routes:{ key:{ discovery, notes:[...] } } }
//   resonance answer an Echo's note      { b, k:'resonance', id, d, echo:{mvt,b}, fallback:[p,p] }
//   breath    marked rest                { b, k:'breath', d, lane?, style? }
//
// b = beat (quarter notes from the start of bar 1), d = length in beats.

const C = 0, D = 1, E = 2, G = 3, A = 4;

const note = (b, p, d, extra = {}) => ({ b, k: 'note', p, d, ...extra });
const hold = (b, p, d, extra = {}) => ({ b, k: 'hold', p, d, ...extra });
const open = (b, d = 1) => ({ b, k: 'open', d });
const breath = (b, d, extra = {}) => ({ b, k: 'breath', d, ...extra });

// ---------------------------------------------------------------------------------
// Harmony: voiced with no B and no upper-register F so C D E G A all sit well on
// every bar. `bass` and `pad` are MIDI note numbers.
// ---------------------------------------------------------------------------------
const CH = {
  Cadd9: { name: 'Cadd9', bass: 36, pad: [48, 55, 62, 64], color: [67, 72, 76] },
  Am7: { name: 'Am7', bass: 33, pad: [45, 55, 60, 64], color: [69, 72, 76] },
  Fmaj9: { name: 'Fmaj9', bass: 29, pad: [41, 57, 60, 64], color: [67, 72, 76] },
  Gsus: { name: 'Gsus4', bass: 31, pad: [43, 55, 60, 62], color: [67, 69, 74] },
  CoverE: { name: 'C/E', bass: 28, pad: [40, 55, 60, 67], color: [64, 72, 79] },
  Dm11: { name: 'Dm11', bass: 38, pad: [50, 57, 60, 64], color: [67, 69, 76] },
  C: { name: 'C', bass: 36, pad: [48, 55, 60, 64], color: [67, 72, 79] },
};

const harmony = [
  CH.Cadd9, CH.Am7, CH.Fmaj9, CH.Gsus,
  CH.Cadd9, CH.Am7, CH.Fmaj9, CH.Gsus,
  CH.Fmaj9, CH.CoverE, CH.Dm11, CH.Gsus,
  CH.Am7, CH.Fmaj9, CH.Gsus, CH.C,
];

// ---------------------------------------------------------------------------------
// I — THE CAUSEWAY
// ---------------------------------------------------------------------------------
const causeway = {
  id: 'causeway',
  title: 'The Causeway',
  numeral: 'I',
  instrument: 'bell',
  octave: 5,
  startBeat: -9,
  endBeat: 67,
  startLane: C,
  endLane: C,
  events: [
    // Prelude. One note in near silence. It waits for the player, then starts everything.
    // The first stone fills the first gap; an old, intact stretch of causeway carries Kite
    // through the count-in.
    note(-5, C, 1, { gate: true, accent: 'firstStone' }),
    breath(-3.2, 3.2, { style: 'ruin', lane: C }),

    // Bar 1–4: two rising steps, then the first real decision.
    note(0, D, 2),
    note(2, E, 2),
    {
      b: 4, k: 'choice', id: 'tide-or-arch',
      routes: {
        low: { discovery: 'fish', notes: [note(4, D, 2), note(6, C, 2), note(8, D, 2, { accent: 'fish' }), note(10, E, 2)] },
        high: { discovery: 'chime', notes: [note(4, G, 2), note(6, A, 2), note(8, G, 2, { accent: 'chime' }), note(10, E, 2)] },
      },
    },
    note(12, G, 1, { accent: 'lantern1' }),
    breath(13, 3, { lane: E }),

    // Bar 5–8: stepping stones, the first held bridge, a little climb, a second bridge.
    note(16, E, 1),
    note(17, D, 1),
    note(18, C, 1),
    breath(19, 1),
    hold(20, E, 3, { accent: 'firstBridge' }),
    breath(23, 1, { style: 'ruin', lane: E }),
    note(24, G, 1),
    note(25, A, 1),
    note(26, G, 1),
    breath(27, 1),
    hold(28, D, 2),
    breath(30, 2, { lane: E }),

    // Bar 9–11: the open phrase. The rhythm is given; the melody is the player's.
    open(32), open(33), open(34),
    breath(35, 1),
    open(36), open(37), open(38),
    breath(39, 1),
    open(40), open(41), open(42), open(43),

    // Bar 12: every route lands on the second lantern.
    note(44, G, 1, { accent: 'lantern2' }),
    breath(45, 3, { lane: E }),

    // Bar 13–16: the guided cadence home.
    note(48, E, 2),
    note(50, G, 2),
    note(52, A, 2),
    note(54, G, 2),
    hold(56, E, 2),
    note(58, D, 2),
    note(60, C, 3, { accent: 'lantern3' }),
  ],
};

// ---------------------------------------------------------------------------------
// II — THE ANSWERING ROOTS
// ---------------------------------------------------------------------------------
const roots = {
  id: 'roots',
  title: 'The Answering Roots',
  numeral: 'II',
  instrument: 'root',
  octave: 3,
  startBeat: -6,
  endBeat: 67,
  startLane: E,
  endLane: C,
  events: [
    // Bar 1: listen — the Echo begins above. One pickup note answers it.
    note(3, G, 1),
    // Bar 2: a long tone wakes the first root.
    hold(4, A, 2.5, { accent: 'root1' }),
    breath(6.5, 0.5),
    note(7, G, 1),
    // Bar 3: a slow descent toward the water.
    note(8, E, 2),
    note(10, D, 2),
    // Bar 4: the Echo's lantern note rings down; answer it (optional crossing).
    breath(12, 2),
    { b: 14, k: 'resonance', id: 'crossing1', d: 2, echo: { mvt: 0, b: 12 }, fallback: [C, E] },

    // Bar 5: space, then a low reply in the lead's gap.
    breath(16, 3, { lane: D }),
    note(19, C, 1),
    // Bar 6: a short repeated figure wakes the second root.
    note(20, A, 1),
    note(21, A, 1),
    note(22, G, 1, { accent: 'root2' }),
    breath(23, 1),
    // Bar 7: a long tone sets the waterwheel turning.
    hold(24, C, 3, { accent: 'wheel' }),
    breath(27, 1),
    // Bar 8
    note(28, D, 2),
    open(30, 2),

    // Bar 9–10: hold beneath your own open phrase, answer in its rests.
    hold(32, A, 2.5),
    breath(34.5, 0.5),
    open(35, 1),
    note(36, E, 2),
    breath(38, 1),
    open(39, 1),
    // Bar 11: the Echo's own improvised note rings down; answer it (optional crossing).
    breath(40, 2),
    { b: 42, k: 'resonance', id: 'crossing2', d: 2, echo: { mvt: 0, b: 40 }, fallback: [D, G] },
    // Bar 12
    note(44, D, 2),
    breath(46, 2, { lane: E }),

    // Bar 13–16: the cadence, an octave and more beneath the lead.
    note(48, A, 2),
    note(50, E, 2),
    note(52, C, 2),
    breath(54, 2),
    hold(56, G, 3),
    note(59, D, 1),
    note(60, C, 3, { accent: 'lighthouseWheel' }),
  ],
};

// ---------------------------------------------------------------------------------
// III — LIGHTING THE LENS
// ---------------------------------------------------------------------------------
const lens = {
  id: 'lens',
  title: 'Lighting the Lens',
  numeral: 'III',
  instrument: 'glass',
  octave: 4,
  startBeat: -6,
  endBeat: 67,
  startLane: C,
  endLane: G,
  events: [
    // Bar 1–2: a rising phrase becomes the spiral stair.
    note(0, C, 2),
    note(2, E, 2),
    note(4, G, 2),
    note(6, A, 2),
    // Bar 3: a long tone lights the first half of the lens.
    hold(8, A, 3, { accent: 'lensHalf1' }),
    // Bar 4: rest and listen to both Echoes.
    breath(11, 5, { lane: E }),

    // Bar 5: two strong accents wake panels of glass.
    note(16, G, 2, { accent: 'panel1' }),
    note(18, E, 2, { accent: 'panel2' }),
    // Bar 6–7: skim the gallery where the gulls sleep, or climb into open sky.
    {
      b: 20, k: 'choice', id: 'gallery-or-sky',
      routes: {
        low: { discovery: 'gulls', notes: [note(20, C, 2), note(22, D, 2, { accent: 'gulls' }), hold(24, C, 3, { accent: 'lensHalf2' })] },
        high: { discovery: 'stars', notes: [note(20, A, 2), note(22, G, 2, { accent: 'stars' }), hold(24, A, 3, { accent: 'lensHalf2' })] },
      },
    },
    breath(27, 3, { lane: E }),

    // Bar 8–10: a slow open phrase, high above everything already built.
    open(30, 1), open(31, 1),
    open(32, 2), open(34, 2),
    open(36, 2),
    breath(38, 2, { lane: E }),
    // Bar 11
    note(40, E, 2),
    breath(42, 4),
    // Bar 12: Echo II's note rings up the tower; answer it (optional crossing).
    { b: 46, k: 'resonance', id: 'crossing3', d: 2, echo: { mvt: 1, b: 44 }, fallback: [A, E] },

    // Bar 13–14: the last climb, two more panels.
    note(48, E, 2),
    note(50, G, 2),
    note(52, A, 2, { accent: 'panel3' }),
    note(54, G, 2, { accent: 'panel4' }),
    // Bar 15–16: one long note spans the last gap to the Pulse chamber.
    hold(56, G, 6, { accent: 'lens' }),
  ],
};

export const LIGHTHOUSE = {
  id: 'lighthouse',
  title: 'Lighthouse of First Light',
  bpm: 96,
  beats: 64,
  harmony,
  movements: [causeway, roots, lens],
};
