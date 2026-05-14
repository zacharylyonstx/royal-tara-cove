import { useGameStore } from '../../state/gameStore';

/**
 * The active character's ray gun. Drawn at hand height in front of the
 * player along their facing direction. Visible only during the combat phase.
 */
export function RayGun() {
  const phase = useGameStore((s) => s.phase);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);

  if (phase !== 'combat') return null;

  const pos = positions[activeId];
  const yaw = yaws[activeId];
  // Hand is offset to the player's right (positive local X) and forward (-Z local).
  const handLocalX = 0.35;
  const handLocalZ = -0.3;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const wx = pos.x + handLocalX * cy + handLocalZ * sy;
  const wz = pos.z - handLocalX * sy + handLocalZ * cy;
  return (
    <group position={[wx, 1.05, wz]} rotation={[0, yaw + Math.PI, 0]}>
      {/* grip */}
      <mesh position={[0, -0.06, 0]} castShadow>
        <boxGeometry args={[0.08, 0.18, 0.1]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* barrel */}
      <mesh position={[0, 0.04, -0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.36, 12]} />
        <meshStandardMaterial color="#8a8a92" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* glowing tip */}
      <mesh position={[0, 0.04, -0.4]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={1.2} />
      </mesh>
      <pointLight position={[0, 0.04, -0.4]} color="#3afff0" intensity={0.6} distance={2.5} decay={2} />
      {/* power coil ring near barrel rear */}
      <mesh position={[0, 0.04, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.012, 8, 16]} />
        <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
