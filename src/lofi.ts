// Lofi radio — three chill beats for Free Play, made in the browser.
//
// No audio files: every note is synthesised with the Web Audio API, like the
// rest of the game's sound (so there is nothing to download and nothing to
// license). What makes it read as "lofi" rather than "synth":
//   • jazzy seventh/ninth chords on a soft electric-piano voice, strummed a
//     few milliseconds apart and played a hair late;
//   • a swung boom-bap beat — soft kick, lazy snare, quiet hats;
//   • a round sub bass under it, and a sparse pentatonic lead that plays a
//     phrase, repeats it, varies it, then rests;
//   • the whole mix through a tape chain: low-pass, gentle saturation, slow
//     pitch wobble, vinyl crackle, and the keys "pumping" away from each kick.
// Each track has its own key, tempo, chords and lead voice, an intro, a 16-bar
// form with a B section, and drum breaks — and the lead is improvised, so a
// track never plays exactly the same twice.
//
// The engine runs on ANY BaseAudioContext (the live one, or an offline one for
// tests): `new LofiEngine(ctx, destination)`, then `schedule(until)`.

export type Lead = 'bell' | 'flute' | 'pluck';
interface Chord { bass: number; keys: number[] }
export interface LofiTrack {
  name: string;
  bpm: number;
  /** 0.5 = straight; 0.6 = heavy swing. */
  swing: number;
  a: Chord[];
  b: Chord[];
  /** Pitch classes the lead may use (a pentatonic that fits every chord). */
  scale: number[];
  /** MIDI note the lead hovers around. */
  leadHome: number;
  lead: Lead;
  pad: boolean;
  /** Chance of the extra kicks that make a beat busier. */
  busy: number;
}

// MIDI numbers: C4 = 60.
const C2 = 36, D2 = 38, E2 = 40, F2 = 41, Fs2 = 42, G2 = 43, A2 = 45, B1 = 35;
const ch = (bass: number, ...keys: number[]): Chord => ({ bass, keys });

export const LOFI_TRACKS: LofiTrack[] = [
  {
    name: 'Porch Swing', bpm: 76, swing: 0.58, lead: 'bell', pad: true, busy: 0.4, leadHome: 76,
    scale: [0, 2, 4, 7, 9], // C major pentatonic
    a: [ch(F2, 57, 60, 64, 67), ch(E2, 55, 59, 62, 64), ch(D2, 53, 57, 60, 64), ch(C2, 52, 55, 59, 62)], // Fmaj9  Em7  Dm9  Cmaj9
    b: [ch(F2, 57, 60, 64, 67), ch(G2, 59, 62, 64, 67), ch(E2, 55, 59, 62, 64), ch(A2, 55, 60, 64, 67)], // Fmaj9  G6   Em7  Am7
  },
  {
    name: 'Rain on the Cove', bpm: 68, swing: 0.6, lead: 'flute', pad: true, busy: 0.2, leadHome: 72,
    scale: [9, 0, 2, 4, 7], // A minor pentatonic
    a: [ch(A2, 55, 59, 60, 64), ch(F2, 57, 60, 64, 67), ch(D2, 53, 57, 60, 64), ch(E2, 55, 59, 62, 64)], // Am9  Fmaj9  Dm9  Em7
    b: [ch(F2, 57, 60, 64), ch(G2, 59, 62, 64, 67), ch(A2, 55, 59, 60, 64), ch(A2, 55, 60, 64, 67)],     // Fmaj7  G6   Am9  Am7
  },
  {
    name: 'Bikes at Sunset', bpm: 84, swing: 0.56, lead: 'pluck', pad: false, busy: 0.6, leadHome: 78,
    scale: [2, 4, 6, 9, 11], // D major pentatonic
    a: [ch(D2, 54, 57, 61, 64), ch(B1, 57, 62, 66), ch(G2, 54, 59, 62, 66), ch(A2, 55, 62, 64, 67)],     // Dmaj9  Bm7  Gmaj7  A7sus4
    b: [ch(G2, 54, 59, 62, 66), ch(Fs2, 57, 61, 64), ch(E2, 55, 59, 62, 66), ch(A2, 55, 61, 64, 67)],    // Gmaj7  F#m7  Em9  A7
  },
];

/** Bars in one full pass of the form (A A B A), and how many passes a track gets. */
const FORM_BARS = 16;
export const TRACK_BARS = FORM_BARS * 3;
const INTRO_BARS = 2;
/** Output gain at full level (sits the radio under the game's sound effects). */
export const OUT_LEVEL = 0.24;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface LeadNote { step: number; len: number; midi: number; vel: number }

export class LofiEngine {
  readonly ctx: BaseAudioContext;
  private out: GainNode;        // overall level (ducked by the game)
  private mix: GainNode;        // everything pre-tape
  private pump: GainNode;       // keys + pad + lead: ducks on each kick
  private noise: AudioBuffer;
  private crackle: AudioBufferSourceNode | null = null;
  private wobble: OscillatorNode[] = [];
  private rnd: () => number = Math.random;

  trackIndex = 0;
  /** Bars played of the current track. */
  bar = 0;
  private step = 0;
  /** Context time at which the next step sounds. */
  private nextTime = 0;
  private phraseA: LeadNote[] = [];
  private phraseB: LeadNote[] = [];
  private leadPos = 0;
  /** Called (from the scheduler) when a track starts — for the "now playing" chip. */
  onTrack: ((index: number) => void) | null = null;

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);

    // ---- the tape: low-pass → soft saturation → wow & flutter ----
    this.mix = ctx.createGain();
    this.mix.gain.value = 0.9;
    const tape = ctx.createBiquadFilter();
    tape.type = 'lowpass'; tape.frequency.value = 5600; tape.Q.value = 0.4;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 48;
    const sat = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
    sat.curve = curve;
    const wow = ctx.createDelay(0.1);
    wow.delayTime.value = 0.014;
    // Slow wow (a warped record) + a little fast flutter (a tired motor).
    for (const [rate, depth] of [[0.37, 0.0011], [5.6, 0.00012]] as [number, number][]) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
      const g = ctx.createGain(); g.gain.value = depth;
      lfo.connect(g).connect(wow.delayTime); lfo.start();
      this.wobble.push(lfo);
    }
    this.mix.connect(hp).connect(tape).connect(sat).connect(wow).connect(this.out);

    this.pump = ctx.createGain();
    this.pump.connect(this.mix);

    // One second of white noise, shared by the hats and snares.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startCrackle();
  }

  /** Vinyl surface noise: faint hiss with a scatter of ticks and pops, looped. */
  private startCrackle() {
    const c = this.ctx, secs = 7;
    const buf = c.createBuffer(1, c.sampleRate * secs, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.012;
    const pops = secs * 9;
    for (let p = 0; p < pops; p++) {
      const at = Math.floor(Math.random() * (d.length - 400));
      const amp = Math.random() < 0.12 ? 0.5 + Math.random() * 0.4 : 0.08 + Math.random() * 0.2;
      const len = 30 + Math.floor(Math.random() * 120);
      const sign = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < len; i++) d[at + i] += sign * amp * Math.exp(-i / (len * 0.22)) * (Math.random() * 0.6 + 0.4);
    }
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.35;
    const g = c.createGain(); g.gain.value = 0.16;
    src.connect(bp).connect(g).connect(this.out);
    src.start();
    this.crackle = src;
  }

  /** 0..1 — the game ducks the radio (Siren Head out) or fades it in/out. */
  setLevel(v: number, ramp = 0.8) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * OUT_LEVEL, t, ramp / 3);
  }

  /** Begin (or jump to) a track at context time `at`. */
  startTrack(index: number, at: number) {
    this.trackIndex = ((index % LOFI_TRACKS.length) + LOFI_TRACKS.length) % LOFI_TRACKS.length;
    this.bar = 0; this.step = 0; this.nextTime = at;
    this.phraseA = []; this.phraseB = []; this.leadPos = 0; this.currentPhrase = [];
    this.onTrack?.(this.trackIndex);
  }

  dispose() {
    try { this.crackle?.stop(); } catch { /* already stopped */ }
    for (const o of this.wobble) { try { o.stop(); } catch { /* already stopped */ } }
    this.out.disconnect();
  }

  /** Queue every note that starts before `until` (context seconds). */
  schedule(until: number) {
    while (this.nextTime < until) {
      const tr = LOFI_TRACKS[this.trackIndex];
      const stepDur = 60 / tr.bpm / 4;
      // Swing: push the off-beat eighths late (and the odd sixteenths a little).
      const sw = (tr.swing - 0.5) * 2 * stepDur;
      const pos = this.step % 4;
      const t = this.nextTime + (pos === 2 ? sw : pos === 3 ? sw * 0.5 : 0);
      this.playStep(tr, this.bar, this.step, t, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step === 16) {
        this.step = 0; this.bar++;
        // Track over: the next one comes straight in on the following bar.
        if (this.bar >= TRACK_BARS + 1) this.startTrack(this.trackIndex + 1, this.nextTime);
      }
    }
  }

  // ---------------------------------------------------------------- music --
  private playStep(tr: LofiTrack, bar: number, step: number, t: number, stepDur: number) {
    const r = this.rnd;
    const outro = bar >= TRACK_BARS;                       // one last bar: just the chord ringing
    const formBar = bar % FORM_BARS;
    const block = Math.floor(formBar / 4);                 // A A B A
    const chords = block === 2 ? tr.b : tr.a;
    const chord = chords[formBar % 4];
    const intro = bar < INTRO_BARS;
    // A breath every 16 bars: the drums drop out for the last bar of the form.
    const drumBreak = formBar === FORM_BARS - 1;
    const drums = !intro && !outro && !drumBreak;
    const late = () => 0.004 + r() * 0.012;                // everything sits a touch behind the beat

    // ---- keys: the chord on one, a softer push later in the bar ----
    if (step === 0) this.keys(chord, t + late(), stepDur * 14, outro ? 0.8 : 1);
    if (!outro && step === 10 && r() < 0.55) this.keys(chord, t + late(), stepDur * 5, 0.5);
    if (!outro && step === 14 && r() < 0.3) {
      const nb = (formBar + 1) % FORM_BARS;
      const next = (Math.floor(nb / 4) === 2 ? tr.b : tr.a)[nb % 4];
      this.keys(next, t + late(), stepDur * 2.5, 0.42);    // lean into the next chord early
    }
    if (tr.pad && step === 0 && !outro) this.pad(chord, t, stepDur * 16);

    // ---- bass: root on one, a pickup before three ----
    if (!intro && !outro) {
      if (step === 0) this.bass(chord.bass, t + late(), stepDur * 7, 1);
      if (step === 10 && r() < 0.75) this.bass(chord.bass + (r() < 0.35 ? 7 : 0), t + late(), stepDur * 3, 0.75);
      if (step === 14 && r() < 0.3) this.bass(chord.bass + 12, t + late(), stepDur * 1.6, 0.55);
    }

    // ---- drums: boom-bap ----
    if (drums) {
      const kick = step === 0 || (step === 7 && r() < tr.busy * 0.7) || (step === 8 && r() < 0.3) || (step === 10 && r() < tr.busy);
      if (kick) this.kick(t, step === 0 ? 1 : 0.78);
      if (step === 4 || step === 12) this.snare(t + 0.006 + r() * 0.01, 1);
      if (step === 15 && r() < 0.12) this.snare(t, 0.35);                     // ghost note
      if (step % 2 === 0) this.hat(t, step % 4 === 0 ? 0.8 : 0.5 + r() * 0.25, step === 14 && r() < 0.18);
      else if (r() < 0.14) this.hat(t, 0.28, false);
    } else if (drumBreak && step === 12) {
      this.snare(t, 0.55);                                                    // a single pickup back in
    }

    // ---- lead: a two-bar phrase, said twice, varied, then left alone ----
    if (step === 0 && (intro || outro)) this.currentPhrase = [];
    if (!intro && !outro && step === 0 && bar % 2 === 0) this.planLead(tr, bar);
    for (const n of this.currentPhrase) {
      if (n.step === step + (bar % 2) * 16) this.leadNote(tr.lead, n.midi, t + late(), n.len * stepDur, n.vel);
    }
  }

  private currentPhrase: LeadNote[] = [];
  /** Decide what the lead does for the next two bars. */
  private planLead(tr: LofiTrack, bar: number) {
    const r = this.rnd;
    const slot = Math.floor((bar % FORM_BARS) / 2);          // 0..7 across the form
    if (!this.phraseA.length || (bar % FORM_BARS === 0 && r() < 0.6)) this.phraseA = this.improvise(tr);
    if (!this.phraseB.length || (bar % FORM_BARS === 8 && r() < 0.7)) this.phraseB = this.improvise(tr);
    // A  A'  –  A   |  B  B'  A  –     (– = the lead lays out)
    const plan = ['A', 'A2', '', 'A', 'B', 'B2', 'A', ''][slot];
    if (!plan) { this.currentPhrase = []; return; }
    const base = plan.startsWith('A') ? this.phraseA : this.phraseB;
    this.currentPhrase = plan.endsWith('2')
      // The answer: same rhythm, the ending bent somewhere new.
      ? base.map((n, i) => (i >= base.length - 2 ? { ...n, midi: this.nearScale(tr, n.midi + (r() < 0.5 ? -2 : 3)) } : n))
      : base;
  }

  /** Snap a MIDI note onto the track's pentatonic. */
  private nearScale(tr: LofiTrack, midi: number): number {
    for (let d = 0; d < 4; d++) {
      for (const m of [midi + d, midi - d]) if (tr.scale.includes(((m % 12) + 12) % 12)) return m;
    }
    return midi;
  }

  /** A fresh two-bar phrase: a few notes wandering stepwise round "home". */
  private improvise(tr: LofiTrack): LeadNote[] {
    const r = this.rnd;
    const RHYTHMS: [number, number][][] = [
      [[0, 3], [4, 2], [6, 4], [12, 2], [14, 6], [22, 6]],
      [[2, 2], [4, 4], [10, 2], [12, 6], [20, 3], [24, 6]],
      [[0, 6], [8, 2], [10, 2], [12, 8], [26, 4]],
      [[4, 2], [6, 2], [8, 6], [16, 2], [18, 2], [20, 8]],
      [[0, 2], [3, 3], [6, 6], [16, 4], [22, 2], [24, 6]],
    ];
    const rhythm = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    // The scale laid out across two octaves round home.
    const ladder: number[] = [];
    for (let m = tr.leadHome - 12; m <= tr.leadHome + 9; m++) if (tr.scale.includes(((m % 12) + 12) % 12)) ladder.push(m);
    let i = ladder.findIndex((m) => m >= tr.leadHome);
    this.leadPos = i;
    const out: LeadNote[] = [];
    for (const [step, len] of rhythm) {
      if (out.length && r() < 0.14) continue;                // leave a hole now and then
      const move = r();
      i += move < 0.38 ? -1 : move < 0.76 ? 1 : move < 0.88 ? 2 : -2;
      // Drift back toward home so it never climbs off into the rafters.
      if (i > this.leadPos + 3) i -= 2;
      if (i < this.leadPos - 3) i += 2;
      i = Math.max(0, Math.min(ladder.length - 1, i));
      out.push({ step, len, midi: ladder[i], vel: 0.7 + r() * 0.3 });
    }
    return out;
  }

  // --------------------------------------------------------------- voices --
  /** Soft electric piano: a strummed chord of bell-ish sine pairs. */
  private keys(chord: Chord, t: number, dur: number, vel: number) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3;
    lp.connect(this.pump);
    chord.keys.forEach((m, i) => {
      const at = t + i * (0.012 + this.rnd() * 0.012);       // strum, low note first
      const f = mtof(m), v = vel * (0.088 + this.rnd() * 0.018) * (i === 0 ? 1.1 : 1);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(v, at + 0.008);
      g.gain.setTargetAtTime(0.0001, at + 0.03, Math.max(0.25, dur * 0.42));
      g.connect(lp);
      const end = at + dur * 2 + 0.6;
      for (const [mult, lvl, det] of [[1, 1, -3], [1, 0.8, 4], [2, 0.3, 0], [3, 0.08, 0]] as [number, number, number][]) {
        const o = c.createOscillator();
        o.type = 'sine'; o.frequency.value = f * mult; o.detune.value = det;
        const og = c.createGain(); og.gain.value = lvl;
        o.connect(og).connect(g); o.start(at); o.stop(end);
      }
      // The "tine": a quick glassy ping at the top of the note.
      const tine = c.createOscillator(); tine.type = 'sine'; tine.frequency.value = f * 5.02;
      const tg = c.createGain();
      tg.gain.setValueAtTime(0.07 * vel, at); tg.gain.exponentialRampToValueAtTime(0.0005, at + 0.09);
      tine.connect(tg).connect(g); tine.start(at); tine.stop(at + 0.1);
    });
  }

  /** A warm bed under the chord (root, fifth and the top note), barely there. */
  private pad(chord: Chord, t: number, dur: number) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    lp.connect(g).connect(this.pump);
    for (const m of [chord.bass + 24, chord.bass + 31, chord.keys[chord.keys.length - 1]]) {
      for (const det of [-8, 7]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur * 1.1);
      }
    }
  }

  private bass(midi: number, t: number, dur: number, vel: number) {
    const c = this.ctx, f = mtof(midi);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1 * vel, t + 0.018);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.7, 0.09);
    lp.connect(g).connect(this.mix);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    // Plenty of second harmonic: a phone or laptop speaker can't play the
    // fundamental, but it can play this — and the ear fills in the rest.
    const g2 = c.createGain(); g2.gain.value = 0.9;
    o.connect(lp); o2.connect(g2).connect(lp);
    const end = t + dur + 0.5;
    o.start(t); o2.start(t); o.stop(end); o2.stop(end);
  }

  private kick(t: number, vel: number) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.2);
    o.connect(g).connect(this.mix); o.start(t); o.stop(t + 0.22);
    // The beater: a soft knock up in the mids, so the kick reads on any speaker.
    const k = c.createOscillator(); k.type = 'triangle';
    k.frequency.setValueAtTime(320, t); k.frequency.exponentialRampToValueAtTime(120, t + 0.03);
    const kg = c.createGain();
    kg.gain.setValueAtTime(0.11 * vel, t); kg.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
    k.connect(kg).connect(this.mix); k.start(t); k.stop(t + 0.06);
    // The pump: the keys duck out of the kick's way and swell back.
    const p = this.pump.gain;
    p.setTargetAtTime(0.5 + 0.2 * (1 - vel), t, 0.005);
    p.setTargetAtTime(1, t + 0.03, 0.11);
  }

  private snare(t: number, vel: number) {
    const c = this.ctx;
    const n = c.createBufferSource(); n.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4 * vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.17);
    n.connect(bp).connect(g).connect(this.mix);
    n.start(t, this.rnd() * 0.5, 0.2);
    // A woody thump under the noise, like a rim shot.
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(235, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.07);
    const og = c.createGain();
    og.gain.setValueAtTime(0.13 * vel, t); og.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);
    o.connect(og).connect(this.mix); o.start(t); o.stop(t + 0.1);
  }

  private hat(t: number, vel: number, open: boolean) {
    const c = this.ctx;
    const n = c.createBufferSource(); n.buffer = this.noise;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3600;
    const g = c.createGain();
    const len = open ? 0.22 : 0.045;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.34 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0006, t + len);
    n.connect(hp).connect(g).connect(this.mix);
    n.start(t, this.rnd() * 0.6, len + 0.02);
  }

  private leadNote(kind: Lead, midi: number, t: number, dur: number, vel: number) {
    const c = this.ctx, f = mtof(midi);
    const g = c.createGain();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.connect(g).connect(this.pump);
    const end = t + dur + 1.2;
    if (kind === 'bell') {
      // Kalimba / music-box: a sine with a quick metallic overtone.
      lp.frequency.value = 3000;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.27 * vel, t + 0.005);
      g.gain.setTargetAtTime(0.0001, t + 0.02, 0.26 + dur * 0.15);
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.01;
      const g2 = c.createGain(); g2.gain.setValueAtTime(0.22, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(lp); o2.connect(g2).connect(lp);
      o.start(t); o2.start(t); o.stop(end); o2.stop(t + 0.14);
    } else if (kind === 'flute') {
      // Breathy and slow to speak, with a late vibrato.
      lp.frequency.value = 2200;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.27 * vel, t + 0.07);
      g.gain.setValueAtTime(0.27 * vel, t + Math.max(0.08, dur * 0.8));
      g.gain.setTargetAtTime(0.0001, t + Math.max(0.09, dur * 0.8), 0.12);
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const vib = c.createOscillator(); vib.frequency.value = 5.2;
      const vg = c.createGain();
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + 0.35);
      vib.connect(vg).connect(o.frequency);
      o.connect(lp); o.start(t); vib.start(t); o.stop(end); vib.stop(end);
    } else {
      // Muted-guitar pluck: bright for an instant, then the filter closes.
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(650, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.25 * vel, t + 0.004);
      g.gain.setTargetAtTime(0.0001, t + 0.03, 0.2 + dur * 0.12);
      for (const [type, lvl, det] of [['triangle', 1, 0], ['sawtooth', 0.28, 5]] as [OscillatorType, number, number][]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
        const og = c.createGain(); og.gain.value = lvl;
        o.connect(og).connect(lp); o.start(t); o.stop(end);
      }
    }
  }
}
