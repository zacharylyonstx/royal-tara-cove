import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useGameStore } from '../../state/gameStore';
import { isNearPlayer } from '../../systems/distance';

interface CatProps {
  position: [number, number, number];
  rotation?: number;
  furColor?: string;
}

/** A sleeping orange tabby that wakes (head up, tail flicks) when player approaches. */
export function Cat({ position, rotation = 0, furColor = '#d68a3a' }: CatProps) {
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const body = useRef<Group>(null);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);

  useFrame((state) => {
    if (!isNearPlayer(position[0], position[2], 40)) return;
    const t = state.clock.elapsedTime;
    const player = positions[activeId];
    const dx = position[0] - player.x;
    const dz = position[2] - player.z;
    const dist = Math.hypot(dx, dz);
    const awake = dist < 4.5;

    if (head.current) {
      const target = awake ? 0.8 : 0.0;
      head.current.position.y = head.current.position.y + (target - head.current.position.y) * 0.05;
      head.current.rotation.x = awake ? -0.3 : 0;
    }
    if (tail.current) {
      const wag = awake ? 0.6 : 0.15;
      tail.current.rotation.y = Math.sin(t * (awake ? 6 : 1)) * wag;
    }
    if (body.current) {
      // Breathing
      body.current.scale.y = 1 + Math.sin(t * 1.6) * 0.04;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* body */}
      <group ref={body}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.5, 0.22, 0.85]} />
          <meshStandardMaterial color={furColor} roughness={0.95} />
        </mesh>
        {/* leg humps (visible while curled) */}
        {[
          [-0.18, 0.08, -0.3],
          [0.18, 0.08, -0.3],
          [-0.18, 0.08, 0.3],
          [0.18, 0.08, 0.3],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={furColor} roughness={0.95} />
          </mesh>
        ))}
      </group>
      {/* head */}
      <group ref={head} position={[0, 0, -0.45]}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color={furColor} roughness={0.95} />
        </mesh>
        {/* ears */}
        <mesh position={[-0.1, 0.13, 0.02]} rotation={[0, 0, -0.3]} castShadow>
          <coneGeometry args={[0.06, 0.12, 6]} />
          <meshStandardMaterial color={furColor} />
        </mesh>
        <mesh position={[0.1, 0.13, 0.02]} rotation={[0, 0, 0.3]} castShadow>
          <coneGeometry args={[0.06, 0.12, 6]} />
          <meshStandardMaterial color={furColor} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.06, 0.02, -0.13]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#1a8a3a" emissive="#3a8a3a" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.06, 0.02, -0.13]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#1a8a3a" emissive="#3a8a3a" emissiveIntensity={0.3} />
        </mesh>
        {/* nose */}
        <mesh position={[0, -0.04, -0.155]}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <meshStandardMaterial color="#3a1818" />
        </mesh>
      </group>
      {/* tail */}
      <group ref={tail} position={[0, 0.2, 0.4]}>
        <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 6, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.5, 6]} />
          <meshStandardMaterial color={furColor} />
        </mesh>
      </group>
    </group>
  );
}
