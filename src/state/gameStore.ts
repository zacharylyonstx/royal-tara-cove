import { create } from 'zustand';
import { Vector3 } from 'three';
import type { CharacterId, Floor, RectCollider } from '../types';

export type GameMode = 'aliens' | 'tornado' | 'munchies' | 'treehouse';
export type TornadoPhase =
  | 'calm' | 'rain' | 'hail' | 'tornado-approach' | 'tornado-arrived';
export type MunchiesPhase =
  | 'munchies-intro'
  | 'munchies-play'
  | 'munchies-powered'
  | 'munchies-caught'
  | 'munchies-level-clear'
  | 'munchies-game-over'
  | 'munchies-victory';
export type TreehousePhase =
  | 'treehouse-welcome'      // first-time overlay
  | 'treehouse-play'         // default — free exploration / mission active
  | 'treehouse-letter-open'  // letter overlay showing
  | 'treehouse-complete';    // post-completion toast for a few seconds
export type GamePhase =
  | 'pre-intro' | 'intro' | 'combat' | 'victory' | 'defeat' | 'free-play'
  | TornadoPhase
  | MunchiesPhase
  | TreehousePhase;

interface RagdollState {
  active: boolean;
  startedAt: number;
  originX: number;
  originY: number;
  originZ: number;
}

interface GameStore {
  activeCharacterId: CharacterId;
  welcomeOpen: boolean;
  positions: Record<CharacterId, Vector3>;
  yaws: Record<CharacterId, number>;
  setActiveCharacter: (id: CharacterId) => void;
  closeWelcome: () => void;
  openWelcome: () => void;

  /** Selected game mode (chosen on welcome screen). */
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;

  /** Tornado-mode per-house destruction state. address → destroyedAt seconds. */
  destroyedHouses: Record<string, number>;
  markHouseDestroyed: (address: string, at: number) => void;
  clearDestroyedHouses: () => void;

  /** Tornado-mode ragdoll-throw state (null when not throwing). */
  ragdoll: RagdollState | null;
  startRagdoll: (x: number, y: number, z: number, at: number) => void;
  clearRagdoll: () => void;

  /** Reset all tornado-mode state for replay or mode switch. */
  resetTornadoGame: () => void;

  /** Reset all munchies state (positions + store). Called when welcome reopens or mode switches away from munchies. */
  resetMunchiesGame: () => void;

  /** Game phase machine. Welcome closes → intro → combat → victory|defeat (aliens),
   *  or → calm → rain → hail → tornado-approach → tornado-arrived → victory|defeat (tornado). */
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
  closeWelcome: () => set((s) => ({
    welcomeOpen: false,
    // Aliens uses an intro cinematic; tornado has its own pacing and starts in calm.
    phase:
      s.gameMode === 'tornado'   ? 'calm' :
      s.gameMode === 'munchies'  ? 'munchies-intro' :
      s.gameMode === 'treehouse' ? 'treehouse-welcome' :
      'intro',
  })),
  openWelcome: () => set({ welcomeOpen: true }),

  gameMode: 'aliens',
  setGameMode: (m) => set({ gameMode: m }),

  destroyedHouses: {},
  markHouseDestroyed: (address, at) =>
    set((s) => ({ destroyedHouses: { ...s.destroyedHouses, [address]: at } })),
  clearDestroyedHouses: () => set({ destroyedHouses: {} }),

  ragdoll: null,
  startRagdoll: (x, y, z, at) =>
    set({ ragdoll: { active: true, startedAt: at, originX: x, originY: y, originZ: z } }),
  clearRagdoll: () => set({ ragdoll: null }),

  resetTornadoGame: () => set({
    destroyedHouses: {},
    ragdoll: null,
    positions: {
      dad: new Vector3(-2.5, 0, 10),
      penny: new Vector3(0, 0, 11),
      luke: new Vector3(2.5, 0, 10),
    },
    yaws: { dad: Math.PI, penny: Math.PI, luke: Math.PI },
  }),

  resetMunchiesGame: () => set({
    positions: {
      dad: new Vector3(-2.5, 0, 10),
      penny: new Vector3(0, 0, 11),
      luke: new Vector3(2.5, 0, 10),
    },
    yaws: { dad: Math.PI, penny: Math.PI, luke: Math.PI },
  }),

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
