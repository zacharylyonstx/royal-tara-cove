import { describe, it, expect } from 'vitest';
import { makeRunner, playMovement, perfect, highest, silent, M1, M2, M3 } from './helpers.js';
import { complementOf } from '../../src/music/Theory.js';

const C = 0, D = 1, E = 2, G = 3, A = 4;

/** Advance through the gate and return the runner sitting just after the prelude note. */
function afterGate() {
  const r = makeRunner();
  const gate = r.gateBeat();
  r.press(C, gate);
  return r;
}

describe('MovementRunner — the four input outcomes', () => {
  it('gate waits: the first note never times out', () => {
    const r = makeRunner();
    const gate = r.gateBeat();
    expect(gate).not.toBeNull();
    const events = r.advance(gate + 500);
    expect(events.filter((e) => e.type === 'miss')).toHaveLength(0);
    expect(r.entries).toHaveLength(0);
    expect(r.gateBeat()).toBe(gate);
    const res = r.press(C, gate + 500);
    expect(res.type).toBe('hit');
    expect(res.entry.pressBeat).toBe(gate);
    expect(r.gateBeat()).toBeNull();
  });

  it('guided hit: records real timing and makes a stone on that lane', () => {
    const r = afterGate();
    r.advance(-0.2);
    const res = r.press(D, 0.1);
    expect(res.type).toBe('hit');
    expect(res.entry.outcome).toBe('hit');
    expect(res.entry.p).toBe(D);
    expect(res.entry.pressBeat).toBeCloseTo(0.1, 6);
    const stone = r.pieces.at(-1);
    expect(stone.kind).toBe('stone');
    expect(stone.lane).toBe(D);
    expect(stone.b0).toBeGreaterThan(0.1);
    expect(r.lane).toBe(D);
  });

  it('wrong pitch is a flourish: no terrain, slot stays open', () => {
    const r = afterGate();
    r.advance(0);
    const before = r.pieces.length;
    const res = r.press(A, 0);
    expect(res.type).toBe('flourish');
    expect(r.pieces.length).toBe(before);
    expect(r.nextSlot().b).toBe(0);
    expect(r.press(D, 0.05).type).toBe('hit');
  });

  it('pressing far too early is a flourish, not a hit', () => {
    const r = afterGate();
    r.advance(-3);
    expect(r.press(D, -3).type).toBe('flourish');
    expect(r.nextSlot().b).toBe(0);
  });

  it('miss creates rescue: note absent, pale piece on the current lane', () => {
    const r = afterGate();
    const laneBefore = r.lane;
    const events = r.advance(1.2);
    const miss = events.find((e) => e.type === 'miss');
    expect(miss).toBeTruthy();
    const entry = r.entries.at(-1);
    expect(entry.outcome).toBe('miss');
    expect(entry.p).toBeNull();
    const rescue = r.pieces.at(-1);
    expect(rescue.kind).toBe('rescue');
    expect(rescue.lane).toBe(laneBefore);
    expect(r.lane).toBe(laneBefore);
  });

  it('mash: every key at once yields at most one hit per slot', () => {
    const r = afterGate();
    r.advance(0);
    const results = [C, D, E, G, A, D, D].map((p) => r.press(p, 0.01));
    expect(results.filter((x) => x.type === 'hit')).toHaveLength(1);
    const stones = r.pieces.filter((p) => p.kind === 'stone');
    expect(stones).toHaveLength(2); // prelude + this one
  });
});

describe('MovementRunner — choice, open, hold', () => {
  it('choice routes rejoin: route changes the melody, landmark slot is shared', () => {
    const low = playMovement(makeRunner(), perfect);
    const high = playMovement(makeRunner(), highest);
    expect(low.choices['tide-or-arch']).toBe('low');
    expect(high.choices['tide-or-arch']).toBe('high');
    const pitchesAt = (r, beats) => beats.map((b) => r.entries.find((e) => e.b === b).p);
    expect(pitchesAt(low, [4, 6, 8])).not.toEqual(pitchesAt(high, [4, 6, 8]));
    // both hit the lantern at beat 12 on the same pitch
    expect(low.entries.find((e) => e.b === 12).p).toBe(high.entries.find((e) => e.b === 12).p);
    expect(low.entries.find((e) => e.b === 12).outcome).toBe('hit');
    expect(low.done && high.done).toBe(true);
  });

  it('a missed choice still resolves to a route and the movement completes', () => {
    const r = playMovement(makeRunner(), (slot, offers) => (slot.src === 'choice' ? { press: null } : { press: offers[0] }));
    expect(['low', 'high']).toContain(r.choices['tide-or-arch']);
    expect(r.done).toBe(true);
  });

  it('open offers adapt: only pitches within reach of where Kite stands', () => {
    const r = makeRunner();
    let checked = 0;
    playMovement(r, (slot, offers, run) => {
      if (slot.src === 'open') {
        checked++;
        for (const p of offers) expect(Math.abs(p - run.lane)).toBeLessThanOrEqual(2);
        expect(offers.length).toBeGreaterThanOrEqual(3);
        return { press: offers[offers.length - 1], offset: 0 };
      }
      return { press: offers[0], offset: 0 };
    });
    expect(checked).toBeGreaterThan(5);
  });

  it('an unreachable pitch on an open beat is only a flourish', () => {
    const r = makeRunner();
    let tested = false;
    playMovement(r, (slot, offers, run) => {
      if (slot.src === 'open' && !tested) {
        // settle time up to the beat first (a breath may carry Kite to another lane), then ask again
        run.advance(slot.b);
        const now = run.offers(slot);
        const far = [0, 1, 2, 3, 4].find((p) => !now.includes(p));
        if (far !== undefined) {
          expect(Math.abs(far - run.lane)).toBeGreaterThan(2);
          expect(run.press(far, slot.b).type).toBe('flourish');
          expect(run.nextSlot()).toBe(slot);
          tested = true;
        }
        return { press: now[0], offset: 0.02 };
      }
      return { press: offers[0], offset: 0.02 };
    });
    expect(tested).toBe(true);
  });

  it('hold outcomes: full, early release, and over-hold', () => {
    // full hold
    const full = playMovement(makeRunner(), (s, o) => ({ press: o[0], offset: 0, holdFraction: 1.0 }));
    const fullEntry = full.entries.find((e) => e.b === 20);
    expect(fullEntry.k).toBe('hold');
    expect(fullEntry.full).toBe(true);
    expect(full.pieces.some((p) => p.kind === 'ledge')).toBe(false);

    // early release at 40%
    const early = playMovement(makeRunner(), (s, o) => ({ press: o[0], offset: 0, holdFraction: 0.4 }));
    const earlyEntry = early.entries.find((e) => e.b === 20);
    expect(earlyEntry.outcome).toBe('hit');
    expect(earlyEntry.full).toBe(false);
    expect(earlyEntry.held).toBeGreaterThan(1.0);
    expect(earlyEntry.held).toBeLessThan(1.5);
    const bridge = early.pieces.find((p) => p.kind === 'bridge' && p.slotB === 20);
    const ledge = early.pieces.find((p) => p.kind === 'ledge' && p.slotB === 20);
    expect(ledge).toBeTruthy();
    expect(bridge.b1).toBeLessThan(22);
    expect(ledge.b1).toBeGreaterThanOrEqual(23);

    // over-hold: never releases; bridge still ends at its destination
    const over = playMovement(makeRunner(), (s, o) => ({ press: o[0], offset: 0, holdFraction: 50 }));
    const overEntry = over.entries.find((e) => e.b === 20);
    expect(overEntry.full).toBe(true);
    expect(overEntry.held).toBeLessThanOrEqual(3.01);
    const overBridge = over.pieces.find((p) => p.kind === 'bridge' && p.slotB === 20);
    expect(overBridge.b1).toBeLessThan(24.6);
    expect(over.done).toBe(true);
  });

  it('a hold that is never pressed is a miss with a rescue surface', () => {
    const r = playMovement(makeRunner(), (s, o) => (s.k === 'hold' ? { press: null } : { press: o[0] }));
    const e = r.entries.find((x) => x.b === 20);
    expect(e.outcome).toBe('miss');
    expect(r.pieces.some((p) => p.kind === 'rescue' && p.slotB === 20)).toBe(true);
    expect(r.done).toBe(true);
  });

  it('a completely silent player still reaches the end, with every note absent', () => {
    const r = playMovement(makeRunner(), silent);
    expect(r.done).toBe(true);
    const played = r.entries.filter((e) => e.outcome === 'hit');
    expect(played).toHaveLength(1); // only the gated first note, which the helper must press
    expect(r.entries.filter((e) => e.outcome === 'miss').length).toBeGreaterThan(25);
  });
});

describe('MovementRunner — resonance crossings', () => {
  it('resonance: offers the complement of what the Echo actually played', () => {
    const first = playMovement(makeRunner(M1), perfect).record();
    const echoPitch = first.entries.find((e) => e.b === 12).p;
    const r = makeRunner(M2, { echoes: [first] });
    let seen = null;
    playMovement(r, (slot, offers, run) => {
      if (slot.src === 'resonance' && slot.id === 'crossing1') {
        seen = { offers, ring: run.resonantPitch(slot) };
        return { press: run.resonantPitch(slot), offset: 0 };
      }
      return { press: offers[0], offset: 0 };
    });
    expect(seen.ring).toBe(complementOf(echoPitch));
    expect(seen.offers).toContain(seen.ring);
    expect(seen.offers.length).toBe(2);
    expect(r.entries.find((e) => e.b === 14).res).toBe(true);
  });

  it('resonance follows a personal open-phrase note', () => {
    const first = playMovement(makeRunner(M1), highest).record();
    const echoPitch = first.entries.find((e) => e.b === 40).p;
    const r = makeRunner(M2, { echoes: [first] });
    const slot = r.slots.find((s) => s.id === 'crossing2');
    expect(r.resonantPitch(slot)).toBe(complementOf(echoPitch));
  });

  it('resonance fallback completes: a missed Echo note removes the crossing, not the path', () => {
    const first = playMovement(makeRunner(M1), (s, o) => (s.b === 12 ? { press: null } : { press: o[0] })).record();
    expect(first.entries.find((e) => e.b === 12).outcome).toBe('miss');
    const r = makeRunner(M2, { echoes: [first] });
    const slot = r.slots.find((s) => s.id === 'crossing1');
    expect(r.resonantPitch(slot)).toBeNull();
    playMovement(r, perfect);
    expect(r.done).toBe(true);
    expect(r.entries.find((e) => e.b === 14).outcome).toBe('hit');
    expect(r.entries.find((e) => e.b === 14).res).toBe(false);
  });

  it('movement three completes and can resonate with movement two', () => {
    const a = playMovement(makeRunner(M1), perfect).record();
    const b = playMovement(makeRunner(M2, { echoes: [a] }), perfect).record();
    const r = makeRunner(M3, { echoes: [a, b] });
    playMovement(r, (slot, offers, run) => ({ press: slot.src === 'resonance' ? run.resonantPitch(slot) ?? offers[0] : offers[0], offset: 0 }));
    expect(r.done).toBe(true);
    expect(r.entries.find((e) => e.id === 'crossing3').res).toBe(true);
  });
});

describe('MovementRunner — record', () => {
  it('record is plain serializable data', () => {
    const r = playMovement(makeRunner(), perfect);
    const rec = r.record();
    const round = JSON.parse(JSON.stringify(rec));
    expect(round).toEqual(rec);
    expect(rec.chartId).toBe(M1.id);
    expect(rec.entries.length).toBe(r.slots.length);
  });

  it('timing quality reflects distance from the beat but both build the same stone', () => {
    const r = makeRunner();
    r.press(0, r.gateBeat());
    r.advance(0);
    const a = r.press(1, 0.02);
    r.advance(1.9);
    const b = r.press(2, 2.3);
    expect(a.entry.q).toBe('perfect');
    expect(b.entry.q).toBe('good');
    expect(r.pieces.filter((p) => p.kind === 'stone').length).toBe(3);
  });
});
