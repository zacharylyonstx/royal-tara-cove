import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import type { CharacterId } from '../types';
import { laserZap } from '../audio';

const FIRE_INTERVAL = 2.0;
const RANGE = 18;
const BLOB_RADIUS = 0.55;

/**
 * Penny + Luke autoshoot at the nearest blob when not the active character.
 * Slower fire rate than the player; tinted beams.
 */
export function SidekickController() {
  const phase = useGameStore((s) => s.phase);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const damageBlob = useCombatStore((s) => s.damageBlob);
  const spawnBeam = useCombatStore((s) => s.spawnBeam);
  const spawnHitParticle = useCombatStore((s) => s.spawnHitParticle);
  const recordShotFired = useCombatStore((s) => s.recordShotFired);
  const recordShotHit = useCombatStore((s) => s.recordShotHit);

  const cooldowns = useRef<Record<CharacterId, number>>({
    dad: 0,
    penny: 0,
    luke: 0,
  });

  useFrame((_, dtRaw) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    if (phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1);

    const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
    if (blobs.length === 0) return;

    for (const id of ['penny', 'luke'] as CharacterId[]) {
      if (id === activeId) continue;
      cooldowns.current[id] -= dt;
      if (cooldowns.current[id] > 0) continue;

      const pos = positions[id];
      // Find nearest blob in range
      let bestDist = RANGE;
      let bestBlob = null as null | typeof blobs[number];
      for (const b of blobs) {
        const d = Math.hypot(b.x - pos.x, b.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          bestBlob = b;
        }
      }
      if (!bestBlob) continue;

      // Aim at the blob (rotate kid to face it)
      const dx = bestBlob.x - pos.x;
      const dz = bestBlob.z - pos.z;
      const yaw = Math.atan2(-dx, -dz);
      yaws[id] = yaw;

      // Fire
      cooldowns.current[id] = FIRE_INTERVAL;
      recordShotFired();
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const HAND_X = 0.28;
      const MUZZLE_Z = -0.5;
      const muzzleX = pos.x + HAND_X * cy + MUZZLE_Z * sy;
      const muzzleY = 0.95;
      const muzzleZ = pos.z - HAND_X * sy + MUZZLE_Z * cy;

      // Raycast against the chosen blob (we already know it's nearest in range)
      const fx = muzzleX - bestBlob.x;
      const fy = muzzleY - (bestBlob.y + 0.3 * bestBlob.scale);
      const fz = muzzleZ - bestBlob.z;
      const dirX = -Math.sin(yaw);
      const dirZ = -Math.cos(yaw);
      const a = 1;
      const bb = 2 * (fx * dirX + fz * dirZ);
      const cc = fx * fx + fy * fy + fz * fz - (BLOB_RADIUS * bestBlob.scale) ** 2;
      const disc = bb * bb - 4 * a * cc;
      const tint = id === 'penny' ? 'pink' : 'green';
      if (disc < 0) {
        // Miss — beam to a far point
        spawnBeam([muzzleX, muzzleY, muzzleZ], [muzzleX + dirX * RANGE, muzzleY, muzzleZ + dirZ * RANGE], tint);
        laserZap();
        continue;
      }
      const t = (-bb - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t > RANGE) {
        spawnBeam([muzzleX, muzzleY, muzzleZ], [muzzleX + dirX * RANGE, muzzleY, muzzleZ + dirZ * RANGE], tint);
        laserZap();
        continue;
      }
      const hitX = muzzleX + dirX * t;
      const hitY = bestBlob.y + 0.3 * bestBlob.scale;
      const hitZ = muzzleZ + dirZ * t;
      spawnBeam([muzzleX, muzzleY, muzzleZ], [hitX, hitY, hitZ], tint);
      laserZap();
      damageBlob(bestBlob.id);
      recordShotHit();
      spawnHitParticle(hitX, hitY, hitZ, bestBlob.variant);
    }
  });

  return null;
}
