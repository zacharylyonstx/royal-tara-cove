import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { BLOB_SPAWN } from '../components/aliens/UFOCrash';
import { blobAttack, damageHit, victoryFanfare, stopCrackleLoop } from '../audio';

const HOP_DIST = 1.3;
const HOP_TIME = 0.45;
const ATTACK_DIST = 1.0;
const ATTACK_COOLDOWN = 1.0;
const APPROACH_RANGE = 60;

interface BlobRuntime {
  hopProgress: number; // 0 = grounded, 1 = mid-hop
  hopFromX: number; hopFromZ: number;
  hopToX: number; hopToZ: number;
  attackCooldown: number;
  spawnDelay: number; // wait before first hop after spawn
}

export function BlobController() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const damagePlayer = useGameStore((s) => s.damagePlayer);

  const blobs = useCombatStore((s) => s.blobs);
  const blobsToSpawn = useCombatStore((s) => s.blobsToSpawn);
  const spawnBlob = useCombatStore((s) => s.spawnBlob);
  const consumeBlobToSpawn = useCombatStore((s) => s.consumeBlobToSpawn);
  const spawnSplat = useCombatStore((s) => s.spawnSplat);
  const reapDeadBlobs = useCombatStore((s) => s.reapDeadBlobs);
  const reapSplats = useCombatStore((s) => s.reapSplats);
  const reapBeams = useCombatStore((s) => s.reapBeams);
  const reapHitParticles = useCombatStore((s) => s.reapHitParticles);
  const triggerDamageFlash = useCombatStore((s) => s.triggerDamageFlash);
  const addShake = useCombatStore((s) => s.addShake);

  // Per-blob runtime state (refs to avoid React churn).
  const runtimes = useRef<Map<number, BlobRuntime>>(new Map());
  const spawnAccum = useRef(0);
  const victoryFired = useRef(false);

  // When we leave combat, clear runtimes.
  useEffect(() => {
    if (phase !== 'combat' && phase !== 'intro') {
      runtimes.current.clear();
      spawnAccum.current = 0;
      victoryFired.current = false;
    }
  }, [phase]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const now = state.clock.elapsedTime;

    // Cleanup expired effects every frame
    reapDeadBlobs(now);
    reapSplats(now);
    reapBeams(now);
    reapHitParticles(now);

    if (phase !== 'combat') return;

    // Spawn blobs gradually after the crash.
    if (blobsToSpawn > 0) {
      spawnAccum.current += dt;
      if (spawnAccum.current > 0.35) {
        spawnAccum.current = 0;
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterZ = (Math.random() - 0.5) * 2;
        spawnBlob(BLOB_SPAWN[0] + jitterX, BLOB_SPAWN[1], BLOB_SPAWN[2] + jitterZ);
        consumeBlobToSpawn();
      }
    }

    // Step each blob's AI.
    const player = positions[activeId];
    for (const b of blobs) {
      if (!b.alive) {
        if (b.deathAt > 0 && !runtimes.current.get(b.id)?.hopProgress) {
          // First time we see a dead blob — spawn a goo splat.
          if (runtimes.current.has(b.id)) {
            spawnSplat(b.x, b.z, b.variant);
            runtimes.current.delete(b.id);
          }
        }
        continue;
      }
      let rt = runtimes.current.get(b.id);
      if (!rt) {
        rt = {
          hopProgress: 0,
          hopFromX: b.x, hopFromZ: b.z,
          hopToX: b.x, hopToZ: b.z,
          attackCooldown: 0,
          spawnDelay: 0.4 + Math.random() * 0.6,
        };
        runtimes.current.set(b.id, rt);
      }

      if (rt.spawnDelay > 0) {
        rt.spawnDelay -= dt;
        continue;
      }

      // If mid-hop, progress hop
      if (rt.hopProgress > 0) {
        rt.hopProgress += dt / HOP_TIME;
        const t = Math.min(1, rt.hopProgress);
        b.x = rt.hopFromX + (rt.hopToX - rt.hopFromX) * t;
        b.z = rt.hopFromZ + (rt.hopToZ - rt.hopFromZ) * t;
        b.y = 4 * t * (1 - t) * 0.7;
        if (t >= 1) {
          rt.hopProgress = 0;
          b.y = 0;
        }
        continue;
      }

      // Pick next action
      const dx = player.x - b.x;
      const dz = player.z - b.z;
      const dist = Math.hypot(dx, dz);
      if (dist > APPROACH_RANGE) continue; // too far, idle

      if (dist < ATTACK_DIST) {
        rt.attackCooldown -= dt;
        if (rt.attackCooldown <= 0) {
          rt.attackCooldown = ATTACK_COOLDOWN;
          damagePlayer(1);
          blobAttack();
          damageHit();
          triggerDamageFlash();
          addShake(0.18);
          // Recoil hop away
          const ux = -dx / Math.max(dist, 0.001);
          const uz = -dz / Math.max(dist, 0.001);
          rt.hopFromX = b.x; rt.hopFromZ = b.z;
          rt.hopToX = b.x + ux * HOP_DIST;
          rt.hopToZ = b.z + uz * HOP_DIST;
          rt.hopProgress = 0.001;
        }
        continue;
      }

      // Hop toward player
      b.hopCooldown -= dt;
      if (b.hopCooldown <= 0) {
        b.hopCooldown = 0.6 + Math.random() * 0.4;
        const ux = dx / Math.max(dist, 0.001);
        const uz = dz / Math.max(dist, 0.001);
        rt.hopFromX = b.x; rt.hopFromZ = b.z;
        rt.hopToX = b.x + ux * HOP_DIST;
        rt.hopToZ = b.z + uz * HOP_DIST;
        rt.hopProgress = 0.001;
      }
    }

    // Check victory
    const aliveCount = blobs.filter((b) => b.alive).length;
    if (blobsToSpawn === 0 && aliveCount === 0 && !victoryFired.current) {
      const totalSpawned = useCombatStore.getState().spawnedBlobsCount;
      if (totalSpawned >= 8) {
        victoryFired.current = true;
        victoryFanfare();
        stopCrackleLoop();
        setPhase('victory');
      }
    }
  });

  return null;
}
