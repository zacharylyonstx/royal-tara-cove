import { mat } from '../../world/materials';

interface SedanProps {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}

export function Sedan({ position, rotation = 0, color = '#a8a8a8' }: SedanProps) {
  const paint = mat.carPaint(color);
  const window = mat.carWindow();
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Lower body */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.5, 4.6]} />
        <primitive object={paint} attach="material" />
      </mesh>
      {/* Greenhouse */}
      <mesh position={[0, 0.95, -0.05]} castShadow>
        <boxGeometry args={[1.78, 0.7, 2.5]} />
        <primitive object={paint} attach="material" />
      </mesh>
      {/* Roof tapered ends visualized as glass */}
      <mesh position={[0, 1.18, -1.3]} rotation={[-Math.PI / 6, 0, 0]}>
        <boxGeometry args={[1.7, 0.7, 0.06]} />
        <primitive object={window} attach="material" />
      </mesh>
      <mesh position={[0, 1.18, 1.2]} rotation={[Math.PI / 6, 0, 0]}>
        <boxGeometry args={[1.7, 0.6, 0.06]} />
        <primitive object={window} attach="material" />
      </mesh>
      {/* Side windows */}
      <mesh position={[0.9, 1.0, -0.05]}>
        <boxGeometry args={[0.04, 0.45, 2.2]} />
        <primitive object={window} attach="material" />
      </mesh>
      <mesh position={[-0.9, 1.0, -0.05]}>
        <boxGeometry args={[0.04, 0.45, 2.2]} />
        <primitive object={window} attach="material" />
      </mesh>
      {/* Wheels */}
      {[
        [0.84, 0.32, -1.42],
        [-0.84, 0.32, -1.42],
        [0.84, 0.32, 1.42],
        [-0.84, 0.32, 1.42],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.26, 16]} />
            <meshStandardMaterial color="#1a1a1c" roughness={0.95} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 0.28, 10]} />
            <meshStandardMaterial color="#9c9890" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Headlights */}
      <mesh position={[0.55, 0.55, -2.32]}>
        <boxGeometry args={[0.34, 0.16, 0.04]} />
        <meshStandardMaterial color="#fff8d8" emissive="#fff8d8" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.55, 0.55, -2.32]}>
        <boxGeometry args={[0.34, 0.16, 0.04]} />
        <meshStandardMaterial color="#fff8d8" emissive="#fff8d8" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
