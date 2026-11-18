import { create } from 'zustand';
import { audioGraph } from '../audio';
import { LofiEngine, LOFI_TRACKS } from '../lofi';

// Free Play's radio. Two stations: the lofi playlist (three tracks that follow
// one another) and "classic" — the gentle neighbourhood pad the game has always
// had, for anyone who misses it. The choice is remembered per device.

export type Station = 'lofi' | 'classic';
const KEY = 'music.v1';

function loadStation(): Station {
  try { return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'lofi'; } catch { return 'lofi'; }
}

interface MusicStore {
  station: Station;
  /** Which lofi track is playing (index into LOFI_TRACKS). */
  track: number;
  /** performance.now() of the last change — drives the "now playing" chip. */
  changedAt: number;
  /** The 🎵 button: next lofi track, then classic, then round again. */
  cycle: () => void;
  noteTrack: (i: number) => void;
  /** Pop the "now playing" chip (e.g. when you step into the game). */
  announce: () => void;
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  station: loadStation(),
  track: Math.floor(Math.random() * LOFI_TRACKS.length),
  changedAt: 0,
  cycle: () => {
    const s = get();
    let station: Station = s.station, track = s.track;
    if (s.station === 'classic') { station = 'lofi'; track = 0; }
    else if (s.track >= LOFI_TRACKS.length - 1) station = 'classic';
    else track = s.track + 1;
    try { localStorage.setItem(KEY, station); } catch { /* private mode */ }
    set({ station, track, changedAt: performance.now() });
    if (station === 'lofi') lofiJump(track);
  },
  noteTrack: (i) => { if (get().track !== i) set({ track: i, changedAt: performance.now() }); },
  announce: () => set({ changedAt: performance.now() }),
}));

// ---- the live engine (one per page) ----
let engine: LofiEngine | null = null;
let timer: number | null = null;
let offTimer: number | null = null;

function pump() {
  if (!engine) return;
  // A hidden tab only gets a timer tick about once a second — queue further ahead.
  engine.schedule(engine.ctx.currentTime + (document.hidden ? 1.8 : 0.5));
}

/** Make sure the radio is playing, at `level` (0..1). Cheap to call every frame. */
export function lofiOn(level: number) {
  const g = audioGraph();
  if (!g) return;
  if (!engine) {
    engine = new LofiEngine(g.ctx, g.out);
    engine.onTrack = (i) => useMusicStore.getState().noteTrack(i);
  }
  if (offTimer !== null) { clearTimeout(offTimer); offTimer = null; }
  if (timer === null) {
    engine.startTrack(useMusicStore.getState().track, g.ctx.currentTime + 0.2);
    useMusicStore.setState({ changedAt: performance.now() });
    timer = window.setInterval(pump, 110);
    pump();
  }
  engine.setLevel(level);
}

/** Fade the radio out and stop queueing notes. */
export function lofiOff() {
  if (!engine || timer === null || offTimer !== null) return;
  engine.setLevel(0, 0.5);
  offTimer = window.setTimeout(() => {
    offTimer = null;
    if (timer !== null) { clearInterval(timer); timer = null; }
    // Next time it comes on, it opens with the following track.
    useMusicStore.setState((s) => ({ track: (s.track + 1) % LOFI_TRACKS.length }));
  }, 900);
}

function lofiJump(track: number) {
  if (!engine || timer === null) return;
  engine.startTrack(track, engine.ctx.currentTime + 0.25);
}

/** DEV: window.__music = the radio's store. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __music: unknown }).__music = useMusicStore;
}
