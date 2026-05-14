import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import type { Blob } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { blobAttack, damageHit, bossSlam } from '../audio';

const HOP_DIST = 1.3;
const HOP_TIME = 0.45;
const HOP_PEAK = 0.7;
const ATTACK_DIST = 1.1;
const ATTACK_COOLDOWN = 1.0;
const APPROACH_RANGE = 60;
const SPRINTER_SPEED = 4.0;
const BOSS_CHARGE_SPEED = 6.0;
const BOSS_SLAM_RADIUS = 4.0;
const BOSS_SLAM_DAMAGE = 2;
const SPLITTER_SPLIT_COUNT = 2;

interface BlobRuntime {
  hopProgress: number;
  hopFromX: number; hopFromZ: number;
  hopToX: number; hopToZ: number;
  attackCooldown: number;
  spawnDelay: number;
  // Boss-specific
  bossSlamProgress: number; // -1 = idle, else 0..1 of slam arc
  bossChargeUntil: number;
  bossChargeDirX: number;
  bossChargeDirZ: number;
}

function newRuntime(b: Blob): BlobRuntime {
  return {
    hopProgress: 0,
    hopFromX: b.x, hopFromZ: b.z,
    hopToX: b.x, hopToZ: b.z,
    attackCooldown: 0,
    spawnDelay: b.kind === 'boss' ? 0.8 : 0.4 + Math.random() * 0.6,
    bossSlamProgress: -1,
    bossChargeUntil: 0,
    bossChargeDirX: 0,
    bossChargeDirZ: 0,
  };
}

export function BlobController() {
  const phase = useGameStore((s) => s.phase);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const damagePlayer = useGameStore((s) => s.damagePlayer);

  const blobs = useCombatStore((s) => s.blobs);
  const slowMo = useCombatStore((s) => s.slowMo);
  const decaySlowMo = useCombatStore((s) => s.decaySlowMo);
  const reapDeadBlobs = useCombatStore((s) => s.reapDeadBlobs);
  const reapSplats = useCombatStore((s) => s.reapSplats);
  const reapBeams = useCombatStore((s) => s.reapBeams);
  const reapHitParticles = useCombatStore((s) => s.reapHitParticles);
  const reapDialogue = useCombatStore((s) => s.reapDialogue);
  const spawnSplat = useCombatStore((s) => s.spawnSplat);
  const spawnBlob = useCombatStore((s) => s.spawnBlob);
  const triggerDamageFlash = useCombatStore((s) => s.triggerDamageFlash);
  const addShake = useCombatStore((s) => s.addShake);
  const triggerSlowMo = useCombatStore((s) => s.triggerSlowMo);
  const pushDialogue = useCombatStore((s) => s.pushDialogue);

  const runtimes = useRef<Map<number, BlobRuntime>>(new Map());
  const splatsSpawned = useRef<Set<number>>(new Set());
  const splittersHandled = useRef<Set<number>>(new Set());
  const bossKilledAt = useRef<number>(-1);

  useEffect(() => {
    if (phase !== 'combat' && phase !== 'intro') {
      runtimes.current.clear();
      splatsSpawned.current.clear();
      splittersHandled.current.clear();
      bossKilledAt.current = -1;
    }
  }, [phase]);

  useFrame((state, dtRaw) => {
    const now = state.clock.elapsedTime;
    const realDt = Math.min(dtRaw, 0.1);
    const dt = realDt * slowMo;

    decaySlowMo();
    reapDeadBlobs(now);
    reapSplats(now);
    reapBeams(now);
    reapHitParticles(now);
    reapDialogue(now);

    if (phase !== 'combat') return;

    const player = positions[activeId];

    for (const b of blobs) {
      if (!b.alive) {
        // Death effects (run once per blob)
        if (!splatsSpawned.current.has(b.id)) {
          splatsSpawned.current.add(b.id);
          const splatScale = b.kind === 'boss' ? 3.5 : 1;
          spawnSplat(b.x, b.z, b.variant, splatScale);
          // Splitter spawns babies
          if (b.kind === 'splitter' && !splittersHandled.current.has(b.id)) {
            splittersHandled.current.add(b.id);
            for (let i = 0; i < SPLITTER_SPLIT_COUNT; i++) {
              const ang = (i / SPLITTER_SPLIT_COUNT) * Math.PI * 2 + Math.random();
              const r = 1.0;
              spawnBlob('hopper', b.x + Math.cos(ang) * r, b.y, b.z + Math.sin(ang) * r);
            }
          }
          // Boss death cinematic
          if (b.kind === 'boss' && bossKilledAt.current < 0) {
            bossKilledAt.current = now;
            triggerSlowMo(0.25, 1.4);
            addShake(0.8);
            pushDialogue('dad', 'Earth defended!', 4);
          }
          runtimes.current.delete(b.id);
        }
        continue;
      }
      let rt = runtimes.current.get(b.id);
      if (!rt) {
        rt = newRuntime(b);
        runtimes.current.set(b.id, rt);
      }
      if (rt.spawnDelay > 0) {
        rt.spawnDelay -= dt;
        continue;
      }

      const dx = player.x - b.x;
      const dz = player.z - b.z;
      const dist = Math.hypot(dx, dz);

      // --- Sprinter: continuous slide toward player ---
      if (b.kind === 'sprinter') {
        if (dist > APPROACH_RANGE) continue;
        if (dist < ATTACK_DIST) {
          rt.attackCooldown -= dt;
          if (rt.attackCooldown <= 0) {
            rt.attackCooldown = ATTACK_COOLDOWN * 0.8;
            damagePlayer(1);
            blobAttack();
            damageHit();
            triggerDamageFlash();
            addShake(0.18);
          }
        } else {
          const ux = dx / Math.max(dist, 0.001);
          const uz = dz / Math.max(dist, 0.001);
          b.x += ux * SPRINTER_SPEED * dt;
          b.z += uz * SPRINTER_SPEED * dt;
        }
        continue;
      }

      // --- Boss: special AI ---
      if (b.kind === 'boss') {
        // Slam attack
        if (rt.bossSlamProgress >= 0) {
          rt.bossSlamProgress += dt / 1.0; // 1.0s slam total
          const k = Math.min(1, rt.bossSlamProgress);
          if (k < 0.5) {
            // Going up
            b.y = (k / 0.5) * 6;
          } else {
            // Coming down
            b.y = 6 * (1 - (k - 0.5) / 0.5);
            if (k >= 0.999) {
              b.y = 0;
              rt.bossSlamProgress = -1;
              bossSlam();
              addShake(0.6);
              if (dist < BOSS_SLAM_RADIUS) {
                damagePlayer(BOSS_SLAM_DAMAGE);
                damageHit();
                triggerDamageFlash();
              }
              rt.attackCooldown = ATTACK_COOLDOWN;
              b.slamCooldown = 8;
            }
          }
          continue;
        }
        // Charging
        if (now < rt.bossChargeUntil) {
          b.x += rt.bossChargeDirX * BOSS_CHARGE_SPEED * dt;
          b.z += rt.bossChargeDirZ * BOSS_CHARGE_SPEED * dt;
        } else {
          // Decide next action
          b.slamCooldown = (b.slamCooldown ?? 0) - dt;
          b.summonCooldown = (b.summonCooldown ?? 0) - dt;
          b.chargeCooldown = (b.chargeCooldown ?? 0) - dt;
          if ((b.slamCooldown ?? 0) <= 0 && dist < 8) {
            rt.bossSlamProgress = 0;
          } else if ((b.summonCooldown ?? 0) <= 0) {
            b.summonCooldown = 8;
            for (let i = 0; i < 2; i++) {
              const ang = Math.random() * Math.PI * 2;
              spawnBlob('hopper', b.x + Math.cos(ang) * 2, b.y, b.z + Math.sin(ang) * 2);
            }
            pushDialogue('penny', 'WATCH OUT!');
          } else if ((b.chargeCooldown ?? 0) <= 0 && dist > 12) {
            b.chargeCooldown = 9;
            const ux = dx / Math.max(dist, 0.001);
            const uz = dz / Math.max(dist, 0.001);
            rt.bossChargeDirX = ux;
            rt.bossChargeDirZ = uz;
            rt.bossChargeUntil = now + 1.8;
          } else {
            // Slow drift toward player
            const ux = dx / Math.max(dist, 0.001);
            const uz = dz / Math.max(dist, 0.001);
            b.x += ux * 1.0 * dt;
            b.z += uz * 1.0 * dt;
          }
        }
        // Melee contact damage
        if (dist < 2.5) {
          rt.attackCooldown -= dt;
          if (rt.attackCooldown <= 0) {
            rt.attackCooldown = 1.2;
            damagePlayer(1);
            damageHit();
            triggerDamageFlash();
            addShake(0.2);
          }
        }
        continue;
      }

      // --- Hopper / Splitter: hop toward player + melee ---
      if (rt.hopProgress > 0) {
        rt.hopProgress += dt / HOP_TIME;
        const t = Math.min(1, rt.hopProgress);
        b.x = rt.hopFromX + (rt.hopToX - rt.hopFromX) * t;
        b.z = rt.hopFromZ + (rt.hopToZ - rt.hopFromZ) * t;
        b.y = 4 * t * (1 - t) * HOP_PEAK;
        if (t >= 1) {
          rt.hopProgress = 0;
          b.y = 0;
        }
        continue;
      }
      if (dist > APPROACH_RANGE) continue;
      if (dist < ATTACK_DIST) {
        rt.attackCooldown -= dt;
        if (rt.attackCooldown <= 0) {
          rt.attackCooldown = ATTACK_COOLDOWN;
          damagePlayer(1);
          blobAttack();
          damageHit();
          triggerDamageFlash();
          addShake(0.18);
          const ux = -dx / Math.max(dist, 0.001);
          const uz = -dz / Math.max(dist, 0.001);
          rt.hopFromX = b.x; rt.hopFromZ = b.z;
          rt.hopToX = b.x + ux * HOP_DIST;
          rt.hopToZ = b.z + uz * HOP_DIST;
          rt.hopProgress = 0.001;
        }
        continue;
      }
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

    // Player low-HP nag
    const hp = useGameStore.getState().playerHp;
    if (hp > 0 && hp <= 3) {
      const last = useCombatStore.getState().dialogue.find((d) => d.speaker === 'luke' && d.text.includes('losing'));
      if (!last || now - last.spawnedAt > 8) {
        pushDialogue('luke', 'Dad, we\'re losing!');
      }
    }
  });

  return null;
}
