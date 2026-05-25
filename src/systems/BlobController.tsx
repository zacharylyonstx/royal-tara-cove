import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCombatStore, POWERUP_BASE_DROP_RATE, POWERUP_KINDS } from '../state/combatStore';
import type { Blob } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { blobAttack, damageHit, bossSlam } from '../audio';

const HOP_DIST = 1.3;
const HOP_TIME = 0.5;
const HOP_PEAK = 0.7;
const ATTACK_DIST = 1.1;
const ATTACK_COOLDOWN = 3.0;     // slower attacks → fightable
const APPROACH_RANGE = 60;
const SPRINTER_SPEED = 2.6;       // was 4.0 — easier to kite
const BOSS_CHARGE_SPEED = 5.5;
const BOSS_SLAM_RADIUS = 4.0;
const BOSS_SLAM_DAMAGE = 3;
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

/** Returns the position of the claimed character closest to (bx, bz). */
function nearestPlayerPos(bx: number, bz: number) {
  const g = useGameStore.getState();
  const net = useNetStore.getState();
  // Build the set of claimed character IDs (all peers, including self).
  const claimed = new Set<string>();
  for (const p of Object.values(net.peers)) {
    if (p.characterId) claimed.add(p.characterId);
  }
  // Fallback to activeCharacterId in pure single-player (no room joined).
  if (claimed.size === 0) claimed.add(g.activeCharacterId);

  let bestPos = g.positions[g.activeCharacterId];
  let bestDist = Infinity;
  for (const id of claimed) {
    const p = g.positions[id as keyof typeof g.positions];
    if (!p) continue;
    const d = Math.hypot(p.x - bx, p.z - bz);
    if (d < bestDist) { bestDist = d; bestPos = p; }
  }
  return bestPos;
}

export function BlobController() {
  const phase = useGameStore((s) => s.phase);
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
  const registerKill = useCombatStore((s) => s.registerKill);
  const decayCombo = useCombatStore((s) => s.decayCombo);
  const reapPowerUps = useCombatStore((s) => s.reapPowerUps);
  const reapFloatingTexts = useCombatStore((s) => s.reapFloatingTexts);
  const reapFireworks = useCombatStore((s) => s.reapFireworks);
  const spawnPowerUp = useCombatStore((s) => s.spawnPowerUp);
  const hasPowerUp = useCombatStore((s) => s.hasPowerUp);

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
    if (!useNetStore.getState().isHost) return;
    if (useGameStore.getState().gameMode !== 'aliens') return;
    const now = state.clock.elapsedTime;
    const realDt = Math.min(dtRaw, 0.1);
    const dt = realDt * slowMo;

    decaySlowMo();
    reapDeadBlobs(now);
    reapSplats(now);
    reapBeams(now);
    reapHitParticles(now);
    reapDialogue(now);
    reapPowerUps(now);
    reapFloatingTexts(now);
    reapFireworks(now);
    decayCombo(now);

    if (phase !== 'combat') return;

    for (const b of blobs) {
      if (!b.alive) {
        // Death effects (run once per blob)
        if (!splatsSpawned.current.has(b.id)) {
          splatsSpawned.current.add(b.id);
          const splatScale = b.kind === 'boss' ? 3.5 : 1;
          spawnSplat(b.x, b.z, b.variant, splatScale);
          registerKill(b.kind, b.x, b.y, b.z);
          // Power-up drop chance (boss always drops)
          const dropRate = b.kind === 'boss' ? 1 : POWERUP_BASE_DROP_RATE;
          if (Math.random() < dropRate) {
            const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
            spawnPowerUp(b.x, b.z, kind);
          }
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
      // Freeze ray: skip movement while frozen
      if (hasPowerUp('freezeRay')) {
        // Pause all blob behavior - no movement, no attacks
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

      // Detour pathing: aim for waypoint until reached, then chase nearest player.
      if (!b.waypointReached) {
        const wdx = b.waypointX - b.x;
        const wdz = b.waypointZ - b.z;
        if (Math.hypot(wdx, wdz) < 1.0) {
          b.waypointReached = true;
        }
      }
      const player = nearestPlayerPos(b.x, b.z);
      const targetX = b.waypointReached ? player.x : b.waypointX;
      const targetZ = b.waypointReached ? player.z : b.waypointZ;
      const dx = targetX - b.x;
      const dz = targetZ - b.z;
      const dist = Math.hypot(dx, dz);
      const playerDist = b.waypointReached ? dist : Math.hypot(player.x - b.x, player.z - b.z);
      // Don't attempt melee attacks while still routing around the house.
      const canAttack = b.waypointReached;

      // --- Sprinter: continuous slide toward player ---
      if (b.kind === 'sprinter') {
        if (dist > APPROACH_RANGE) continue;
        if (canAttack && playerDist < ATTACK_DIST) {
          rt.attackCooldown -= dt;
          if (rt.attackCooldown <= 0) {
            rt.attackCooldown = ATTACK_COOLDOWN * 0.8;
            if (!hasPowerUp('shield')) damagePlayer(1);
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
        // Before reaching waypoint, just drift toward it; skip combat AI.
        if (!b.waypointReached) {
          const ux = dx / Math.max(dist, 0.001);
          const uz = dz / Math.max(dist, 0.001);
          b.x += ux * 1.6 * dt;
          b.z += uz * 1.6 * dt;
          continue;
        }
        // From here, dist/dx/dz are to player (waypointReached is true).
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
                if (!hasPowerUp('shield')) damagePlayer(BOSS_SLAM_DAMAGE);
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
            if (!hasPowerUp('shield')) damagePlayer(1);
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
      if (canAttack && playerDist < ATTACK_DIST) {
        rt.attackCooldown -= dt;
        if (rt.attackCooldown <= 0) {
          rt.attackCooldown = ATTACK_COOLDOWN;
          if (!hasPowerUp('shield')) damagePlayer(1);
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
