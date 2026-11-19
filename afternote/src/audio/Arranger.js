// Schedules everything that is not the player's live note: the spacious backing and the
// Echoes' recorded notes. Runs a short lookahead on the audio clock so timing is steady
// regardless of frame rate.
//
// The backing never plays a melody. It gives pulse and harmony, and thins as parts stack up
// so each new voice is audible (bible §5.3).

import { MIX, CROSSING } from '../core/Constants.js';

const SCENES = {
  // level: how full the accompaniment is
  silent: { pad: 0, bass: 0, pulse: 0, air: 0, shaker: 0 },
  causeway: { pad: 1.0, bass: 0.9, pulse: 1.0, air: 0, shaker: 0, bassOn3: false },
  roots: { pad: 0.7, bass: 0.75, pulse: 0.9, air: 0, shaker: 0, bassOn3: false, padDown: true },
  lens: { pad: 0.7, bass: 0.8, pulse: 0.8, air: 0.55, shaker: 0.5, bassOn3: true, thinEnd: true },
  reveal: { pad: 1.1, bass: 1.0, pulse: 0.85, air: 1.2, shaker: 0.8, bassOn3: true },
  rest: { pad: 0.6, bass: 0.5, pulse: 0.0, air: 0.7, shaker: 0, bassOn3: false },
};

export class Arranger {
  constructor(audio, island) {
    this.audio = audio;
    this.island = island;
    this.scene = SCENES.silent;
    this.echoes = [];
    this.muted = [false, false, false];
    this.wheel = false; // the waterwheel's tok joins once it turns
    this.cursor = 0;
    this.active = false;
    this.setPiece(null);
  }

  /**
   * What the backing is playing over. null = the lighthouse's own sixteen bars; a sea
   * crossing passes its mood's chords (looped), its length, and the chord it rests on.
   */
  setPiece(piece) {
    this.harmony = piece?.harmony ?? this.island.harmony;
    this.beats = piece?.beats ?? this.island.beats ?? 64;
    this.final = piece?.final ?? this.harmony[this.harmony.length - 1];
  }

  /** @param {string|object} scene  a named scene, or a mood's own levels */
  setScene(scene) {
    this.scene = (typeof scene === 'string' ? SCENES[scene] : scene) ?? SCENES.silent;
  }

  /** @param {Array<{mvt:number, record:object, chart:object}>} echoes */
  setEchoes(echoes) {
    this.echoes = echoes.map((e) => {
      const notes = e.record.entries.filter((n) => n.outcome === 'hit').map((n) => ({ ...n })).sort((a, b) => a.pressBeat - b.pressBeat);
      // a free part has no written lengths: each note rings until the next one, within reason
      if (e.chart.free) {
        notes.forEach((n, i) => {
          const next = notes[i + 1];
          n.ring = Math.min(CROSSING.RING_BEATS + 0.9, Math.max(0.75, next ? next.pressBeat - n.pressBeat + 0.2 : CROSSING.RING_BEATS + 0.9));
        });
      }
      return { ...e, notes };
    });
  }

  /** One bar of a mood, to choose it by ear. */
  preview(mood, when) {
    const audio = this.audio;
    if (!audio.ready || !audio.running) return;
    const spb = 60 / (96 * mood.tempo);
    const chord = mood.harmony[0];
    const sc = mood.scene;
    if (sc.pad > 0) audio.pad(chord.pad, when, 4 * spb, MIX.PAD * sc.pad);
    if (sc.bass > 0) audio.bass(chord.bass + 12, when, 2.5 * spb, MIX.BASS * sc.bass);
    for (let b = 0; b < 4; b += 0.5) this._groove(mood.groove, b, when + b * spb, spb, 1);
    if (sc.air > 0) audio.air(chord.color, when, 4 * spb, 0.055 * sc.air);
  }

  /** The drums and pulse of one half-beat of a mood's groove (nothing if the mood has none). */
  _groove() {}

  /** Start scheduling from this beat (call whenever the transport jumps). */
  reset(beat) {
    this.cursor = beat;
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  /**
   * @param {number} [ahead] seconds to schedule ahead (the offline audio check renders a whole movement at once)
   * @param {number} [stopAt] a beat nothing may be scheduled at or past yet: the note the music is
   *   waiting for. Without it the look-ahead plays that beat's chord while the game still waits,
   *   and plays it again when the key comes.
   */
  update(transport, clock, ahead = MIX.SCHEDULE_AHEAD_SEC, stopAt = Infinity) {
    const audio = this.audio;
    // (with the device's sound taken away, nothing is queued: it would all sound at once on return)
    if (!this.active || !audio.ready || !audio.running || !transport.running) return;
    const spb = transport.secPerBeat;
    const now = transport.scheduleBeat();
    const to = Math.min(now + ahead / spb, stopAt);
    let from = this.cursor;
    if (from < now - 0.02) from = now - 0.02; // never schedule the past
    if (to <= from) return;
    const at = (beat) => clock.toAudioTime(transport.timeOfBeat(beat));
    const sc = this.scene;
    const harmony = this.harmony;
    const N = this.beats;
    const loop = harmony.length;

    // --- the half-beat grid ---------------------------------------------------------
    // (from is where the last pass stopped, exclusive: a grid point it landed on exactly is not played twice)
    for (let k = Math.ceil(from * 2); k / 2 < to; k++) {
      const b = k / 2;
      const whole = k % 2 === 0;
      const t = at(b);

      // count-in bar: four pulses and a breath of harmony
      if (b >= -4 && b < 0) {
        if (whole) audio.tick(t, MIX.PULSE * 1.25, b === -4);
        if (b === -4 && sc.pad > 0) audio.pad(harmony[0].pad, t, 4 * spb + 0.5, MIX.PAD * 0.6 * sc.pad);
        continue;
      }
      if (b < 0 || b > N) continue;

      if (b === N) {
        // the last chord rings on so nothing ends abruptly
        if (sc.pad > 0) audio.pad(this.final.pad, t, 6 * spb, MIX.PAD * sc.pad);
        if (sc.bass > 0) audio.bass(this.final.bass + 12, t, 5 * spb, MIX.BASS * sc.bass);
        continue;
      }

      const bar = Math.floor(b / 4);
      const pos = b - bar * 4;
      const chord = harmony[bar % loop];
      const thin = sc.thinEnd && b >= N - 8 ? Math.max(0.25, 1 - (b - (N - 8)) / 7) : 1;

      if (pos === 0) {
        const pad = sc.padDown ? chord.pad.map((m, i) => (i > 1 ? m - 12 : m)) : chord.pad;
        if (sc.pad > 0) audio.pad(pad, t, 4 * spb + 0.6, MIX.PAD * sc.pad * thin);
        if (sc.bass > 0) audio.bass(chord.bass + 12, t, 3 * spb, MIX.BASS * sc.bass * thin);
        if (sc.air > 0) audio.air(chord.color, t, 4 * spb + 1, 0.055 * sc.air * thin);
      }
      if (pos === 2 && sc.bassOn3 && sc.bass > 0) audio.bass(chord.bass + 12, t, 1.5 * spb, MIX.BASS * sc.bass * 0.55 * thin);
      if (whole && sc.pulse > 0 && !(sc.thinEnd && b >= N - 6)) audio.tick(t, MIX.PULSE * sc.pulse, pos === 0);
      if (!whole && sc.shaker > 0 && thin > 0.6) audio.shaker(t, 0.05 * sc.shaker);
      if ((this.wheel || sc.tock) && !whole && Math.floor(b) % 2 === 1) audio.wood(t, 0.1, Math.floor(b / 2) % 2 ? 520 : 440);
    }

    // --- Echoes: exactly what was played, when it was played ---------------------------
    for (const e of this.echoes) {
      if (this.muted[e.mvt]) continue;
      const pan = e.mvt === 0 ? -0.32 : e.mvt === 1 ? 0.3 : 0.0;
      for (const n of e.notes) {
        if (n.pressBeat < from) continue;
        if (n.pressBeat >= to) break;
        const t = at(n.pressBeat);
        if (n.k === 'hold') {
          const v = audio.note({ instrument: e.chart.instrument, octave: e.chart.octave, pitch: n.p, when: t, dur: null, bus: 'echo', pan });
          if (v) v.stop(t + Math.max(0.15, n.held * spb));
        } else {
          audio.note({ instrument: e.chart.instrument, octave: e.chart.octave, pitch: n.p, when: t, dur: (n.ring ?? Math.min(n.d, 2)) * spb, bus: 'echo', pan });
        }
      }
    }

    this.cursor = to;
  }
}
