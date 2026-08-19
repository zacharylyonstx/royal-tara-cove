import { create } from 'zustand';
import type { CharacterId } from '../types';
import { loadAffection, saveAffection, friendLevel, type Affection } from '../world/petStorage';

// Lightweight registry for zone interactables (pet the dog, get ice cream…).
// Mirrors the dresser pattern: components register a spot, PlayerController
// proximity-scans + consumes E, InteractPrompt shows the label, and the
// owning component reacts to the fired event for FX.

export type ZoneInteractKind = 'pet' | 'icecream' | 'shop';

export interface ZoneInteractable {
  id: string;
  kind: ZoneInteractKind;
  label: string;
  x: number;
  z: number;
  radius: number;
}

interface ZoneStore {
  interactables: Record<string, ZoneInteractable>;
  hoverId: string | null;
  register: (i: ZoneInteractable) => void;
  unregister: (id: string) => void;
  /** Live position update for moving interactables (the dog). */
  updatePos: (id: string, x: number, z: number) => void;
  setHover: (id: string | null) => void;

  /** Friendship: how many times each family member has loved on each pet.
   *  Persisted (pets.v1). Drives the ♥ badge + Sparky's behaviour. */
  affection: Affection;
  /** Add affection (1 s cooldown per pet+person so E-mashing doesn't farm it).
   *  Returns true when a friendship LEVEL was crossed. */
  bumpAffection: (petId: string, by: CharacterId, amount?: number) => boolean;
  /** Last level-up for the toast. */
  lastLevelUp: { petId: string; by: CharacterId; level: number; at: number } | null;

  /** One-shot events (perf.now timestamps) consumed visually by components. */
  lastPetAt: number;
  /** Which pet spot was petted last (sparky / duck-0 …) so only THAT animal reacts. */
  lastPetId: string | null;
  lastPetBy: CharacterId | null;
  lastTreatAt: number;
  fireInteract: (id: string, by: CharacterId) => void;
  /** A pet event from a PEER (so everyone sees the hearts + the host's dog reacts). */
  firePetRemote: (id: string, by: CharacterId) => void;
}

declare global {
  interface Window { __zone?: unknown; }
}

/** Per pet+person cooldown clock for bumpAffection. */
const bumpAt = new Map<string, number>();

export const useZoneStore = create<ZoneStore>((set, get) => ({
  interactables: {},
  hoverId: null,
  register: (i) => set((s) => ({ interactables: { ...s.interactables, [i.id]: i } })),
  unregister: (id) =>
    set((s) => {
      const next = { ...s.interactables };
      delete next[id];
      return { interactables: next, hoverId: s.hoverId === id ? null : s.hoverId };
    }),
  updatePos: (id, x, z) => {
    const cur = get().interactables[id];
    if (!cur) return;
    // Mutate in place — read in the PlayerController hot path, no re-render needed.
    cur.x = x;
    cur.z = z;
  },
  setHover: (id) => {
    if (get().hoverId === id) return;
    set({ hoverId: id });
  },

  affection: typeof localStorage !== 'undefined' ? loadAffection() : {},
  lastLevelUp: null,
  bumpAffection: (petId, by, amount = 1) => {
    const now = performance.now();
    const key = `${petId}|${by}`;
    const last = bumpAt.get(key) ?? -Infinity;
    if (now - last < 1000) return false;
    bumpAt.set(key, now);
    const cur = get().affection[petId]?.[by] ?? 0;
    const next = Math.min(9999, cur + amount);
    const affection: Affection = { ...get().affection, [petId]: { ...(get().affection[petId] ?? {}), [by]: next } };
    const leveled = friendLevel(next).level > friendLevel(cur).level;
    set({ affection, ...(leveled ? { lastLevelUp: { petId, by, level: friendLevel(next).level, at: now } } : {}) });
    saveAffection(affection);
    return leveled;
  },

  lastPetAt: 0,
  lastPetId: null,
  lastPetBy: null,
  lastTreatAt: 0,
  fireInteract: (id, by) => {
    const i = get().interactables[id];
    if (!i) return;
    if (i.kind === 'pet') {
      set({ lastPetAt: performance.now(), lastPetId: id, lastPetBy: by });
      get().bumpAffection(id, by);
    } else if (i.kind === 'icecream') set({ lastTreatAt: performance.now() });
  },
  firePetRemote: (id, by) => {
    set({ lastPetAt: performance.now(), lastPetId: id, lastPetBy: by });
    // Track the peer's affection too so the (host's) dog knows who loves him.
    get().bumpAffection(id, by);
  },
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__zone = useZoneStore;
}
