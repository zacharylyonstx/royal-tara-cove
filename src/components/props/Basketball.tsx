import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useGameStore } from '../../state/gameStore';
import { isNearPlayer } from '../../systems/distance';

interface BasketballProps {
  position: [number, number, number];
}

/**
 * A basketball that rests on the driveway. When the active character walks
 * into it, the ball is kicked away (along the player's facing direction)
 * and bounces with gravity until it settles.
 */
export function Basketball({ position }: BasketballProps) {
  const meshRef = useRef<Mesh>(null);
  const velocity = useRef({ x: 0, y: 0, z: 0 });
  const pos = useRef({ x: position[0], y: 0.16, z: position[2] });
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const activeId = useGameStore((s) => s.activeCharacterId);

  useFrame((_, dtRaw) => {
    if (!isNearPlayer(pos.current.x, pos.current.z, 40)) return;
    const dt = Math.min(dtRaw, 0.1);
    const m = meshRef.current;
    if (!m) return;

    // Check kick: player within 0.6m of ball
    const player = positions[activeId];
    const dx = pos.current.x - player.x;
    const dz = pos.current.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.7 && Math.abs(velocity.current.x) + Math.abs(velocity.current.z) < 0.5) {
      // Kick along player facing direction
      const facingX = -Math.sin(yaws[activeId]);
      const facingZ = -Math.cos(yaws[activeId]);
      const kickStrength = 5.5;
      velocity.current.x = facingX * kickStrength;
      velocity.current.z = facingZ * kickStrength;
      velocity.current.y = 4.5;
    }

    // Physics: gravity + bounce
    velocity.current.y -= 18 * dt;
    pos.current.x += velocity.current.x * dt;
    pos.current.y += velocity.current.y * dt;
    pos.current.z += velocity.current.z * dt;
    if (pos.current.y < 0.16) {
      pos.current.y = 0.16;
      if (velocity.current.y < -0.5) {
        velocity.current.y = -velocity.current.y * 0.55;
      } else {
        velocity.current.y = 0;
      }
      velocity.current.x *= 0.82;
      velocity.current.z *= 0.82;
      if (Math.abs(velocity.current.x) < 0.05) velocity.current.x = 0;
      if (Math.abs(velocity.current.z) < 0.05) velocity.current.z = 0;
    }

    m.position.set(pos.current.x, pos.current.y, pos.current.z);
    // Spin while moving
    const spinSpeed = Math.hypot(velocity.current.x, velocity.current.z);
    if (spinSpeed > 0.05) {
      m.rotation.x += spinSpeed * dt * 1.5;
      m.rotation.z += spinSpeed * dt * 0.8;
    }
  });

  return (
    <mesh ref={meshRef} position={[position[0], 0.16, position[2]]} castShadow>
      <sphereGeometry args={[0.16, 16, 16]} />
      <meshStandardMaterial color="#d8662a" roughness={0.9} />
    </mesh>
  );
}
