// Use the WebTorrent-tracker signaling strategy. The default `trystero`
// package uses Nostr relays which were intermittently failing (see
// payments.u4er.net WebSocket failures in console). WebTorrent trackers are
// well-maintained public infrastructure and more reliable for our use case.
import { joinRoom as trysteroJoin, selfId } from '@trystero-p2p/torrent';
import type { Room } from '@trystero-p2p/torrent';
import { useNetStore } from '../state/netStore';
import { useGameStore, type GameMode, type GamePhase } from '../state/gameStore';
import { useCombatStore, type Blob, type PowerUpDrop, type ActivePowerUp, type WaveState } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useChatStore, type ChatMsg } from '../state/chatStore';
import type { CharacterId } from '../types';

const APP_ID = 'royal-tara-cove-7f3a';

/** Identity broadcast: who am I and what character do I claim. */
interface Whoami {
  characterId: CharacterId | null;
  joinedAt: number;
}

/** High-frequency player position broadcast (everyone sends about themselves). */
export interface PlayerStateMsg {
  characterId: CharacterId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  running: boolean;
  jumping: boolean;
  t: number; // sender timestamp ms
}

/** Authoritative world snapshot (host only). */
export interface WorldStateMsg {
  /** gameStore */
  phase: GamePhase;
  playerHp: number;
  destroyedHouses: Record<string, number>;
  /** combatStore */
  blobs: Blob[];
  waveIndex: number;
  waveState: WaveState;
  intermissionEndsAt: number;
  powerUpDrops: PowerUpDrop[];
  activePowerUps: ActivePowerUp[];
  score: number;
  kills: number;
  /** tornadoStore */
  tornadoPhaseEnteredAt: number;
  tornadoZ: number;
  tornadoX: number;
  stormIntensity: number;
  windStrength: number;
  tornadoOpacity: number;
  t: number;
}

let room: Room | null = null;
let sendWhoami: ((data: Whoami, peers?: string | string[]) => Promise<void[]>) | null = null;
let sendPlayer: ((data: PlayerStateMsg) => Promise<void[]>) | null = null;
let sendWorld: ((data: WorldStateMsg) => Promise<void[]>) | null = null;
let sendChatAction: ((data: ChatMsg) => Promise<void[]>) | null = null;
let myJoinedAt = 0;
let chatMsgCounter = 0;

export function getSelfId(): string {
  return selfId;
}

export function isInRoom(): boolean {
  return room !== null;
}

export async function joinRoom(mode: GameMode): Promise<void> {
  if (room) await leaveRoom();
  useNetStore.getState().setConnectionStatus('connecting');

  myJoinedAt = Date.now();
  const r = trysteroJoin(
    { appId: APP_ID },
    `room-${mode}`,
  );
  room = r;

  // Actions. Trystero's generic is strict about JSON-index-signature shape;
  // our interfaces are JSON-compatible at runtime but TypeScript can't prove
  // it. Cast through unknown.
  const [whoamiSender, whoamiReceiver] = r.makeAction('whoami');
  const [playerSender, playerReceiver] = r.makeAction('player');
  const [worldSender, worldReceiver] = r.makeAction('world');
  const [chatSender, chatReceiver] = r.makeAction('chat');
  sendWhoami = whoamiSender as unknown as typeof sendWhoami;
  sendPlayer = playerSender as unknown as typeof sendPlayer;
  sendWorld = worldSender as unknown as typeof sendWorld;
  sendChatAction = chatSender as unknown as typeof sendChatAction;

  whoamiReceiver((rawData, peerId) => {
    const data = rawData as unknown as Whoami;
    useNetStore.getState().upsertPeer(peerId, {
      characterId: data.characterId,
      joinedAt: data.joinedAt,
    });
  });

  playerReceiver((rawData) => {
    const data = rawData as unknown as PlayerStateMsg;
    useNetStore.getState().setRemotePlayerState({
      ...data,
      receivedAt: performance.now(),
    });
  });

  worldReceiver((rawData) => {
    // Only apply if I'm NOT the host (avoid overwriting our own sim).
    if (useNetStore.getState().isHost) return;
    applyWorldSnapshot(rawData as unknown as WorldStateMsg);
  });

  chatReceiver((rawData) => {
    const msg = rawData as unknown as ChatMsg;
    useChatStore.getState().appendMessage(msg);
  });

  r.onPeerJoin((peerId) => {
    // Greet new peer with our identity so they learn about us.
    if (sendWhoami) {
      const cur = useNetStore.getState();
      sendWhoami(
        { characterId: cur.myCharacterId, joinedAt: myJoinedAt },
        peerId,
      ).catch(() => {});
    }
  });

  r.onPeerLeave((peerId) => {
    useNetStore.getState().removePeer(peerId);
  });

  // Register ourself in store as the first peer.
  useNetStore.getState().joined(selfId, myJoinedAt, mode);

  // Announce to anyone already in the room (sent to all peers; some may not be
  // connected yet — that's fine, onPeerJoin will re-announce as they connect).
  if (sendWhoami) {
    await sendWhoami({ characterId: null, joinedAt: myJoinedAt }).catch(() => {});
  }
}

export async function leaveRoom(): Promise<void> {
  if (!room) return;
  try {
    await room.leave();
  } catch {
    // ignore
  }
  room = null;
  sendWhoami = sendPlayer = sendWorld = sendChatAction = null;
  useNetStore.getState().leftRoom();
}

/** Send a chat message. No-op for spectators or anyone without a character. */
export async function sendChat(text: string): Promise<void> {
  const trimmed = text.trim().slice(0, 120);
  if (!trimmed) return;
  const characterId = useNetStore.getState().myCharacterId;
  if (!characterId) return; // spectators can't send
  chatMsgCounter += 1;
  const msg: ChatMsg = {
    id: `${selfId}-${chatMsgCounter}`,
    characterId,
    text: trimmed,
    sentAt: Date.now(),
  };
  // Append locally first so the sender sees their own message immediately.
  useChatStore.getState().appendMessage(msg);
  if (sendChatAction) await sendChatAction(msg).catch(() => {});
}

export async function claimCharacter(id: CharacterId): Promise<void> {
  useNetStore.getState().setMyCharacter(id);
  if (sendWhoami) {
    await sendWhoami({ characterId: id, joinedAt: myJoinedAt }).catch(() => {});
  }
}

export async function broadcastPlayerState(msg: PlayerStateMsg): Promise<void> {
  if (sendPlayer) await sendPlayer(msg).catch(() => {});
}

export async function broadcastWorldState(msg: WorldStateMsg): Promise<void> {
  if (sendWorld) await sendWorld(msg).catch(() => {});
}

/** Apply a host-broadcasted world snapshot into our local stores. */
function applyWorldSnapshot(s: WorldStateMsg): void {
  // Game store: phase, hp, destroyed houses.
  const gs = useGameStore.getState();
  if (gs.phase !== s.phase) gs.setPhase(s.phase);
  if (gs.playerHp !== s.playerHp) {
    // Use direct set via the store's set fn — simpler than damage/heal deltas.
    useGameStore.setState({ playerHp: s.playerHp });
  }
  // destroyedHouses: replace wholesale (small map).
  if (Object.keys(s.destroyedHouses).length !== Object.keys(gs.destroyedHouses).length) {
    useGameStore.setState({ destroyedHouses: s.destroyedHouses });
  }

  // Combat store: blobs, wave state, power-ups, score.
  useCombatStore.setState({
    blobs: s.blobs,
    waveIndex: s.waveIndex,
    waveState: s.waveState,
    intermissionEndsAt: s.intermissionEndsAt,
    powerUpDrops: s.powerUpDrops,
    activePowerUps: s.activePowerUps,
    score: s.score,
    kills: s.kills,
  });

  // Tornado store: phase timing + visible fields.
  useTornadoStore.setState({
    phaseEnteredAt: s.tornadoPhaseEnteredAt,
    tornadoZ: s.tornadoZ,
    tornadoX: s.tornadoX,
    stormIntensity: s.stormIntensity,
    windStrength: s.windStrength,
    tornadoOpacity: s.tornadoOpacity,
  });
}
