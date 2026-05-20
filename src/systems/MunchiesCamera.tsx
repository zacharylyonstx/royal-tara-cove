import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';

// Top-down camera locked above Luke. ~14m up, slightly south of him so the
// camera looks slightly back (small forward tilt) — gives a tabletop feel
// while still letting you read which way Luke is facing.

const HEIGHT = 14;
const SOUTH_OFFSET = 1.5;
const LERP_K = 8;
const FOV = 50;

export function MunchiesCamera() {
  const { camera } = useThree();
  const gameMode = useGameStore((s) => s.gameMode);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);

  useEffect(() => {
    if (gameMode !== 'munchies') return;
    // perspectiveCamera fov isn't a prop on the global camera; mutate directly.
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
      }
    };
  }, [camera, gameMode]);

  const target = new Vector3();
  const look = new Vector3();

  useFrame((_, dtRaw) => {
    if (gameMode !== 'munchies') return;
    const dt = Math.min(dtRaw, 0.1);
    const id = myCharacterId ?? fallbackActive;
    const pos = useGameStore.getState().positions[id];
    if (!pos) return;
    target.set(pos.x, HEIGHT, pos.z + SOUTH_OFFSET);
    const k = Math.min(1, LERP_K * dt);
    camera.position.lerp(target, k);
    look.set(pos.x, 0.6, pos.z);
    camera.lookAt(look);
  });

  return null;
}
