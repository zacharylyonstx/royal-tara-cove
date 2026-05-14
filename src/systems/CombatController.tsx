import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { laserZap, blobSquish } from '../audio';

const FIRE_COOLDOWN = 0.18;
const RANGE = 30;
const BLOB_RADIUS = 0.55;

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
    const yaw = yaws[activeId];
    const HAND_X = 0.35;
    const MUZZLE_Z_LOCAL = -0.8;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const muzzleX = pos.x + HAND_X * cy + MUZZLE_Z_LOCAL * sy;
    const muzzleY = 1.1;
    const muzzleZ = pos.z - HAND_X * sy + MUZZLE_Z_LOCAL * cy;
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);

    const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
    let bestT = Infinity;
    let bestId: number | null = null;
    let bestPoint: [number, number, number] = [muzzleX + dirX * RANGE, muzzleY, muzzleZ + dirZ * RANGE];
    let bestVariant = 0;
    let bestKind: typeof blobs[number]['kind'] = 'hopper';
    for (const b of blobs) {
      // Use scale-adjusted radius
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
        bestKind = b.kind;
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
      void bestKind;
    }
  });

  return null;
}
