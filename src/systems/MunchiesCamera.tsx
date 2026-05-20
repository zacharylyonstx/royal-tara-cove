import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';

const HEIGHT = 14;
const SOUTH_OFFSET = 1.5;
const LERP_K = 6;
const FOV = 50;
const TELEPORT_THRESHOLD = 3.0;  // m — snap instead of lerp if target jumped this far

export function MunchiesCamera() {
  const { camera } = useThree();
  const gameMode = useGameStore((s) => s.gameMode);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);

  const prevTarget = useRef<Vector3 | null>(null);

  useEffect(() => {
    if (gameMode !== 'munchies') return;
    if ('fov' in camera) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (camera as any).fov = FOV;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (camera as any).updateProjectionMatrix?.();
    }
    return () => {
      if ('fov' in camera) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (camera as any).fov = 80;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (camera as any).updateProjectionMatrix?.();
        prevTarget.current = null;
      }
    };
  }, [camera, gameMode]);

  const target = new Vector3();
  const look = new Vector3();

  useFrame((_, dtRaw) => {
    if (gameMode !== 'munchies') return;
    const dt = Math.min(dtRaw, 0.05);
    const id = myCharacterId ?? fallbackActive;
    const pos = useGameStore.getState().positions[id];
    if (!pos) return;

    target.set(pos.x, HEIGHT, pos.z + SOUTH_OFFSET);

    // Snap-on-teleport: if the new target is far from the previous frame's target,
    // skip the lerp and snap directly. This stops the camera from sliding across
    // the maze after Luke is teleported on level-start / caught-cinematic.
    if (!prevTarget.current) {
      camera.position.copy(target);
      prevTarget.current = target.clone();
    } else {
      const delta = prevTarget.current.distanceTo(target);
      if (delta > TELEPORT_THRESHOLD) {
        camera.position.copy(target);
      } else {
        const k = Math.min(1, LERP_K * dt);
        camera.position.lerp(target, k);
      }
      prevTarget.current.copy(target);
    }

    look.set(pos.x, 0.6, pos.z);
    camera.lookAt(look);
  });

  return null;
}
