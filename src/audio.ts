// Procedural one-shot SFX via Web Audio. No audio files needed.

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

/** Call this from a user-gesture handler to unlock audio. */
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
}

export function laserZap() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(900, t0);
  osc.frequency.exponentialRampToValueAtTime(160, t0 + 0.18);
  gain.gain.setValueAtTime(0.18, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

export function blobSquish() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // Short noise burst with quick low-pass filter sweep down.
  const bufSize = Math.floor(c.sampleRate * 0.28);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, t0);
  filter.frequency.exponentialRampToValueAtTime(120, t0 + 0.28);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.22, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);
}

export function ufoCrash() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // White noise low-pass sweep + low-frequency thump
  const bufSize = Math.floor(c.sampleRate * 1.6);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, t0);
  filter.frequency.exponentialRampToValueAtTime(50, t0 + 1.6);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.55, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.6);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);

  // Boom thump
  const osc = c.createOscillator();
  const g2 = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t0);
  osc.frequency.exponentialRampToValueAtTime(28, t0 + 0.4);
  g2.gain.setValueAtTime(0.5, t0);
  g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
  osc.connect(g2).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.5);
}

export function blobAttack() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
  gain.gain.setValueAtTime(0.18, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.14);
}

export function victoryFanfare() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
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
  const t0 = c.currentTime;
  const notes = [392.0, 311.13, 261.63]; // G4 Eb4 C4
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
