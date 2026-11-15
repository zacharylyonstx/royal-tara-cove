import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCombatStore, POWERUP_BASE_DROP_RATE, POWERUP_KINDS } from '../state/combatStore';
import type { Blob, PowerUpKind } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { blobAttack, damageHit, bossSlam } from '../audio';
import { ensureBlobNav, navFieldFor, blobWaypoint, blobLineOfSight, blobSafeSpot } from '../world/blobNav';

const HOP_DIST = 1.3;
const HOP_TIME = 0.5;
const HOP_PEAK = 0.7;
const ATTACK_DIST = 1.1;
const ATTACK_COOLDOWN = 3.0;     // slower attacks → fightable
const APPROACH_RANGE = 140;       // pods land all over the block now
const SPRINTER_SPEED = 3.1;       // quick enough to be scary, slow enough to out-walk
/** Far from everyone, blobs hustle (nobody enjoys waiting a minute for the
 *  wave to waddle over); up close they slow to the fair, dodgeable pace. */
const HUSTLE_BEYOND = 15;
const BOSS_CHARGE_SPEED = 5.5;
const BOSS_SLAM_RADIUS = 4.0;
const BOSS_SLAM_DAMAGE = 3;
const SPLITTER_SPLIT_COUNT = 2;
/** Blobs keep roughly this far apart (× their size) instead of stacking. */
const PERSONAL_SPACE = 0.95;
/** Even mobbed by a whole wave, the family loses HP no faster than one bite
 *  per this many seconds — a surrounded 6-year-old gets time to run for it. */
const BITE_GAP_S = 0.75;

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

/** The claimed character closest to (bx, bz) — who this blob is after. */
function nearestPlayer(bx: number, bz: number) {
  const g = useGameStore.getState();
  const net = useNetStore.getState();
  let bestId: string = g.activeCharacterId;
  let bestPos = g.positions[g.activeCharacterId];
  let bestDist = Infinity;
  let any = false;
  for (const p of Object.values(net.peers)) {
    if (!p.characterId) continue;
    const pos = g.positions[p.characterId];
    if (!pos) continue;
    any = true;
    const d = Math.hypot(pos.x - bx, pos.z - bz);
    if (d < bestDist) { bestDist = d; bestPos = pos; bestId = p.characterId; }
  }
  // Pure single-player (no room joined): chase the active character.
  if (!any) bestDist = Math.hypot(bestPos.x - bx, bestPos.z - bz);
  return { id: bestId, pos: bestPos, dist: bestDist };
}

const _wp = { x: 0, z: 0 };

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
  /** When the family last took a hit — small blobs take turns biting. */
  const lastBiteAt = useRef(-999);

  useEffect(() => {
    if (phase !== 'combat' && phase !== 'intro') {
      runtimes.current.clear();
      splatsSpawned.current.clear();
      splittersHandled.current.clear();
      bossKilledAt.current = -1;
    }
  }, [phase]);

  useFrame((_, dtRaw) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    // ONE clock for everything combat: the store stamps spawn/death/hit times
    // with performance.now(), so compare against the same thing (the R3F clock
    // starts a beat later, which used to stretch every beam and death pop).
    const now = performance.now() / 1000;
    const realDt = Math.min(dtRaw, 0.1);
    const dt = realDt * slowMo;

    // Local-FX housekeeping runs on EVERY client — guests spawn their own
    // beams/particles/popups when shooting, and without reaping they pile up
    // forever (permanent glow trails + slow leak on the kids' machines).
    decaySlowMo();
    reapSplats(now);
    reapBeams(now);
    reapHitParticles(now);
    reapDialogue(now);
    reapFloatingTexts(now);
    reapFireworks(now);
    decayCombo(now);

    // Everything below is the host-authoritative sim (blob brains, damage,
    // spawns). Guests receive its results via the world snapshot.
    if (!useNetStore.getState().isHost) return;
    reapDeadBlobs(now);
    reapPowerUps(now);

    if (phase !== 'combat') return;
    ensureBlobNav(useGameStore.getState().staticColliders);
    const frozen = hasPowerUp('freezeRay');
    const shielded = hasPowerUp('shield');
    const hurt = (n: number, shake: number) => {
      lastBiteAt.current = now;
      if (!shielded) damagePlayer(n);
      damageHit();
      triggerDamageFlash();
      addShake(shake);
    };

    for (const b of blobs) {
      if (!b.alive) {
        // Death effects (run once per blob)
        if (!splatsSpawned.current.has(b.id)) {
          splatsSpawned.current.add(b.id);
          const splatScale = b.kind === 'boss' ? 3.5 : b.kind === 'brute' ? 1.8 : 1;
          spawnSplat(b.x, b.z, b.variant, splatScale);
          registerKill(b.kind, b.x, b.y, b.z);
          // Tactile kill feedback for regular blobs (boss gets its big slam below):
          // a tiny shake every kill + a brief slow-mo punch on combo milestones.
          if (b.kind !== 'boss') {
            addShake(b.kind === 'brute' ? 0.3 : 0.12);
            const combo = useCombatStore.getState().comboCount;
            if (combo > 0 && combo % 3 === 0) triggerSlowMo(0.4, 0.08);
          }
          // Power-up drop chance (boss + brutes always drop). When the family
          // is hurt, a good share of drops are health instead of a gun boost.
          const dropRate = b.kind === 'boss' || b.kind === 'brute' ? 1 : POWERUP_BASE_DROP_RATE;
          if (Math.random() < dropRate) {
            const gs = useGameStore.getState();
            const hpFrac = gs.playerHp / gs.maxHp;
            const healChance = hpFrac < 0.4 ? 0.7 : hpFrac < 0.75 ? 0.4 : 0;
            const kind: PowerUpKind = Math.random() < healChance
              ? 'heal'
              : POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
            spawnPowerUp(b.x, b.z, kind);
          }
          // Splitter spawns babies
          if (b.kind === 'splitter' && !splittersHandled.current.has(b.id)) {
            splittersHandled.current.add(b.id);
            for (let i = 0; i < SPLITTER_SPLIT_COUNT; i++) {
              const ang = (i / SPLITTER_SPLIT_COUNT) * Math.PI * 2 + Math.random();
              const spot = blobSafeSpot(b.x + Math.cos(ang), b.z + Math.sin(ang));
              spawnBlob('hopper', spot.x, 0, spot.z);
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
      // Freeze ray: no movement, no attacks.
      if (frozen) continue;
      let rt = runtimes.current.get(b.id);
      if (!rt) {
        rt = newRuntime(b);
        runtimes.current.set(b.id, rt);
      }
      if (rt.spawnDelay > 0) {
        rt.spawnDelay -= dt;
        continue;
      }

      // Who am I after, and which way round the houses do I go to get there?
      const prey = nearestPlayer(b.x, b.z);
      const player = prey.pos;
      const playerDist = prey.dist;
      if (playerDist > APPROACH_RANGE) continue;
      blobWaypoint(navFieldFor(prey.id, player.x, player.z, now), b.x, b.z, _wp);
      let dx = _wp.x - b.x;
      let dz = _wp.z - b.z;
      const dist = Math.hypot(dx, dz);
      // A little personal space so a wave arrives as a crowd, not a stack.
      {
        let px = 0, pz = 0;
        for (const o of blobs) {
          if (o === b || !o.alive) continue;
          const ox = b.x - o.x, oz = b.z - o.z;
          const od = Math.hypot(ox, oz);
          const want = PERSONAL_SPACE * (b.scale + o.scale) * 0.5;
          if (od < want && od > 0.001) {
            const push = (want - od) / want;
            px += (ox / od) * push;
            pz += (oz / od) * push;
          }
        }
        if (px !== 0 || pz !== 0) {
          const ux = dx / Math.max(dist, 0.001), uz = dz / Math.max(dist, 0.001);
          const sx = ux + px * 0.9, sz = uz + pz * 0.9;
          const sl = Math.hypot(sx, sz);
          if (sl > 0.05) { dx = (sx / sl) * dist; dz = (sz / sl) * dist; }
        }
      }
      const ux = dx / Math.max(dist, 0.001);
      const uz = dz / Math.max(dist, 0.001);
      const hustle = playerDist > HUSTLE_BEYOND;

      // --- Sprinter: continuous slide toward player ---
      if (b.kind === 'sprinter') {
        if (playerDist < ATTACK_DIST) {
          rt.attackCooldown -= dt;
          if (rt.attackCooldown <= 0 && now - lastBiteAt.current > BITE_GAP_S) {
            rt.attackCooldown = ATTACK_COOLDOWN * 0.8;
            blobAttack();
            hurt(1, 0.18);
          }
        } else {
          const sp = SPRINTER_SPEED * (hustle ? 1.6 : 1);
          b.x += ux * sp * dt;
          b.z += uz * sp * dt;
        }
        continue;
      }

      // --- Boss: special AI ---
      if (b.kind === 'boss') {
        const sees = playerDist < 30 && blobLineOfSight(b.x, b.z, player.x, player.z);
        // Slam attack (finishes even if you duck behind something)
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
              if (playerDist < BOSS_SLAM_RADIUS) hurt(BOSS_SLAM_DAMAGE, 0.2);
              rt.attackCooldown = ATTACK_COOLDOWN;
              b.slamCooldown = 8;
            }
          }
          continue;
        }
        if (!sees) {
          // Lumber round the houses until it can see someone.
          rt.bossChargeUntil = 0;
          b.x += ux * 2.2 * dt;
          b.z += uz * 2.2 * dt;
          continue;
        }
        // From here it has a clear line: aim straight at the player.
        const pdx = player.x - b.x, pdz = player.z - b.z;
        const pux = pdx / Math.max(playerDist, 0.001), puz = pdz / Math.max(playerDist, 0.001);
        // Charging
        if (now < rt.bossChargeUntil) {
          b.x += rt.bossChargeDirX * BOSS_CHARGE_SPEED * dt;
          b.z += rt.bossChargeDirZ * BOSS_CHARGE_SPEED * dt;
        } else {
          // Decide next action
          b.slamCooldown = (b.slamCooldown ?? 0) - dt;
          b.summonCooldown = (b.summonCooldown ?? 0) - dt;
          b.chargeCooldown = (b.chargeCooldown ?? 0) - dt;
          if ((b.slamCooldown ?? 0) <= 0 && playerDist < 8) {
            rt.bossSlamProgress = 0;
          } else if ((b.summonCooldown ?? 0) <= 0) {
            b.summonCooldown = 8;
            for (let i = 0; i < 2; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spot = blobSafeSpot(b.x + Math.cos(ang) * 2.4, b.z + Math.sin(ang) * 2.4);
              spawnBlob('hopper', spot.x, 0, spot.z);
            }
            pushDialogue('penny', 'WATCH OUT!');
          } else if ((b.chargeCooldown ?? 0) <= 0 && playerDist > 12) {
            b.chargeCooldown = 9;
            rt.bossChargeDirX = pux;
            rt.bossChargeDirZ = puz;
            rt.bossChargeUntil = now + 1.8;
          } else {
            // Slow drift toward player
            b.x += pux * 1.2 * dt;
            b.z += puz * 1.2 * dt;
          }
        }
        // Melee contact damage
        if (playerDist < 2.5) {
          rt.attackCooldown -= dt;
          if (rt.attackCooldown <= 0) {
            rt.attackCooldown = 1.2;
            hurt(1, 0.2);
          }
        }
        continue;
      }

      // --- Hopper / Splitter / Brute: hop toward player + melee ---
      const brute = b.kind === 'brute';
      if (rt.hopProgress > 0) {
        rt.hopProgress += dt / (brute ? HOP_TIME * 1.25 : HOP_TIME);
        const t = Math.min(1, rt.hopProgress);
        b.x = rt.hopFromX + (rt.hopToX - rt.hopFromX) * t;
        b.z = rt.hopFromZ + (rt.hopToZ - rt.hopFromZ) * t;
        b.y = 4 * t * (1 - t) * (brute ? HOP_PEAK * 1.4 : HOP_PEAK);
        if (t >= 1) {
          rt.hopProgress = 0;
          b.y = 0;
          if (brute) addShake(playerDist < 12 ? 0.1 : 0); // you FEEL a brute land
        }
        continue;
      }
      const reach = brute ? ATTACK_DIST + 0.7 : ATTACK_DIST;
      if (playerDist < reach) {
        rt.attackCooldown -= dt;
        if (rt.attackCooldown <= 0 && now - lastBiteAt.current > BITE_GAP_S) {
          rt.attackCooldown = ATTACK_COOLDOWN;
          blobAttack();
          hurt(brute ? 2 : 1, brute ? 0.32 : 0.18);
          // Bounce back off the player after a bite.
          const bx = -(player.x - b.x) / Math.max(playerDist, 0.001);
          const bz = -(player.z - b.z) / Math.max(playerDist, 0.001);
          rt.hopFromX = b.x; rt.hopFromZ = b.z;
          rt.hopToX = b.x + bx * HOP_DIST;
          rt.hopToZ = b.z + bz * HOP_DIST;
          rt.hopProgress = 0.001;
        }
        continue;
      }
      b.hopCooldown -= dt;
      if (b.hopCooldown <= 0) {
        b.hopCooldown = brute
          ? (hustle ? 0.3 : 0.85) + Math.random() * 0.3
          : hustle ? 0.18 + Math.random() * 0.14 : 0.45 + Math.random() * 0.35;
        // Never overshoot the corner we're steering for.
        const stride = Math.min(dist, brute ? (hustle ? 2.0 : 1.5) : hustle ? 1.75 : HOP_DIST);
        rt.hopFromX = b.x; rt.hopFromZ = b.z;
        rt.hopToX = b.x + ux * stride;
        rt.hopToZ = b.z + uz * stride;
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
