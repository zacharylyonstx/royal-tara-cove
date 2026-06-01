import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Group } from 'three';
import type { CharacterId } from '../../types';
import { useWardrobeStore } from '../../state/wardrobeStore';

// A bedroom dresser with a standing mirror + a little folded laundry on top.
// On mount it registers its WORLD position + owner so PlayerController can offer
// "open wardrobe" when the player walks up. The mirror is low-roughness so it
// catches the environment reflections from the atmosphere pass.

const tmp = new THREE.Vector3();

export function Dresser({ owner, position, yaw = 0, accent }: {
  owner: CharacterId;
  position: [number, number, number];
  yaw?: number;
  accent: string;
}) {
  const ref = useRef<Group>(null);
  const register = useWardrobeStore((s) => s.registerDresser);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    g.getWorldPosition(tmp);
    register({ owner, x: tmp.x, y: tmp.y, z: tmp.z });
  }, [owner, register]);

  return (
    <group ref={ref} position={position} rotation={[0, yaw, 0]}>
      {/* body */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.0, 0.5]} />
        <meshStandardMaterial color="#8a5a36" roughness={0.68} />
      </mesh>
      {/* drawers + knobs */}
      {[0.22, 0.5, 0.78].map((y, i) => (
        <group key={i} position={[0, y, 0.26]}>
          <mesh castShadow>
            <boxGeometry args={[0.96, 0.24, 0.04]} />
            <meshStandardMaterial color="#9a6a44" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color={accent} roughness={0.3} metalness={0.5} />
          </mesh>
        </group>
      ))}
      {/* top trim */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[1.2, 0.06, 0.56]} />
        <meshStandardMaterial color="#6e4626" roughness={0.7} />
      </mesh>
      {/* folded laundry on top */}
      <mesh position={[-0.3, 1.12, 0]} castShadow>
        <boxGeometry args={[0.34, 0.14, 0.34]} />
        <meshStandardMaterial color={accent} roughness={0.85} />
      </mesh>
      <mesh position={[0.18, 1.1, 0.04]} castShadow>
        <boxGeometry args={[0.3, 0.1, 0.3]} />
        <meshStandardMaterial color="#f6f2e8" roughness={0.85} />
      </mesh>
      {/* standing mirror */}
      <mesh position={[0, 1.75, -0.22]} castShadow>
        <boxGeometry args={[0.72, 1.4, 0.05]} />
        <meshStandardMaterial color="#caa24a" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.75, -0.185]}>
        <planeGeometry args={[0.58, 1.22]} />
        <meshStandardMaterial color="#cfe6f5" roughness={0.06} metalness={0.2} />
      </mesh>
      {/* gentle glow hint so the kids notice it */}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
    </group>
  );
}
