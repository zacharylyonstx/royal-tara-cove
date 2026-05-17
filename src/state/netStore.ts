import { create } from 'zustand';
import type { CharacterId } from '../types';
import type { GameMode } from './gameStore';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface RoomPeer {
  peerId: string;
  characterId: CharacterId | null;
  joinedAt: number;
}

export interface RemotePlayerState {
  characterId: CharacterId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  running: boolean;
  jumping: boolean;
  receivedAt: number;
}

interface NetStore {
  /** Stable id for this browser session (trystero selfId). */
  selfId: string | null;
  /** When this browser joined the current room. */
  myJoinedAt: number | null;
  /** Active room (mode), or null if not in a room. */
  mode: GameMode | null;
  connectionStatus: ConnectionStatus;
  /** Character this browser controls, or null if not picked / spectator. */
  myCharacterId: CharacterId | null;
  /** True when no characters available (4th+ joiner). */
  spectator: boolean;
  /** Map of peerId → peer state (includes self). */
  peers: Record<string, RoomPeer>;
  /** Map of characterId → remote state for non-local characters. */
  remotePlayers: Partial<Record<CharacterId, RemotePlayerState>>;
  /** True if this browser is currently the host (oldest joinedAt). */
  isHost: boolean;

  // Actions
  joined: (selfId: string, joinedAt: number, mode: GameMode) => void;
  leftRoom: () => void;
  upsertPeer: (peerId: string, peer: Omit<RoomPeer, 'peerId'>) => void;
  removePeer: (peerId: string) => void;
  setMyCharacter: (id: CharacterId | null) => void;
  setSpectator: (v: boolean) => void;
  setRemotePlayerState: (s: RemotePlayerState) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
}

function computeHost(peers: Record<string, RoomPeer>, selfId: string | null): boolean {
  if (!selfId) return true; // solo / no room — treat as host
  const list = Object.values(peers);
  if (list.length === 0) return true;
  // Smallest joinedAt wins; ties broken by lexicographically smallest peerId.
  let bestId = list[0].peerId;
  let bestJoinedAt = list[0].joinedAt;
  for (const p of list.slice(1)) {
    if (p.joinedAt < bestJoinedAt || (p.joinedAt === bestJoinedAt && p.peerId < bestId)) {
      bestId = p.peerId;
      bestJoinedAt = p.joinedAt;
    }
  }
  return bestId === selfId;
}

export const useNetStore = create<NetStore>((set, get) => ({
  selfId: null,
  myJoinedAt: null,
  mode: null,
  connectionStatus: 'idle',
  myCharacterId: null,
  spectator: false,
  peers: {},
  remotePlayers: {},
  isHost: true,

  joined: (selfId, joinedAt, mode) => {
    const peers: Record<string, RoomPeer> = {
      [selfId]: { peerId: selfId, characterId: null, joinedAt },
    };
    set({
      selfId,
      myJoinedAt: joinedAt,
      mode,
      peers,
      remotePlayers: {},
      myCharacterId: null,
      spectator: false,
      isHost: true,
      connectionStatus: 'connected',
    });
  },

  leftRoom: () => set({
    selfId: null,
    myJoinedAt: null,
    mode: null,
    peers: {},
    remotePlayers: {},
    myCharacterId: null,
    spectator: false,
    isHost: true,
    connectionStatus: 'idle',
  }),

  upsertPeer: (peerId, peer) => {
    const peers = { ...get().peers, [peerId]: { peerId, ...peer } };
    set({ peers, isHost: computeHost(peers, get().selfId) });
  },

  removePeer: (peerId) => {
    const peers = { ...get().peers };
    const leaving = peers[peerId];
    delete peers[peerId];
    const remotePlayers = { ...get().remotePlayers };
    if (leaving?.characterId) delete remotePlayers[leaving.characterId];
    set({
      peers,
      remotePlayers,
      isHost: computeHost(peers, get().selfId),
    });
  },

  setMyCharacter: (id) => {
    const selfId = get().selfId;
    if (!selfId) {
      set({ myCharacterId: id });
      return;
    }
    const peers = { ...get().peers };
    const me = peers[selfId];
    if (me) peers[selfId] = { ...me, characterId: id };
    // If I now own a character that was previously remote, clear remote state.
    const remotePlayers = { ...get().remotePlayers };
    if (id) delete remotePlayers[id];
    set({
      peers,
      remotePlayers,
      myCharacterId: id,
      spectator: false,
      isHost: computeHost(peers, selfId),
    });
  },

  setSpectator: (v) => set({ spectator: v, myCharacterId: null }),

  setRemotePlayerState: (s) => {
    if (s.characterId === get().myCharacterId) return; // ignore echoes of self
    set((cur) => ({
      remotePlayers: { ...cur.remotePlayers, [s.characterId]: s },
    }));
  },

  setConnectionStatus: (s) => set({ connectionStatus: s }),
}));

/** Which characters are currently claimed by some peer (self or other). */
export function getTakenCharacters(): Set<CharacterId> {
  const s = new Set<CharacterId>();
  for (const p of Object.values(useNetStore.getState().peers)) {
    if (p.characterId) s.add(p.characterId);
  }
  return s;
}

/** Total peer count in the room (including self). */
export function getPeerCount(): number {
  return Object.keys(useNetStore.getState().peers).length;
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __net?: unknown }).__net = useNetStore;
}
