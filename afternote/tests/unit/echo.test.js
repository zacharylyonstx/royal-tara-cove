import { describe, it, expect } from 'vitest';
import { makeRunner, playMovement, rng, M1 } from './helpers.js';
import { kiteStateAt, evalSegs } from '../../src/rules/Trajectory.js';

describe('an Echo is the recorded performance, nothing more', () => {
  it('echo is faithful: same pitches, same press beats, same silences, same path', () => {
    const r = rng(99);
    const runner = makeRunner(M1);
    const live = [];
    playMovement(runner, (slot, offers) => {
      if (r() < 0.25) return { press: null };
      return { press: offers[Math.floor(r() * offers.length)], offset: (r() - 0.5) * 0.4, holdFraction: 0.3 + r() };
    }, {
      step: 1 / 16,
      onStep: (beat, run) => {
        const k = run.kiteAt(beat);
        live.push([beat, k.x, k.y]);
      },
    });
    const rec = JSON.parse(JSON.stringify(runner.record()));

    // notes and silences
    const hits = runner.entries.filter((e) => e.outcome === 'hit');
    const misses = runner.entries.filter((e) => e.outcome === 'miss');
    expect(misses.length).toBeGreaterThan(0);
    expect(rec.entries.filter((e) => e.outcome === 'hit').map((e) => [e.b, e.p, e.pressBeat, e.held]))
      .toEqual(hits.map((e) => [e.b, e.p, e.pressBeat, e.held]));
    expect(rec.entries.filter((e) => e.outcome === 'miss').map((e) => e.b)).toEqual(misses.map((e) => e.b));
    for (const m of rec.entries.filter((e) => e.outcome === 'miss')) expect(m.p).toBeNull();

    // the runner the Echo replays is where the player was, at every sampled beat from the
    // moment each surface existed
    for (const [beat, x, y] of live) {
      const built = rec.segs.filter((s) => s.t0 <= beat);
      const then = evalSegs(built, rec.startLane, beat);
      const final = kiteStateAt(rec.pieces, rec.segs, rec.startLane, beat);
      expect(final.x).toBeCloseTo(then.x, 6);
      expect(final.y).toBeCloseTo(then.y, 6);
      expect(final.x).toBeCloseTo(x, 6);
      expect(final.y).toBeCloseTo(y, 6);
    }
  });

  it('rescue steps stay distinct in the record', () => {
    const runner = playMovement(makeRunner(M1), (s, o) => (s.b === 16 ? { press: null } : { press: o[0] }));
    const rec = runner.record();
    const rescue = rec.pieces.find((p) => p.kind === 'rescue' && p.slotB === 16);
    expect(rescue).toBeTruthy();
    expect(rescue.p).toBeUndefined();
    expect(rec.pieces.filter((p) => p.kind === 'stone' && p.slotB === 16)).toHaveLength(0);
  });
});
