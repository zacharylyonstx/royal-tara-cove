import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';

export function BonusCookieLive() {
  const bonus = useMunchiesStore((s) => s.bonus);
  if (!bonus || bonus.eaten) return null;
  return <BonusCookie x={bonus.x} z={bonus.z} spawnedAt={bonus.spawnedAt} />;
}

function BonusCookie({ x, z, spawnedAt }: { x: number; z: number; spawnedAt: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const age = performance.now() / 1000 - spawnedAt;
    ref.current.position.y = 0.35 + Math.sin(t * 4) * 0.08;
    ref.current.rotation.y = t * 1.4;
    const wobble = 1 + Math.sin(t * 12) * 0.04;
    ref.current.scale.set(wobble, wobble, wobble);
    void age;
  });
  return (
    <group ref={ref} position={[x, 0.35, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.08, 24]} />
        <meshStandardMaterial color="#b87842" emissive="#a04018" emissiveIntensity={0.9} roughness={0.65} />
      </mesh>
      {/* many chips */}
      {[[0.1, 0.08], [-0.12, 0.05], [0.05, -0.15], [-0.18, -0.04], [0.18, 0.18], [0, 0]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0.045, cz]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#2a1a0a" />
        </mesh>
      ))}
      <pointLight color="#ffd080" intensity={2.5} distance={4} decay={2} />
    </group>
  );
}
