import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import { laserZap, blobSquish } from '../audio';

const FIRE_COOLDOWN_BASE = 0.18;
const RAPID_FIRE_COOLDOWN = 0.06;
const RANGE = 55;                     // long enough to snipe blobs detouring around the house
const BLOB_RADIUS = 0.55;
const AIM_CONE_DEG = 40;             // forgiving snap so kids hit but not 50° free-shots
const PASSIVE_AIM_NEAR = 6;           // melee range still requires aiming
const PASSIVE_AIM_FAR = 24;           // active out to 24m (slightly farther)
const PASSIVE_AIM_LERP = 4.0;         // brisk tracking so kids find threats
const PREFER_LOW_HP_DELTA = 4;        // prefer finishing if within 4m of nearest

const BOMB_COOLDOWN = 0.6;
const LEGO_COOLDOWN = 0.4;

export function CombatController() {
  const { gl } = useThree();
  const phase = useGameStore((s) => s.phase);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const spawnBeam = useCombatStore((s) => s.spawnBeam);
  const spawnHitParticle = useCombatStore((s) => s.spawnHitParticle);
  const damageBlob = useCombatStore((s) => s.damageBlob);
  const recordShotFired = useCombatStore((s) => s.recordShotFired);
  const recordShotHit = useCombatStore((s) => s.recordShotHit);
  const slowMo = useCombatStore((s) => s.slowMo);
  const spawnProjectile = useCombatStore((s) => s.spawnProjectile);
  const hasPowerUp = useCombatStore((s) => s.hasPowerUp);

  const cooldown = useRef(0);
  const wantsFire = useRef(false);
  const lastTargetId = useRef<number | null>(null);
  const lastActiveId = useRef(activeId);

  // Reset cooldown on character switch (no exploit)
  if (lastActiveId.current !== activeId) {
    lastActiveId.current = activeId;
    cooldown.current = 0.15;
  }

  useEffect(() => {
    const canvas = gl.domElement;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (useGameStore.getState().phase !== 'combat') return;
      wantsFire.current = true;
    };
    const onMouseUp = () => { wantsFire.current = false; };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    if (phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1) * slowMo;
    cooldown.current = Math.max(0, cooldown.current - dt);

    // --- Passive aim assist ---
    {
      const pos = positions[activeId];
      const blobsAlive = useCombatStore.getState().blobs.filter((b) => b.alive);
      let nearest: typeof blobsAlive[number] | null = null;
      let nearestD = PASSIVE_AIM_FAR;
      for (const b of blobsAlive) {
        const d = Math.hypot(b.x - pos.x, b.z - pos.z);
        if (d < nearestD && d >= PASSIVE_AIM_NEAR) { nearestD = d; nearest = b; }
      }
      if (nearest) {
        const dx = nearest.x - pos.x;
        const dz = nearest.z - pos.z;
        const targetYaw = Math.atan2(-dx, -dz);
        let diff = targetYaw - yaws[activeId];
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        yaws[activeId] = yaws[activeId] + diff * Math.min(1, PASSIVE_AIM_LERP * dt);
      }
    }

    if (!wantsFire.current || cooldown.current > 0) return;

    // Dispatch by active character
    if (activeId === 'penny') {
      cooldown.current = BOMB_COOLDOWN;
      fireBomb();
    } else if (activeId === 'luke') {
      cooldown.current = LEGO_COOLDOWN;
      fireLegoSpread();
    } else {
      // Dad — ray gun (with powerup modifiers)
      cooldown.current = hasPowerUp('rapidFire') ? RAPID_FIRE_COOLDOWN : FIRE_COOLDOWN_BASE;
      fireRayGun();
    }
  });

  function getAimVectors() {
    const pos = positions[activeId];
    const yaw = yaws[activeId];
    const HAND_X = 0.35;
    const MUZZLE_Z_LOCAL = -0.8;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const muzzleX = pos.x + HAND_X * cy + MUZZLE_Z_LOCAL * sy;
    const muzzleY = 1.55;
    const muzzleZ = pos.z - HAND_X * sy + MUZZLE_Z_LOCAL * cy;
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);
    return { pos, yaw, muzzleX, muzzleY, muzzleZ, dirX, dirZ };
  }

  function snapTargetForYaw(yaw: number, posX: number, posZ: number) {
    const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
    const facingX = -Math.sin(yaw);
    const facingZ = -Math.cos(yaw);
    const coneCos = Math.cos((AIM_CONE_DEG * Math.PI) / 180);
    const candidates: { blob: typeof blobs[number]; dist: number }[] = [];
    for (const b of blobs) {
      const dx = b.x - posX;
      const dz = b.z - posZ;
      const dist = Math.hypot(dx, dz);
      if (dist > RANGE || dist < 0.001) continue;
      const ux = dx / dist;
      const uz = dz / dist;
      const dot = ux * facingX + uz * facingZ;
      if (dot < coneCos) continue;
      candidates.push({ blob: b, dist });
    }
    if (candidates.length === 0) return null;
    // Sort nearest-first, then promote any within PREFER_LOW_HP_DELTA of the
    // nearest that has lower HP (kid-friendly: finish kills when convenient).
    candidates.sort((a, b) => a.dist - b.dist);
    const nearest = candidates[0];
    let pick = nearest;
    for (const c of candidates) {
      if (c.dist - nearest.dist > PREFER_LOW_HP_DELTA) break;
      if (c.blob.hp < pick.blob.hp) pick = c;
    }
    return pick.blob;
  }

  function castBeamForYaw(yaw: number) {
    const pos = positions[activeId];
    const HAND_X = 0.35;
    const MUZZLE_Z_LOCAL = -0.8;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const muzzleX = pos.x + HAND_X * cy + MUZZLE_Z_LOCAL * sy;
    const muzzleY = 1.55;
    const muzzleZ = pos.z - HAND_X * sy + MUZZLE_Z_LOCAL * cy;
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);

    const big = hasPowerUp('bigLaser');
    const dmg = big ? 3 : 1;

    const snapTarget = snapTargetForYaw(yaw, pos.x, pos.z);
    let bestId: number | null = null;
    let bestPoint: [number, number, number] = [muzzleX + dirX * RANGE, muzzleY, muzzleZ + dirZ * RANGE];
    let bestVariant = 0;

    if (snapTarget) {
      bestId = snapTarget.id;
      bestPoint = [snapTarget.x, snapTarget.y + 0.3 * snapTarget.scale, snapTarget.z];
      bestVariant = snapTarget.variant;
    } else {
      const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
      let bestT = Infinity;
      for (const b of blobs) {
        const r = BLOB_RADIUS * b.scale;
        const fx = muzzleX - b.x;
        const fy = muzzleY - (b.y + 0.3 * b.scale);
        const fz = muzzleZ - b.z;
        const a = 1;
        const bb = 2 * (fx * dirX + fz * dirZ);
        const cc = fx * fx + fy * fy + fz * fz - r * r;
        const disc = bb * bb - 4 * a * cc;
        if (disc < 0) continue;
        const t = (-bb - Math.sqrt(disc)) / (2 * a);
        if (t < 0 || t > RANGE) continue;
        if (t < bestT) {
          bestT = t;
          bestId = b.id;
          bestPoint = [muzzleX + dirX * t, b.y + 0.3 * b.scale, muzzleZ + dirZ * t];
          bestVariant = b.variant;
        }
      }
    }
    spawnBeam([muzzleX, muzzleY, muzzleZ], bestPoint, 'cyan');
    if (bestId !== null) {
      const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
      const target = blobs.find((b) => b.id === bestId);
      // Damage is host-authoritative. Non-host beams are cosmetic — they
      // hit visually but don't subtract HP. Damage broadcast for non-host
      // shots is a follow-up.
      if (useNetStore.getState().isHost) {
        damageBlob(bestId, dmg);
        if (target && target.hp <= dmg) blobSquish();
      }
      recordShotHit();
      spawnHitParticle(bestPoint[0], bestPoint[1], bestPoint[2], bestVariant);
    }
    lastTargetId.current = bestId;
  }

  function fireRayGun() {
    const { yaw, pos } = getAimVectors();
    recordShotFired();
    const snap = snapTargetForYaw(yaw, pos.x, pos.z);
    let aimYaw = yaw;
    if (snap) {
      aimYaw = Math.atan2(-(snap.x - pos.x), -(snap.z - pos.z));
      yaws[activeId] = aimYaw;
    }
    laserZap();
    if (hasPowerUp('tripleShot')) {
      const spreadDeg = 8;
      castBeamForYaw(aimYaw - (spreadDeg * Math.PI) / 180);
      castBeamForYaw(aimYaw);
      castBeamForYaw(aimYaw + (spreadDeg * Math.PI) / 180);
    } else {
      castBeamForYaw(aimYaw);
    }
  }

  function fireBomb() {
    const { muzzleX, muzzleY, muzzleZ, dirX, dirZ, pos, yaw } = getAimVectors();
    recordShotFired();
    laserZap();
    // Only host spawns projectiles (ProjectileController is host-gated; on
    // non-host they would accumulate forever).
    if (!useNetStore.getState().isHost) return;
    // Auto-aim toward nearest target
    const snap = snapTargetForYaw(yaw, pos.x, pos.z);
    let tx = pos.x + dirX * 12;
    let tz = pos.z + dirZ * 12;
    if (snap) { tx = snap.x; tz = snap.z; }
    // Solve parabolic arc: launch with vy chosen so the bomb peaks halfway
    const dx = tx - muzzleX;
    const dz = tz - muzzleZ;
    const dist = Math.max(2, Math.hypot(dx, dz));
    const flightTime = Math.min(1.5, 0.15 + dist / 18);
    const vx = dx / flightTime;
    const vz = dz / flightTime;
    const vy = 0.5 * 22 * flightTime + 0.4; // up enough to clear an arc
    spawnProjectile({
      kind: 'bomb',
      x: muzzleX, y: muzzleY + 0.1, z: muzzleZ,
      vx, vy, vz,
      spawnedAt: performance.now() / 1000,
      bouncesLeft: 2,
      rotPhase: Math.random() * Math.PI * 2,
      damage: hasPowerUp('bigLaser') ? 4 : 2,
    });
  }

  function fireLegoSpread() {
    const { muzzleX, muzzleY, muzzleZ, pos, yaw } = getAimVectors();
    recordShotFired();
    laserZap();
    if (!useNetStore.getState().isHost) return;
    const snap = snapTargetForYaw(yaw, pos.x, pos.z);
    let aimYaw = yaw;
    if (snap) {
      aimYaw = Math.atan2(-(snap.x - pos.x), -(snap.z - pos.z));
      yaws[activeId] = aimYaw;
    }
    const triple: number = hasPowerUp('tripleShot') ? 5 : 3;
    const totalSpreadDeg = triple === 5 ? 28 : 18;
    const speed = 22;
    const dmg = hasPowerUp('bigLaser') ? 3 : 1;
    for (let i = 0; i < triple; i++) {
      const t = triple === 1 ? 0 : (i / (triple - 1)) - 0.5;
      const off = t * (totalSpreadDeg * Math.PI / 180);
      const a = aimYaw + off;
      const vx = -Math.sin(a) * speed;
      const vz = -Math.cos(a) * speed;
      spawnProjectile({
        kind: 'lego',
        x: muzzleX, y: muzzleY, z: muzzleZ,
        vx, vy: 1.2, vz,
        spawnedAt: performance.now() / 1000,
        rotPhase: Math.random() * Math.PI * 2,
        damage: dmg,
      });
    }
  }

  return null;
}
