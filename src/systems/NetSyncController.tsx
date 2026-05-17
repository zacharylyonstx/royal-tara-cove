import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useNetStore } from '../state/netStore';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { broadcastPlayerState, broadcastWorldState, isInRoom } from '../net/room';
import type { PlayerStateMsg, WorldStateMsg } from '../net/room';

const PLAYER_RATE_HZ = 15;
const WORLD_RATE_HZ = 10;
const PLAYER_INTERVAL = 1 / PLAYER_RATE_HZ;
const WORLD_INTERVAL = 1 / WORLD_RATE_HZ;

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

    // ---- Apply remote players → gameStore positions ----
    for (const [charId, rp] of Object.entries(net.remotePlayers)) {
      if (!rp) continue;
      const pos = game.positions[charId as keyof typeof game.positions];
      const yaws = game.yaws as Record<string, number>;
      if (pos) {
        pos.x = rp.x;
        pos.y = rp.y;
        pos.z = rp.z;
        yaws[charId] = rp.yaw;
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
        const msg: PlayerStateMsg = {
          characterId: net.myCharacterId,
          x: pos.x, y: pos.y, z: pos.z, yaw,
          running: lastRunningRef.current,
          jumping,
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
        broadcastWorldState(snap);
      }
    }
  });

  return null;
}
