// Chart -> a flat, ordered list of decision "slots" plus the breaths between them.
//
// A slot is one moment where the player may place a note. Its *rhythm* (beat, length,
// tap-or-hold) is fixed by the chart; which pitch lands there can depend on the player:
//   guided    one authored pitch
//   choice    first note of a fork; choosing a pitch picks the route
//   route     later notes of a fork; pitch comes from the chosen route
//   open      any pitch within reach
//   resonance like a two-way choice, where one option answers an Echo's real note
//
// Pure: no three, no DOM, no audio.

import { RULES } from '../core/Constants.js';

export function buildSlots(chart) {
  const slots = [];
  const breaths = [];

  for (const ev of chart.events) {
    if (ev.k === 'breath') {
      breaths.push({ b: ev.b, d: ev.d, lane: ev.lane ?? null, style: ev.style ?? 'current' });
    } else if (ev.k === 'note' || ev.k === 'hold') {
      slots.push({
        b: ev.b, d: ev.d, k: ev.k === 'hold' ? 'hold' : 'tap', src: 'guided',
        p: ev.p, accent: ev.accent ?? null, gate: !!ev.gate, id: ev.id ?? null,
      });
    } else if (ev.k === 'open') {
      slots.push({ b: ev.b, d: ev.d, k: 'tap', src: 'open', p: null, accent: null, gate: !!ev.gate, id: null });
    } else if (ev.k === 'resonance') {
      slots.push({
        b: ev.b, d: ev.d, k: 'tap', src: 'resonance', p: null, accent: null, gate: false,
        id: ev.id, echo: { ...ev.echo }, fallback: [...ev.fallback],
      });
    } else if (ev.k === 'choice') {
      const keys = Object.keys(ev.routes);
      const len = ev.routes[keys[0]].notes.length;
      for (let j = 0; j < len; j++) {
        const ref = ev.routes[keys[0]].notes[j];
        const routeP = {};
        const routeAccent = {};
        for (const key of keys) {
          const n = ev.routes[key].notes[j];
          if (n.b !== ref.b || n.d !== ref.d || n.k !== ref.k) {
            throw new Error(`choice ${ev.id}: routes must share one rhythm (note ${j})`);
          }
          routeP[key] = n.p;
          routeAccent[key] = n.accent ?? null;
        }
        slots.push({
          b: ref.b, d: ref.d, k: ref.k === 'hold' ? 'hold' : 'tap',
          src: j === 0 ? 'choice' : 'route', p: null, accent: null, gate: false, id: null,
          choiceId: ev.id, routeP, routeAccent,
        });
      }
    } else {
      throw new Error(`unknown chart event kind: ${ev.k}`);
    }
  }

  slots.sort((a, b) => a.b - b.b);
  breaths.sort((a, b) => a.b - b.b);
  slots.forEach((s, i) => { s.i = i; });
  return { slots, breaths };
}

/** Timing windows in beats for every slot, clamped so neighbours never overlap. */
export function buildWindows(slots, bpm, rules = RULES) {
  const bps = bpm / 60;
  const early = rules.EARLY_SEC * bps;
  const late = rules.LATE_SEC * bps;
  return slots.map((s, i) => {
    const prev = slots[i - 1];
    const next = slots[i + 1];
    const prevEnd = prev ? (prev.k === 'hold' ? prev.b + prev.d : prev.b) : -Infinity;
    const gapPrev = s.b - prevEnd;
    let e = Math.min(early, rules.NEIGHBOR_FRACTION * (prev ? s.b - prev.b : Infinity));
    if (prev && prev.k === 'hold') e = Math.min(e, Math.max(gapPrev, 0) + rules.HOLD_RELEASE_TOL_BEATS);
    const span = s.k === 'hold' ? s.d : next ? next.b - s.b : Infinity;
    const l = Math.min(late, rules.NEIGHBOR_FRACTION * span);
    return {
      open: s.gate ? -Infinity : s.b - e,
      close: s.gate ? Infinity : s.b + l,
      // a hold may still be joined after its window closes, until near its end
      lateClose: s.k === 'hold' ? s.b + s.d - rules.HOLD_LATE_START_TAIL_BEATS : null,
    };
  });
}
