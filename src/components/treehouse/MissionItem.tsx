import { useTreehouseStore } from '../../state/treehouseStore';
import { useGameStore } from '../../state/gameStore';
import { Dog } from '../munchies/Dog';

export function MissionItem() {
  const item = useTreehouseStore((s) => s.missionItem);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  if (!item) return null;

  let x = item.x;
  let z = item.z;
  let yaw = 0;
  if (item.carriedBy) {
    const p = positions[item.carriedBy];
    if (p) { x = p.x; z = p.z; yaw = yaws[item.carriedBy]; }
  }

  if (item.id === 'gnome') {
    return <GnomeMesh x={x} y={item.carriedBy ? 1.4 : 0.3} z={z} />;
  }
  if (item.id === 'sparky') {
    return <Dog positionRef={{ x, z, yaw }} bluish={false} />;
  }
  return null;
}

function GnomeMesh({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.18, 0.42, 10]} />
        <meshStandardMaterial color="#c83030" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#f0c8a3" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.07, 0.07]} castShadow>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial color="#fafaf0" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.16, 0]} castShadow>
        <coneGeometry args={[0.2, 0.4, 10]} />
        <meshStandardMaterial color="#3a5a8a" roughness={0.85} />
      </mesh>
      <mesh position={[-0.06, -0.38, 0.06]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.14]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[0.06, -0.38, 0.06]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.14]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
    </group>
  );
}
