import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMapStore } from '../../ui/WorldMap';

/**
 * "Show me the way to…" — a tall pink beam of light standing on the place the
 * player picked on the map, visible from across the neighbourhood, so a
 * 6-year-old can simply walk toward the light.
 */
export function GuideBeacon() {
  const guide = useMapStore((s) => s.guide);
  const beam = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 3) * 0.1;
    if (ring.current) {
      const k = (t * 0.6) % 1;
      ring.current.scale.setScalar(1 + k * 3.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    }
  });
  if (!guide) return null;
  return (
    <group position={[guide.x, 0, guide.z]}>
      <mesh ref={beam} position={[0, 30, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 60, 14, 1, true]} />
        <meshBasicMaterial color="#ff4d8d" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[1.5, 1.9, 36]} />
        <meshBasicMaterial color="#ff4d8d" transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
