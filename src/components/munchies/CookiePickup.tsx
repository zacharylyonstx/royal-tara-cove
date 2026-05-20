import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';

export function CookiePickupsLive() {
  const pellets = useMunchiesStore((s) => s.pellets);
  return (
    <>
      {Object.values(pellets).map((p) => (
        <CookiePickup key={p.id} x={p.x} z={p.z} />
      ))}
    </>
  );
}

function CookiePickup({ x, z }: { x: number; z: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Gentle bob
    ref.current.position.y = 0.25 + Math.sin(t * 2 + x * 0.7 + z * 0.3) * 0.04;
    ref.current.rotation.y = t * 0.6;
  });
  return (
    <group ref={ref} position={[x, 0.25, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 16]} />
        <meshStandardMaterial color="#a86a3a" emissive="#5a2e10" emissiveIntensity={0.6} roughness={0.7} />
      </mesh>
      {/* chocolate chips */}
      <mesh position={[0.05, 0.026, 0.03]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[-0.04, 0.026, 0.05]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[0.02, 0.026, -0.05]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
    </group>
  );
}
