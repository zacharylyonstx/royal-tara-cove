// Procedural one-shot SFX via Web Audio. No audio files needed.

import { unmuteProjector } from './world/projectorMedia';

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  unmuteProjector();
}

// --- Combat one-shots ---

export function laserZap() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1100, t0);
  osc.frequency.exponentialRampToValueAtTime(160, t0 + 0.18);
  gain.gain.setValueAtTime(0.18, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.22);
  // little high "twang" overlay
  const osc2 = c.createOscillator();
  const gain2 = c.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(2400, t0);
  osc2.frequency.exponentialRampToValueAtTime(900, t0 + 0.06);
  gain2.gain.setValueAtTime(0.06, t0);
  gain2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
  osc2.connect(gain2).connect(c.destination);
  osc2.start(t0);
  osc2.stop(t0 + 0.07);
}

export function blobSquish() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const bufSize = Math.floor(c.sampleRate * 0.35);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, t0);
  filter.frequency.exponentialRampToValueAtTime(90, t0 + 0.35);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.28, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);
  // Pitched "blop"
  const osc = c.createOscillator();
  const g2 = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(280, t0);
  osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.22);
  g2.gain.setValueAtTime(0.2, t0);
  g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
  osc.connect(g2).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.24);
}

// --- Descent whine (plays during UFO intro) ---

let descendOsc: OscillatorNode | null = null;
let descendOsc2: OscillatorNode | null = null;
let descendGain: GainNode | null = null;

export function ufoDescend() {
  const c = ensureCtx();
  if (!c) return;
  stopUfoDescend(); // make sure no stray osc
  const t0 = c.currentTime;
  descendOsc = c.createOscillator();
  descendOsc2 = c.createOscillator();
  descendGain = c.createGain();
  descendOsc.type = 'sawtooth';
  descendOsc.frequency.setValueAtTime(120, t0);
  descendOsc.frequency.exponentialRampToValueAtTime(420, t0 + 4.0);
  descendOsc2.type = 'square';
  descendOsc2.frequency.setValueAtTime(125, t0);
  descendOsc2.frequency.exponentialRampToValueAtTime(437, t0 + 4.0);
  // Tremolo via gain modulation
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.setValueAtTime(7, t0);
  lfoGain.gain.value = 0.06;
  lfo.connect(lfoGain).connect(descendGain.gain);
  descendGain.gain.setValueAtTime(0.07, t0);
  descendGain.gain.linearRampToValueAtTime(0.16, t0 + 3.8);
  descendOsc.connect(descendGain);
  descendOsc2.connect(descendGain);
  descendGain.connect(c.destination);
  descendOsc.start(t0);
  descendOsc2.start(t0);
  lfo.start(t0);
}

export function stopUfoDescend() {
  const c = ensureCtx();
  if (!c || !descendGain) return;
  try {
    descendGain.gain.cancelScheduledValues(c.currentTime);
    descendGain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.1);
    descendOsc?.stop(c.currentTime + 0.12);
    descendOsc2?.stop(c.currentTime + 0.12);
  } catch (_) { /* ignore */ }
  descendOsc = null;
  descendOsc2 = null;
  descendGain = null;
}

// --- UFO crash: layered impact ---

export function ufoCrash() {
  const c = ensureCtx();
  if (!c) return;
  stopUfoDescend();
  const t0 = c.currentTime;

  // Broad noise burst
  const bufSize = Math.floor(c.sampleRate * 1.8);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1100, t0);
  filter.frequency.exponentialRampToValueAtTime(60, t0 + 1.8);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.65, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);

  // Primary sub-thump
  thumpAt(t0, 90, 28, 0.55);
  // Secondary deeper boom (debris settling)
  thumpAt(t0 + 0.25, 60, 22, 0.4);
  // Tertiary low rumble
  thumpAt(t0 + 0.7, 42, 30, 0.25);
}

function thumpAt(t: number, fStart: number, fEnd: number, vol: number) {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(fStart, t);
  osc.frequency.exponentialRampToValueAtTime(fEnd, t + 0.5);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.65);
}

// --- Sustained crackle ambience (UFO wreckage smoldering) ---

let crackleSrc: AudioBufferSourceNode | null = null;
let crackleGain: GainNode | null = null;

export function startCrackleLoop() {
  const c = ensureCtx();
  if (!c) return;
  stopCrackleLoop();
  // Build a 2-second tape-hiss-like buffer with random pops
  const bufSize = Math.floor(c.sampleRate * 2.0);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    let v = (Math.random() * 2 - 1) * 0.08;
    // sporadic pops
    if (Math.random() < 0.0015) v += (Math.random() * 2 - 1) * 0.85;
    data[i] = v;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 700;
  filter.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.value = 0.18;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
  crackleSrc = src;
  crackleGain = gain;
}

export function stopCrackleLoop() {
  const c = ensureCtx();
  if (!c || !crackleSrc || !crackleGain) return;
  try {
    crackleGain.gain.cancelScheduledValues(c.currentTime);
    crackleGain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.4);
    crackleSrc.stop(c.currentTime + 0.45);
  } catch (_) { /* ignore */ }
  crackleSrc = null;
  crackleGain = null;
}

// --- Blob attack on player ---

export function blobAttack() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.14);
  gain.gain.setValueAtTime(0.22, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.16);
}

export function damageHit() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const distort = c.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.4);
  }
  distort.curve = curve;
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420, t0);
  osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.18);
  gain.gain.setValueAtTime(0.28, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
  osc.connect(distort).connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.22);
}

export function gunWind() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.35);
  gain.gain.setValueAtTime(0.0, t0);
  gain.gain.linearRampToValueAtTime(0.14, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.5);
}

export function victoryFanfare() {
  const c = ensureCtx();
  if (!c) return;
  stopCrackleLoop();
  const t0 = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = t0 + i * 0.15;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

export function bossRoar() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // Two-octave detuned sawtooth + sub bass + filter sweep
  const osc1 = c.createOscillator();
  const osc2 = c.createOscillator();
  const sub = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(110, t0);
  osc1.frequency.exponentialRampToValueAtTime(60, t0 + 1.2);
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(115, t0); // slight detune
  osc2.frequency.exponentialRampToValueAtTime(58, t0 + 1.2);
  sub.type = 'sine';
  sub.frequency.setValueAtTime(45, t0);
  sub.frequency.exponentialRampToValueAtTime(30, t0 + 1.2);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t0);
  filter.frequency.exponentialRampToValueAtTime(220, t0 + 1.2);
  gain.gain.setValueAtTime(0.0, t0);
  gain.gain.linearRampToValueAtTime(0.32, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.3);
  osc1.connect(filter);
  osc2.connect(filter);
  sub.connect(filter);
  filter.connect(gain).connect(c.destination);
  osc1.start(t0); osc2.start(t0); sub.start(t0);
  osc1.stop(t0 + 1.4); osc2.stop(t0 + 1.4); sub.stop(t0 + 1.4);
}

export function bossSlam() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // Sub thump + noise impact
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, t0);
  osc.frequency.exponentialRampToValueAtTime(35, t0 + 0.5);
  og.gain.setValueAtTime(0.6, t0);
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
  osc.connect(og).connect(c.destination);
  osc.start(t0); osc.stop(t0 + 0.6);
  // noise burst
  const bufSize = Math.floor(c.sampleRate * 0.4);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(500, t0);
  filter.frequency.exponentialRampToValueAtTime(60, t0 + 0.4);
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.45, t0);
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
  src.connect(filter).connect(ng).connect(c.destination);
  src.start(t0);
}

export function waveAlarm() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // Two short blips ascending — incoming wave alert
  for (let i = 0; i < 2; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = t0 + i * 0.18;
    osc.type = 'square';
    osc.frequency.setValueAtTime(660 + i * 220, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }
}

// --- Procedural music subsystem ---
// Three concurrent layers cross-faded by combat phase. All notes are
// scheduled by an interval that runs at ~4 Hz and queues the next bar.

interface MusicLayer {
  gain: GainNode;
  // Steady references so we can quickly retune
  voices: OscillatorNode[];
  noiseSrc?: AudioBufferSourceNode;
}

let musicMaster: GainNode | null = null;
let peacefulLayer: MusicLayer | null = null;
let combatLayer: MusicLayer | null = null;
let victoryLayer: MusicLayer | null = null;
let musicScheduler: number | null = null;
let nextNoteTime = 0;
let beatCounter = 0;

const PEACEFUL_CHORDS: number[][] = [
  [261.63, 329.63, 392.0],   // C major
  [220.0, 277.18, 329.63],   // A minor
  [293.66, 369.99, 440.0],   // D minor
  [196.0, 246.94, 293.66],   // G major
];

const COMBAT_BASS: number[] = [
  82.41, 82.41, 110.0, 82.41, 73.42, 73.42, 98.0, 110.0,
];

// Major triad cascading ladder for victory layer
const VICTORY_NOTES: number[] = [
  261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51,
];

function ensureMusicMaster(): GainNode | null {
  const c = ensureCtx();
  if (!c) return null;
  if (!musicMaster) {
    musicMaster = c.createGain();
    musicMaster.gain.value = 0.0;
    musicMaster.connect(c.destination);
  }
  return musicMaster;
}

function makeLayer(): MusicLayer | null {
  const c = ensureCtx();
  const master = ensureMusicMaster();
  if (!c || !master) return null;
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(master);
  return { gain: g, voices: [] };
}

function ensureLayers() {
  if (!peacefulLayer) peacefulLayer = makeLayer();
  if (!combatLayer) combatLayer = makeLayer();
  if (!victoryLayer) victoryLayer = makeLayer();
}

export function startMusic() {
  const c = ensureCtx();
  if (!c) return;
  ensureMusicMaster();
  ensureLayers();
  if (musicScheduler !== null) return;
  if (musicMaster) musicMaster.gain.linearRampToValueAtTime(0.45, c.currentTime + 0.5);
  nextNoteTime = c.currentTime + 0.05;
  beatCounter = 0;
  musicScheduler = window.setInterval(() => scheduleAhead(), 200);
}

export function stopMusic() {
  const c = ensureCtx();
  if (!c) return;
  if (musicScheduler !== null) {
    clearInterval(musicScheduler);
    musicScheduler = null;
  }
  if (musicMaster) {
    musicMaster.gain.cancelScheduledValues(c.currentTime);
    musicMaster.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.3);
  }
}

/**
 * Set the relative gain of each layer (0..1). Call this on phase changes.
 */
export function setMusicMix(p: { peaceful?: number; combat?: number; victory?: number }) {
  const c = ensureCtx();
  if (!c) return;
  ensureLayers();
  const t = c.currentTime;
  const ramp = 0.6;
  if (peacefulLayer && p.peaceful !== undefined) {
    peacefulLayer.gain.gain.cancelScheduledValues(t);
    peacefulLayer.gain.gain.linearRampToValueAtTime(p.peaceful, t + ramp);
  }
  if (combatLayer && p.combat !== undefined) {
    combatLayer.gain.gain.cancelScheduledValues(t);
    combatLayer.gain.gain.linearRampToValueAtTime(p.combat, t + ramp);
  }
  if (victoryLayer && p.victory !== undefined) {
    victoryLayer.gain.gain.cancelScheduledValues(t);
    victoryLayer.gain.gain.linearRampToValueAtTime(p.victory, t + ramp);
  }
}

function scheduleAhead() {
  const c = ensureCtx();
  if (!c) return;
  const lookahead = 0.3; // schedule 300ms ahead
  while (nextNoteTime < c.currentTime + lookahead) {
    schedulePeacefulPad(nextNoteTime);
    if (beatCounter % 1 === 0) scheduleCombatBeat(nextNoteTime);
    if (beatCounter % 2 === 0) scheduleVictoryNote(nextNoteTime);
    nextNoteTime += 0.5; // 120bpm eighth-note
    beatCounter++;
  }
}

function schedulePeacefulPad(t: number) {
  const c = ensureCtx();
  if (!c || !peacefulLayer) return;
  // Change chord every 8 beats
  const chordIdx = Math.floor(beatCounter / 8) % PEACEFUL_CHORDS.length;
  const chord = PEACEFUL_CHORDS[chordIdx];
  // Fire each note as a soft sine pad with slow attack
  for (const f of chord) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g).connect(peacefulLayer.gain);
    osc.start(t);
    osc.stop(t + 0.75);
  }
}

function scheduleCombatBeat(t: number) {
  const c = ensureCtx();
  if (!c || !combatLayer) return;
  // Bass line
  const f = COMBAT_BASS[beatCounter % COMBAT_BASS.length];
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.4);
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  osc.connect(g).connect(combatLayer.gain);
  osc.start(t);
  osc.stop(t + 0.5);

  // Snare-like noise hit on 2 and 4 (every other beat)
  if (beatCounter % 2 === 1) {
    const bufSize = Math.floor(c.sampleRate * 0.16);
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 1800;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(filt).connect(ng).connect(combatLayer.gain);
    src.start(t);
  }

  // Arpeggio (square wave)
  const arpNotes = [261.63, 329.63, 392.0, 523.25];
  const arp = arpNotes[beatCounter % arpNotes.length];
  const arpOsc = c.createOscillator();
  const arpG = c.createGain();
  arpOsc.type = 'square';
  arpOsc.frequency.setValueAtTime(arp, t);
  arpG.gain.setValueAtTime(0.0, t);
  arpG.gain.linearRampToValueAtTime(0.05, t + 0.02);
  arpG.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  arpOsc.connect(arpG).connect(combatLayer.gain);
  arpOsc.start(t);
  arpOsc.stop(t + 0.3);
}

function scheduleVictoryNote(t: number) {
  const c = ensureCtx();
  if (!c || !victoryLayer) return;
  const f = VICTORY_NOTES[beatCounter % VICTORY_NOTES.length];
  // Triangle "bell"
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.10, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
  osc.connect(g).connect(victoryLayer.gain);
  osc.start(t);
  osc.stop(t + 0.9);

  // Faux brass: detuned saw an octave below, on every 4th beat
  if (beatCounter % 4 === 0) {
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(f * 0.5, t);
    g2.gain.setValueAtTime(0.0, t);
    g2.gain.linearRampToValueAtTime(0.08, t + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1200;
    o2.connect(filt).connect(g2).connect(victoryLayer.gain);
    o2.start(t);
    o2.stop(t + 1.5);
  }
}

export function defeatSting() {
  const c = ensureCtx();
  if (!c) return;
  stopCrackleLoop();
  const t0 = c.currentTime;
  const notes = [392.0, 311.13, 261.63];
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = t0 + i * 0.2;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  });
}

// =====================================================================
// Tornado-mode storm audio. All looping sources route through a single
// `tornadoGroup` GainNode so victory/defeat can fade everything cleanly.
// =====================================================================

let tornadoGroup: GainNode | null = null;
function ensureTornadoGroup(): GainNode | null {
  const c = ensureCtx();
  if (!c) return null;
  if (!tornadoGroup) {
    tornadoGroup = c.createGain();
    tornadoGroup.gain.value = 1;
    tornadoGroup.connect(c.destination);
  }
  return tornadoGroup;
}

function makeNoiseBuffer(c: AudioContext, seconds = 4, color: 'white' | 'pink' | 'brown' = 'white'): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  if (color === 'white') {
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } else if (color === 'pink') {
    // Voss-McCartney lite
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.96300 * b1 + w * 0.296340;
      b2 = 0.57000 * b2 + w * 1.044800;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
  } else {
    // brown
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.04) * 0.998;
      data[i] = last * 4;
    }
  }
  return buf;
}

interface StormLayer {
  src: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

let rainLayer: StormLayer | null = null;
let windLayer: StormLayer | null = null;
let sirenOsc: { osc: OscillatorNode; lfo: OscillatorNode; lfoGain: GainNode; gain: GainNode } | null = null;
let roarLayer: { rumble: OscillatorNode; noise: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
let whooshLayer: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; ratePhase: number } | null = null;

export function startRainLoop() {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp || rainLayer) return;
  const src = c.createBufferSource();
  src.buffer = makeNoiseBuffer(c, 4, 'brown');
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.5;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(grp);
  src.start();
  rainLayer = { src, filter, gain };
}

export function setRainVolume(v: number) {
  if (!rainLayer) return;
  const c = ensureCtx();
  if (!c) return;
  rainLayer.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.35, c.currentTime, 0.2);
}

export function startWindLoop() {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp || windLayer) return;
  const src = c.createBufferSource();
  src.buffer = makeNoiseBuffer(c, 4, 'pink');
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(grp);
  src.start();
  windLayer = { src, filter, gain };
}

export function setWindVolume(v: number) {
  if (!windLayer) return;
  const c = ensureCtx();
  if (!c) return;
  windLayer.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.28, c.currentTime, 0.3);
}

export function startSirenLoop() {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp || sirenOsc) return;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 380;
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.18;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(osc.frequency);
  const gain = c.createGain();
  gain.gain.value = 0;
  osc.connect(gain).connect(grp);
  osc.start();
  lfo.start();
  sirenOsc = { osc, lfo, lfoGain, gain };
}

export function setSirenVolume(v: number) {
  if (!sirenOsc) return;
  const c = ensureCtx();
  if (!c) return;
  sirenOsc.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.12, c.currentTime, 0.4);
}

export function startRoarLoop() {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp || roarLayer) return;
  const rumble = c.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 70;
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuffer(c, 4, 'pink');
  noise.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  filter.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.value = 0;
  rumble.connect(gain);
  noise.connect(filter).connect(gain);
  gain.connect(grp);
  rumble.start();
  noise.start();
  roarLayer = { rumble, noise, filter, gain };
}

export function setRoarVolume(v: number) {
  if (!roarLayer) return;
  const c = ensureCtx();
  if (!c) return;
  roarLayer.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.5, c.currentTime, 0.25);
}

export function hailTick(panX: number = 0, pitch: number = 1) {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(2200 * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(900 * pitch, t0 + 0.02);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.07, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
  const panner = c.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, panX));
  osc.connect(gain).connect(panner).connect(grp);
  osc.start(t0);
  osc.stop(t0 + 0.04);
}

export function lightningStrike(distance: number = 0.3) {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp) return;
  const t0 = c.currentTime;
  // Sharp snap
  const snap = c.createOscillator();
  snap.type = 'square';
  snap.frequency.value = 4000;
  const snapG = c.createGain();
  snapG.gain.setValueAtTime(0.25, t0);
  snapG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
  snap.connect(snapG).connect(grp);
  snap.start(t0);
  snap.stop(t0 + 0.06);
  // Rumble after delay (further = longer delay, lower volume)
  const delay = 0.3 + distance * 1.5;
  const t1 = t0 + delay;
  const rumble = c.createBufferSource();
  rumble.buffer = makeNoiseBuffer(c, 2.5, 'brown');
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 180;
  const rumG = c.createGain();
  rumG.gain.setValueAtTime(0, t1);
  rumG.gain.linearRampToValueAtTime(0.4 * (1 - distance * 0.6), t1 + 0.08);
  rumG.gain.exponentialRampToValueAtTime(0.001, t1 + 2.5);
  rumble.connect(filter).connect(rumG).connect(grp);
  rumble.start(t1);
  rumble.stop(t1 + 2.6);
}

export function houseCollapse(distance: number = 0.5) {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp) return;
  const t0 = c.currentTime;
  const volScale = 1 - Math.min(0.7, distance);
  // Wood-snap cracks: 4 quick oscillator clicks
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * 0.04 + Math.random() * 0.02;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800 + Math.random() * 600, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.18 * volScale, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g).connect(grp);
    osc.start(t);
    osc.stop(t + 0.08);
  }
  // Low boom
  const boom = c.createOscillator();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(80, t0);
  boom.frequency.exponentialRampToValueAtTime(40, t0 + 0.4);
  const bG = c.createGain();
  bG.gain.setValueAtTime(0.5 * volScale, t0 + 0.05);
  bG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
  boom.connect(bG).connect(grp);
  boom.start(t0 + 0.05);
  boom.stop(t0 + 0.75);
  // Dust whoosh (filtered noise)
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuffer(c, 1.2, 'pink');
  const nf = c.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 1200;
  nf.Q.value = 0.6;
  const nG = c.createGain();
  nG.gain.setValueAtTime(0, t0);
  nG.gain.linearRampToValueAtTime(0.25 * volScale, t0 + 0.1);
  nG.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
  noise.connect(nf).connect(nG).connect(grp);
  noise.start(t0);
  noise.stop(t0 + 1.3);
}

export function startRagdollWhoosh() {
  const c = ensureCtx();
  const grp = ensureTornadoGroup();
  if (!c || !grp || whooshLayer) return;
  const src = c.createBufferSource();
  src.buffer = makeNoiseBuffer(c, 2, 'white');
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 1.0;
  const gain = c.createGain();
  gain.gain.value = 0.4;
  src.connect(filter).connect(gain).connect(grp);
  src.start();
  whooshLayer = { src, filter, gain, ratePhase: 800 };
}

export function tickRagdollWhoosh(t: number) {
  if (!whooshLayer) return;
  const c = ensureCtx();
  if (!c) return;
  // Rising pitch over t (0..4s)
  const f = 600 + t * 800;
  whooshLayer.filter.frequency.setTargetAtTime(f, c.currentTime, 0.05);
}

export function stopRagdollWhoosh() {
  if (!whooshLayer) return;
  try { whooshLayer.src.stop(); } catch { /* already stopped */ }
  whooshLayer = null;
}

export function fadeAllTornadoAudio(durationSec: number = 3) {
  const c = ensureCtx();
  if (!c || !tornadoGroup) return;
  tornadoGroup.gain.cancelScheduledValues(c.currentTime);
  tornadoGroup.gain.setValueAtTime(tornadoGroup.gain.value, c.currentTime);
  tornadoGroup.gain.linearRampToValueAtTime(0, c.currentTime + durationSec);
}

export function restoreTornadoAudio() {
  const c = ensureCtx();
  if (!c || !tornadoGroup) return;
  tornadoGroup.gain.cancelScheduledValues(c.currentTime);
  tornadoGroup.gain.setTargetAtTime(1, c.currentTime, 0.2);
}

/** Stops all tornado loops + clears state for replay. */
export function resetTornadoAudio() {
  const c = ensureCtx();
  if (!c) return;
  const stopLayer = (layer: StormLayer | null) => {
    if (!layer) return;
    try { layer.src.stop(); } catch { /* */ }
  };
  stopLayer(rainLayer); rainLayer = null;
  stopLayer(windLayer); windLayer = null;
  if (roarLayer) {
    try { roarLayer.rumble.stop(); } catch { /* */ }
    try { roarLayer.noise.stop(); } catch { /* */ }
    roarLayer = null;
  }
  if (sirenOsc) {
    try { sirenOsc.osc.stop(); } catch { /* */ }
    try { sirenOsc.lfo.stop(); } catch { /* */ }
    sirenOsc = null;
  }
  stopRagdollWhoosh();
  restoreTornadoAudio();
}
