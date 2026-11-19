import { describe, it, expect } from 'vitest';
import { MovementRunner } from '../../src/rules/MovementRunner.js';
import { supportAt, evalSegs } from '../../src/rules/Trajectory.js';
import { CROSSING } from '../../src/core/Constants.js';
import {
  EDGES, EDGE, PLACES, PLACE, SOUNDS, MOODS, HOME, crossingChart, crossingRules, scoreOf, performScore, tidyRests,
  emptySea, sanitizeSea, unlocked, edgesOf, otherEnd,
} from '../../src/music/sea.js';

const BPM = 76.8;
const edge = EDGE['lighthouse~chimes'];
const chart = () => crossingChart({ edge, from: 'lighthouse', sound: 'bell' });
const runner = () => new MovementRunner(chart(), { bpm: BPM, rules: crossingRules() });

/** Step a runner through time, pressing where `plan(beat)` says. Returns every event. */
function play(r, plan, until = r.chart.endBeat + 2, step = 0.05) {
  const events = [];
  for (let b = r.chart.startBeat; b <= until; b += step) {
    events.push(...r.advance(b));
    const p = plan(b);
    if (p !== null && p !== undefined) events.push(...r.press(p, b).events);
  }
  return events;
}

describe('the sea chart', () => {
  it('joins every place, and every gift is a real sound and mood', () => {
    expect(PLACES[0].id).toBe(HOME);
    for (const p of PLACES) {
      expect(edgesOf(p.id).length).toBeGreaterThan(0);
      if (p.gift) {
        expect(SOUNDS[p.gift.sound]).toBeTruthy();
        expect(MOODS[p.gift.mood]).toBeTruthy();
      }
    }
    for (const e of EDGES) {
      expect(PLACE[e.a] && PLACE[e.b]).toBeTruthy();
      expect(e.bars % 4).toBe(0);
      expect(otherEnd(e, e.a)).toBe(e.b);
    }
    // every place can be reached from home
    const seen = new Set([HOME]);
    for (let k = 0; k < PLACES.length; k++) for (const e of EDGES) {
      if (seen.has(e.a)) seen.add(e.b);
      if (seen.has(e.b)) seen.add(e.a);
    }
    expect(seen.size).toBe(PLACES.length);
  });

  it('gives every sound and mood exactly once', () => {
    const { sounds, moods } = unlocked(PLACES.map((p) => p.id));
    expect(sounds.sort()).toEqual(Object.keys(SOUNDS).sort());
    expect(moods.sort()).toEqual(Object.keys(MOODS).sort());
    expect(unlocked([HOME]).sounds).toEqual(['bell', 'root', 'glass']);
  });
});

describe('a crossing', () => {
  it('waits at its first beat, and any of the five keys begins it', () => {
    for (let p = 0; p < 5; p++) {
      const r = runner();
      expect(r.advance(40)).toEqual([]);
      expect(r.gateBeat()).toBe(0);
      expect(r.offers()).toEqual([0, 1, 2, 3, 4]);
      const res = r.press(p, r.gateBeat());
      expect(res.type).toBe('hit');
      expect(res.entry.p).toBe(p);
    }
  });

  it('builds a stone for every key, wherever Kite is standing', () => {
    const r = runner();
    r.press(0, 0);
    r.advance(0.5);
    expect(r.press(4, 0.5).type).toBe('hit'); // the far lane is still in reach
    r.advance(1.0);
    expect(r.press(0, 1.0).type).toBe('hit');
  });

  it('never misses: a beat left alone is a rest, with light under Kite', () => {
    const r = runner();
    const events = play(r, (b) => (Math.abs(b) < 0.02 ? 2 : null));
    expect(events.filter((e) => e.type === 'miss' || e.type === 'rescue')).toEqual([]);
    expect(events.some((e) => e.type === 'complete')).toBe(true);
    const rec = r.record();
    expect(rec.entries.filter((e) => e.outcome === 'miss')).toEqual([]);
    expect(rec.entries.filter((e) => e.outcome === 'hit').length).toBe(1);
    expect(rec.pieces.filter((p) => p.kind === 'rescue')).toEqual([]);
  });

  it('keeps Kite supported at every moment, however it is played', () => {
    const plans = [
      () => null,
      (b) => (Math.abs(b - Math.round(b * 2) / 2) < 0.02 ? Math.floor(Math.abs(b * 7)) % 5 : null), // every half-beat
      (b) => (Math.abs(b - Math.round(b)) < 0.02 && Math.round(b) % 3 === 0 ? Math.round(b) % 5 : null), // sparse
      (b) => (Math.abs((b * 4) % 1) < 0.2 ? Math.floor(Math.abs(b * 13)) % 5 : null), // mashing
    ];
    for (const plan of plans) {
      const r = runner();
      const first = (b) => (b >= 0 && r.gateBeat() !== null ? 2 : plan(b));
      play(r, first);
      const rec = r.record();
      for (let b = rec.entries[0].b; b <= r.chart.endBeat; b += 0.03) {
        const k = evalSegs(rec.segs, rec.startLane, b);
        if (k.air) continue;
        expect(supportAt(rec.pieces, rec.segs, rec.startLane, b), `unsupported at beat ${b.toFixed(2)}`).not.toBeNull();
      }
    }
  });

  it('takes at most one stone per half-beat; an extra press only shimmers', () => {
    const r = runner();
    r.press(2, 0);
    r.advance(0.05);
    expect(r.press(3, 0.05).type).toBe('flourish');
    r.advance(0.3);
    expect(r.press(3, 0.3).type).toBe('hit'); // the next half-beat has opened
  });
});

describe('a kept bridge', () => {
  it('is its score, played exactly on the beat', () => {
    const r = runner();
    play(r, (b) => (Math.abs(b - Math.round(b)) < 0.03 ? Math.round(Math.abs(b)) % 5 : null));
    const score = scoreOf(r.record());
    expect(score.length).toBeGreaterThan(10);
    const kept = performScore(MovementRunner, chart(), BPM, score);
    expect(scoreOf(kept)).toEqual(score);
    for (const e of kept.entries.filter((x) => x.outcome === 'hit')) expect(e.pressBeat).toBe(e.b);
    // and performing it again gives the very same record
    expect(performScore(MovementRunner, chart(), BPM, score)).toEqual(kept);
  });

  it('survives a change of timing rules', () => {
    const score = [[0, 2], [3, 4], [4, 0], [9, 1], [63, 3]];
    const tight = performScore(MovementRunner, chart(), BPM, score, { ...crossingRules(), EARLY_SEC: 0.05, LATE_SEC: 0.05 });
    expect(scoreOf(tight)).toEqual(score);
  });

  it('draws the light between stones as single runs, and still holds Kite up', () => {
    const kept = performScore(MovementRunner, chart(), BPM, [[0, 2], [20, 4]]);
    const rests = kept.pieces.filter((p) => p.rest);
    expect(rests.length).toBeLessThanOrEqual(3);
    for (let b = 0; b <= chart().endBeat; b += 0.05) {
      if (evalSegs(kept.segs, kept.startLane, b).air) continue;
      expect(supportAt(kept.pieces, kept.segs, kept.startLane, b)).not.toBeNull();
    }
    expect(tidyRests(kept).pieces.length).toBe(kept.pieces.length);
  });
});

describe('the saved sea', () => {
  it('starts at home with nothing built', () => {
    expect(emptySea()).toEqual({ at: HOME, awake: [HOME], bridges: {}, seen: {} });
    expect(sanitizeSea(null)).toEqual(emptySea());
    expect(sanitizeSea('nonsense')).toEqual(emptySea());
  });

  it('keeps what is sound and drops what is not', () => {
    const slots = (edge.bars * 4) / CROSSING.GRID;
    const sea = sanitizeSea({
      at: 'chimes',
      awake: ['lighthouse', 'chimes', 'atlantis'],
      bridges: {
        'lighthouse~chimes': {
          from: 'lighthouse', mood: 'lullaby', bpm: 70,
          layers: [
            { sound: 'bell', score: [[0, 2], [1, 9], [1, 3], [slots, 0], [5, 1], [5, 2], ['x', 1]] },
            { sound: 'kazoo', score: [[2, 0]] },
            null,
            { sound: 'root', score: [[4, 4]] },
            { sound: 'glass', score: [[6, 1]] },
          ],
        },
        'nowhere~chimes': { from: 'chimes', layers: [{ sound: 'bell', score: [[0, 0]] }] },
        'harp~garden': { from: 'stacks', layers: [{ sound: 'bell', score: [[0, 0]] }] },
      },
    });
    expect(sea.at).toBe('chimes');
    expect(sea.awake).toEqual(['lighthouse', 'chimes']);
    expect(Object.keys(sea.bridges)).toEqual(['lighthouse~chimes']);
    const b = sea.bridges['lighthouse~chimes'];
    expect(b.layers.length).toBe(CROSSING.MAX_LAYERS);
    expect(b.layers[0].score).toEqual([[0, 2], [1, 3], [5, 1]]);
    expect(b.layers[1].sound).toBe('bell');
    expect(b.mood).toBe('lullaby');
    expect(b.bpm).toBe(70);
  });

  it('wakes both ends of any bridge it holds', () => {
    const sea = sanitizeSea({ awake: ['lighthouse'], bridges: { 'garden~deep': { from: 'garden', layers: [{ sound: 'bell', score: [[0, 1]] }] } } });
    expect(sea.awake.sort()).toEqual(['deep', 'garden', 'lighthouse']);
  });
});
