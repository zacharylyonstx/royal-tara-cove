import { describe, it, expect } from 'vitest';
import { Arranger } from '../../src/audio/Arranger.js';
import { LIGHTHOUSE } from '../../src/music/charts/lighthouse.js';
import { MOODS, FINAL_CHORD } from '../../src/music/sea.js';
import { MIX } from '../../src/core/Constants.js';

/** An audio engine that only writes down what it was asked to play, and when. */
function recorder() {
  const log = [];
  const rec = (kind) => (...args) => log.push({ kind, when: args.find((a) => typeof a === 'number' && a !== args[0]) ?? args[0], args });
  return {
    log,
    ready: true,
    running: true,
    pad: (m, when) => log.push({ kind: 'pad', when }),
    bass: (m, when) => log.push({ kind: 'bass', when }),
    air: (m, when) => log.push({ kind: 'air', when }),
    tick: (when) => log.push({ kind: 'tick', when }),
    shaker: (when) => log.push({ kind: 'shaker', when }),
    wood: (when) => log.push({ kind: 'wood', when }),
    kick: (when) => log.push({ kind: 'kick', when }),
    snare: (when) => log.push({ kind: 'snare', when }),
    hat: (when) => log.push({ kind: 'hat', when }),
    pluck: (m, when) => log.push({ kind: 'pluck', when }),
    note: (o) => (log.push({ kind: 'note', when: o.when }), { stop() {} }),
    rec,
  };
}

/** Run the arranger frame by frame, as the game does, and return everything it scheduled. */
function run({ mood = MOODS.firstlight, bpm = 76.8, fps = 60, beats = 32, from = -4, to = 34, stopAt = () => Infinity } = {}) {
  const audio = recorder();
  const arr = new Arranger(audio, LIGHTHOUSE);
  arr.setPiece({ harmony: mood.harmony, beats, final: FINAL_CHORD });
  arr.setScene(mood.scene);
  const spb = 60 / bpm;
  let beat = from;
  const transport = { running: true, secPerBeat: spb, scheduleBeat: () => beat, timeOfBeat: (b) => b * spb };
  const clock = { toAudioTime: (t) => t };
  arr.reset(from);
  const dt = 1 / fps / spb;
  while (beat < to) {
    arr.update(transport, clock, MIX.SCHEDULE_AHEAD_SEC, stopAt(beat));
    beat += dt;
  }
  return { log: audio.log, spb };
}

const countAt = (log, kind, when) => log.filter((e) => e.kind === kind && Math.abs(e.when - when) < 1e-6).length;

describe('the backing', () => {
  it('plays each bar once and only once, at any tempo and any frame rate', () => {
    for (const mood of Object.values(MOODS)) {
      for (const pace of [1, 0.8, 0.66]) {
        for (const fps of [60, 120, 48, 30]) {
          const bpm = 96 * mood.tempo * pace;
          const { log, spb } = run({ mood, bpm, fps });
          for (let bar = 0; bar < 8; bar++) {
            const when = bar * 4 * spb;
            if (mood.scene.pad > 0) expect(countAt(log, 'pad', when), `${mood.id} pad bar ${bar} at ${bpm} bpm ${fps} fps`).toBe(1);
            if (mood.scene.bass > 0) expect(countAt(log, 'bass', when), `${mood.id} bass bar ${bar}`).toBe(1);
          }
          // the last chord, once
          expect(countAt(log, 'pad', 32 * spb), `${mood.id} final pad`).toBe(mood.scene.pad > 0 ? 1 : 0);
        }
      }
    }
  });

  it('never plays the note the music is waiting for until the key comes', () => {
    // the crossing waits at beat 0 (its first note). Until it is played, nothing at or after 0 may sound.
    const { log, spb } = run({ from: -4, to: 0.5, stopAt: () => 0 });
    expect(log.length).toBeGreaterThan(0); // the count-in is heard
    for (const e of log) expect(e.when, `${e.kind} at ${e.when / spb}`).toBeLessThan(0);
    // The game holds the transport at the waiting note, and starts the backing again from it when
    // the key comes. Played out frame by frame: beat 0 sounds exactly once, on the key, never before.
    const audio = recorder();
    const arr = new Arranger(audio, LIGHTHOUSE);
    arr.setPiece({ harmony: MOODS.firstlight.harmony, beats: 32, final: FINAL_CHORD });
    arr.setScene(MOODS.firstlight.scene);
    const spb2 = 60 / 76.8;
    let beat = -4;
    const transport = { running: true, secPerBeat: spb2, scheduleBeat: () => beat, timeOfBeat: (b) => b * spb2 };
    const clock = { toAudioTime: (t) => t };
    arr.reset(-4);
    const dt = 1 / 60 / spb2;
    for (; beat < 0; beat += dt) arr.update(transport, clock, MIX.SCHEDULE_AHEAD_SEC, 0);
    beat = 0;
    for (let waiting = 0; waiting < 300; waiting++) arr.update(transport, clock, MIX.SCHEDULE_AHEAD_SEC, 0); // five seconds at the gate
    expect(countAt(audio.log, 'pad', 0)).toBe(0);
    arr.reset(0); // the key
    for (; beat < 2; beat += dt) arr.update(transport, clock, MIX.SCHEDULE_AHEAD_SEC, Infinity);
    expect(countAt(audio.log, 'pad', 0)).toBe(1);
    expect(countAt(audio.log, 'bass', 0)).toBe(1);
    expect(countAt(audio.log, 'tick', 0)).toBe(1);
  });

  it('queues nothing while the device has taken the sound away', () => {
    const audio = recorder();
    audio.running = false;
    const arr = new Arranger(audio, LIGHTHOUSE);
    arr.setPiece({ harmony: MOODS.tide.harmony, beats: 32, final: FINAL_CHORD });
    arr.setScene(MOODS.tide.scene);
    arr.reset(-4);
    const transport = { running: true, secPerBeat: 0.5, scheduleBeat: () => 8, timeOfBeat: (b) => b * 0.5 };
    arr.update(transport, { toAudioTime: (t) => t });
    expect(audio.log).toEqual([]);
    // when it comes back, the music carries on from now, not from where it left off
    audio.running = true;
    arr.update(transport, { toAudioTime: (t) => t });
    expect(audio.log.length).toBeGreaterThan(0);
    for (const e of audio.log) expect(e.when).toBeGreaterThanOrEqual(8 * 0.5 - 0.02);
  });
});
