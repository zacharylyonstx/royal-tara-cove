import { create } from 'zustand';
import { Vector3 } from 'three';
import type { CharacterId, RectCollider } from '../types';

interface GameStore {
  activeCharacterId: CharacterId;
  welcomeOpen: boolean;
  positions: Record<CharacterId, Vector3>;
  yaws: Record<CharacterId, number>;
  setActiveCharacter: (id: CharacterId) => void;
  closeWelcome: () => void;
  openWelcome: () => void;

  /** Static + dynamic colliders. `dynamic` is updated when doors open/close. */
  staticColliders: RectCollider[];
  setStaticColliders: (cs: RectCollider[]) => void;

  /** Doors keyed by id. Each door publishes its current passable AABB to dynamicColliders. */
  doors: Record<string, { open: boolean; centerX: number; centerZ: number; aabbWhenClosed: RectCollider }>;
  registerDoor: (id: string, aabb: RectCollider, centerX: number, centerZ: number) => void;
  toggleDoor: (id: string) => void;

  /** Currently focused interactable (for "Press E" prompt). null if none in range. */
  hoverDoorId: string | null;
  setHoverDoor: (id: string | null) => void;
}

// Expose to window for dev testing only.
declare global {
  interface Window { __game?: unknown; }
}

export const useGameStore = create<GameStore>((set, get) => ({
  activeCharacterId: 'dad',
  welcomeOpen: true,
  positions: {
    // Spawn the family on the road just inside the entry, facing south toward
    // the cul-de-sac (10600 is at the end).
    dad: new Vector3(-2.5, 0, -108),
    penny: new Vector3(0, 0, -109),
    luke: new Vector3(2.5, 0, -108),
  },
  // Yaw π = facing +Z (south, toward the cul-de-sac).
  yaws: { dad: Math.PI, penny: Math.PI, luke: Math.PI },
  setActiveCharacter: (id) => set({ activeCharacterId: id }),
  closeWelcome: () => set({ welcomeOpen: false }),
  openWelcome: () => set({ welcomeOpen: true }),

  staticColliders: [],
  setStaticColliders: (cs) => set({ staticColliders: cs }),

  doors: {},
  registerDoor: (id, aabb, centerX, centerZ) =>
    set((s) => ({
      doors: {
        ...s.doors,
        [id]: { open: false, centerX, centerZ, aabbWhenClosed: aabb },
      },
    })),
  toggleDoor: (id) => {
    const door = get().doors[id];
    if (!door) return;
    set((s) => ({
      doors: { ...s.doors, [id]: { ...door, open: !door.open } },
    }));
  },

  hoverDoorId: null,
  setHoverDoor: (id) => {
    if (get().hoverDoorId === id) return;
    set({ hoverDoorId: id });
  },
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__game = useGameStore;
}
