// One movement being performed: inputs in, an honest record out.
//
// The runner owns every rule about what a press, a release or a silence *means*:
// whether it counts, what it builds, where Kite goes. It knows nothing about three.js,
// audio or the DOM. Views and sound are driven by the events it returns, and an Echo,
// a save file and the World Reveal are all just its record() read again.
//
// Time is always in beats.

import { RULES, KITE } from '../core/Constants.js';
import { complementOf } from '../music/Theory.js';
import { buildSlots, buildWindows } from './Slots.js';
import { evalSegs, kiteStateAt, laneXY } from './Trajectory.js';

const PENDING = 0, HIT = 1, MISSED = 2, RESCUED = 3; // RESCUED: a hold that can still be joined late

export class MovementRunner {
  /**
   * @param {object} chart   a movement from src/music/charts
   * @param {{bpm:number, echoes?:object[], rules?:object}} opts  echoes = records of earlier movements
   */
  constructor(chart, { bpm, echoes = [], rules = RULES } = {}) {
    this.chart = chart;
    /** A free chart (a sea crossing): every beat is open, and a beat left unplayed is simply a rest. */
    this.free = !!chart.free;
    this.bpm = bpm;
    this.rules = rules;
    this.echoes = echoes;

    const { slots, breaths } = buildSlots(chart);
    this.slots = slots;
    this.breaths = breaths;
    this.windows = buildWindows(slots, bpm, rules);
    this.state = slots.map(() => PENDING);
    this.breathDone = breaths.map(() => false);

    const last = slots[slots.length - 1];
    this.groundBeat = last.b + last.d;
    this.startLane = chart.startLane;
    this.lane = chart.startLane;

    this.choices = {};
    this.entries = [];
    this.pieces = [];
    this.segs = [];
    this.discoveries = [];
    this.activeHold = null;
    this.lateHold = null;
    this.cursor = 0;
    this.done = false;
    this.leapBeats = rules.LEAP_SEC * (bpm / 60);

    const first = slots[0];
    const firstBreath = breaths.find((br) => br.b < first.b);
    const startEnd = first.gate
      ? first.b + rules.GATE_LIP_BEATS
      : Math.min(this.windows[0].close, firstBreath ? firstBreath.b + 0.06 : Infinity);
    this.pieces.push({ kind: 'ground', b0: chart.startBeat - 6, b1: startEnd, lane: chart.startLane, slotB: null, role: 'start' });
  }

  // -------------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------------

  /** The next slot that has not been decided yet. */
  nextSlot() {
    return this.cursor < this.slots.length ? this.slots[this.cursor] : null;
  }

  /** If the next note is the gated first note, the beat the transport must wait at. */
  gateBeat() {
    const s = this.nextSlot();
    return s && s.gate ? s.b : null;
  }

  /** For a resonance slot: the pitch that answers the Echo's real note, or null. */
  resonantPitch(slot) {
    if (!slot || slot.src !== 'resonance') return null;
    const echo = this.echoes[slot.echo.mvt];
    if (!echo) return null;
    const e = echo.entries.find((x) => x.b === slot.echo.b && x.outcome === 'hit');
    return e ? complementOf(e.p) : null;
  }

  /** Pitches that will build ground at this slot, ascending. */
  offers(slot = this.nextSlot(), lane = this.lane) {
    if (!slot) return [];
    switch (slot.src) {
      case 'guided':
        return [slot.p];
      case 'choice':
        return Object.values(slot.routeP).sort((a, b) => a - b);
      case 'route': {
        const route = this.choices[slot.choiceId];
        return route ? [slot.routeP[route]] : [];
      }
      case 'open': {
        const out = [];
        for (let p = 0; p < 5; p++) if (Math.abs(p - lane) <= this.rules.REACH) out.push(p);
        return out;
      }
      case 'resonance': {
        const ring = this.resonantPitch(slot);
        if (ring === null) return [...slot.fallback].sort((a, b) => a - b);
        const alt = slot.fallback.find((p) => p !== ring);
        return [ring, alt].sort((a, b) => a - b);
      }
      default:
        return [];
    }
  }

  /** Undecided slots within `horizon` beats, with what each currently offers. */
  upcoming(beat, horizon) {
    const out = [];
    for (let i = this.cursor; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.b - beat > horizon) break;
      out.push({ slot, offers: this.offers(slot), ring: this.resonantPitch(slot), isNext: i === this.cursor, window: this.windows[i] });
    }
    return out;
  }

  /** Breaths that have not started yet, within `horizon` beats. */
  upcomingBreaths(beat, horizon) {
    return this.breaths.filter((br, i) => !this.breathDone[i] && br.b - beat <= horizon);
  }

  /** How long Kite's leap onto this slot's surface takes, in beats. */
  leapFor(slot) {
    const next = this.slots[slot.i + 1];
    const gap = slot.k === 'hold' ? slot.d : next ? next.b - slot.b : 2;
    return Math.max(this.rules.LEAP_MIN_BEATS, Math.min(this.leapBeats, this.rules.LEAP_GAP_FRACTION * gap));
  }

  kiteAt(beat) {
    return kiteStateAt(this.pieces, this.segs, this.startLane, beat);
  }

  record() {
    return JSON.parse(JSON.stringify({
      chartId: this.chart.id,
      bpm: this.bpm,
      startLane: this.startLane,
      groundBeat: this.groundBeat,
      choices: this.choices,
      entries: this.entries,
      pieces: this.pieces,
      segs: this.segs,
      discoveries: this.discoveries,
    }));
  }

  // -------------------------------------------------------------------------------
  // Structure helpers
  // -------------------------------------------------------------------------------

  /** The first breath that begins after this slot sounds and before the next slot. */
  _breathAfter(slot) {
    const from = slot.k === 'hold' ? slot.b + slot.d : slot.b;
    const next = this.slots[slot.i + 1];
    const until = next ? next.b : Infinity;
    return this.breaths.find((br) => br.b >= from - 1e-9 && br.b < until) ?? null;
  }

  /** How far the surface built at this slot must reach so Kite is never unsupported. */
  _coverEnd(slot) {
    const br = this._breathAfter(slot);
    if (br) return br.b + 0.06;
    const next = this.slots[slot.i + 1];
    if (next) return this.windows[next.i].close + 0.02;
    return this.groundBeat + 0.15;
  }

  _breathCoverEnd(index) {
    const br = this.breaths[index];
    const nextBreath = this.breaths[index + 1];
    const nextSlot = this.slots.find((s) => s.b >= br.b + br.d - 1e-9);
    const slotLimit = nextSlot ? this.windows[nextSlot.i].close + 0.02 : this.groundBeat + 0.15;
    if (nextBreath && (!nextSlot || nextBreath.b < nextSlot.b)) return nextBreath.b + 0.06;
    return slotLimit;
  }

  _accentOf(slot) {
    if (slot.routeAccent) return slot.routeAccent[this.choices[slot.choiceId]] ?? null;
    return slot.accent ?? null;
  }

  _entry(slot, fields) {
    const entry = {
      i: slot.i, b: slot.b, d: slot.d, id: slot.id ?? null, k: slot.k, src: slot.src,
      outcome: 'miss', p: null, pressBeat: null, q: null, held: 0, full: false, late: false,
      res: false, accent: null, route: slot.choiceId ? this.choices[slot.choiceId] ?? null : null,
      ...fields,
    };
    this.entries.push(entry);
    return entry;
  }

  // -------------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------------

  /**
   * A key went down at `beat`. Call advance(beat) first so deadlines up to here are settled.
   * @returns {{type:'hit'|'flourish', entry?:object, events:object[]}}
   */
  press(pitch, beat) {
    const events = [];
    const flourish = (reason) => {
      events.push({ type: 'flourish', p: pitch, reason });
      return { type: 'flourish', events };
    };
    if (this.done) return flourish('done');

    // Pressing the next note while still holding the previous one: legato hand-off.
    if (this.activeHold) {
      const h = this.activeHold;
      const end = h.slot.b + h.slot.d;
      if (pitch === h.entry.p || beat < end - this.rules.HOLD_RELEASE_TOL_BEATS) return flourish('holding');
      this._finishHold(beat, events);
    }

    let slot = this.nextSlot();
    let late = false;

    // A hold whose start was missed can still be joined until near its end.
    if (this.lateHold) {
      const lh = this.lateHold;
      const lw = this.windows[lh.slot.i];
      const nextOpen = slot ? this.windows[slot.i].open : Infinity;
      if (beat <= lw.lateClose && beat < nextOpen && this.offers(lh.slot).includes(pitch)) {
        slot = lh.slot;
        late = true;
      }
    }
    if (!slot) return flourish('nothing-ahead');

    const win = this.windows[slot.i];
    const gated = slot.gate;
    if (!late && !gated && beat < win.open) return flourish('early');
    if (!this.offers(slot).includes(pitch)) return flourish('unoffered');

    const pressBeat = gated ? slot.b : beat;
    const bps = this.bpm / 60;
    const offBy = Math.abs(pressBeat - slot.b);
    const q = late ? 'late' : offBy <= this.rules.PERFECT_SEC * bps ? 'perfect' : 'good';

    if (slot.src === 'choice') {
      const route = Object.keys(slot.routeP).find((key) => slot.routeP[key] === pitch);
      this.choices[slot.choiceId] = route;
      events.push({ type: 'choice', id: slot.choiceId, route, auto: false });
    }

    const ring = this.resonantPitch(slot);
    const res = ring !== null && ring === pitch;

    // Kite's leap from wherever they are right now onto the new surface.
    const from = evalSegs(this.segs, this.startLane, pressBeat);
    const to = laneXY(pitch);
    let t1 = pressBeat + this.leapFor(slot);
    if (slot.k === 'tap') {
      const br = this._breathAfter(slot);
      if (br) t1 = Math.max(pressBeat + this.rules.LEAP_MIN_BEATS, Math.min(t1, br.b - 0.02));
    }
    const arc = KITE.LEAP_ARC + KITE.LEAP_ARC_PER_Y * Math.abs(to.y - from.y) + KITE.LEAP_ARC_PER_X * Math.abs(to.x - from.x);
    const seg = { kind: 'leap', t0: pressBeat, t1, x0: from.x, y0: from.y, x1: to.x, y1: to.y, arc, slotB: slot.b };
    this.segs.push(seg);

    const b0 = t1 - this.rules.LAND_LEAD_BEATS;
    const entry = this._entry(slot, {
      outcome: 'hit', p: pitch, pressBeat, q, late, res, accent: this._accentOf(slot),
      route: slot.choiceId ? this.choices[slot.choiceId] : null,
    });

    let piece;
    if (slot.k === 'hold') {
      piece = { kind: 'bridge', b0, b1: slot.b + slot.d, fullEnd: this._coverEnd(slot), lane: pitch, p: pitch, slotB: slot.b, pressBeat, growing: true };
      this.pieces.push(piece);
      this.activeHold = { slot, entry, piece };
      if (late) {
        this.lateHold.rescue.b1 = t1 + 0.1;
        this.lateHold = null;
      }
      this.state[slot.i] = HIT;
      events.push({ type: 'hit', entry, slot, piece, seg });
      events.push({ type: 'hold:start', entry, slot, piece });
    } else {
      piece = {
        kind: 'stone', b0, b1: this._coverEnd(slot), lane: pitch, p: pitch, slotB: slot.b, pressBeat,
        q, src: slot.src, accent: entry.accent, res,
      };
      this.pieces.push(piece);
      this.state[slot.i] = HIT;
      events.push({ type: 'hit', entry, slot, piece, seg });
    }

    this.lane = pitch;
    if (!late) this.cursor = slot.i + 1;
    if (res) events.push({ type: 'resonance', entry, slot, echoMvt: slot.echo.mvt, echoBeat: slot.echo.b, piece });
    if (entry.accent) {
      events.push({ type: 'accent', tag: entry.accent, entry, piece });
      this._discover(entry.accent);
    }
    if (res) this._discover(slot.id);
    return { type: 'hit', entry, events };
  }

  /** A key came up at `beat`. Only matters for an active hold on that pitch. */
  release(pitch, beat) {
    const events = [];
    if (this.activeHold && this.activeHold.entry.p === pitch) this._finishHold(beat, events);
    return events;
  }

  /** Mark the active hold as granted (used when a pause interrupts it). */
  grantHold() {
    if (this.activeHold) this.activeHold.granted = true;
  }

  _finishHold(beat, events) {
    const h = this.activeHold;
    if (!h) return;
    const { slot, entry, piece } = h;
    const end = slot.b + slot.d;
    const full = h.granted || beat >= end - this.rules.HOLD_RELEASE_TOL_BEATS;
    piece.growing = false;
    if (full) {
      entry.full = true;
      entry.held = Math.max(0, end - entry.pressBeat);
      piece.b1 = this._coverEnd(slot);
    } else {
      entry.full = false;
      entry.held = Math.max(0, beat - entry.pressBeat);
      piece.b1 = Math.max(beat + 0.08, piece.b0 + this.rules.HOLD_MIN_BRIDGE_BEATS);
      const ledge = { kind: 'ledge', b0: piece.b1 - 0.1, b1: this._coverEnd(slot), lane: piece.lane, slotB: slot.b };
      this.pieces.push(ledge);
      events.push({ type: 'hold:broken', entry, slot, piece, ledge, beat });
    }
    this.activeHold = null;
    events.push({ type: 'hold:end', entry, slot, piece, full, beat: full ? Math.min(beat, end) : beat });
  }

  // -------------------------------------------------------------------------------
  // Time
  // -------------------------------------------------------------------------------

  /** Settle everything that is due by `beat`: deadlines, hold ends, breaths, the finish. */
  advance(beat) {
    const events = [];
    if (this.done) return events;
    const gate = this.gateBeat();
    if (gate !== null) beat = Math.min(beat, gate);

    for (let guard = 0; guard < 1000; guard++) {
      let best = null;
      const consider = (time, order, run) => {
        if (time > beat) return;
        if (!best || time < best.time || (time === best.time && order < best.order)) best = { time, order, run };
      };

      if (this.activeHold) {
        const h = this.activeHold;
        consider(h.slot.b + h.slot.d, 0, () => this._finishHold(h.slot.b + h.slot.d, events));
      }
      if (this.lateHold) {
        const lh = this.lateHold;
        consider(this.windows[lh.slot.i].lateClose, 1, () => {
          this.state[lh.slot.i] = MISSED;
          const entry = this._entry(lh.slot, {});
          this.lateHold = null;
          events.push({ type: 'miss', entry, slot: lh.slot, piece: lh.rescue });
        });
      }
      const slot = this.nextSlot();
      if (slot && !slot.gate) consider(this.windows[slot.i].close, 2, () => this._miss(slot, events));
      const bi = this.breathDone.indexOf(false);
      if (bi !== -1) consider(this.breaths[bi].b, 3, () => this._startBreath(bi, events));
      if (!slot && !this.activeHold && !this.lateHold) consider(this.groundBeat, 4, () => this._finish(events));

      if (!best) break;
      best.run();
      if (this.done) break;
    }
    return events;
  }

  _miss(slot, events) {
    const close = this.windows[slot.i].close;
    if (this.free && slot.src === 'open') {
      // Nothing was played here, and nothing was asked for: the light that carries Kite
      // simply runs on in the lane they are already in. It is not a miss and not a rescue.
      const xy = laneXY(this.lane);
      const rest = {
        kind: 'breath', style: 'current', rest: true, b0: close - 0.3, b1: this._coverEnd(slot), lane: this.lane,
        x0: xy.x, y0: xy.y, x1: xy.x, y1: xy.y, g0: close, g1: close, slotB: slot.b,
      };
      this.pieces.push(rest);
      this.cursor = slot.i + 1;
      this.state[slot.i] = MISSED;
      const entry = this._entry(slot, { outcome: 'rest' });
      events.push({ type: 'rest', entry, slot, piece: rest });
      return;
    }
    if (slot.src === 'choice' && !this.choices[slot.choiceId]) {
      // No decision: take the route whose first note is nearest to where Kite already is.
      const keys = Object.keys(slot.routeP);
      keys.sort((a, b) => Math.abs(slot.routeP[a] - this.lane) - Math.abs(slot.routeP[b] - this.lane));
      this.choices[slot.choiceId] = keys[0];
      events.push({ type: 'choice', id: slot.choiceId, route: keys[0], auto: true });
    }
    const rescue = { kind: 'rescue', b0: close - 0.3, b1: this._coverEnd(slot), lane: this.lane, slotB: slot.b };
    this.pieces.push(rescue);
    this.cursor = slot.i + 1;
    if (slot.k === 'hold') {
      this.state[slot.i] = RESCUED;
      this.lateHold = { slot, rescue };
      events.push({ type: 'rescue', slot, piece: rescue });
    } else {
      this.state[slot.i] = MISSED;
      const entry = this._entry(slot, {});
      events.push({ type: 'miss', entry, slot, piece: rescue });
    }
  }

  _startBreath(index, events) {
    const br = this.breaths[index];
    this.breathDone[index] = true;
    const from = evalSegs(this.segs, this.startLane, br.b);
    const target = br.lane !== null ? laneXY(br.lane) : { x: from.x, y: from.y };
    const moves = Math.abs(target.x - from.x) > 1e-6 || Math.abs(target.y - from.y) > 1e-6;
    const g0 = br.b;
    const g1 = br.b + Math.min(this.rules.GLIDE_BEATS, br.d * 0.85);
    if (moves) {
      this.segs.push({ kind: 'glide', t0: g0, t1: g1, x0: from.x, y0: from.y, x1: target.x, y1: target.y, arc: 0, slotB: null });
    }
    const piece = {
      kind: 'breath', b0: br.b - 0.06, b1: this._breathCoverEnd(index), style: br.style,
      lane: br.lane !== null ? br.lane : this.lane, x0: from.x, y0: from.y, x1: target.x, y1: target.y, g0, g1, slotB: null,
    };
    this.pieces.push(piece);
    if (br.lane !== null) this.lane = br.lane;
    events.push({ type: 'breath', breath: br, piece });
  }

  _finish(events) {
    const t0 = this.groundBeat;
    const from = evalSegs(this.segs, this.startLane, t0);
    const to = laneXY(this.chart.endLane);
    const moves = Math.abs(to.x - from.x) > 1e-6 || Math.abs(to.y - from.y) > 1e-6;
    let b0 = t0 - 0.12;
    if (moves) {
      const t1 = t0 + 0.7;
      const arc = KITE.LEAP_ARC * 0.8 + KITE.LEAP_ARC_PER_Y * Math.abs(to.y - from.y);
      this.segs.push({ kind: 'step', t0, t1, x0: from.x, y0: from.y, x1: to.x, y1: to.y, arc, slotB: null });
      b0 = t1 - this.rules.LAND_LEAD_BEATS;
    }
    this.pieces.push({ kind: 'ground', b0, b1: this.chart.endBeat + 12, lane: this.chart.endLane, slotB: null, role: 'end' });
    this.lane = this.chart.endLane;
    this.done = true;
    events.push({ type: 'complete' });
  }

  _discover(tag) {
    if (tag && !this.discoveries.includes(tag)) this.discoveries.push(tag);
  }
}
