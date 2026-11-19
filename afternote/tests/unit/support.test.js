import { describe, it, expect } from 'vitest';
import { makeRunner, playMovement, rng, M1, M2, M3 } from './helpers.js';
import { supportAt } from '../../src/rules/Trajectory.js';

/** A messy human: sometimes early, sometimes late, sometimes absent, lets go of holds at random. */
function messy(seed) {
  const r = rng(seed);
  return (slot, offers) => {
    const roll = r();
    if (roll < 0.22) return { press: null };
    const pitch = offers[Math.floor(r() * offers.length)];
    return { press: pitch, offset: (r() - 0.45) * 0.6, holdFraction: 0.1 + r() * 1.3 };
  };
}

function assertAlwaysSupported(runner) {
  const chart = runner.chart;
  const problems = [];
  playMovement(runner, runner.__policy, {
    step: 1 / 24,
    onStep: (beat, run) => {
      if (beat < chart.startBeat + 0.01 || beat > chart.endBeat) return;
      const k = run.kiteAt(beat);
      if (k.air) return;
      const s = supportAt(run.pieces, run.segs, run.startLane, beat);
      if (!s) problems.push(`beat ${beat.toFixed(3)} lane(${k.x.toFixed(2)},${k.y.toFixed(2)}) unsupported`);
    },
  });
  return problems;
}

describe('Kite is never left without ground', () => {
  for (const [name, chart] of [['causeway', M1], ['roots', M2], ['lens', M3]]) {
    it(`always supported — ${name}, 40 messy performances`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const runner = makeRunner(chart);
        runner.__policy = messy(seed * 7919 + chart.id.length);
        const problems = assertAlwaysSupported(runner);
        expect(problems, `seed ${seed}: ${problems.slice(0, 3).join('; ')}`).toHaveLength(0);
        expect(runner.done).toBe(true);
      }
    });
  }

  it('always supported — perfect, silent and always-early performances', () => {
    const policies = [
      (s, o) => ({ press: o[0], offset: 0 }),
      () => ({ press: null }),
      (s, o) => ({ press: o[o.length - 1], offset: -0.3, holdFraction: 0.2 }),
      (s, o) => ({ press: o[0], offset: 0.4, holdFraction: 3 }),
    ];
    for (const chart of [M1, M2, M3]) {
      for (const p of policies) {
        const runner = makeRunner(chart);
        runner.__policy = p;
        expect(assertAlwaysSupported(runner)).toHaveLength(0);
      }
    }
  });

  it('every landing has a surface under it', () => {
    const runner = makeRunner(M1);
    playMovement(runner, messy(4242));
    for (const seg of runner.segs.filter((s) => s.kind === 'leap')) {
      const s = supportAt(runner.pieces, runner.segs, runner.startLane, seg.t1 + 0.001);
      expect(s, `landing at ${seg.t1}`).toBeTruthy();
    }
  });
});
