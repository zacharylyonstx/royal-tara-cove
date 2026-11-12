import { create } from 'zustand';
import type { CharacterId } from '../types';

// Townsfolk runtime state: who is saying what, and the local player's errand.
// NPC POSITIONS are not here — they are pure functions of the shared day clock
// (world/npcTime.ts), so they never need syncing.

const STARS_KEY = 'helper.v1';

function loadStars(): number {
  try {
    const n = parseInt(localStorage.getItem(STARS_KEY) ?? '0', 10);
    return Number.isFinite(n) && n > 0 ? Math.min(9999, n) : 0;
  } catch { return 0; }
}

export interface NpcBubble { text: string; at: number; by: CharacterId | null }

/** Something an NPC asked me to carry to someone else. */
export interface Carrying {
  errandId: string;
  item: string;      // emoji
  toId: string;      // npc id
  toName: string;
  where: string;     // "at the school"
}

interface NpcStore {
  /** Latest speech bubble per NPC (perf.now timestamps). */
  bubbles: Record<string, NpcBubble>;
  say: (npcId: string, text: string, by: CharacterId | null) => void;

  /** Rotates each NPC's small-talk so they don't repeat themselves. */
  lineIndex: Record<string, number>;
  nextLine: (npcId: string, count: number) => number;

  carrying: Carrying | null;
  setCarrying: (c: Carrying | null) => void;
  /** Errands finished this session (so the same one isn't offered twice in a row). */
  done: Record<string, true>;
  markDone: (errandId: string) => void;

  /** Helper stars earned (persisted on this device). */
  stars: number;
  addStar: () => number;
  lastStarAt: number;
}

declare global {
  interface Window { __npc?: unknown; }
}

export const useNpcStore = create<NpcStore>((set, get) => ({
  bubbles: {},
  say: (npcId, text, by) => set((s) => ({ bubbles: { ...s.bubbles, [npcId]: { text, at: performance.now(), by } } })),

  lineIndex: {},
  nextLine: (npcId, count) => {
    const i = (get().lineIndex[npcId] ?? Math.floor(Math.random() * count)) % Math.max(1, count);
    set((s) => ({ lineIndex: { ...s.lineIndex, [npcId]: i + 1 } }));
    return i;
  },

  carrying: null,
  setCarrying: (c) => set({ carrying: c }),
  done: {},
  markDone: (errandId) => set((s) => ({ done: { ...s.done, [errandId]: true } })),

  stars: typeof localStorage !== 'undefined' ? loadStars() : 0,
  lastStarAt: 0,
  addStar: () => {
    const stars = get().stars + 1;
    try { localStorage.setItem(STARS_KEY, String(stars)); } catch { /* no-op */ }
    set({ stars, lastStarAt: performance.now() });
    return stars;
  },
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__npc = useNpcStore;
}
