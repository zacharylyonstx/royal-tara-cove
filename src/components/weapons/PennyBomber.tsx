import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useGameStore } from '../../state/gameStore';

const HAND_X = 0.32;
const HAND_Z = -0.22;
const Y = 0.95;

/** Penny's bouncy-bomb launcher — pink, chubby, candy-vending look. */
export function PennyBomber() {
  const groupRef = useRef<Group>(null);
  const phase = useGameStore((s) => s.phase);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    // FPS: hide own weapon; show Penny's bomber only when she's an NPC.
    if (phase !== 'combat' || activeId === 'penny' || useGameStore.getState().gameMode !== 'aliens') {
      g.visible = false;
      return;
    }
    g.visible = true;
    const pos = positions['penny'];
    const yaw = yaws['penny'];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const wx = pos.x + HAND_X * cy + HAND_Z * sy;
    const wz = pos.z - HAND_X * sy + HAND_Z * cy;
    g.position.set(wx, Y, wz);
    g.rotation.set(0, yaw, 0);
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* grip */}
      <mesh position={[0, -0.07, 0.05]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.07, 0.18, 0.08]} />
        <meshStandardMaterial color="#7a3a4a" roughness={0.7} />
      </mesh>
      {/* main body — chubby pink barrel */}
      <mesh position={[0, 0.04, -0.12]} castShadow>
        <sphereGeometry args={[0.13, 14, 12]} />
        <meshStandardMaterial color="#e26aa1" roughness={0.4} />
      </mesh>
      {/* candy ring stripes */}
      <mesh position={[0, 0.04, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.135, 0.012, 6, 18]} />
        <meshStandardMaterial color="#fff7e6" emissive="#fff" emissiveIntensity={0.2} />
      </mesh>
      {/* short funnel tip */}
      <mesh position={[0, 0.04, -0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.12, 0.18, 16, 1, true]} />
        <meshStandardMaterial color="#c84080" metalness={0.2} roughness={0.4} />
      </mesh>
      {/* bomb in chamber (pink ball peeking) */}
      <mesh position={[0, 0.04, -0.32]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#ff80b8" emissive="#ff80b8" emissiveIntensity={0.4} />
      </mesh>
      {/* heart sticker on side */}
      <mesh position={[0.13, 0.06, -0.12]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.04, 12]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
    </group>
  );
}
