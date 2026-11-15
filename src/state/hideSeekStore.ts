import { create } from 'zustand';
import type { CharacterId } from '../types';
import { HS_ROUND_S, type HsPhase } from '../world/hideSeek';

// Hide-and-seek state. The HOST owns the game (phase, who's found, the clock)
// and ships it in the world snapshot; guests ask for things (start / tag /
// stop) through `request`, which the net layer forwards to the host.
//
// Clocks: `endsAt` / `seekStartedAt` are LOCAL performance.now() seconds on
// every machine — the wire only ever carries "seconds left".

const BEST_KEY = 'hs.best.v1';

function loadBest(): Partial<Record<CharacterId, number>> {
  try {
    const v = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, unknown>;
    const out: Partial<Record<CharacterId, number>> = {};
    for (const id of ['dad', 'penny', 'luke'] as CharacterId[]) {
      const n = v[id];
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[id] = Math.min(n, HS_ROUND_S);
    }
    return out;
  } catch { return {}; }
}

export type HsRequest =
  | { type: 'start'; by: CharacterId }
  | { type: 'tag'; who: CharacterId; by: CharacterId }
  | { type: 'stop'; by: CharacterId };

export interface HsCore {
  phase: HsPhase;
  /** Goes up by one every game — lets each client notice "a new game began". */
  round: number;
  seeker: CharacterId | null;
  /** Everyone who was playing when the game started (seeker included). */
  players: CharacterId[];
  /** Hider → how many seconds they stayed hidden before being found. */
  found: Partial<Record<CharacterId, number>>;
  foundBy: Partial<Record<CharacterId, CharacterId>>;
  /** How long the seeking actually ran (for the score card). */
  seekSecs: number;
  /** Stars this play session (not saved — a fresh visit starts at zero). */
  stars: Partial<Record<CharacterId, number>>;
}

interface HideSeekStore extends HsCore {
  /** When the current phase ends (local perf seconds). */
  endsAt: number;
  seekStartedAt: number;
  /** The newest "found you!" for the toast + sparkle (local perf seconds). */
  lastFound: { who: CharacterId; by: CharacterId | null; at: number } | null;
  /** When I last bumped the force field (local perf seconds). */
  bumpAt: number;
  /** A short line for everyone's screen ("Game stopped", "needs 2 players"). */
  notice: { text: string; at: number } | null;
  /** Requests waiting for the host's game loop. */
  pending: HsRequest[];
  /** My longest hide ever, per character, on this device. */
  best: Partial<Record<CharacterId, number>>;
  /** Set when this round beat someone's best (for the card). */
  newBest: Partial<Record<CharacterId, true>>;

  push: (r: HsRequest) => void;
  takePending: () => HsRequest[];
  setCore: (c: Partial<HsCore> & { endsAt?: number; seekStartedAt?: number }) => void;
  markFound: (who: CharacterId, by: CharacterId | null) => void;
  bump: () => void;
  say: (text: string) => void;
  recordBest: (id: CharacterId, secs: number) => void;
  reset: () => void;
}

const IDLE: HsCore = { phase: 'idle', round: 0, seeker: null, players: [], found: {}, foundBy: {}, seekSecs: 0, stars: {} };

export const useHideSeekStore = create<HideSeekStore>((set, get) => ({
  ...IDLE,
  endsAt: 0,
  seekStartedAt: 0,
  lastFound: null,
  bumpAt: -999,
  notice: null,
  pending: [],
  best: typeof localStorage !== 'undefined' ? loadBest() : {},
  newBest: {},

  push: (r) => set((s) => ({ pending: [...s.pending, r].slice(-8) })),
  takePending: () => {
    const p = get().pending;
    if (p.length) set({ pending: [] });
    return p;
  },
  setCore: (c) => set(c),
  markFound: (who, by) => set({ lastFound: { who, by, at: performance.now() / 1000 } }),
  bump: () => set({ bumpAt: performance.now() / 1000 }),
  say: (text) => set({ notice: { text, at: performance.now() / 1000 } }),
  recordBest: (id, secs) => {
    const cur = get().best[id] ?? 0;
    if (secs <= cur + 0.5) return;
    const best = { ...get().best, [id]: secs };
    set({ best, newBest: { ...get().newBest, [id]: true } });
    try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* private mode */ }
  },
  // Leaving Free Play: forget the game but keep the round counter moving
  // forward (so a later game is still "new") and this device's best times.
  reset: () => set((s) => ({ ...IDLE, round: s.round, endsAt: 0, seekStartedAt: 0, lastFound: null, notice: null, pending: [], newBest: {} })),
}));

/** Is a game in its live part (counting or seeking)? */
export function hsLive(): boolean {
  const p = useHideSeekStore.getState().phase;
  return p === 'counting' || p === 'seeking';
}

/** What `id` is doing in the current game. */
export function hsRole(id: CharacterId): 'none' | 'seeker' | 'hider' | 'found' {
  const s = useHideSeekStore.getState();
  if (s.phase === 'idle' || !s.players.includes(id)) return 'none';
  if (s.seeker === id) return 'seeker';
  return s.found[id] !== undefined ? 'found' : 'hider';
}

/** Should `viewer` be kept in the dark about where `target` is? (Name tags,
 *  map dots.) True for the seeking side looking at someone not yet found. */
export function hsHiddenFrom(viewer: CharacterId, target: CharacterId): boolean {
  if (!hsLive() || viewer === target) return false;
  const v = hsRole(viewer);
  return (v === 'seeker' || v === 'found') && hsRole(target) === 'hider';
}

declare global {
  interface Window { __hs?: unknown; }
}
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__hs = useHideSeekStore;
}
