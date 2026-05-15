import { create } from 'zustand';
import { Vector3 } from 'three';
import type { CharacterId, Floor, RectCollider } from '../types';

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
  healPlayer: (n: number) => void;

  staticColliders: RectCollider[];
  setStaticColliders: (cs: RectCollider[]) => void;

  floors: Floor[];
  setFloors: (fs: Floor[]) => void;

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
    // Spawn the family in the cul-de-sac in front of 10600, facing the
    // backyard (where the UFO is about to crash). The crash + combat happen
    // right in front of you.
    dad: new Vector3(-2.5, 0, 10),
    penny: new Vector3(0, 0, 11),
    luke: new Vector3(2.5, 0, 10),
  },
  // Yaw π = facing +Z (south, toward 10600's backyard / crash site).
  yaws: { dad: Math.PI, penny: Math.PI, luke: Math.PI },
  setActiveCharacter: (id) => set({ activeCharacterId: id }),
  closeWelcome: () => set({ welcomeOpen: false, phase: 'intro' }),
  openWelcome: () => set({ welcomeOpen: true }),

  phase: 'pre-intro',
  setPhase: (p) => set({ phase: p }),
  playerHp: 20,
  maxHp: 20,
  damagePlayer: (n) =>
    set((s) => {
      const next = Math.max(0, s.playerHp - n);
      if (next === 0 && s.phase === 'combat') {
        return { playerHp: 0, phase: 'defeat' as const };
      }
      return { playerHp: next };
    }),
  resetHp: () => set({ playerHp: 20 }),
  healPlayer: (n) =>
    set((s) => ({ playerHp: Math.min(s.maxHp, s.playerHp + n) })),

  staticColliders: [],
  setStaticColliders: (cs) => set({ staticColliders: cs }),

  floors: [],
  setFloors: (fs) => set({ floors: fs }),

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
