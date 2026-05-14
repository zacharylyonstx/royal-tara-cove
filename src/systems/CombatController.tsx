import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { laserZap, blobSquish } from '../audio';

const FIRE_COOLDOWN = 0.18;
const RANGE = 30;
const BLOB_RADIUS = 0.55;
const AIM_CONE_DEG = 25; // half-angle for auto-aim assist

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
    if (!wantsFire.current || cooldown.current > 0) return;

    cooldown.current = FIRE_COOLDOWN;
    recordShotFired();
    const pos = positions[activeId];
    let yaw = yaws[activeId];

    // --- Auto-aim assist: cone-snap to nearest blob in front ---
    const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
    const facingX = -Math.sin(yaw);
    const facingZ = -Math.cos(yaw);
    const coneCos = Math.cos((AIM_CONE_DEG * Math.PI) / 180);
    let snapTarget: typeof blobs[number] | null = null;
    let snapBestDist = Infinity;
    for (const b of blobs) {
      const dx = b.x - pos.x;
      const dz = b.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > RANGE || dist < 0.001) continue;
      const ux = dx / dist;
      const uz = dz / dist;
      const dot = ux * facingX + uz * facingZ;
      if (dot < coneCos) continue; // outside cone
      if (dist < snapBestDist) {
        snapBestDist = dist;
        snapTarget = b;
      }
    }
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
