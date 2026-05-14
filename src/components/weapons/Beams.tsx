import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useCombatStore } from '../../state/combatStore';

/** Renders all active beam visuals. Each fades out over ~0.14s. */
export function Beams() {
  const beams = useCombatStore((s) => s.beams);
  return (
    <>
      {beams.map((b) => (
        <BeamMesh key={b.id} beam={b} />
      ))}
    </>
  );
}

function BeamMesh({ beam }: { beam: ReturnType<typeof useCombatStore.getState>['beams'][number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const start = new THREE.Vector3(beam.fromX, beam.fromY, beam.fromZ);
  const end = new THREE.Vector3(beam.toX, beam.toY, beam.toZ);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const dir = end.clone().sub(start);
  const len = dir.length();
  dir.normalize();
  // Orient cylinder along Y axis then point it from start to end.
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  useFrame(() => {
    const age = performance.now() / 1000 - beam.spawnedAt;
    const fade = Math.max(0, 1 - age / 0.14);
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.opacity = fade;
        if (mat.emissive) {
          mat.emissiveIntensity = 1.4 * fade;
        }
      }
      meshRef.current.scale.set(1 + (1 - fade) * 0.5, 1, 1 + (1 - fade) * 0.5);
    }
  });

  return (
    <mesh ref={meshRef} position={mid.toArray()} quaternion={quat.toArray() as unknown as THREE.Quaternion}>
      <cylinderGeometry args={[0.05, 0.05, len, 6, 1, true]} />
      <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={1.4} transparent opacity={0.95} />
    </mesh>
  );
}
