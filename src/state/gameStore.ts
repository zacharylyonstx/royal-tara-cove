import { create } from 'zustand';
import { Vector3 } from 'three';
import type { CharacterId, RectCollider } from '../types';

export type GamePhase = 'pre-intro' | 'intro' | 'combat' | 'victory' | 'defeat';

interface GameStore {
  activeCharacterId: CharacterId;
  welcomeOpen: boolean;
  positions: Record<CharacterId, Vector3>;
  yaws: Record<CharacterId, number>;
  setActiveCharacter: (id: CharacterId) => void;
  closeWelcome: () => void;
  openWelcome: () => void;

  /** Game phase machine. Welcome closes → intro → combat → victory|defeat. */
  phase: GamePhase;
  setPhase: (p: GamePhase) => void;

  /** Shared family HP across all characters. */
  playerHp: number;
  maxHp: number;
  damagePlayer: (n: number) => void;
  resetHp: () => void;

  staticColliders: RectCollider[];
  setStaticColliders: (cs: RectCollider[]) => void;

  doors: Record<string, { open: boolean; centerX: number; centerZ: number; aabbWhenClosed: RectCollider }>;
  registerDoor: (id: string, aabb: RectCollider, centerX: number, centerZ: number) => void;
  toggleDoor: (id: string) => void;

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
  closeWelcome: () => set({ welcomeOpen: false, phase: 'intro' }),
  openWelcome: () => set({ welcomeOpen: true }),

  phase: 'pre-intro',
  setPhase: (p) => set({ phase: p }),
  playerHp: 10,
  maxHp: 10,
  damagePlayer: (n) =>
    set((s) => {
      const next = Math.max(0, s.playerHp - n);
      if (next === 0 && s.phase === 'combat') {
        return { playerHp: 0, phase: 'defeat' as const };
      }
      return { playerHp: next };
    }),
  resetHp: () => set({ playerHp: 10 }),

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
