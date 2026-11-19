import { MovementRunner } from '../../src/rules/MovementRunner.js';
import { LIGHTHOUSE } from '../../src/music/charts/lighthouse.js';

export const M1 = LIGHTHOUSE.movements[0];
export const M2 = LIGHTHOUSE.movements[1];
export const M3 = LIGHTHOUSE.movements[2];

export function makeRunner(chart = M1, opts = {}) {
  return new MovementRunner(chart, { bpm: 96, ...opts });
}

/** Deterministic PRNG so "random" performances are reproducible. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plays a whole movement with a scripted policy.
 * policy(slot, offers, runner) -> { press: pitch|null, offset: beats, holdFraction: 0..1.2 }
 * Returns the finished runner. Steps time in small increments like the real game.
 */
export function playMovement(runner, policy, { step = 1 / 32, onStep } = {}) {
  const chart = runner.chart;
  let beat = chart.startBeat;
  const plans = new Map();
  let releaseAt = null;
  let heldPitch = null;
  let guard = 0;
  while (!runner.done && guard++ < 200000) {
    // gate: the transport would hold here until the press arrives
    const gate = runner.gateBeat();
    if (gate !== null && beat >= gate) {
      beat = gate;
      const slot = runner.nextSlot();
      const offers = runner.offers(slot);
      runner.press(offers[0], beat);
      continue;
    }
    const slot = runner.nextSlot();
    if (slot && !plans.has(slot.i)) {
      const offers = runner.offers(slot);
      plans.set(slot.i, policy(slot, offers, runner) ?? { press: null });
    }
    if (releaseAt !== null && beat >= releaseAt) {
      runner.advance(releaseAt);
      runner.release(heldPitch, releaseAt);
      releaseAt = null;
      heldPitch = null;
    }
    if (slot) {
      const plan = plans.get(slot.i);
      if (plan.press !== null && plan.press !== undefined && !plan.done) {
        const at = slot.b + (plan.offset ?? 0);
        if (beat >= at) {
          plan.done = true;
          runner.advance(at);
          const res = runner.press(plan.press, at);
          if (res.type === 'hit' && slot.k === 'hold') {
            heldPitch = plan.press;
            releaseAt = at + slot.d * (plan.holdFraction ?? 1.05);
          }
        }
      }
    }
    runner.advance(beat);
    if (onStep) onStep(beat, runner);
    beat += step;
  }
  return runner;
}

export const perfect = (slot, offers) => ({ press: offers[0], offset: 0 });
export const highest = (slot, offers) => ({ press: offers[offers.length - 1], offset: 0 });
export const silent = () => ({ press: null });
