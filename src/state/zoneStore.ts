import { create } from 'zustand';
import type { CharacterId } from '../types';

// Lightweight registry for zone interactables (pet the dog, get ice cream…).
// Mirrors the dresser pattern: components register a spot, PlayerController
// proximity-scans + consumes E, InteractPrompt shows the label, and the
// owning component reacts to the fired event for FX.

export type ZoneInteractKind = 'pet' | 'icecream';

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

  /** One-shot events (perf.now timestamps) consumed visually by components. */
  lastPetAt: number;
  lastTreatAt: number;
  fireInteract: (id: string, by: CharacterId) => void;
}

declare global {
  interface Window { __zone?: unknown; }
}

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

  lastPetAt: 0,
  lastTreatAt: 0,
  fireInteract: (id) => {
    const i = get().interactables[id];
    if (!i) return;
    if (i.kind === 'pet') set({ lastPetAt: performance.now() });
    else if (i.kind === 'icecream') set({ lastTreatAt: performance.now() });
  },
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__zone = useZoneStore;
}
