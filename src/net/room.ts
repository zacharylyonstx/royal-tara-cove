// Use the WebTorrent-tracker signaling strategy. The default `trystero`
// package uses Nostr relays which were intermittently failing (see
// payments.u4er.net WebSocket failures in console). WebTorrent trackers are
// well-maintained public infrastructure and more reliable for our use case.
import { joinRoom as trysteroJoin, selfId } from '@trystero-p2p/torrent';
import type { Room } from '@trystero-p2p/torrent';
import { useNetStore, peerOutranks } from '../state/netStore';
import { useGameStore, type GameMode, type GamePhase } from '../state/gameStore';
import { useCombatStore, type Blob, type PowerUpDrop, type ActivePowerUp, type WaveState } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useChatStore, EMOTES, type ChatMsg } from '../state/chatStore';
import { useMunchiesStore, type SleepwalkerId, type SleepwalkerMode } from '../state/munchiesStore';
import { usePlayStore } from '../state/playStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { type Appearance, SLOTS, getItem, defaultAppearance } from '../world/wardrobe';
import { blobSquish, chatPop, bonkHit } from '../audio';
import { useNightStore, type SirenState, type PlayerNightState, type Lantern } from '../state/nightStore';
import type { CharacterId } from '../types';

const APP_ID = 'royal-tara-cove-7f3a';
// Reliable WebTorrent signaling trackers (re-probed live 2026-06-03 — all three
// open in <800ms). Three of them so a single tracker hiccup never surfaces the
// "API error" in console; dead ones (btorrent.xyz, webtorrent.io, files.fm,
// fastcast.nz) are deliberately left out.
const RELAY_URLS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.novage.com.ua:443/announce',
];

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
  /** Crouching (Siren Head Night) — shrinks your detection radius; the host
   *  reads remote players' crouch so kids' hiding works when Dad hosts. */
  crouching?: boolean;
  /** Vehicle-riding state (so peers render the bike/car under us). y/flipAngle drive air + tricks.
   *  bikeId is the real registered prop id so observers hide the right parked vehicle. */
  riding?: { bikeId?: string; bikeColor: string; heading: number; y?: number; flipAngle?: number; vehicle?: 'bike' | 'car'; carKind?: 'sedan' | 'truck' | 'golfcart'; passengerOf?: CharacterId; seat?: number } | null;
  t: number; // sender timestamp ms
}

/** A "someone scored a basket" celebration event. */
export interface BasketMsg {
  shooter: CharacterId;
  t: number;
}

/**
 * A weapon discharge (aliens combat). Broadcast by every shooter so peers SEE
 * each other fight; the host additionally applies the damage (world state is
 * host-authoritative, so a guest kid's shots are forwarded here rather than
 * damaging locally).
 */
export interface FireMsg {
  by: CharacterId;
  kind: 'beam' | 'bomb' | 'lego';
  /** Beam visual endpoints (beam only). */
  fromX?: number; fromY?: number; fromZ?: number;
  toX?: number; toY?: number; toZ?: number;
  tint?: 'cyan' | 'pink' | 'green';
  /** Beam: blob the shooter's aim resolved to (null = miss). */
  targetBlobId?: number | null;
  /** Projectile launch state (bomb/lego only). */
  px?: number; py?: number; pz?: number;
  vx?: number; vy?: number; vz?: number;
  damage: number;
  t: number;
}

/** Siren Head Night — host tells everyone a player just got swatted (down) or
 *  freed (safe). A crisp one-shot so the BONK + ragdoll fire instantly on peers,
 *  in addition to the continuous WorldStateMsg.night replication. */
export interface SirenCaughtMsg {
  characterId: CharacterId;
  result: 'down' | 'safe';
  t: number;
}

/** A character's chosen dress-up look + real-vs-avatar mode (low-frequency: only
 *  on change + join). */
export interface WardrobeMsg {
  characterId: CharacterId;
  appearance: Appearance;
  realMode?: boolean;
  actionMode?: boolean;
}

/** A door swung open/closed (low-frequency: on interact + host greet). Doors
 *  are id-keyed in gameStore so a peer opening the front door opens it for
 *  everyone instead of Penny walking through a door Luke sees as shut. */
export interface DoorMsg {
  id: string;
  open: boolean;
  t: number;
}

/** Where cars are parked right now. Sent when a driver gets out (just that
 *  car) and by the host to a late joiner (every car) so nobody sees a truck
 *  teleport back to its driveway. */
export interface ParkMsg {
  cars: { id: string; x: number; z: number; yaw: number }[];
  t: number;
}
/** perf.now() of the last exact ParkMsg per car id — NetSync's "driver got out"
 *  fallback (which only knows the driver's SMOOTHED position) defers to this so
 *  the precise spot isn't overwritten by a laggy one a frame later. */
export const recentParkMsgAt = new Map<string, number>();

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
  /** Siren Head Night — undefined when not in night mode. roundEndsInSeconds is
   *  a DELTA (not an absolute clock) so cross-machine skew never matters. */
  night?: {
    sirenX: number; sirenZ: number; sirenYaw: number;
    sirenState: string; sirenTargetId: string | null;
    playerNightStates: Record<string, string>;
    lanterns: { id: string; x: number; z: number; state: string; carrier: string | null }[];
    lanternsDelivered: number;
    roundEndsInSeconds: number;
    regroupAt: number;
    sirenSwingCount: number;
  };
}

let room: Room | null = null;
let sendWhoami: ((data: Whoami, peers?: string | string[]) => Promise<void[]>) | null = null;
let sendPlayer: ((data: PlayerStateMsg) => Promise<void[]>) | null = null;
let sendWorld: ((data: WorldStateMsg) => Promise<void[]>) | null = null;
let sendChatAction: ((data: ChatMsg) => Promise<void[]>) | null = null;
let sendBasketAction: ((data: BasketMsg) => Promise<void[]>) | null = null;
let sendWardrobe: ((data: WardrobeMsg, peers?: string | string[]) => Promise<void[]>) | null = null;
let sendFireAction: ((data: FireMsg) => Promise<void[]>) | null = null;
let sendSirenCaughtAction: ((data: SirenCaughtMsg) => Promise<void[]>) | null = null;
let sendDoorAction: ((data: DoorMsg, peers?: string | string[]) => Promise<void[]>) | null = null;
let sendParkAction: ((data: ParkMsg, peers?: string | string[]) => Promise<void[]>) | null = null;
let myJoinedAt = 0;
/** Last host regroup timestamp we applied (raw host clock); guests stamp their
 *  own perf.now() when it changes so the "Regroup!" toast times correctly. */
let lastNightRegroupRaw = 0;
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
    // Pin known-working WebTorrent trackers (the signaling servers that introduce
    // peers). The old default `tracker.btorrent.xyz` is dead (connection timeout =
    // the "API error" in console). redundancy:3 connects all three healthy
    // trackers so one going down doesn't stop kids from finding each other.
    { appId: APP_ID, relayConfig: { urls: RELAY_URLS, redundancy: 3 } },
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
  const [wardrobeSender, wardrobeReceiver] = r.makeAction('wardrobe');
  const [fireSender, fireReceiver] = r.makeAction('fire');
  const [sirenCaughtSender, sirenCaughtReceiver] = r.makeAction('sirenCaught');
  const [doorSender, doorReceiver] = r.makeAction('door');
  const [parkSender, parkReceiver] = r.makeAction('park');
  sendWhoami = whoamiSender as unknown as typeof sendWhoami;
  sendPlayer = playerSender as unknown as typeof sendPlayer;
  sendWorld = worldSender as unknown as typeof sendWorld;
  sendChatAction = chatSender as unknown as typeof sendChatAction;
  sendBasketAction = basketSender as unknown as typeof sendBasketAction;
  sendWardrobe = wardrobeSender as unknown as typeof sendWardrobe;
  sendFireAction = fireSender as unknown as typeof sendFireAction;
  sendSirenCaughtAction = sirenCaughtSender as unknown as typeof sendSirenCaughtAction;
  sendDoorAction = doorSender as unknown as typeof sendDoorAction;
  sendParkAction = parkSender as unknown as typeof sendParkAction;

  whoamiReceiver((rawData, peerId) => netGuard('whoami', () => {
    if (!isObj(rawData)) return;
    const theirCharacterId = (typeof rawData.characterId === 'string'
      ? rawData.characterId
      : null) as CharacterId | null;
    const theirJoinedAt = num(rawData.joinedAt, Date.now());
    useNetStore.getState().upsertPeer(peerId, {
      characterId: theirCharacterId,
      joinedAt: theirJoinedAt,
    });

    // Duplicate claim: both of us say we're the same character (two kids both
    // tapped Dad before either saw the other's claim). Left alone, each side
    // ignores the other's position packets as "echoes of self" and they turn
    // invisible to each other. Resolve it with the SAME seniority rule as host
    // election so both browsers reach the same verdict with no negotiation.
    const net = useNetStore.getState();
    if (!theirCharacterId || theirCharacterId !== net.myCharacterId || !net.selfId) return;
    const me = { peerId: net.selfId, joinedAt: myJoinedAt };
    const them = { peerId, joinedAt: theirJoinedAt };
    if (peerOutranks(them, me)) {
      // I lose: let go of the character and tell everyone I'm unclaimed again.
      net.setMyCharacter(null);
      net.noteClaimBounce(theirCharacterId);
      if (sendWhoami) sendWhoami({ characterId: null, joinedAt: myJoinedAt }).catch(() => {});
    } else if (sendWhoami) {
      // I win: re-assert to just that peer so they run this same check and bounce.
      sendWhoami({ characterId: theirCharacterId, joinedAt: myJoinedAt }, peerId).catch(() => {});
    }
  }));

  playerReceiver((rawData) => netGuard('player', () => {
    if (!isObj(rawData) || typeof rawData.characterId !== 'string') return;
    const r = rawData.riding;
    const riding = isObj(r)
      ? {
          bikeId: str(r.bikeId, ''),
          bikeColor: str(r.bikeColor, '#888'),
          heading: num(r.heading),
          y: num(r.y),
          flipAngle: num(r.flipAngle),
          vehicle: r.vehicle === 'car' ? ('car' as const) : ('bike' as const),
          carKind: r.carKind === 'truck' ? ('truck' as const) : r.carKind === 'golfcart' ? ('golfcart' as const) : ('sedan' as const),
          // Passenger of another character (position derived from the driver on every client).
          passengerOf: (r.passengerOf === 'dad' || r.passengerOf === 'penny' || r.passengerOf === 'luke') ? (r.passengerOf as CharacterId) : undefined,
          seat: typeof r.seat === 'number' && r.seat >= 0 && r.seat < 8 ? Math.floor(r.seat) : undefined,
        }
      : null;
    useNetStore.getState().setRemotePlayerState({
      characterId: rawData.characterId as CharacterId,
      x: num(rawData.x), y: num(rawData.y), z: num(rawData.z), yaw: num(rawData.yaw),
      running: bool(rawData.running), jumping: bool(rawData.jumping),
      crouching: bool(rawData.crouching),
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
    // Audible arrival, pitched per family member — Dad hears the kids even
    // while he's mid-blob-fight.
    chatPop(characterId);
  }));

  basketReceiver((rawData) => netGuard('basket', () => {
    if (!isObj(rawData) || typeof rawData.shooter !== 'string') return;
    // A peer scored — celebrate + count it on our side (sender already counted
    // locally; trystero doesn't echo to the sender, so no double-count).
    usePlayStore.getState().scoreBasket(rawData.shooter as CharacterId, performance.now());
  }));

  fireReceiver((rawData) => netGuard('fire', () => {
    if (!isObj(rawData)) return;
    if (useGameStore.getState().gameMode !== 'aliens') return;
    const c = useCombatStore.getState();
    const tint = rawData.tint === 'pink' || rawData.tint === 'green' ? rawData.tint : 'cyan';
    const damage = Math.min(4, Math.max(1, num(rawData.damage, 1)));
    if (rawData.kind === 'beam') {
      // Everyone renders the shooter's beam; the host also lands the hit.
      const to: [number, number, number] = [num(rawData.toX), num(rawData.toY), num(rawData.toZ)];
      c.spawnBeam([num(rawData.fromX), num(rawData.fromY), num(rawData.fromZ)], to, tint);
      const targetId = typeof rawData.targetBlobId === 'number' ? rawData.targetBlobId : null;
      if (targetId !== null) {
        const blob = c.blobs.find((b) => b.id === targetId && b.alive);
        if (blob) {
          c.spawnHitParticle(to[0], to[1], to[2], blob.variant);
          if (useNetStore.getState().isHost) {
            c.damageBlob(targetId, damage);
            if (blob.hp <= damage) blobSquish();
          }
        }
      }
    } else if (rawData.kind === 'bomb' || rawData.kind === 'lego') {
      // Spawn the shooter's projectile locally. ProjectileController moves it
      // on every client; only the host's copy deals damage.
      c.spawnProjectile({
        kind: rawData.kind,
        x: num(rawData.px), y: num(rawData.py), z: num(rawData.pz),
        vx: num(rawData.vx), vy: num(rawData.vy), vz: num(rawData.vz),
        spawnedAt: performance.now() / 1000,
        bouncesLeft: rawData.kind === 'bomb' ? 2 : undefined,
        rotPhase: Math.random() * Math.PI * 2,
        damage,
      });
    }
  }));

  sirenCaughtReceiver((rawData) => netGuard('sirenCaught', () => {
    if (!isObj(rawData) || typeof rawData.characterId !== 'string') return;
    const id = rawData.characterId as CharacterId;
    if (id !== 'dad' && id !== 'penny' && id !== 'luke') return;
    const ns = useNightStore.getState();
    const result: PlayerNightState = rawData.result === 'safe' ? 'safe' : 'down';
    ns.setPlayerNightState(id, result);
    ns.setDownAt(id, performance.now() / 1000);
    bonkHit();
    // If it was MY character, pop my own ragdoll locally (it broadcasts via the
    // normal position sync so others see the launch too).
    if (result === 'down' && id === useNetStore.getState().myCharacterId) {
      const p = useGameStore.getState().positions[id];
      if (p) useGameStore.getState().startRagdoll(p.x, p.y, p.z, performance.now() / 1000);
    }
  }));

  wardrobeReceiver((rawData) => netGuard('wardrobe', () => {
    if (!isObj(rawData) || typeof rawData.characterId !== 'string') return;
    const id = rawData.characterId;
    if (id !== 'dad' && id !== 'penny' && id !== 'luke') return;
    const real = typeof rawData.realMode === 'boolean' ? rawData.realMode : undefined;
    const action = typeof rawData.actionMode === 'boolean' ? rawData.actionMode : undefined;
    useWardrobeStore.getState().setRemoteAppearance(id, safeAppearance(id, rawData.appearance), real, action);
  }));

  doorReceiver((rawData) => netGuard('door', () => {
    if (!isObj(rawData)) return;
    const { id, open } = rawData;
    if (typeof id !== 'string' || id.length === 0 || id.length >= 80) return;
    if (typeof open !== 'boolean') return;
    // setDoorOpen is idempotent + ignores unknown ids, so a late/duplicate
    // packet or a door this build hasn't registered yet is harmless.
    useGameStore.getState().setDoorOpen(id, open);
  }));

  parkReceiver((rawData) => netGuard('park', () => {
    if (!isObj(rawData)) return;
    const cars = arr(rawData.cars);
    if (cars.length > 64) return; // the whole neighborhood is ~25 cars
    const play = usePlayStore.getState();
    const now = performance.now();
    for (const c of cars) {
      if (!isObj(c) || typeof c.id !== 'string' || c.id.length >= 80) continue;
      if (typeof c.x !== 'number' || typeof c.z !== 'number' || typeof c.yaw !== 'number') continue;
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || !Number.isFinite(c.yaw)) continue;
      play.parkCar(c.id, c.x, c.z, c.yaw); // no-ops on unknown ids
      recentParkMsgAt.set(c.id, now);
    }
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
    // Tell the new peer what our character is wearing.
    const myId = useNetStore.getState().myCharacterId;
    if (sendWardrobe && myId) {
      const ws = useWardrobeStore.getState();
      sendWardrobe({ characterId: myId, appearance: ws.appearances[myId], realMode: ws.realMode[myId], actionMode: ws.actionMode[myId] }, peerId).catch(() => {});
    }
    // Host catches the late joiner up on world bits that only change on
    // interaction (not in the 10 Hz snapshot): which doors are open, and
    // where every car is parked right now.
    if (useNetStore.getState().isHost) {
      const t = Date.now();
      if (sendDoorAction) {
        const doors = useGameStore.getState().doors;
        for (const id of Object.keys(doors)) {
          if (doors[id].open) sendDoorAction({ id, open: true, t }, peerId).catch(() => {});
        }
      }
      if (sendParkAction) {
        const cars = Object.values(usePlayStore.getState().cars)
          .map((c) => ({ id: c.id, x: c.x, z: c.z, yaw: c.yaw }));
        if (cars.length) sendParkAction({ cars, t }, peerId).catch(() => {});
      }
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
  sendWhoami = sendPlayer = sendWorld = sendChatAction = sendBasketAction = sendWardrobe = null;
  sendFireAction = null;
  sendSirenCaughtAction = null;
  sendDoorAction = sendParkAction = null;
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
  chatPop(characterId);
  if (sendChatAction) await sendChatAction(msg).catch(() => {});
}

let lastEmoteAt = 0;

/** Send a one-tap emote (index into EMOTES) through the chat channel.
 *  Lightly rate-limited so a button-mashing kid doesn't flood the room. */
export function sendEmote(index: number): void {
  const e = EMOTES[index];
  if (!e) return;
  const now = Date.now();
  if (now - lastEmoteAt < 350) return;
  lastEmoteAt = now;
  void sendChat(e);
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

/** Broadcast a weapon discharge so peers see it (and the host lands it). */
export async function broadcastFire(msg: FireMsg): Promise<void> {
  if (sendFireAction) await sendFireAction(msg).catch(() => {});
}

/** Host → peers: a player got swatted by Siren Head (or freed). */
export async function broadcastSirenCaught(msg: SirenCaughtMsg): Promise<void> {
  if (sendSirenCaughtAction) await sendSirenCaughtAction(msg).catch(() => {});
}

/** Broadcast our character's chosen dress-up look to all peers. */
export async function broadcastWardrobe(msg: WardrobeMsg): Promise<void> {
  if (sendWardrobe) await sendWardrobe(msg).catch(() => {});
}

/** Tell peers a door just swung (call after toggling it locally). */
export async function broadcastDoor(msg: DoorMsg): Promise<void> {
  if (sendDoorAction) await sendDoorAction(msg).catch(() => {});
}

/** Tell peers where car(s) are now parked (call when a driver gets out). */
export async function broadcastPark(cars: { id: string; x: number; z: number; yaw: number }[]): Promise<void> {
  if (!cars.length) return;
  if (sendParkAction) await sendParkAction({ cars, t: Date.now() }).catch(() => {});
}

/** Build a validated Appearance from an untrusted P2P payload (catalog-checked). */
function safeAppearance(id: CharacterId, raw: unknown): Appearance {
  const base = defaultAppearance(id);
  if (!isObj(raw)) return base;
  for (const slot of SLOTS) {
    const c = raw[slot];
    if (isObj(c) && typeof c.item === 'string') {
      const it = getItem(slot, c.item);
      base[slot] = { item: it.id, color: typeof c.color === 'string' ? c.color : (it.colors[0] ?? '') };
    }
  }
  return base;
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
  // Kill juice for guests: the host plays squish/shake at the moment of a
  // kill, but a guest only learns about it here — without this, a kid's own
  // killing blow lands in total silence on her machine.
  const nextBlobs = arr(s.blobs) as Blob[];
  {
    const cs = useCombatStore.getState();
    const prevAlive = cs.blobs.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
    const nextAlive = nextBlobs.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
    if (nextAlive < prevAlive && prevAlive > 0) {
      blobSquish();
      cs.addShake(0.1);
    }
  }
  useCombatStore.setState({
    blobs: nextBlobs,
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

  // Siren Head Night — only when host's snapshot includes it.
  if (isObj(s.night)) {
    applyNightSnapshot(s.night);
  }
}

function applyNightSnapshot(n: Json): void {
  const ns = useNightStore.getState();
  ns.setSiren(
    num(n.sirenX), num(n.sirenZ), num(n.sirenYaw),
    str(n.sirenState, 'patrol') as SirenState,
    typeof n.sirenTargetId === 'string' ? (n.sirenTargetId as CharacterId) : null,
  );
  const pns = obj(n.playerNightStates);
  for (const id of ['dad', 'penny', 'luke'] as const) {
    const v = str(pns[id], 'alive');
    const st: PlayerNightState = v === 'down' ? 'down' : v === 'safe' ? 'safe' : 'alive';
    ns.setPlayerNightState(id, st);
  }
  const lanterns: Lantern[] = arr(n.lanterns)
    .map((l) => {
      const o = obj(l);
      const stt = str(o.state, 'idle');
      return {
        id: str(o.id),
        x: num(o.x), z: num(o.z),
        state: (stt === 'carried' ? 'carried' : stt === 'delivered' ? 'delivered' : 'idle') as Lantern['state'],
        carrier: typeof o.carrier === 'string' ? (o.carrier as CharacterId) : null,
      };
    })
    .filter((l) => l.id);
  if (lanterns.length) ns.setLanterns(lanterns);
  ns.setLanternsDelivered(num(n.lanternsDelivered));
  ns.setRoundEndsInSeconds(num(n.roundEndsInSeconds));
  // Regroup toast: when the host's raw timestamp changes, stamp our own clock.
  const rg = num(n.regroupAt);
  if (rg && rg !== lastNightRegroupRaw) {
    lastNightRegroupRaw = rg;
    ns.setRegroupAt(performance.now() / 1000);
  }
  // Hand-swat cue: a counter — the mesh latches locally on change (skew-safe).
  const sc = num(n.sirenSwingCount);
  if (sc !== ns.sirenSwingCount) useNightStore.setState({ sirenSwingCount: sc });
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
