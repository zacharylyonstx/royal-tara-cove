import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';

// Behind-the-back 3rd person. No pointer lock, no mouse-look.
// Auto-orients behind the player; smooth lag.

const HEIGHT = 3.2;
const BACK_DISTANCE = 6.0;
const LOOK_AHEAD = 2.0;
const LERP_K = 5;
const TELEPORT_THRESHOLD = 4.0;

export function TreehouseCamera() {
  const { camera } = useThree();
  const gameMode = useGameStore((s) => s.gameMode);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);

  const prevTarget = useRef<Vector3 | null>(null);
  const target = useRef(new Vector3());
  const look = useRef(new Vector3());

  useFrame((_, dtRaw) => {
    if (gameMode !== 'treehouse') return;
    const dt = Math.min(dtRaw, 0.05);
    const id = myCharacterId ?? fallbackActive;
    const pos = useGameStore.getState().positions[id];
    if (!pos) return;
    const yaw = useGameStore.getState().yaws[id];

    // Behind direction. Forward convention in this codebase: (-sin(yaw), -cos(yaw)).
    const behindX = Math.sin(yaw);
    const behindZ = Math.cos(yaw);

    target.current.set(
      pos.x + behindX * BACK_DISTANCE,
      pos.y + HEIGHT,
      pos.z + behindZ * BACK_DISTANCE,
    );

    if (!prevTarget.current) {
      camera.position.copy(target.current);
      prevTarget.current = target.current.clone();
    } else {
      const delta = prevTarget.current.distanceTo(target.current);
      if (delta > TELEPORT_THRESHOLD) {
        camera.position.copy(target.current);
      } else {
        const k = Math.min(1, LERP_K * dt);
        camera.position.lerp(target.current, k);
      }
      prevTarget.current.copy(target.current);
    }

    const forwardX = -behindX;
    const forwardZ = -behindZ;
    look.current.set(pos.x + forwardX * LOOK_AHEAD, pos.y + 1.4, pos.z + forwardZ * LOOK_AHEAD);
    camera.lookAt(look.current);
  });

  return null;
}
