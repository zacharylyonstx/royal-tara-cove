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
import { useMunchiesStore, type SleepwalkerId, type SleepwalkerMode } from '../state/munchiesStore';
import { usePlayStore } from '../state/playStore';
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
  /** Bike-riding state (so peers render the bike under us). y/flipAngle drive air + tricks. */
  riding?: { bikeColor: string; heading: number; y?: number; flipAngle?: number } | null;
  t: number; // sender timestamp ms
}

/** A "someone scored a basket" celebration event. */
export interface BasketMsg {
  shooter: CharacterId;
  t: number;
}

export interface MunchiesNetSnapshot {
  level: number;
  score: number;
  lives: number;
  sleepwalkers: Record<string, { x: number; z: number; yaw: number; mode: string; tuckedAt: number }>;
  pellets: { id: string; x: number; z: number }[];
  milks: { id: string; x: number; z: number }[];
  bonus: { x: number; z: number; spawnedAt: number; eaten: boolean } | null;
  poweredUntil: number;
  difficulty: string;
  roster: string[];
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
  /** munchies — undefined when not in munchies mode. */
  munchies?: MunchiesNetSnapshot;
}

let room: Room | null = null;
let sendWhoami: ((data: Whoami, peers?: string | string[]) => Promise<void[]>) | null = null;
let sendPlayer: ((data: PlayerStateMsg) => Promise<void[]>) | null = null;
let sendWorld: ((data: WorldStateMsg) => Promise<void[]>) | null = null;
let sendChatAction: ((data: ChatMsg) => Promise<void[]>) | null = null;
let sendBasketAction: ((data: BasketMsg) => Promise<void[]>) | null = null;
let myJoinedAt = 0;
let chatMsgCounter = 0;

// --- Inbound payload validation -------------------------------------------
// Net data arrives over open P2P (public WebTorrent trackers) and is untyped at
// runtime. trystero invokes receivers synchronously from the RTCDataChannel
// message handler with no try/catch of its own, so a throw here (e.g. a
// malformed/partial packet, or a peer on a slightly different build) would
// propagate out uncaught and silently break state application. Every receiver
// is therefore wrapped in netGuard() and reads fields through these helpers.
type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown): boolean => v === true;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Json => (isObj(v) ? v : {});

function netGuard(kind: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (import.meta.env.DEV) console.warn(`[net] dropped malformed "${kind}" packet`, e);
  }
}

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
  const [basketSender, basketReceiver] = r.makeAction('basket');
  sendWhoami = whoamiSender as unknown as typeof sendWhoami;
  sendPlayer = playerSender as unknown as typeof sendPlayer;
  sendWorld = worldSender as unknown as typeof sendWorld;
  sendChatAction = chatSender as unknown as typeof sendChatAction;
  sendBasketAction = basketSender as unknown as typeof sendBasketAction;

  whoamiReceiver((rawData, peerId) => netGuard('whoami', () => {
    if (!isObj(rawData)) return;
    useNetStore.getState().upsertPeer(peerId, {
      characterId: (typeof rawData.characterId === 'string'
        ? rawData.characterId
        : null) as CharacterId | null,
      joinedAt: num(rawData.joinedAt, Date.now()),
    });
  }));

  playerReceiver((rawData) => netGuard('player', () => {
    if (!isObj(rawData) || typeof rawData.characterId !== 'string') return;
    const r = rawData.riding;
    const riding = isObj(r)
      ? {
          bikeColor: str(r.bikeColor, '#888'),
          heading: num(r.heading),
          y: num(r.y),
          flipAngle: num(r.flipAngle),
        }
      : null;
    useNetStore.getState().setRemotePlayerState({
      characterId: rawData.characterId as CharacterId,
      x: num(rawData.x), y: num(rawData.y), z: num(rawData.z), yaw: num(rawData.yaw),
      running: bool(rawData.running), jumping: bool(rawData.jumping),
      riding,
      receivedAt: performance.now(),
    });
  }));

  worldReceiver((rawData) => netGuard('world', () => {
    // Only apply if I'm NOT the host (avoid overwriting our own sim).
    if (useNetStore.getState().isHost) return;
    if (!isObj(rawData)) return;
    applyWorldSnapshot(rawData);
  }));

  chatReceiver((rawData, peerId) => netGuard('chat', () => {
    if (!isObj(rawData)) return;
    const text = str(rawData.text).slice(0, 120);
    const characterId = rawData.characterId;
    if (!text || typeof characterId !== 'string') return;
    useChatStore.getState().appendMessage({
      id: str(rawData.id, `${peerId}-${num(rawData.sentAt)}`),
      characterId: characterId as CharacterId,
      text,
      sentAt: num(rawData.sentAt, Date.now()),
    });
  }));

  basketReceiver((rawData) => netGuard('basket', () => {
    if (!isObj(rawData) || typeof rawData.shooter !== 'string') return;
    // A peer scored — celebrate + count it on our side (sender already counted
    // locally; trystero doesn't echo to the sender, so no double-count).
    usePlayStore.getState().scoreBasket(rawData.shooter as CharacterId, performance.now());
  }));

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
  sendWhoami = sendPlayer = sendWorld = sendChatAction = sendBasketAction = null;
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

/** Tell peers we sank a basket (celebration only; the ball isn't networked). */
export async function broadcastBasket(shooter: CharacterId): Promise<void> {
  if (sendBasketAction) await sendBasketAction({ shooter, t: Date.now() }).catch(() => {});
}

/**
 * Apply a host-broadcasted world snapshot into our local stores. Reads every
 * field defensively (missing collections default to {}/[]) so a partial packet
 * can never throw on Object.keys/.map/index access.
 */
function applyWorldSnapshot(s: Json): void {
  // Game store: phase, hp, destroyed houses.
  const gs = useGameStore.getState();
  if (typeof s.phase === 'string' && gs.phase !== s.phase) gs.setPhase(s.phase as GamePhase);
  const playerHp = num(s.playerHp, gs.playerHp);
  if (gs.playerHp !== playerHp) {
    // Use direct set via the store's set fn — simpler than damage/heal deltas.
    useGameStore.setState({ playerHp });
  }
  // destroyedHouses: replace wholesale (small map).
  const destroyedHouses = obj(s.destroyedHouses) as Record<string, number>;
  if (Object.keys(destroyedHouses).length !== Object.keys(gs.destroyedHouses).length) {
    useGameStore.setState({ destroyedHouses });
  }

  // Combat store: blobs, wave state, power-ups, score.
  useCombatStore.setState({
    blobs: arr(s.blobs) as Blob[],
    waveIndex: num(s.waveIndex),
    waveState: s.waveState as WaveState,
    intermissionEndsAt: num(s.intermissionEndsAt),
    powerUpDrops: arr(s.powerUpDrops) as PowerUpDrop[],
    activePowerUps: arr(s.activePowerUps) as ActivePowerUp[],
    score: num(s.score),
    kills: num(s.kills),
  });

  // Tornado store: phase timing + visible fields.
  useTornadoStore.setState({
    phaseEnteredAt: num(s.tornadoPhaseEnteredAt),
    tornadoZ: num(s.tornadoZ),
    tornadoX: num(s.tornadoX),
    stormIntensity: num(s.stormIntensity),
    windStrength: num(s.windStrength),
    tornadoOpacity: num(s.tornadoOpacity),
  });

  // Munchies — only when host's snapshot includes it.
  if (isObj(s.munchies)) {
    applyMunchiesSnapshot(s.munchies);
  }
}

function applyMunchiesSnapshot(m: Json): void {
  const ms = useMunchiesStore.getState();
  const pellets = arr(m.pellets) as { id: string; x: number; z: number }[];
  const milks = arr(m.milks) as { id: string; x: number; z: number }[];

  // Replace pellets/milks if sizes differ (cheap signal).
  if (Object.keys(ms.pellets).length !== pellets.length) {
    useMunchiesStore.setState({
      pellets: Object.fromEntries(pellets.map((p) => [p.id, p])),
    });
  }
  if (Object.keys(ms.milks).length !== milks.length) {
    useMunchiesStore.setState({
      milks: Object.fromEntries(milks.map((mm) => [mm.id, mm])),
    });
  }

  // Sleepwalkers — mutate live x/z/yaw directly; update mode through setState only if changed.
  const srcWalkers = obj(m.sleepwalkers);
  let sleepwalkersChanged = false;
  const updated = { ...ms.sleepwalkers };
  for (const id of Object.keys(srcWalkers)) {
    const swId = id as SleepwalkerId;
    const src = obj(srcWalkers[id]);
    const target = updated[swId];
    if (!target) continue;
    target.x = num(src.x, target.x);
    target.z = num(src.z, target.z);
    target.yaw = num(src.yaw, target.yaw);
    if (typeof src.mode === 'string' && target.mode !== src.mode) {
      updated[swId] = { ...target, mode: src.mode as SleepwalkerMode, tuckedAt: num(src.tuckedAt) };
      sleepwalkersChanged = true;
    }
  }
  if (sleepwalkersChanged) {
    useMunchiesStore.setState({ sleepwalkers: updated });
  }

  // Scalars
  useMunchiesStore.setState({
    level: num(m.level, ms.level),
    score: num(m.score, ms.score),
    lives: num(m.lives, ms.lives),
    bonus: isObj(m.bonus)
      ? {
          x: num(m.bonus.x), z: num(m.bonus.z),
          spawnedAt: num(m.bonus.spawnedAt), eaten: bool(m.bonus.eaten),
        }
      : null,
    poweredUntil: num(m.poweredUntil),
    difficulty: (m.difficulty === 'awake' ? 'awake' : 'sleepy'),
    activeRoster: arr(m.roster).filter((s2): s2 is string => typeof s2 === 'string').filter(isSleepwalkerId),
  });
}

function isSleepwalkerId(s: string): s is 'dad' | 'penny' | 'dog' | 'schmorgesblob' {
  return s === 'dad' || s === 'penny' || s === 'dog' || s === 'schmorgesblob';
}
