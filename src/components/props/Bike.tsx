import { usePlayStore } from '../../state/playStore';

interface BikeProps {
  position: [number, number, number];
  rotation?: number;
  /** Frame color */
  color?: string;
  /** Scale: kid-sized = 0.7, adult = 1 */
  scale?: number;
  /** Registered bike id; when set and someone is riding it, this prop hides. */
  id?: string;
}

export function Bike({ position, rotation = 0, color = '#c8392a', scale = 1, id }: BikeProps) {
  const ridden = usePlayStore((s) =>
    id != null && Object.values(s.riding).some((r) => r?.bikeId === id),
  );
  if (ridden) return null;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {/* wheels */}
      {[
        [0.55, 0.3, 0],
        [-0.55, 0.3, 0],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <torusGeometry args={[0.3, 0.04, 8, 18]} />
            <meshStandardMaterial color="#1a1a1c" />
          </mesh>
          {/* spokes */}
          {Array.from({ length: 6 }, (_, j) => (
            <mesh key={j} rotation={[0, (j * Math.PI) / 3, 0]}>
              <boxGeometry args={[0.5, 0.01, 0.005]} />
              <meshStandardMaterial color="#bbb" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {/* frame */}
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
        <boxGeometry args={[1.0, 0.07, 0.07]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-0.2, 0.5, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <boxGeometry args={[0.7, 0.07, 0.07]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* seat */}
      <mesh position={[-0.42, 0.7, 0]} castShadow>
        <boxGeometry args={[0.22, 0.06, 0.1]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* handlebar */}
      <mesh position={[0.45, 0.78, 0]} castShadow>
        <boxGeometry args={[0.06, 0.4, 0.06]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.45, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
    </group>
  );
}
