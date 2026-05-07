import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';

const SPEED = 4.5;
const RUN_SPEED = 8.0;
const JUMP_VELOCITY = 7.5;
const GRAVITY = 22;

// World-space movement controller. Reads keyboard, mutates the active
// character's Vector3 position and yaw in the store. Movement direction is
// always computed relative to the camera's horizontal heading.
export function PlayerController() {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const yVel = useRef(0);

  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const setActive = useGameStore((s) => s.setActiveCharacter);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      if (k === '1') setActive('dad');
      if (k === '2') setActive('penny');
      if (k === '3') setActive('luke');
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setActive]);

  useFrame((_, dtRaw) => {
    if (welcomeOpen) return;
    const dt = Math.min(dtRaw, 0.1); // clamp on tab-switch resume

    const k = keys.current;
    let dx = 0;
    let dz = 0;
    if (k['w'] || k['arrowup']) dz -= 1;
    if (k['s'] || k['arrowdown']) dz += 1;
    if (k['a'] || k['arrowleft']) dx -= 1;
    if (k['d'] || k['arrowright']) dx += 1;

    const pos = positions[activeId];

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;

      const camDir = new Vector3();
      camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      const camRight = new Vector3().crossVectors(camDir, new Vector3(0, 1, 0)).normalize();

      const isRunning = !!k['shift'];
      const speed = isRunning ? RUN_SPEED : SPEED;

      const moveDir = new Vector3()
        .addScaledVector(camDir, -dz)
        .addScaledVector(camRight, dx)
        .normalize();

      pos.x += moveDir.x * speed * dt;
      pos.z += moveDir.z * speed * dt;

      // Rotate character to face movement direction (lerp).
      const targetYaw = Math.atan2(-moveDir.x, -moveDir.z);
      let diff = targetYaw - yaws[activeId];
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      yaws[activeId] = yaws[activeId] + diff * Math.min(1, 14 * dt);
    }

    // Jump
    if ((k[' '] || k['space']) && pos.y < 0.05) {
      yVel.current = JUMP_VELOCITY;
    }
    yVel.current -= GRAVITY * dt;
    pos.y += yVel.current * dt;
    if (pos.y < 0) {
      pos.y = 0;
      yVel.current = 0;
    }
  });

  return null;
}
