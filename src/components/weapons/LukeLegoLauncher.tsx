import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useGameStore } from '../../state/gameStore';

const HAND_X = 0.32;
const HAND_Z = -0.22;
const Y = 0.95;

/** Luke's Lego launcher — chunky primary-color blocks. */
export function LukeLegoLauncher() {
  const groupRef = useRef<Group>(null);
  const phase = useGameStore((s) => s.phase);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    // FPS: hide own weapon; show Luke's launcher only when he's an NPC.
    if (phase !== 'combat' || activeId === 'luke') {
      g.visible = false;
      return;
    }
    g.visible = true;
    const pos = positions['luke'];
    const yaw = yaws['luke'];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const wx = pos.x + HAND_X * cy + HAND_Z * sy;
    const wz = pos.z - HAND_X * sy + HAND_Z * cy;
    g.position.set(wx, Y, wz);
    g.rotation.set(0, yaw, 0);
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* yellow grip block */}
      <mesh position={[0, -0.06, 0.04]} rotation={[0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.07, 0.18, 0.07]} />
        <meshStandardMaterial color="#fff15a" roughness={0.5} />
      </mesh>
      {/* red receiver block */}
      <mesh position={[0, 0.04, -0.04]} castShadow>
        <boxGeometry args={[0.13, 0.13, 0.18]} />
        <meshStandardMaterial color="#e63a3a" roughness={0.5} />
      </mesh>
      {/* lego studs on top */}
      {[-0.04, 0, 0.04].map((x, i) => (
        <mesh key={i} position={[x, 0.115, -0.04]}>
          <cylinderGeometry args={[0.018, 0.018, 0.025, 12]} />
          <meshStandardMaterial color="#e63a3a" roughness={0.5} />
        </mesh>
      ))}
      {/* three blue barrels (spread tubes) */}
      {[-0.05, 0, 0.05].map((x, i) => (
        <mesh key={`b-${i}`} position={[x, 0.04, -0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.18, 10]} />
          <meshStandardMaterial color="#3a6db0" roughness={0.4} />
        </mesh>
      ))}
      {/* magazine block (green) */}
      <mesh position={[0, 0.13, 0.02]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.1]} />
        <meshStandardMaterial color="#5cb85c" roughness={0.5} />
      </mesh>
    </group>
  );
}
