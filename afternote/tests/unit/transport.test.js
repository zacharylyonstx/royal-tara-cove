import { describe, it, expect } from 'vitest';
import { Transport } from '../../src/music/Transport.js';
import { ManualClock } from '../../src/core/Clock.js';
import { makeRunner, playMovement, perfect, M1 } from './helpers.js';
import { MovementRunner } from '../../src/rules/MovementRunner.js';

describe('Transport', () => {
  it('counts beats at the tempo and freezes when stopped', () => {
    const clock = new ManualClock();
    const t = new Transport(clock);
    t.bpm = 120;
    t.start(-4);
    clock.advance(1);
    expect(t.beat()).toBeCloseTo(-2, 9);
    t.stop();
    clock.advance(5);
    expect(t.beat()).toBeCloseTo(-2, 9);
    t.start();
    clock.advance(0.5);
    expect(t.beat()).toBeCloseTo(-1, 9);
  });

  it('timeOfBeat is the inverse of the schedule beat', () => {
    const clock = new ManualClock();
    const t = new Transport(clock);
    t.start(0);
    clock.advance(2.5);
    expect(t.timeOfBeat(t.scheduleBeat())).toBeCloseTo(clock.now(), 9);
  });

  it('perceived beat lags the scheduled beat by the output latency', () => {
    const clock = new ManualClock();
    const t = new Transport(clock);
    t.bpm = 60;
    t.latency = 0.05;
    t.start(0);
    clock.advance(1);
    expect(t.scheduleBeat()).toBeCloseTo(1, 9);
    expect(t.beat()).toBeCloseTo(0.95, 9);
  });

  it('pace: changing tempo mid-flight keeps the beat continuous', () => {
    const clock = new ManualClock();
    const t = new Transport(clock);
    t.bpm = 96;
    t.start(0);
    clock.advance(1.25);
    const before = t.beat();
    t.setBpm(96 * 0.8);
    expect(t.beat()).toBeCloseTo(before, 9);
    clock.advance(1);
    expect(t.beat()).toBeCloseTo(before + (96 * 0.8) / 60, 9);
  });

  it('pace: a slower tempo does not change which beats are recorded', () => {
    const fast = playMovement(makeRunner(M1), perfect).record();
    const slow = playMovement(new MovementRunner(M1, { bpm: 96 * 0.8 }), perfect).record();
    expect(slow.entries.map((e) => [e.b, e.p, e.pressBeat])).toEqual(fast.entries.map((e) => [e.b, e.p, e.pressBeat]));
  });
});
