import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PowerUpDrop } from '../../state/combatStore';
import { POWERUP_COLOR } from '../../state/combatStore';

interface Props { drop: PowerUpDrop }

export function Pickup({ drop }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const color = POWERUP_COLOR[drop.kind];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const age = t - drop.spawnedAt;
    if (groupRef.current) {
      groupRef.current.position.y = 0.85 + Math.sin(t * 3 + drop.id) * 0.18;
      groupRef.current.rotation.y = t * 1.5 + drop.id;
      // small scale-in
      const s = age < 0.3 ? Math.min(1, age / 0.3) : 1;
      groupRef.current.scale.setScalar(s * (1 + Math.sin(t * 4 + drop.id) * 0.04));
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2;
      ringRef.current.rotation.z = -t * 2;
    }
  });

  return (
    <group ref={groupRef} position={[drop.x, 0.85, drop.z]}>
      {/* Inner spinning octahedron (gem) — emissive replaces removed pointlight */}
      <mesh castShadow>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.4}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      {/* Outer ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.6, 0.04, 6, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.0}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Glow shell */}
      <mesh>
        <sphereGeometry args={[0.7, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {/* Ground caustic ring */}
      <mesh position={[0, -0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.95, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function PickupRenderer({ drops }: { drops: PowerUpDrop[] }) {
  return (
    <>
      {drops.map((d) => <Pickup key={d.id} drop={d} />)}
    </>
  );
}
