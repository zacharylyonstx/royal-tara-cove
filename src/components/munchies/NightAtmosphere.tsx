import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';
import { HERO_PIVOT_X, HERO_PIVOT_Z, HERO_YAW } from '../../world/heroPlace';

// Small light sources that hint at a real sleeping house: a kitchen nightlight,
// moonlight through the front window, the projector left on, fireplace embers.

export function NightAtmosphere() {
  const tvRef = useRef<PointLight>(null);
  const moonRef = useRef<PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (tvRef.current) {
      tvRef.current.intensity = 1.0 + Math.sin(t * 5) * 0.35 + Math.sin(t * 19) * 0.15;
    }
    if (moonRef.current) {
      moonRef.current.intensity = 0.7 + Math.sin(t * 0.4) * 0.07;
    }
  });

  // Authored in house-local coordinates (see components/hero/floorPlan.ts).
  return (
    <group position={[HERO_PIVOT_X, 0, HERO_PIVOT_Z]} rotation={[0, HERO_YAW, 0]}>
      {/* Kitchen nightlight over the counter. */}
      <pointLight position={[3.2, 1.3, 7.6]} color="#ffcf66" intensity={1.4} distance={6} decay={2} />

      {/* Moonlight slanting in through the tall front window. */}
      <pointLight ref={moonRef} position={[0.9, 3, -8.2]} color="#9bb4f0" intensity={0.7} distance={14} decay={1.4} />

      {/* Projector screen left on — flickering blue/white on the great-room wall. */}
      <pointLight ref={tvRef} position={[10.6, 1.4, -4]} color="#8ab4ff" intensity={1.0} distance={7} decay={2} />

      {/* Embers in the den fireplace. */}
      <pointLight position={[-10.2, 0.8, 7.2]} color="#ff7a30" intensity={1.6} distance={6} decay={2} />

      {/* Soft ambient cool fill. */}
      <ambientLight color="#5a6a8a" intensity={0.18} />
    </group>
  );
}
