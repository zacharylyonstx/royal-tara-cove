import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { BLOB_COLORS, useCombatStore } from '../../state/combatStore';

export function HitParticles() {
  const particles = useCombatStore((s) => s.hitParticles);
  return (
    <>
      {particles.map((p) => <ParticleBurst key={p.id} particle={p} />)}
    </>
  );
}

function ParticleBurst({ particle }: { particle: ReturnType<typeof useCombatStore.getState>['hitParticles'][number] }) {
  const ref = useRef<Group>(null);
  const color = BLOB_COLORS[particle.variant].body;
  useFrame(() => {
    const age = performance.now() / 1000 - particle.spawnedAt;
    if (ref.current) {
      ref.current.scale.setScalar(1 + age * 3);
      const children = ref.current.children;
      for (const c of children) {
        const mesh = c as { material?: { opacity?: number } };
        if (mesh.material) mesh.material.opacity = Math.max(0, 1 - age / 0.5);
      }
    }
  });
  return (
    <group ref={ref} position={[particle.x, particle.y, particle.z]}>
      {[
        [0.2, 0.05, 0],
        [-0.2, 0.05, 0.1],
        [0.05, 0.2, -0.1],
        [-0.05, 0.15, 0.15],
        [0.0, -0.05, 0.2],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}
