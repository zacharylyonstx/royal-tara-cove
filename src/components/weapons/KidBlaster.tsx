import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useGameStore } from '../../state/gameStore';
import type { CharacterId } from '../../types';

interface KidBlasterProps {
  who: CharacterId;
  color: string;
}

const HAND_X = 0.28;
const HAND_Z = -0.2;
const Y = 0.85;

/**
 * A small kid-sized blaster anchored to a non-active character's hand.
 * Visible whenever combat is active and this is not the active character.
 */
export function KidBlaster({ who, color }: KidBlasterProps) {
  const groupRef = useRef<Group>(null);
  const phase = useGameStore((s) => s.phase);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (phase !== 'combat' || activeId === who || useGameStore.getState().gameMode !== 'aliens') {
      g.visible = false;
      return;
    }
    g.visible = true;
    const pos = positions[who];
    const yaw = yaws[who];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const wx = pos.x + HAND_X * cy + HAND_Z * sy;
    const wz = pos.z - HAND_X * sy + HAND_Z * cy;
    g.position.set(wx, Y, wz);
    g.rotation.set(0, yaw, 0);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, -0.06, 0.04]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.06, 0.16, 0.07]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.04, -0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.045, 0.28, 10]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.04, -0.32]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}
