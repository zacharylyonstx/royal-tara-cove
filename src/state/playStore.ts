import { create } from 'zustand';
import type { CharacterId } from '../types';

// Free-roam play: rideable bikes + playable basketball. State lives here so the
// PlayerController (input), CameraRig (chase cam), the Basketball props
// (physics/scoring), and the net layer can all coordinate.

export interface HoopReg {
  x: number;          // rim world X
  z: number;          // rim world Z
  rimY: number;       // rim height
  rimR: number;       // forgiving scoring radius
}

export interface BikeReg {
  id: string;
  x: number;
  z: number;
  color: string;
}

export type HoverPlay = 'ride' | 'getoff' | 'pickup' | 'shoot' | null;

export interface RidingState {
  bikeId: string;
  bikeColor: string;
  heading: number;    // facing yaw of the bike
  speed: number;      // m/s, signed
}

/**
 * Live ball positions, written every frame by each Basketball. Kept OUT of the
 * reactive store so per-frame updates don't churn zustand subscribers; read
 * directly by the PlayerController for nearest-ball detection.
 */
export const ballPositions: Record<string, { x: number; z: number }> = {};

interface PlayStore {
  /** Per-character riding state (null = on foot). */
  riding: Record<CharacterId, RidingState | null>;
  /** The single ball currently held, if any. */
  heldBall: { ballId: string; by: CharacterId } | null;
  /** One-shot impulse a Basketball consumes to launch (cleared after read). */
  shotImpulse: { ballId: string; by: CharacterId; vx: number; vy: number; vz: number; t: number } | null;

  familyBaskets: number;
  lastBasket: { by: CharacterId; at: number } | null;

  hoops: Record<string, HoopReg>;                 // keyed by house address
  bikes: Record<string, BikeReg>;                 // keyed by bike id

  // Contextual interact hint for the local player.
  hoverPlay: HoverPlay;
  hoverBikeId: string | null;
  hoverBallId: string | null;

  setHover: (play: HoverPlay, bikeId: string | null, ballId: string | null) => void;
  registerHoop: (address: string, reg: HoopReg) => void;
  registerBike: (reg: BikeReg) => void;

  mount: (id: CharacterId, s: RidingState) => void;
  dismount: (id: CharacterId) => void;
  setRiding: (id: CharacterId, s: RidingState) => void;

  pickUpBall: (ballId: string, by: CharacterId) => void;
  dropBall: () => void;
  shoot: (ballId: string, by: CharacterId, vx: number, vy: number, vz: number, t: number) => void;
  clearShot: () => void;

  scoreBasket: (by: CharacterId, at: number) => void;
}

declare global {
  interface Window { __play?: unknown; }
}

export const usePlayStore = create<PlayStore>((set) => ({
  riding: { dad: null, penny: null, luke: null },
  heldBall: null,
  shotImpulse: null,
  familyBaskets: 0,
  lastBasket: null,
  hoops: {},
  bikes: {},
  hoverPlay: null,
  hoverBikeId: null,
  hoverBallId: null,

  setHover: (play, bikeId, ballId) =>
    set((s) =>
      s.hoverPlay === play && s.hoverBikeId === bikeId && s.hoverBallId === ballId
        ? s
        : { hoverPlay: play, hoverBikeId: bikeId, hoverBallId: ballId },
    ),
  registerHoop: (address, reg) => set((s) => ({ hoops: { ...s.hoops, [address]: reg } })),
  registerBike: (reg) => set((s) => ({ bikes: { ...s.bikes, [reg.id]: reg } })),

  mount: (id, st) => set((s) => ({ riding: { ...s.riding, [id]: st } })),
  dismount: (id) => set((s) => ({ riding: { ...s.riding, [id]: null } })),
  setRiding: (id, st) =>
    set((s) => {
      const cur = s.riding[id];
      if (cur) { cur.heading = st.heading; cur.speed = st.speed; }
      return {};
    }),

  pickUpBall: (ballId, by) => set({ heldBall: { ballId, by } }),
  dropBall: () => set({ heldBall: null }),
  shoot: (ballId, by, vx, vy, vz, t) => set({ heldBall: null, shotImpulse: { ballId, by, vx, vy, vz, t } }),
  clearShot: () => set({ shotImpulse: null }),

  scoreBasket: (by, at) =>
    set((s) => ({ familyBaskets: s.familyBaskets + 1, lastBasket: { by, at } })),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__play = usePlayStore;
}
