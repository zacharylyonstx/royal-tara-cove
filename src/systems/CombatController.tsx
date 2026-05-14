import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { laserZap, blobSquish } from '../audio';

const FIRE_COOLDOWN = 0.18;
const RANGE = 30;
const BLOB_RADIUS = 0.55;
const AIM_CONE_DEG = 50; // half-angle for auto-aim assist (wider = more forgiving)
const PASSIVE_AIM_RANGE = 22; // auto-face nearest blob within this range
const PASSIVE_AIM_LERP = 4; // rad/s rotation speed when auto-tracking

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

  const cooldown = useRef(0);
  const wantsFire = useRef(false);
  const lastTargetId = useRef<number | null>(null);

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
    if (phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1) * slowMo;
    cooldown.current = Math.max(0, cooldown.current - dt);

    // --- Passive aim assist: slowly rotate player to face nearest blob ---
    // Only when not actively moving (no WASD pressed). Detected indirectly
    // by checking whether the keyboard last moved us — easier: always track,
    // but at a slow lerp so movement input still wins.
    {
      const pos = positions[activeId];
      const blobsAlive = useCombatStore.getState().blobs.filter((b) => b.alive);
      let nearest = null as null | typeof blobsAlive[number];
      let nearestD = PASSIVE_AIM_RANGE;
      for (const b of blobsAlive) {
        const d = Math.hypot(b.x - pos.x, b.z - pos.z);
        if (d < nearestD) { nearestD = d; nearest = b; }
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

    cooldown.current = FIRE_COOLDOWN;
    recordShotFired();
    const pos = positions[activeId];
    let yaw = yaws[activeId];

    // --- Auto-aim assist: cone-snap with target rotation ---
    // Priority: (1) prefer NOT the last target (spread damage), (2) lowest HP
    // (finish kills), (3) nearest. This avoids wasting shots on one blob
    // while others swarm.
    const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
    const facingX = -Math.sin(yaw);
    const facingZ = -Math.cos(yaw);
    const coneCos = Math.cos((AIM_CONE_DEG * Math.PI) / 180);
    const candidates: { blob: typeof blobs[number]; dist: number }[] = [];
    for (const b of blobs) {
      const dx = b.x - pos.x;
      const dz = b.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > RANGE || dist < 0.001) continue;
      const ux = dx / dist;
      const uz = dz / dist;
      const dot = ux * facingX + uz * facingZ;
      if (dot < coneCos) continue;
      candidates.push({ blob: b, dist });
    }
    let snapTarget: typeof blobs[number] | null = null;
    if (candidates.length > 0) {
      // Sort by score: lower hp first, then nearer; demote the last target.
      candidates.sort((a, b) => {
        if (a.blob.hp !== b.blob.hp) return a.blob.hp - b.blob.hp;
        return a.dist - b.dist;
      });
      // If the top candidate is the same as last shot AND there's another, pick the alternate.
      if (candidates[0].blob.id === lastTargetId.current && candidates.length > 1) {
        snapTarget = candidates[1].blob;
      } else {
        snapTarget = candidates[0].blob;
      }
    }
    lastTargetId.current = snapTarget?.id ?? null;
    if (snapTarget) {
      // Snap player yaw and aim direction toward this blob
      const dx = snapTarget.x - pos.x;
      const dz = snapTarget.z - pos.z;
      yaw = Math.atan2(-dx, -dz);
      yaws[activeId] = yaw;
    }

    const HAND_X = 0.35;
    const MUZZLE_Z_LOCAL = -0.8;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const muzzleX = pos.x + HAND_X * cy + MUZZLE_Z_LOCAL * sy;
    const muzzleY = 1.1;
    const muzzleZ = pos.z - HAND_X * sy + MUZZLE_Z_LOCAL * cy;
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);

    let bestT = Infinity;
    let bestId: number | null = null;
    let bestPoint: [number, number, number] = [muzzleX + dirX * RANGE, muzzleY, muzzleZ + dirZ * RANGE];
    let bestVariant = 0;

    if (snapTarget) {
      // We've already chosen the target — compute hit point exactly on it
      const t = Math.hypot(snapTarget.x - muzzleX, snapTarget.z - muzzleZ);
      bestT = t;
      bestId = snapTarget.id;
      bestPoint = [snapTarget.x, snapTarget.y + 0.3 * snapTarget.scale, snapTarget.z];
      bestVariant = snapTarget.variant;
    } else {
      // No snap — fall back to raycast
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
    laserZap();
    if (bestId !== null) {
      const target = blobs.find((b) => b.id === bestId);
      damageBlob(bestId);
      recordShotHit();
      spawnHitParticle(bestPoint[0], bestPoint[1], bestPoint[2], bestVariant);
      if (target && target.hp <= 1) blobSquish();
    }
  });

  return null;
}
