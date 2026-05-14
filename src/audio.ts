// Procedural one-shot SFX via Web Audio. No audio files needed.

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
