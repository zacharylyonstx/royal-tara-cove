import { mat } from '../../world/materials';

interface TruckProps {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}

/** Stylized full-size pickup (think Ford F-150). */
export function Truck({ position, rotation = 0, color = '#1a3a5e' }: TruckProps) {
  const paint = mat.carPaint(color);
  const window = mat.carWindow();
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Chassis */}
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.42, 5.4]} />
        <primitive object={paint} attach="material" />
      </mesh>
      {/* Cab */}
      <mesh position={[0, 1.0, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.95, 2.4]} />
        <primitive object={paint} attach="material" />
      </mesh>
      {/* Bed walls */}
      <mesh position={[0, 0.78, 1.6]} castShadow>
        <boxGeometry args={[2.0, 0.55, 2.2]} />
        <primitive object={paint} attach="material" />
      </mesh>
      {/* Bed cavity (darker rectangle on top) */}
      <mesh position={[0, 1.04, 1.6]}>
        <boxGeometry args={[1.78, 0.04, 1.98]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.95} />
      </mesh>
      {/* Hood */}
      <mesh position={[0, 0.85, -1.7]} castShadow>
        <boxGeometry args={[2.0, 0.35, 1.5]} />
        <primitive object={paint} attach="material" />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 1.32, -1.05]} rotation={[-Math.PI / 7, 0, 0]}>
        <boxGeometry args={[1.85, 0.85, 0.05]} />
        <primitive object={window} attach="material" />
      </mesh>
      {/* Side windows */}
      <mesh position={[1.005, 1.25, -0.2]}>
        <boxGeometry args={[0.04, 0.6, 2.1]} />
        <primitive object={window} attach="material" />
      </mesh>
      <mesh position={[-1.005, 1.25, -0.2]}>
        <boxGeometry args={[0.04, 0.6, 2.1]} />
        <primitive object={window} attach="material" />
      </mesh>
      {/* Rear window */}
      <mesh position={[0, 1.32, 0.95]}>
        <boxGeometry args={[1.85, 0.65, 0.05]} />
        <primitive object={window} attach="material" />
      </mesh>
      {/* Wheels */}
      {[
        [0.95, 0.36, -1.65],
        [-0.95, 0.36, -1.65],
        [0.95, 0.36, 1.55],
        [-0.95, 0.36, 1.55],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.4, 0.4, 0.32, 16]} />
            <meshStandardMaterial color="#1a1a1c" roughness={0.95} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.34, 10]} />
            <meshStandardMaterial color="#9c9890" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Headlights */}
      <mesh position={[0.6, 0.7, -2.7]}>
        <boxGeometry args={[0.4, 0.18, 0.04]} />
        <meshStandardMaterial color="#fff8d8" emissive="#fff8d8" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.6, 0.7, -2.7]}>
        <boxGeometry args={[0.4, 0.18, 0.04]} />
        <meshStandardMaterial color="#fff8d8" emissive="#fff8d8" emissiveIntensity={0.4} />
      </mesh>
      {/* Grille */}
      <mesh position={[0, 0.72, -2.72]}>
        <boxGeometry args={[1.3, 0.5, 0.04]} />
        <meshStandardMaterial color="#1a1a1c" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}
