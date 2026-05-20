import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';

// Dim the overall scene and add three small light sources that hint at a
// real sleeping house: bathroom nightlight, moonlight through bay window,
// and TV flicker in the great room.

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

  return (
    <>
      {/* Bathroom nightlight — bath-center ≈ (-1.75, 5.0) */}
      <pointLight position={[-1.75, 0.5, 5.0]} color="#ffcf66" intensity={0.45} distance={3.5} decay={2} />

      {/* Moonlight — fakes a slanted beam from outside the bay window. */}
      <pointLight ref={moonRef} position={[-4.5, 3, -9.5]} color="#9bb4f0" intensity={0.7} distance={14} decay={1.4} castShadow />

      {/* TV in the great room — flickering blue/white light near south wall. */}
      <pointLight ref={tvRef} position={[-5.0, 1.0, -7.5]} color="#8ab4ff" intensity={1.0} distance={6} decay={2} />

      {/* Soft ambient cool fill. */}
      <ambientLight color="#5a6a8a" intensity={0.18} />
    </>
  );
}
