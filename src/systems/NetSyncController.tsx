import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useNetStore } from '../state/netStore';
import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';
import { useCombatStore } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { broadcastPlayerState, broadcastWorldState, isInRoom } from '../net/room';
import type { PlayerStateMsg, WorldStateMsg, MunchiesNetSnapshot } from '../net/room';
import { useMunchiesStore } from '../state/munchiesStore';

const PLAYER_RATE_HZ = 15;
const WORLD_RATE_HZ = 10;
const PLAYER_INTERVAL = 1 / PLAYER_RATE_HZ;
const WORLD_INTERVAL = 1 / WORLD_RATE_HZ;

// Remote-player smoothing: at 15 Hz, raw assignment teleports peers ~4 frames
// at a time (visible stutter). We exponentially damp the rendered transform
// toward the received target instead. Large deltas (first sight, teleports,
// mode changes) snap so we never see a long slide across the map.
const REMOTE_SMOOTH = 14; // higher = snappier, lower = floatier
const REMOTE_SNAP_DIST = 5; // metres — beyond this, snap rather than lerp
// Drop a remote player we haven't heard from in this long (silently-stalled
// tab that never fired onPeerLeave) so it doesn't sit frozen forever.
const STALE_MS = 6000;

function shortestAngle(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Owns the network sync loop. Sits inside the R3F tree so it can tick via
 * useFrame. Three responsibilities:
 *
 *  1. Broadcast our character's pos/yaw to peers at ~15 Hz.
 *  2. If host, broadcast world snapshot at ~10 Hz.
 *  3. Apply incoming remote player positions into gameStore.positions for
 *     non-local characters (so Characters render driven by network).
 */
export function NetSyncController() {
  const playerAccum = useRef(0);
  const worldAccum = useRef(0);
  const lastRunningRef = useRef(false);
  const lastYRef = useRef(0);

  useFrame((_, dtRaw) => {
    if (!isInRoom()) return;
    const dt = Math.min(dtRaw, 0.1);
    const net = useNetStore.getState();
    const game = useGameStore.getState();

    // ---- Drop silently-stalled peers, then apply remote players (smoothed) ----
    net.pruneStalePlayers(performance.now(), STALE_MS);
    const k = 1 - Math.exp(-REMOTE_SMOOTH * dt); // frame-rate-independent damping
    const play = usePlayStore.getState();
    for (const [charId, rp] of Object.entries(net.remotePlayers)) {
      if (!rp) continue;
      if (charId === net.myCharacterId) continue;
      const pos = game.positions[charId as keyof typeof game.positions];
      const yaws = game.yaws as Record<string, number>;
      if (pos) {
        const far = Math.hypot(rp.x - pos.x, rp.y - pos.y, rp.z - pos.z) > REMOTE_SNAP_DIST;
        if (far) {
          // First sight / teleport / mode change — snap, don't slide.
          pos.x = rp.x; pos.y = rp.y; pos.z = rp.z;
          yaws[charId] = rp.yaw;
        } else {
          pos.x += (rp.x - pos.x) * k;
          pos.y += (rp.y - pos.y) * k;
          pos.z += (rp.z - pos.z) * k;
          yaws[charId] = (yaws[charId] ?? rp.yaw) + shortestAngle(yaws[charId] ?? rp.yaw, rp.yaw) * k;
        }
      }
      // Mirror the peer's riding state so we render the bike under them.
      const cid = charId as keyof typeof play.riding;
      const cur = play.riding[cid];
      if (rp.riding) {
        const ry = rp.riding.y ?? 0;
        const fa = rp.riding.flipAngle ?? 0;
        const flip = fa !== 0 ? { dir: (fa >= 0 ? 1 : -1) as 1 | -1, angle: fa } : null;
        if (!cur) play.mount(cid, { bikeId: `${charId}-remote`, bikeColor: rp.riding.bikeColor, heading: rp.riding.heading, speed: 0, y: ry, vy: 0, airborne: ry > 0.02, flip, wipeoutUntil: 0 });
        else {
          // Smooth heading + hop height; snap discrete fields (color/flip).
          cur.heading = cur.heading + shortestAngle(cur.heading, rp.riding.heading) * k;
          cur.y += (ry - cur.y) * k;
          cur.bikeColor = rp.riding.bikeColor;
          cur.airborne = ry > 0.02;
          cur.flip = flip;
        }
      } else if (cur) {
        play.dismount(cid);
      }
    }

    // ---- Outgoing: my player state ----
    if (net.myCharacterId) {
      playerAccum.current += dt;
      if (playerAccum.current >= PLAYER_INTERVAL) {
        playerAccum.current = 0;
        const pos = game.positions[net.myCharacterId];
        const yaw = game.yaws[net.myCharacterId];
        // Approximate flags from frame deltas — good enough for animation hints.
        const dy = pos.y - lastYRef.current;
        const jumping = Math.abs(dy) > 0.02;
        lastYRef.current = pos.y;
        const myRiding = usePlayStore.getState().riding[net.myCharacterId];
        const msg: PlayerStateMsg = {
          characterId: net.myCharacterId,
          x: pos.x, y: pos.y, z: pos.z, yaw,
          running: lastRunningRef.current,
          jumping,
          riding: myRiding ? { bikeColor: myRiding.bikeColor, heading: myRiding.heading, y: myRiding.y, flipAngle: myRiding.flip?.angle ?? 0 } : null,
          t: Date.now(),
        };
        broadcastPlayerState(msg);
      }
    }

    // ---- Outgoing: world snapshot (host only) ----
    if (net.isHost && Object.keys(net.peers).length > 1) {
      worldAccum.current += dt;
      if (worldAccum.current >= WORLD_INTERVAL) {
        worldAccum.current = 0;
        const combat = useCombatStore.getState();
        const tornado = useTornadoStore.getState();
        const snap: WorldStateMsg = {
          phase: game.phase,
          playerHp: game.playerHp,
          destroyedHouses: game.destroyedHouses,
          blobs: combat.blobs,
          waveIndex: combat.waveIndex,
          waveState: combat.waveState,
          intermissionEndsAt: combat.intermissionEndsAt,
          powerUpDrops: combat.powerUpDrops,
          activePowerUps: combat.activePowerUps,
          score: combat.score,
          kills: combat.kills,
          tornadoPhaseEnteredAt: tornado.phaseEnteredAt,
          tornadoZ: tornado.tornadoZ,
          tornadoX: tornado.tornadoX,
          stormIntensity: tornado.stormIntensity,
          windStrength: tornado.windStrength,
          tornadoOpacity: tornado.tornadoOpacity,
          t: Date.now(),
        };
        if (game.gameMode === 'munchies') {
          const ms = useMunchiesStore.getState();
          const swSerial: Record<string, { x: number; z: number; yaw: number; mode: string; tuckedAt: number }> = {};
          for (const id of Object.keys(ms.sleepwalkers)) {
            const sw = ms.sleepwalkers[id as keyof typeof ms.sleepwalkers];
            swSerial[id] = { x: sw.x, z: sw.z, yaw: sw.yaw, mode: sw.mode, tuckedAt: sw.tuckedAt };
          }
          const munchiesSnap: MunchiesNetSnapshot = {
            level: ms.level,
            score: ms.score,
            lives: ms.lives,
            sleepwalkers: swSerial,
            pellets: Object.values(ms.pellets),
            milks: Object.values(ms.milks),
            bonus: ms.bonus,
            poweredUntil: ms.poweredUntil,
            difficulty: ms.difficulty,
            roster: ms.activeRoster,
          };
          snap.munchies = munchiesSnap;
        }
        broadcastWorldState(snap);
      }
    }
  });

  return null;
}
