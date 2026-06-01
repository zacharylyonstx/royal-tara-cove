import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { resolveMotion } from './collision';
import type { CharacterId } from '../types';
import { CHARACTER_ORDER } from '../world/characters';

const NPC_SPEED = 1.6;
const PICK_NEW_TARGET_AFTER = 6; // seconds before they pick a new wander target

interface NPCState {
  targetX: number;
  targetZ: number;
  pickedAt: number;
}

/**
 * Drives Penny and Luke (and Dad when not active) to wander gently around
 * Royal Tara Cove when they're not the active character.
 *
 * Wander logic: pick a random point within ±25m of current position, walk
 * toward it at slow pace, repick after a few seconds or when arrived.
 */
export function NPCController() {
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const staticColliders = useGameStore((s) => s.staticColliders);
  const doors = useGameStore((s) => s.doors);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);

  const npcStates = useRef<Record<CharacterId, NPCState>>({
    dad: { targetX: 0, targetZ: 0, pickedAt: 0 },
    penny: { targetX: 0, targetZ: 0, pickedAt: 0 },
    luke: { targetX: 0, targetZ: 0, pickedAt: 0 },
  });

  useFrame((state, dtRaw) => {
    if (welcomeOpen) return;
    const mode = useGameStore.getState().gameMode;
    if (mode === 'munchies' || mode === 'treehouse') return;
    const net = useNetStore.getState();
    // Only run NPC wandering on the host — non-hosts receive character
    // positions via player_state broadcasts. Wandering for unclaimed
    // characters is host-authoritative; their positions are seen by other
    // peers because the host's CharacterId for each NPC isn't broadcast
    // (peers see them at spawn). Acceptable for v1.
    if (!net.isHost) return;
    const dt = Math.min(dtRaw, 0.1);
    const t = state.clock.elapsedTime;

    const colliders = [...staticColliders];
    for (const door of Object.values(doors)) {
      if (!door.open) colliders.push(door.aabbWhenClosed);
    }

    // Characters claimed by any peer (other than unclaimed ones).
    const claimed = new Set<CharacterId>();
    for (const p of Object.values(net.peers)) {
      if (p.characterId) claimed.add(p.characterId);
    }

    for (const id of CHARACTER_ORDER) {
      // Don't wander characters that any peer (including self) claims —
      // those are driven by their owner's input / network broadcasts.
      if (claimed.has(id)) continue;
      // Also defer to any peer with a LIVE remote-player entry: this prevents a
      // tug-of-war with NetSyncController if a peer's whoami hasn't (re)arrived
      // but their position packets have. When a peer goes stale its entry is
      // pruned, so the character gracefully falls back to wandering here.
      if (net.remotePlayers[id]) continue;
      // Single-player fallback: if no one claims a character but we ARE the
      // local active player by gameStore, skip too.
      if (id === activeId && net.peers && Object.keys(net.peers).length === 0) continue;
      const pos = positions[id];
      const npc = npcStates.current[id];

      const dist = Math.hypot(npc.targetX - pos.x, npc.targetZ - pos.z);
      if (dist < 0.5 || t - npc.pickedAt > PICK_NEW_TARGET_AFTER) {
        // Pick a new target: random offset within ±20m, biased toward the cul-de-sac.
        const seed = (Math.sin(t * 12345 + id.length * 31) + 1) * 0.5;
        const ang = seed * Math.PI * 2;
        const r = 4 + Math.random() * 16;
        npc.targetX = pos.x + Math.cos(ang) * r;
        npc.targetZ = pos.z + Math.sin(ang) * r;
        npc.pickedAt = t;
      }

      const dx = npc.targetX - pos.x;
      const dz = npc.targetZ - pos.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const ux = dx / len;
      const uz = dz / len;
      const desiredX = pos.x + ux * NPC_SPEED * dt;
      const desiredZ = pos.z + uz * NPC_SPEED * dt;
      const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, colliders);
      // If we got blocked on both axes, abandon target so we pick a new one
      if (resolved.collidedX && resolved.collidedZ) {
        npc.pickedAt = -100;
      }
      pos.x = resolved.x;
      pos.z = resolved.z;
      const targetYaw = Math.atan2(-ux, -uz);
      let diff = targetYaw - yaws[id];
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      yaws[id] = yaws[id] + diff * Math.min(1, 6 * dt);
    }
  });

  return null;
}
