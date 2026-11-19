// All sound, synthesized live with the Web Audio API. No samples, nothing to load:
// the first note is ready the moment the player presses Begin.
//
// Design rules (bible §3.5, §9.4):
//   - the player's note has an immediate attack and sits above everything else
//   - the backing is spacious and never doubles the player's melody
//   - Echoes are the same instruments, quieter, wetter and off to the side
//   - things that happen in the world ring in tune with the harmony

import { MIX } from '../core/Constants.js';
import { freqOf, midiOf } from '../music/Theory.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = MIX.MASTER;
    this.held = new Map(); // pitch -> voice (player's sustained notes)
  }

  /** Must be called from a user gesture. Safe to call again. */
  init(offlineContext = null) {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    let ctx = offlineContext; // tools/audio-check.mjs renders the mix offline to inspect it
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC({ latencyHint: 'interactive' });
    }
    this.ctx = ctx;

    // master: gentle glue compression so nothing ever clips
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    // nothing useful lives below 35 Hz; removing it keeps headroom for the notes
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'highpass';
    rumble.frequency.value = 36;
    // the compressor adds its own make-up gain; trim after it so peaks keep some headroom
    const trim = ctx.createGain();
    trim.gain.value = 0.8;
    this.master.connect(rumble).connect(comp).connect(trim).connect(ctx.destination);

    // one shared hall
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(MIX.REVERB_SECONDS);
    const wet = ctx.createGain();
    wet.gain.value = 0.9;
    this.reverb.connect(wet).connect(this.master);
    // the hall only hears the upper part of each sound, so the low end stays clear
    this.reverbIn = ctx.createBiquadFilter();
    this.reverbIn.type = 'highpass';
    this.reverbIn.frequency.value = 220;
    this.reverbIn.connect(this.reverb);

    // buses: [dry gain, reverb send]
    this.bus = {};
    const mk = (name, gain, send) => {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(this.master);
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverbIn);
      this.bus[name] = g;
      return g;
    };
    mk('player', MIX.PLAYER, 0.34);
    mk('echo', MIX.ECHO, 0.62);
    mk('backing', 1.0, 0.4);
    mk('world', MIX.WORLD, 0.7);
    mk('ui', 0.5, 0.15);
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = 0;
    this.ambienceBus.connect(this.master);

    this._noise = this._noiseBuffer(2.5);
    this._startAmbience();
    this.ready = true;
    return ctx;
  }

  get outputLatency() {
    if (!this.ctx) return 0;
    const l = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return Math.min(0.25, l);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.now(), 0.05);
  }

  setMuted(m) {
    this.muted = m;
    this.setVolume(this.volume);
  }

  /** Duck or restore the scheduled music (pause, cinematic quiet). */
  duck(amount, time = 0.25) {
    if (!this.ready) return;
    const t = this.now();
    this.bus.backing.gain.setTargetAtTime(amount, t, time / 3);
    this.bus.echo.gain.setTargetAtTime(MIX.ECHO * amount, t, time / 3);
  }

  setAmbience(level, time = 2) {
    if (!this.ready) return;
    this.ambienceBus.gain.setTargetAtTime(level * MIX.AMBIENCE, this.now(), time / 3);
  }

  // -------------------------------------------------------------------------------
  // Building blocks
  // -------------------------------------------------------------------------------
  _impulse(seconds) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, 2.6) * (i < rate * 0.012 ? i / (rate * 0.012) : 1);
        // the tail darkens as it decays, like a real room
        const a = 0.85 - 0.68 * Math.min(1, t * 2.2);
        lp += a * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * env * 0.9;
      }
    }
    return buf;
  }

  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _osc(type, freq, when, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    o.start(when);
    return o;
  }

  _pan(dest, pan) {
    if (!pan || !this.ctx.createStereoPanner) return dest;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dest);
    return p;
  }

  /** A decaying partial: sine at freq*ratio, peak `gain`, time constant `tau`. */
  _partial(dest, freq, when, gain, tau, type = 'sine') {
    const o = this._osc(type, freq, when);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.003);
    g.gain.setTargetAtTime(0, when + 0.004, tau);
    o.connect(g).connect(dest);
    o.stop(when + tau * 8 + 0.2);
    return o;
  }

  _click(dest, when, gain, freq = 3200, q = 1.2, dur = 0.012) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(when, Math.random() * 2);
    src.stop(when + dur + 0.02);
  }

  // -------------------------------------------------------------------------------
  // Instruments. Each returns { stop(when) } so a held note can be let go.
  // `dur` (seconds) = natural length; null = sustain until stop().
  // -------------------------------------------------------------------------------

  /** I — warm plucked bell: kalimba body, glass ping on top. */
  bell(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.5;
    out.connect(dest);
    const sustain = dur === null;
    const body = ctx.createGain();
    body.gain.setValueAtTime(0, when);
    body.gain.linearRampToValueAtTime(1, when + 0.004);
    if (sustain) body.gain.setTargetAtTime(0.42, when + 0.01, 0.3);
    else body.gain.setTargetAtTime(0, when + 0.01, 0.42 + Math.min(0.5, dur * 0.22));
    body.connect(out);
    const o1 = this._osc('sine', freq, when);
    const tri = this._osc('triangle', freq, when);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(2400, freq * 3);
    const triG = ctx.createGain();
    triG.gain.value = 0.22;
    o1.connect(body);
    tri.connect(lp).connect(triG).connect(body);
    this._partial(out, freq * 2, when, 0.3, 0.2);
    this._partial(out, freq * 3.01, when, 0.11, 0.1);
    this._partial(out, freq * 4.23, when, 0.07, 0.05);
    this._click(out, when, 0.16, 3600, 1.0, 0.01);
    const end = sustain ? null : when + 3.2;
    if (end) {
      o1.stop(end);
      tri.stop(end);
    }
    return {
      stop: (t) => {
        body.gain.cancelScheduledValues(t);
        body.gain.setTargetAtTime(0, t, 0.11);
        o1.stop(t + 1);
        tri.stop(t + 1);
      },
    };
  }

  /** II — low, round and woody: a soft mallet on something hollow. */
  root(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.5;
    out.connect(dest);
    const sustain = dur === null;
    const body = ctx.createGain();
    body.gain.setValueAtTime(0, when);
    body.gain.linearRampToValueAtTime(1, when + 0.006);
    if (sustain) body.gain.setTargetAtTime(0.55, when + 0.01, 0.35);
    else body.gain.setTargetAtTime(0, when + 0.012, 0.6 + Math.min(0.7, dur * 0.25));
    body.connect(out);
    const o1 = this._osc('sine', freq, when);
    const tri = this._osc('triangle', freq, when);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, when);
    lp.frequency.setTargetAtTime(520, when + 0.01, 0.25);
    const triG = ctx.createGain();
    triG.gain.value = 0.55;
    o1.connect(body);
    tri.connect(lp).connect(triG).connect(body);
    this._partial(out, freq * 2, when, 0.34, 0.32);
    this._partial(out, freq * 3, when, 0.16, 0.14);
    this._partial(out, freq * 4, when, 0.07, 0.07);
    // the thump of the mallet
    const th = this._osc('sine', 190, when);
    th.frequency.exponentialRampToValueAtTime(70, when + 0.05);
    const thG = ctx.createGain();
    thG.gain.setValueAtTime(0.32, when);
    thG.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    th.connect(thG).connect(out);
    th.stop(when + 0.12);
    this._click(out, when, 0.07, 900, 0.8, 0.02);
    if (!sustain) {
      o1.stop(when + 5);
      tri.stop(when + 5);
    }
    return {
      stop: (t) => {
        body.gain.cancelScheduledValues(t);
        body.gain.setTargetAtTime(0, t, 0.14);
        o1.stop(t + 1.2);
        tri.stop(t + 1.2);
      },
    };
  }

  /** III — bright and sustained: bowed glass with a struck edge. */
  glass(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.86;
    out.connect(dest);
    const sustain = dur === null;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(1, when + 0.012);
    amp.gain.setTargetAtTime(0.62, when + 0.02, 0.45);
    amp.connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(700, when);
    lp.frequency.linearRampToValueAtTime(3200, when + 0.06);
    lp.frequency.setTargetAtTime(1700, when + 0.08, 0.6);
    lp.connect(amp);
    const lfo = this._osc('sine', 5.1, when);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(0, when);
    lfoG.gain.linearRampToValueAtTime(7, when + 0.6);
    lfo.connect(lfoG);
    const oscs = [];
    for (const det of [-7, 7]) {
      const s = this._osc('sawtooth', freq, when, det);
      lfoG.connect(s.detune);
      const g = ctx.createGain();
      g.gain.value = 0.2;
      s.connect(g).connect(lp);
      oscs.push(s);
    }
    const s1 = this._osc('sine', freq, when);
    const g1 = ctx.createGain();
    g1.gain.value = 0.55;
    s1.connect(g1).connect(amp);
    const s2 = this._osc('sine', freq * 2, when);
    const g2 = ctx.createGain();
    g2.gain.value = 0.2;
    s2.connect(g2).connect(amp);
    oscs.push(s1, s2, lfo);
    this._partial(out, freq * 4, when, 0.07, 0.09);
    this._partial(out, freq * 6.02, when, 0.03, 0.05);
    this._click(out, when, 0.05, 5200, 1.4, 0.008);
    const release = (t, tau) => {
      amp.gain.cancelScheduledValues(t);
      amp.gain.setTargetAtTime(0, t, tau);
      for (const o of oscs) o.stop(t + tau * 8);
    };
    if (!sustain) release(when + Math.max(0.25, dur * 0.92), 0.3);
    return { stop: (t) => release(t, 0.22) };
  }

  // -------------------------------------------------------------------------------
  // Sounds found across the sea (each one is the gift of a place). Same contract as the
  // three above: (dest, freq, when, gain, dur) -> { stop(when) }, dur null = hold until stop.
  // -------------------------------------------------------------------------------

  /** Music box: a tiny steel tine. Pure, high, and gone quickly. */
  musicbox(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.58;
    out.connect(dest);
    const body = ctx.createGain();
    body.gain.setValueAtTime(0, when);
    body.gain.linearRampToValueAtTime(1, when + 0.002);
    body.gain.setTargetAtTime(0, when + 0.004, dur === null ? 0.9 : 0.5 + Math.min(0.3, dur * 0.12));
    body.connect(out);
    const o1 = this._osc('sine', freq, when);
    o1.connect(body);
    o1.stop(when + 5);
    this._partial(out, freq * 2, when, 0.2, 0.22);
    this._partial(out, freq * 3.03, when, 0.06, 0.09);
    this._partial(out, freq * 5.4, when, 0.05, 0.035);
    this._click(out, when, 0.12, 6400, 2.0, 0.006);
    return {
      stop: (t) => {
        body.gain.cancelScheduledValues(t);
        body.gain.setTargetAtTime(0, t, 0.18);
      },
    };
  }

  /** Harp: a plucked string that brightens at the pluck and mellows as it rings. */
  harp(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.8;
    out.connect(dest);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(1, when + 0.004);
    amp.gain.setTargetAtTime(0, when + 0.006, dur === null ? 1.3 : 0.7 + Math.min(0.5, dur * 0.2));
    amp.connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(Math.min(5200, freq * 9), when);
    lp.frequency.setTargetAtTime(Math.max(500, freq * 1.6), when + 0.01, 0.22);
    lp.connect(amp);
    const saw = this._osc('sawtooth', freq, when);
    const sawG = ctx.createGain();
    sawG.gain.value = 0.34;
    saw.connect(sawG).connect(lp);
    const sine = this._osc('sine', freq, when);
    const sineG = ctx.createGain();
    sineG.gain.value = 0.55;
    sine.connect(sineG).connect(amp);
    saw.stop(when + 7);
    sine.stop(when + 7);
    this._click(out, when, 0.06, 2400, 0.9, 0.012);
    return {
      stop: (t) => {
        amp.gain.cancelScheduledValues(t);
        amp.gain.setTargetAtTime(0, t, 0.16);
      },
    };
  }

  /** Marimba: a soft mallet on a wooden bar, with the bar's bright fourth harmonic. */
  marimba(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.72;
    out.connect(dest);
    const body = ctx.createGain();
    body.gain.setValueAtTime(0, when);
    body.gain.linearRampToValueAtTime(1, when + 0.003);
    body.gain.setTargetAtTime(0, when + 0.005, dur === null ? 0.6 : 0.3 + Math.min(0.25, dur * 0.1));
    body.connect(out);
    const o1 = this._osc('sine', freq, when);
    o1.connect(body);
    o1.stop(when + 4);
    this._partial(out, freq * 4, when, 0.22, 0.07);
    this._partial(out, freq * 9.2, when, 0.05, 0.02);
    const th = this._osc('sine', 240, when);
    th.frequency.exponentialRampToValueAtTime(110, when + 0.04);
    const thG = ctx.createGain();
    thG.gain.setValueAtTime(0.2, when);
    thG.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    th.connect(thG).connect(out);
    th.stop(when + 0.1);
    this._click(out, when, 0.09, 1500, 0.9, 0.014);
    return {
      stop: (t) => {
        body.gain.cancelScheduledValues(t);
        body.gain.setTargetAtTime(0, t, 0.1);
      },
    };
  }

  /** Wind flute: breath over a pure tone, with a slow waver once it has settled. */
  flute(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.6;
    out.connect(dest);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(1, when + 0.05);
    amp.gain.setTargetAtTime(0.8, when + 0.06, 0.3);
    amp.connect(out);
    const lfo = this._osc('sine', 4.8, when);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(0, when);
    lfoG.gain.linearRampToValueAtTime(6, when + 0.5);
    lfo.connect(lfoG);
    const o1 = this._osc('sine', freq, when);
    lfoG.connect(o1.detune);
    const g1 = ctx.createGain();
    g1.gain.value = 0.8;
    o1.connect(g1).connect(amp);
    const o2 = this._osc('sine', freq * 2, when);
    lfoG.connect(o2.detune);
    const g2 = ctx.createGain();
    g2.gain.value = 0.14;
    o2.connect(g2).connect(amp);
    const o3 = this._osc('triangle', freq * 3, when);
    const g3 = ctx.createGain();
    g3.gain.value = 0.04;
    o3.connect(g3).connect(amp);
    // the breath: band-passed noise riding on the note
    const breath = ctx.createBufferSource();
    breath.buffer = this._noise;
    breath.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(7000, freq * 2.2);
    bp.Q.value = 1.1;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.22, when);
    bg.gain.setTargetAtTime(0.07, when + 0.04, 0.12);
    breath.connect(bp).connect(bg).connect(amp);
    breath.start(when, Math.random() * 2);
    const nodes = [o1, o2, o3, lfo, breath];
    const release = (t, tau) => {
      amp.gain.cancelScheduledValues(t);
      amp.gain.setTargetAtTime(0, t, tau);
      for (const n of nodes) n.stop(t + tau * 8);
    };
    if (dur !== null) release(when + Math.max(0.3, dur * 0.9), 0.14);
    return { stop: (t) => release(t, 0.12) };
  }

  /** Steel pan: a struck dish whose octave and twelfth ring as loudly as the note itself. */
  pan(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.5;
    out.connect(dest);
    const body = ctx.createGain();
    body.gain.setValueAtTime(0, when);
    body.gain.linearRampToValueAtTime(1, when + 0.004);
    body.gain.setTargetAtTime(0, when + 0.006, dur === null ? 0.9 : 0.5 + Math.min(0.4, dur * 0.18));
    body.connect(out);
    const o1 = this._osc('sine', freq * 1.008, when);
    o1.frequency.setTargetAtTime(freq, when, 0.05); // the little "boing" as the dish settles
    o1.connect(body);
    const o2 = this._osc('sine', freq * 2.004, when);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.5, when);
    g2.gain.setTargetAtTime(0.14, when + 0.01, 0.2);
    o2.connect(g2).connect(body);
    const o3 = this._osc('sine', freq * 3.0, when);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.26, when);
    g3.gain.setTargetAtTime(0.04, when + 0.01, 0.12);
    o3.connect(g3).connect(body);
    for (const o of [o1, o2, o3]) o.stop(when + 6);
    this._partial(out, freq * 4.1, when, 0.06, 0.05);
    this._click(out, when, 0.1, 2600, 1.2, 0.012);
    return {
      stop: (t) => {
        body.gain.cancelScheduledValues(t);
        body.gain.setTargetAtTime(0, t, 0.14);
      },
    };
  }

  /** Firefly: a soft blink of a note, round at the edges, with a tiny rise as it lights. */
  firefly(dest, freq, when, gain, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain * 0.7;
    out.connect(dest);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(1, when + 0.006);
    amp.gain.setTargetAtTime(dur === null ? 0.5 : 0, when + 0.01, dur === null ? 0.2 : 0.3 + Math.min(0.25, dur * 0.12));
    amp.connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(Math.min(4200, freq * 5), when);
    lp.frequency.setTargetAtTime(Math.max(700, freq * 1.8), when + 0.01, 0.12);
    lp.connect(amp);
    const sq = this._osc('square', freq * 0.985, when);
    sq.frequency.setTargetAtTime(freq, when, 0.02);
    const sqG = ctx.createGain();
    sqG.gain.value = 0.5;
    sq.connect(sqG).connect(lp);
    const sine = this._osc('sine', freq, when);
    const sineG = ctx.createGain();
    sineG.gain.value = 0.5;
    sine.connect(sineG).connect(amp);
    sq.stop(when + (dur === null ? 30 : 3));
    sine.stop(when + (dur === null ? 30 : 3));
    this._partial(out, freq * 2, when, 0.16, 0.05);
    return {
      stop: (t) => {
        amp.gain.cancelScheduledValues(t);
        amp.gain.setTargetAtTime(0, t, 0.08);
        sq.stop(t + 1);
        sine.stop(t + 1);
      },
    };
  }

  _instrument(name) {
    switch (name) {
      case 'root': return this.root;
      case 'glass': return this.glass;
      case 'musicbox': return this.musicbox;
      case 'harp': return this.harp;
      case 'marimba': return this.marimba;
      case 'flute': return this.flute;
      case 'pan': return this.pan;
      case 'firefly': return this.firefly;
      default: return this.bell;
    }
  }

  // -------------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------------

  /**
   * Play a note of a movement's instrument.
   * @param {object} o instrument, octave, pitch, when (audio time), dur (sec|null), bus, gain, pan
   */
  note(o) {
    if (!this.ready) return null;
    const when = Math.max(o.when ?? 0, this.ctx.currentTime);
    const dest = this._pan(this.bus[o.bus ?? 'player'], o.pan ?? 0);
    const freq = freqOf(midiOf(o.pitch, o.octave));
    return this._instrument(o.instrument).call(this, dest, freq, when, o.gain ?? 1, o.dur ?? 1.2);
  }

  /** The player pressed a key that builds ground. Sounds now. */
  playerDown(chart, pitch, sustain, durSec) {
    if (!this.ready) return;
    this.playerUp(pitch);
    const v = this.note({ instrument: chart.instrument, octave: chart.octave, pitch, dur: sustain ? null : durSec, bus: 'player' });
    if (sustain && v) this.held.set(pitch, v);
  }

  /**
   * A tapped note in free play. Only one of these sounds at a time: the note before it is let
   * go as the new one starts, so sustained sounds never pile into a blur.
   */
  playerTap(chart, pitch, durSec) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (this.tapVoice) this.tapVoice.stop(t + 0.02);
    this.tapVoice = this.note({ instrument: chart.instrument, octave: chart.octave, pitch, dur: durSec, bus: 'player' });
  }

  playerUp(pitch) {
    const v = this.held.get(pitch);
    if (v) {
      v.stop(this.now());
      this.held.delete(pitch);
    }
  }

  releaseAll() {
    for (const p of [...this.held.keys()]) this.playerUp(p);
  }

  /** A key that builds nothing: a quiet, harmless shimmer (never a strong wrong note). */
  flourish(chart, pitch) {
    if (!this.ready) return;
    const t = this.now();
    const freq = freqOf(midiOf(pitch, chart.octave + 1));
    const g = this.ctx.createGain();
    g.gain.value = MIX.FLOURISH;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    g.connect(hp).connect(this.bus.world);
    this._partial(g, freq, t, 0.5, 0.09);
    this._partial(g, freq * 2, t, 0.25, 0.05);
    this._click(g, t, 0.25, 6000, 2, 0.02);
  }

  // -------------------------------------------------------------------------------
  // Backing voices
  // -------------------------------------------------------------------------------
  pad(midis, when, durSec, gain) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    const atk = Math.min(0.9, durSec * 0.3);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(gain, when + atk);
    out.gain.setTargetAtTime(0, when + durSec - 0.1, 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = 0.3;
    lp.connect(out).connect(this.bus.backing);
    for (const m of midis) {
      const f = freqOf(m);
      for (const det of [-5, 6]) {
        const o = this._osc('triangle', f, when, det);
        const g = ctx.createGain();
        g.gain.value = 0.2;
        o.connect(g).connect(lp);
        o.stop(when + durSec + 3);
      }
    }
  }

  /** A high, airy layer for the fuller arrangements. */
  air(midis, when, durSec, gain) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(gain, when + durSec * 0.45);
    out.gain.setTargetAtTime(0, when + durSec - 0.2, 0.7);
    out.connect(this.bus.backing);
    for (const m of midis) {
      const o = this._osc('sine', freqOf(m), when, (Math.random() - 0.5) * 8);
      const g = ctx.createGain();
      g.gain.value = 0.16;
      o.connect(g).connect(out);
      o.stop(when + durSec + 4);
    }
  }

  bass(midi, when, durSec, gain) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const f = freqOf(midi);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(gain, when + 0.02);
    out.gain.setTargetAtTime(gain * 0.4, when + 0.03, 0.25);
    out.gain.setTargetAtTime(0, when + durSec * 0.8, 0.22);
    out.connect(this.bus.backing);
    const o = this._osc('sine', f, when);
    const o2 = this._osc('triangle', f * 2, when);
    const g2 = ctx.createGain();
    g2.gain.value = 0.16;
    o.connect(out);
    o2.connect(g2).connect(out);
    o.stop(when + durSec + 2);
    o2.stop(when + durSec + 2);
  }

  /** The pulse: a soft tick, with a felt heartbeat on strong beats. */
  tick(when, gain, strong = false) {
    if (!this.ready) return;
    this._click(this.bus.backing, when, gain * (strong ? 1 : 0.6), strong ? 4200 : 5600, 2.2, 0.03);
    if (strong) {
      const o = this._osc('sine', 82, when);
      o.frequency.exponentialRampToValueAtTime(52, when + 0.12);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain * 0.9, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      o.connect(g).connect(this.bus.backing);
      o.stop(when + 0.25);
    }
  }

  shaker(when, gain) {
    if (!this.ready) return;
    this._click(this.bus.backing, when, gain, 8200, 0.9, 0.045);
  }

  /** The waterwheel's tok, once it is turning. */
  wood(when, gain, freq = 520) {
    if (!this.ready) return;
    const o = this._osc('sine', freq, when);
    o.frequency.exponentialRampToValueAtTime(freq * 0.7, when + 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    o.connect(g).connect(this.bus.world);
    o.stop(when + 0.12);
    this._click(this.bus.world, when, gain * 0.5, 1800, 1.5, 0.012);
  }

  /** Count-in / UI click. */
  count(when, strong) {
    if (!this.ready) return;
    const t = Math.max(when ?? this.now(), this.now());
    const o = this._osc('sine', strong ? 1320 : 990, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(this.bus.ui);
    o.stop(t + 0.12);
  }

  // -------------------------------------------------------------------------------
  // The world, in tune
  // -------------------------------------------------------------------------------

  /** A hanging chime, a lantern lighting, a pane of glass waking: struck metal on chord tones. */
  chime(midis, gain = 0.5, when = null) {
    if (!this.ready) return;
    const t0 = Math.max(when ?? this.now(), this.now());
    midis.forEach((m, i) => {
      const t = t0 + i * 0.07;
      const f = freqOf(m);
      const g = this.ctx.createGain();
      g.gain.value = gain;
      g.connect(this.bus.world);
      this._partial(g, f, t, 0.5, 0.9);
      this._partial(g, f * 2.76, t, 0.2, 0.35);
      this._partial(g, f * 5.4, t, 0.08, 0.12);
      this._click(g, t, 0.1, 7000, 2, 0.01);
    });
  }

  /** Something leaping from water. */
  plip(midi, gain = 0.4, when = null) {
    if (!this.ready) return;
    const t = Math.max(when ?? this.now(), this.now());
    const f = freqOf(midi);
    const o = this._osc('sine', f * 0.6, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.bus.world);
    o.stop(t + 0.3);
  }

  /** A long breath of air and light: currents, wheels starting, the lens charging. */
  swell(durSec, gain = 0.3, bright = 1800) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now();
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(bright, t + durSec * 0.7);
    bp.frequency.exponentialRampToValueAtTime(500, t + durSec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + durSec * 0.6);
    g.gain.linearRampToValueAtTime(0, t + durSec);
    src.connect(bp).connect(g).connect(this.bus.world);
    src.start(t);
    src.stop(t + durSec + 0.1);
  }

  /** The beam: a held breath, then every note of the home chord opening upward. */
  ignite() {
    if (!this.ready) return;
    const t = this.now();
    this.swell(2.6, 0.4, 5200);
    const chord = [36, 48, 55, 60, 64, 67, 72, 76, 79, 84];
    chord.forEach((m, i) => {
      const when = t + 1.5 + i * 0.09;
      const f = freqOf(m);
      const o = this._osc(i < 2 ? 'sine' : 'triangle', f, when, (i % 2 ? 4 : -4));
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(i < 2 ? 0.3 : 0.11, when + 0.5);
      g.gain.setTargetAtTime(0, when + 3.2, 1.3);
      o.connect(g).connect(this.bus.world);
      o.stop(when + 11);
    });
    this.chime([84, 88, 91, 96], 0.42, t + 1.6);
  }

  // -------------------------------------------------------------------------------
  // Ambience: sea and a little wind, always underneath
  // -------------------------------------------------------------------------------
  _startAmbience() {
    const ctx = this.ctx;
    const mk = (type, freq, q, gain, lfoRate, lfoDepth) => {
      const src = ctx.createBufferSource();
      src.buffer = this._noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoRate;
      const lg = ctx.createGain();
      lg.gain.value = lfoDepth;
      lfo.connect(lg).connect(g.gain);
      src.connect(f).connect(g).connect(this.ambienceBus);
      src.start();
      lfo.start();
    };
    mk('lowpass', 380, 0.4, 0.5, 0.11, 0.3); // slow swells
    mk('lowpass', 900, 0.3, 0.16, 0.17, 0.11);
    mk('bandpass', 2600, 0.6, 0.05, 0.07, 0.04); // foam hiss
    mk('bandpass', 520, 1.6, 0.05, 0.05, 0.04); // wind
  }
}
