import { create } from 'zustand';
import type { CharacterId } from '../types';
import {
  LANTERN_SPAWNS,
  SIREN_SPAWN,
  NIGHT_ROUND_SECONDS,
  type NightZone,
} from '../world/nightLayout';

// Siren Head Night state. Two halves:
//   • HOST-AUTHORITATIVE SIM (siren transform/state, lanterns, per-player state,
//     round timer) — the host writes these every frame and broadcasts them in
//     WorldStateMsg.night; guests receive + apply them. Reads inside useFrame go
//     through getState() to avoid selector churn at high frequency.
//   • LOCAL FEEL (crouch, flashlight, stamina, proximity) — never synced; each
//     client owns its own input/HUD values.

export type SirenState = 'patrol' | 'alerted' | 'chase' | 'retreat';
export type PlayerNightState = 'alive' | 'down' | 'safe';
export type LanternState = 'idle' | 'carried' | 'delivered';

export interface Lantern {
  id: string;
  x: number;
  z: number;
  state: LanternState;
  carrier: CharacterId | null;
}

function freshLanterns(): Lantern[] {
  return LANTERN_SPAWNS.map((l) => ({ id: l.id, x: l.x, z: l.z, state: 'idle' as LanternState, carrier: null }));
}

function freshStates(): Record<CharacterId, PlayerNightState> {
  return { dad: 'alive', penny: 'alive', luke: 'alive' };
}

interface NightStore {
  // ---- host-authoritative sim (synced) ----
  sirenX: number;
  sirenZ: number;
  sirenYaw: number;
  sirenState: SirenState;
  sirenTargetId: CharacterId | null;
  setSiren: (x: number, z: number, yaw: number, state: SirenState, targetId: CharacterId | null) => void;

  lanterns: Lantern[];
  lanternsDelivered: number;
  setLanterns: (l: Lantern[]) => void;
  setLanternsDelivered: (n: number) => void;

  playerNightStates: Record<CharacterId, PlayerNightState>;
  setPlayerNightState: (id: CharacterId, s: PlayerNightState) => void;

  /** Seconds until dawn. Host sends this as a DELTA in the snapshot; guests
   *  reconstruct a local deadline so cross-machine clock skew never matters. */
  roundEndsInSeconds: number;
  setRoundEndsInSeconds: (s: number) => void;

  /** perf.now()/1000 of the last "Regroup!" (all-down reset) — drives the toast. */
  regroupAt: number;
  setRegroupAt: (t: number) => void;

  // ---- host-only bookkeeping (not synced) ----
  /** perf.now()/1000 when each character went down (for auto-revive timing). */
  downAt: Record<CharacterId, number>;
  setDownAt: (id: CharacterId, t: number) => void;

  // ---- local feel (NOT synced) ----
  crouching: boolean;
  setCrouching: (v: boolean) => void;
  flashlightOn: boolean;
  toggleFlashlight: () => void;
  /** Local player's sprint state — read by the host's own-character detection. */
  localRunning: boolean;
  setLocalRunning: (v: boolean) => void;
  /** 0..1 sprint stamina, for the HUD bar. */
  stamina: number;
  setStamina: (v: number) => void;
  /** 0..1 local distance-to-Siren-Head, for the HUD danger meter + heartbeat. */
  sirenProximity: number;
  setSirenProximity: (v: number) => void;

  // ---- static layout (registered once on mode mount; survives reset) ----
  hideZones: NightZone[];
  safeZones: NightZone[];
  setZones: (hide: NightZone[], safe: NightZone[]) => void;

  reset: () => void;
}

export const useNightStore = create<NightStore>((set) => ({
  sirenX: SIREN_SPAWN.x,
  sirenZ: SIREN_SPAWN.z,
  sirenYaw: 0,
  sirenState: 'patrol',
  sirenTargetId: null,
  setSiren: (x, z, yaw, state, targetId) => set({ sirenX: x, sirenZ: z, sirenYaw: yaw, sirenState: state, sirenTargetId: targetId }),

  lanterns: freshLanterns(),
  lanternsDelivered: 0,
  setLanterns: (l) => set({ lanterns: l }),
  setLanternsDelivered: (n) => set({ lanternsDelivered: n }),

  playerNightStates: freshStates(),
  setPlayerNightState: (id, s) =>
    set((st) => (st.playerNightStates[id] === s ? st : { playerNightStates: { ...st.playerNightStates, [id]: s } })),

  roundEndsInSeconds: NIGHT_ROUND_SECONDS,
  setRoundEndsInSeconds: (s) => set({ roundEndsInSeconds: s }),

  regroupAt: 0,
  setRegroupAt: (t) => set({ regroupAt: t }),

  downAt: { dad: 0, penny: 0, luke: 0 },
  setDownAt: (id, t) => set((st) => ({ downAt: { ...st.downAt, [id]: t } })),

  crouching: false,
  setCrouching: (v) => set((st) => (st.crouching === v ? st : { crouching: v })),
  flashlightOn: true,
  toggleFlashlight: () => set((st) => ({ flashlightOn: !st.flashlightOn })),
  localRunning: false,
  setLocalRunning: (v) => set((st) => (st.localRunning === v ? st : { localRunning: v })),
  stamina: 1,
  setStamina: (v) => set({ stamina: v }),
  sirenProximity: 0,
  setSirenProximity: (v) => set({ sirenProximity: v }),

  hideZones: [],
  safeZones: [],
  setZones: (hide, safe) => set({ hideZones: hide, safeZones: safe }),

  reset: () =>
    set({
      sirenX: SIREN_SPAWN.x,
      sirenZ: SIREN_SPAWN.z,
      sirenYaw: 0,
      sirenState: 'patrol',
      sirenTargetId: null,
      lanterns: freshLanterns(),
      lanternsDelivered: 0,
      playerNightStates: freshStates(),
      roundEndsInSeconds: NIGHT_ROUND_SECONDS,
      regroupAt: 0,
      downAt: { dad: 0, penny: 0, luke: 0 },
      crouching: false,
      flashlightOn: true,
      localRunning: false,
      stamina: 1,
      sirenProximity: 0,
    }),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __night?: unknown }).__night = useNightStore;
}
