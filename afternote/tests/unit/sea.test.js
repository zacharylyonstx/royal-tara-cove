import { describe, it, expect } from 'vitest';
import { MovementRunner } from '../../src/rules/MovementRunner.js';
import { supportAt, evalSegs } from '../../src/rules/Trajectory.js';
import { CROSSING } from '../../src/core/Constants.js';
import {
  EDGES, EDGE, PLACES, PLACE, SOUNDS, MOODS, HOME, crossingChart, crossingRules, scoreOf, performScore, tidyRests,
  emptySea, sanitizeSea, unlocked, edgesOf, otherEnd, sanitizeBridge, encodeBridge, decodeBridge, compareBridges, receiveBridge, mergeSeas, CLOAKS, cloaksOf,
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

describe('the moods', () => {
  // how each of the twelve notes is spelled in the keys the moods use
  const SPELL = { 0: 'C', 1: 'C♯', 2: 'D', 3: 'E♭', 4: 'E', 5: 'F', 6: 'F♯', 7: 'G', 8: 'A♭', 9: 'A', 10: 'B♭', 11: 'B' };

  it('name their keys for the notes those keys really play', () => {
    for (const m of Object.values(MOODS)) {
      const expected = [0, 2, 4, 7, 9].map((semi) => SPELL[(((semi + m.key) % 12) + 12) % 12]);
      expect(m.names, m.id).toEqual(expected);
      const c = crossingChart({ edge: EDGES[0], from: EDGES[0].a, sound: 'bell', mood: m.id });
      expect(c.key).toBe(m.key);
      expect(c.names).toEqual(m.names);
    }
    // the lighthouse's own mood is the lighthouse's own key
    expect(MOODS.firstlight.key).toBe(0);
    expect(crossingChart({ edge: EDGES[0], from: EDGES[0].a, sound: 'bell' }).key).toBe(0);
  });

  it('are different music from one another: no two share a key, and no two share a groove and a resting chord', () => {
    const list = Object.values(MOODS);
    expect(new Set(list.map((m) => m.key)).size).toBe(list.length);
    const feel = list.map((m) => JSON.stringify([m.groove, m.final.name, m.harmony.map((c) => c.name), m.scene.pulse > 0, !!m.scene.tock]));
    expect(new Set(feel).size).toBe(list.length);
    // some have drums, some have a broken chord, some have neither: three kinds of backing
    expect(list.filter((m) => m.groove?.kick).length).toBeGreaterThanOrEqual(3);
    expect(list.filter((m) => m.groove?.arp).length).toBeGreaterThanOrEqual(2);
    expect(list.filter((m) => !m.groove).length).toBeGreaterThanOrEqual(1);
    // and not all of them come to rest on the same chord
    expect(new Set(list.map((m) => m.final.name)).size).toBeGreaterThanOrEqual(3);
  });

  it('are written so they can be played: four bars, grooves of eight half-beats, arpeggios within the chord', () => {
    for (const m of Object.values(MOODS)) {
      expect(m.harmony.length, m.id).toBe(4);
      expect(m.final?.pad?.length, m.id).toBeGreaterThan(2);
      expect(m.tempo).toBeGreaterThan(0.7);
      expect(m.tempo).toBeLessThan(1.2);
      expect(Math.abs(m.key)).toBeLessThanOrEqual(5);
      for (const [part, line] of Object.entries(m.groove ?? {})) {
        for (const bar of Array.isArray(line) ? line : [line]) {
          expect(bar.length, `${m.id} ${part}`).toBe(8);
          expect(bar, `${m.id} ${part}`).toMatch(part === 'arp' ? /^[0-5.]{8}$/ : /^[xo.]{8}$/);
        }
      }
    }
  });
});

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
    expect(emptySea()).toEqual({ at: HOME, awake: [HOME], bridges: {}, afar: [], seen: {}, cloak: 'dusk' });
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
            { sound: 'kazoo', score: [[0, 3], [2, 0]] },
            null,
            { sound: 'pan', score: [[4, 4]] }, // never played: every real part begins on the first half-beat
            { sound: 'pan', score: [] },
            { sound: 'root', score: [[0, 1], [4, 4]] },
            { sound: 'glass', score: [[0, 0], [6, 1]] },
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
    expect(b.layers[2]).toEqual({ sound: 'root', score: [[0, 1], [4, 4]] });
    expect(b.mood).toBe('lullaby');
    expect(b.bpm).toBe(70);
  });

  it('wakes both ends of any bridge it holds', () => {
    const sea = sanitizeSea({ awake: ['lighthouse'], bridges: { 'garden~deep': { from: 'garden', layers: [{ sound: 'bell', score: [[0, 1]] }] } } });
    expect(sea.awake.sort()).toEqual(['deep', 'garden', 'lighthouse']);
  });
});

// ---------------------------------------------------------------------------------
// Sending a bridge by link
// ---------------------------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomBridge(e, rnd, parts = 1 + Math.floor(rnd() * 3)) {
  const slots = e.bars * 8;
  const sounds = Object.keys(SOUNDS), moods = Object.keys(MOODS);
  const layers = [];
  for (let k = 0; k < parts; k++) {
    // (every real part begins on the first half-beat: that note is what sets Kite out)
    const score = [[0, Math.floor(rnd() * 5)]];
    for (let i = 1; i < slots; i++) if (rnd() < 0.4) score.push([i, Math.floor(rnd() * 5)]);
    layers.push({ sound: sounds[Math.floor(rnd() * sounds.length)], score });
  }
  return { from: rnd() < 0.5 ? e.a : e.b, mood: moods[Math.floor(rnd() * moods.length)], bpm: Math.round((50 + rnd() * 80) * 10) / 10, layers };
}
const clone = (x) => JSON.parse(JSON.stringify(x));

describe('a bridge written as a link', () => {
  it('comes back exactly as it was sent, for every edge, either direction, any mood and sound', () => {
    const rnd = rng(11);
    for (const e of EDGES) {
      for (let n = 0; n < 12; n++) {
        const b = randomBridge(e, rnd);
        const code = encodeBridge(e.id, b);
        expect(code).toMatch(/^1[0-9a-z]{6}(-[0-9a-z]{1,65}){1,3}$/);
        expect(code.length).toBeLessThanOrEqual(205);
        expect(decodeBridge(code)).toEqual({ edge: e.id, bridge: b });
      }
    }
  });

  it('keeps meaning what it meant: a code written today still reads the same', () => {
    // (if this fails, the wire lists in sea.js were reordered: links already sent would break)
    const b = { from: 'lighthouse', mood: 'firstlight', bpm: 76.8, layers: [{ sound: 'bell', score: [[0, 0], [1, 4], [4, 2], [63, 3]] }, { sound: 'firefly', score: [[0, 1], [2, 1]] }] };
    const code = '10000lc-0b0i' + '0'.repeat(28) + '4-8cc';
    expect(encodeBridge('lighthouse~chimes', b)).toBe(code);
    expect(decodeBridge(code)).toEqual({ edge: 'lighthouse~chimes', bridge: b });
    const far = { from: 'deep', mood: 'deep', bpm: 61.4, layers: [{ sound: 'pan', score: [[0, 0], [127, 4]] }] };
    expect(encodeBridge('harbor~deep', far)).toBe('19160h2-76' + '0'.repeat(62) + '5');
    expect(decodeBridge(encodeBridge('harbor~deep', far))).toEqual({ edge: 'harbor~deep', bridge: far });
  });

  it('is short enough to send: a full three-part bridge on the longest edge fits in a message', () => {
    const e = EDGE['stacks~deep'];
    const full = { from: 'stacks', mood: 'starfall', bpm: 86.4, layers: [0, 1, 2].map((k) => ({ sound: ['flute', 'bell', 'root'][k], score: Array.from({ length: e.bars * 8 }, (_, i) => [i, (i + k) % 5]) })) };
    const code = encodeBridge(e.id, full);
    expect(code.length).toBeLessThanOrEqual(205);
    expect(decodeBridge(code).bridge).toEqual(full);
  });

  it('turns away anything that is not a bridge', () => {
    const good = encodeBridge('lighthouse~chimes', { from: 'lighthouse', mood: 'lullaby', bpm: 64.5, layers: [{ sound: 'musicbox', score: [[0, 1], [3, 2]] }] });
    expect(decodeBridge(good)).toBeTruthy();
    for (const bad of [
      null, undefined, 42, {}, '', 'hello', good.toUpperCase(), '2' + good.slice(1), good + '-', good + '-0', good.replace('-', '_'),
      '1z0000c-0a', // no such edge
      '1020zzz-0a'.replace('z', 'z'), // tempo out of range is repaired, not refused (see below)
      '10090lc-0a', // no such mood
      '10200lc-0a', // neither end
      '10000lc-za', // no such sound
      '10000lc-0', // a part with no stones
      '10000lc-00a', // a part that does not begin on the first half-beat (no crossing can)
      '10000lc-0' + 'a'.repeat(33), // more stones than the edge has half-beats
      '10000lc-0a-0a-0a-0a', // four parts
      '10000lc-0a<script>', '10000lc-0a b', '10000lc-0a%20', 'x'.repeat(400),
    ]) {
      if (bad === '1020zzz-0a') continue;
      expect(decodeBridge(bad), String(bad)).toBeNull();
    }
    // a tempo nobody could play is set back to the sea's own
    expect(decodeBridge('1000zzz-0a').bridge.bpm).toBe(96);
    expect(decodeBridge('1000001-0a').bridge.bpm).toBe(96);
  });

  it('plays back note for note', () => {
    const rnd = rng(5);
    const e = EDGE['garden~deep'];
    const b = randomBridge(e, rnd, 3);
    const back = decodeBridge(encodeBridge(e.id, b)).bridge;
    back.layers.forEach((l, k) => {
      const rec = performScore(MovementRunner, crossingChart({ edge: e, from: back.from, sound: l.sound, layer: k }), back.bpm, l.score);
      expect(scoreOf(rec)).toEqual(b.layers[k].score);
    });
  });

  it('cannot be written from something that is not a whole bridge', () => {
    expect(encodeBridge('nowhere~else', { from: 'lighthouse', mood: 'firstlight', bpm: 80, layers: [{ sound: 'bell', score: [[0, 0]] }] })).toBeNull();
    expect(encodeBridge('lighthouse~chimes', { from: 'garden', mood: 'firstlight', bpm: 80, layers: [{ sound: 'bell', score: [[0, 0]] }] })).toBeNull();
    expect(encodeBridge('lighthouse~chimes', { from: 'lighthouse', mood: 'firstlight', bpm: 80, layers: [] })).toBeNull();
    expect(encodeBridge('lighthouse~chimes', { from: 'lighthouse', mood: 'firstlight', bpm: 80, layers: [{ sound: 'bell', score: [] }] })).toBeNull();
    expect(encodeBridge('lighthouse~chimes', null)).toBeNull();
  });
});

describe('a bridge arriving from another sea', () => {
  const E = 'lighthouse~chimes';
  const one = () => ({ from: 'lighthouse', mood: 'firstlight', bpm: 76.8, layers: [{ sound: 'bell', score: [[0, 0], [2, 2], [5, 4]] }] });
  const two = () => ({ ...one(), layers: [...one().layers, { sound: 'harp', score: [[0, 1], [8, 3]] }] });
  const three = () => ({ ...two(), layers: [...two().layers, { sound: 'root', score: [[0, 0]] }] });

  it('knows a bridge that has grown from one that is simply different', () => {
    expect(compareBridges(E, one(), E, one())).toBe('same');
    expect(compareBridges(E, one(), E, two())).toBe('grown');
    expect(compareBridges(E, one(), E, three())).toBe('grown');
    expect(compareBridges(E, three(), E, two())).toBe('older');
    expect(compareBridges(E, one(), 'lighthouse~harp', one())).toBeNull();
    expect(compareBridges(E, one(), E, { ...one(), mood: 'lullaby' })).toBeNull();
    expect(compareBridges(E, one(), E, { ...one(), from: 'chimes' })).toBeNull();
    expect(compareBridges(E, one(), E, { ...one(), bpm: 64 })).toBeNull();
    expect(compareBridges(E, one(), E, { ...two(), layers: [{ sound: 'glass', score: [[0, 0], [2, 2], [5, 4]] }, two().layers[1]] })).toBeNull();
    expect(compareBridges(E, one(), E, { ...one(), layers: [{ sound: 'bell', score: [[0, 0], [2, 2], [5, 3]] }] })).toBeNull();
  });

  it('is set beside the player\'s own bridges, and wakes nothing', () => {
    const sea = emptySea();
    expect(receiveBridge(sea, E, one())).toEqual({ what: 'new', ref: 'afar:0' });
    expect(sea.afar).toEqual([{ edge: E, ...one() }]);
    expect(sea.bridges).toEqual({});
    expect(sea.awake).toEqual([HOME]);
    // the same link opened twice is still one bridge
    expect(receiveBridge(sea, E, one())).toEqual({ what: 'same', ref: 'afar:0' });
    expect(sea.afar.length).toBe(1);
  });

  it('grows in place when it comes back with more parts', () => {
    const sea = emptySea();
    receiveBridge(sea, 'lighthouse~harp', { from: 'harp', mood: 'tide', bpm: 84.5, layers: [{ sound: 'harp', score: [[3, 3]] }] });
    receiveBridge(sea, E, one());
    expect(receiveBridge(sea, E, two())).toEqual({ what: 'grown', ref: 'afar:1' });
    expect(sea.afar.length).toBe(2);
    expect(sea.afar[1].layers.length).toBe(2);
    // an older telling of it changes nothing
    expect(receiveBridge(sea, E, one())).toEqual({ what: 'same', ref: 'afar:1' });
    expect(sea.afar[1].layers.length).toBe(2);
  });

  it('a bridge the player made comes home grown; their other bridges are never touched', () => {
    const sea = emptySea();
    sea.awake.push('chimes');
    sea.bridges[E] = one();
    expect(receiveBridge(sea, E, three())).toEqual({ what: 'grown', ref: E });
    expect(sea.bridges[E]).toEqual(three());
    expect(sea.afar).toEqual([]);
    // somebody else's bridge on the same edge does not replace it
    const other = { from: 'chimes', mood: 'lullaby', bpm: 64.5, layers: [{ sound: 'musicbox', score: [[4, 4]] }] };
    expect(receiveBridge(sea, E, other)).toEqual({ what: 'new', ref: 'afar:0' });
    expect(sea.bridges[E]).toEqual(three());
    expect(sea.afar).toEqual([{ edge: E, ...other }]);
    // what was taken in is a copy: changing the sender's does not change the keeper's
    const sent = two();
    const sea2 = emptySea();
    sea2.bridges[E] = one();
    receiveBridge(sea2, E, sent);
    sent.layers[1].score[0][1] = 0;
    expect(sea2.bridges[E].layers[1].score[0][1]).toBe(1);
  });

  it('holds only so many, and never pushes one out to make room: a newcomer waits', () => {
    const sea = emptySea();
    for (let n = 0; n < CROSSING.AFAR_MAX; n++) expect(receiveBridge(sea, E, { ...one(), layers: [{ sound: 'bell', score: [[0, 0], [n + 1, 0]] }] }).what).toBe('new');
    const before = clone(sea.afar);
    expect(receiveBridge(sea, E, { ...one(), layers: [{ sound: 'glass', score: [[0, 4]] }] })).toEqual({ what: 'full' });
    expect(sea.afar).toEqual(before);
    // one it already has can still grow, full or not
    const grown = { ...one(), layers: [{ sound: 'bell', score: [[0, 0], [1, 0]] }, { sound: 'root', score: [[0, 1]] }] };
    expect(receiveBridge(sea, E, grown)).toEqual({ what: 'grown', ref: 'afar:0' });
    expect(sea.afar.length).toBe(CROSSING.AFAR_MAX);
  });

  it('is kept by the save, checked like everything else in it', () => {
    const sea = emptySea();
    receiveBridge(sea, E, two());
    receiveBridge(sea, 'harbor~deep', { from: 'deep', mood: 'deep', bpm: 61.4, layers: [{ sound: 'firefly', score: [[0, 1], [120, 2]] }] });
    const back = sanitizeSea(clone(sea));
    expect(back.afar).toEqual(sea.afar);
    expect(back.awake).toEqual([HOME]); // bridges from afar wake nothing
    const dirty = clone(sea);
    dirty.afar.push(null, 7, { edge: 'no~where', ...one() }, { edge: E, from: 'garden', layers: [] }, { edge: E, ...one(), layers: [{ sound: 'bell', score: [[999, 0], ['x', 1], [2, 9]] }, { sound: '???', score: [[0, 4], [1, 1]] }] }, { edge: E, ...one(), bpm: 9000, layers: [{ sound: 'bell', score: [[3, 1]] }] });
    const cleaned = sanitizeSea(dirty);
    expect(cleaned.afar.length).toBe(3);
    // the part with nothing playable in it is gone; the one with an unknown sound is kept as a bell
    expect(cleaned.afar[2]).toEqual({ edge: E, from: 'lighthouse', mood: 'firstlight', bpm: 76.8, layers: [{ sound: 'bell', score: [[0, 4], [1, 1]] }] });
    expect(sanitizeSea({ afar: Array.from({ length: 40 }, () => ({ edge: E, ...one() })) }).afar.length).toBe(CROSSING.AFAR_MAX);
    expect(sanitizeBridge(E, one())).toEqual(one());
    expect(sanitizeBridge(E, { from: 'deep', layers: [] })).toBeNull();
  });

  it('a save edited by hand cannot reach names every object has', () => {
    const hostile = JSON.parse('{"at":"constructor","awake":["toString","__proto__","chimes"],"bridges":{"constructor":{"layers":[{"sound":"bell","score":[[0,0]]}]},"__proto__":{"from":"x","layers":[]},"lighthouse~chimes":{"from":"lighthouse","mood":"toString","layers":[{"sound":"hasOwnProperty","score":[[0,1]]}]}},"afar":[{"edge":"valueOf","layers":[{"score":[[0,0]]}]}]}');
    const sea = sanitizeSea(hostile);
    expect(sea.at).toBe(HOME);
    expect(sea.awake).toEqual([HOME, 'chimes']);
    expect(Object.keys(sea.bridges)).toEqual(['lighthouse~chimes']);
    expect(sea.bridges['lighthouse~chimes']).toEqual({ from: 'lighthouse', mood: 'firstlight', bpm: 96, layers: [{ sound: 'bell', score: [[0, 1]] }] });
    expect(sea.afar).toEqual([]);
    expect(sanitizeBridge('constructor', { layers: [] })).toBeNull();
    expect(sanitizeBridge(undefined, one())).toBeNull();
    expect(sanitizeSea({ bridges: 7, afar: 'x', awake: {} })).toEqual(emptySea());
  });
});

describe('two tabs, one sea', () => {
  const E = 'lighthouse~chimes', F = 'lighthouse~harp';
  const A = () => ({ from: 'lighthouse', mood: 'firstlight', bpm: 76.8, layers: [{ sound: 'bell', score: [[0, 0], [2, 2]] }] });
  const A2 = () => ({ ...A(), layers: [...A().layers, { sound: 'harp', score: [[0, 1]] }] });
  const B = () => ({ from: 'harp', mood: 'tide', bpm: 84.5, layers: [{ sound: 'harp', score: [[0, 3], [5, 1]] }] });
  const C = () => ({ from: 'chimes', mood: 'lullaby', bpm: 64.5, layers: [{ sound: 'musicbox', score: [[0, 4]] }] });
  const seaOf = (parts) => ({ ...emptySea(), ...clone(parts) });

  it('keeps everything either tab has', () => {
    const mine = seaOf({ at: 'chimes', awake: [HOME, 'chimes'], bridges: { [E]: A() } });
    const theirs = seaOf({ at: 'harp', awake: [HOME, 'harp'], bridges: { [F]: B() }, afar: [{ edge: E, ...C() }] });
    const sea = mergeSeas(theirs, mine);
    expect(sea.at).toBe('chimes'); // the tab being played now
    expect([...sea.awake].sort()).toEqual([HOME, 'chimes', 'harp'].sort());
    expect(sea.bridges).toEqual({ [E]: A(), [F]: B() });
    expect(sea.afar).toEqual([{ edge: E, ...C() }]);
    // and it does not matter which way round they are merged, except for where Kite stands
    const other = mergeSeas(mine, theirs);
    expect(other.bridges).toEqual(sea.bridges);
    expect(other.afar).toEqual(sea.afar);
    expect(other.at).toBe('harp');
  });

  it('a bridge one tab has added a part to is the one that is kept', () => {
    const mine = seaOf({ awake: [HOME, 'chimes'], bridges: { [E]: A() } });
    const theirs = seaOf({ awake: [HOME, 'chimes'], bridges: { [E]: A2() } });
    expect(mergeSeas(theirs, mine).bridges[E]).toEqual(A2());
    expect(mergeSeas(mine, theirs).bridges[E]).toEqual(A2());
    expect(mergeSeas(theirs, mine).afar).toEqual([]);
  });

  it('two different bridges on the same water: this tab\'s stands, the other waits from afar', () => {
    const mine = seaOf({ awake: [HOME, 'chimes'], bridges: { [E]: A() } });
    const theirs = seaOf({ awake: [HOME, 'chimes'], bridges: { [E]: C() } });
    const sea = mergeSeas(theirs, mine);
    expect(sea.bridges[E]).toEqual(A());
    expect(sea.afar).toEqual([{ edge: E, ...C() }]);
  });

  it('this tab\'s bridges from afar keep their places, and nothing appears twice', () => {
    const mine = seaOf({ awake: [HOME, 'chimes'], bridges: { [E]: A() }, afar: [{ edge: F, ...B() }, { edge: E, ...C() }] });
    // the other tab swapped C onto the chart (so its A waits from afar), and has a newer B
    const B2 = { ...B(), layers: [...B().layers, { sound: 'glass', score: [[0, 0]] }] };
    const theirs = seaOf({ awake: [HOME, 'chimes'], bridges: { [E]: C() }, afar: [{ edge: E, ...A() }, { edge: F, ...B2 }] });
    const sea = mergeSeas(theirs, mine);
    expect(sea.bridges[E]).toEqual(A());
    expect(sea.afar).toEqual([{ edge: F, ...B2 }, { edge: E, ...C() }]);
    // merged with itself, a sea is itself
    expect(mergeSeas(sea, sea)).toEqual(sea);
    // what comes out shares nothing with what went in
    sea.bridges[E].layers[0].score[0][1] = 3;
    expect(mine.bridges[E].layers[0].score[0][1]).toBe(0);
  });
});

describe('cloaks for Kite', () => {
  const part = (n = 1) => ({ sound: 'bell', score: Array.from({ length: n }, (_, i) => [i, 0]) });
  const built = (layers = 1) => Object.fromEntries(EDGES.map((e) => [e.id, { from: e.a, mood: 'firstlight', bpm: 76.8, layers: Array.from({ length: layers }, () => part(2)) }]));

  it('every place gives one of its own, and each is a whole set of colours', () => {
    const gifts = PLACES.filter((p) => p.gift).map((p) => p.gift.cloak);
    expect(new Set(gifts).size).toBe(6);
    for (const id of gifts) expect(CLOAKS[id], id).toBeTruthy();
    for (const c of Object.values(CLOAKS)) {
      for (const k of ['cloak', 'light', 'trim', 'ember', 'tail']) expect(Number.isInteger(c[k]), `${c.id}.${k}`).toBe(true);
      expect(c.name.length).toBeGreaterThan(2);
      if (c.id !== 'dusk') expect(c.how.length, c.id).toBeGreaterThan(5);
    }
    expect(Object.keys(CLOAKS).length).toBe(10);
  });

  it('are earned by what has been done, never bought or timed', () => {
    const sea = emptySea();
    expect(cloaksOf(sea)).toEqual(['dusk']);
    sea.awake.push('chimes');
    expect(cloaksOf(sea)).toEqual(['dusk', 'moon']);
    sea.awake.push('deep', 'harp');
    expect(cloaksOf(sea)).toEqual(['dusk', 'moon', 'seaglass', 'glow']);
    sea.awake = PLACES.map((p) => p.id);
    expect(cloaksOf(sea)).toContain('dawn');
    expect(cloaksOf(sea)).not.toContain('starlight');
    sea.bridges = built(1);
    expect(cloaksOf(sea)).toContain('starlight');
    expect(cloaksOf(sea)).not.toContain('aurora');
    sea.bridges = built(3);
    expect(cloaksOf(sea).length).toBe(10);
    expect(cloaksOf(sea).at(-1)).toBe('aurora');
  });

  it('the one Kite wears is kept, and only if this sea has earned it', () => {
    expect(sanitizeSea({ awake: ['chimes'], cloak: 'moon' }).cloak).toBe('moon');
    expect(sanitizeSea({ awake: ['chimes'], cloak: 'copper' }).cloak).toBe('dusk');
    expect(sanitizeSea({ cloak: 'constructor' }).cloak).toBe('dusk');
    expect(sanitizeSea({ cloak: 7 }).cloak).toBe('dusk');
    const mine = { ...emptySea(), awake: [HOME, 'chimes'], cloak: 'moon' };
    const theirs = { ...emptySea(), awake: [HOME, 'harp'], cloak: 'seaglass' };
    expect(mergeSeas(theirs, mine).cloak).toBe('moon');
    expect(mergeSeas(mine, theirs).cloak).toBe('seaglass');
  });
});
