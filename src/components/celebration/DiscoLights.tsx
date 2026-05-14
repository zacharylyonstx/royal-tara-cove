import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';
import { useGameStore } from '../../state/gameStore';

const LIGHT_COLORS = ['#ff5a3a', '#5cb85c', '#3a6db0', '#3afff0', '#fff15a', '#e26aa1'];

interface Spot { x: number; z: number; phase: number }

const SPOTS: Spot[] = [
  { x: -22, z: -12, phase: 0 },
  { x: 22, z: -12, phase: 1.0 },
  { x: -22, z: -55, phase: 2.0 },
  { x: 22, z: -55, phase: 3.0 },
  { x: 0, z: -90, phase: 4.0 },
  { x: -22, z: -90, phase: 5.0 },
  { x: 22, z: -90, phase: 0.5 },
];

export function DiscoLights() {
  const phase = useGameStore((s) => s.phase);
  const lightRefs = useRef<(PointLight | null)[]>([]);

  useFrame(({ clock }) => {
    if (phase !== 'victory') return;
    const t = clock.elapsedTime;
    SPOTS.forEach((spot, i) => {
      const light = lightRefs.current[i];
      if (!light) return;
      const colorIdx = Math.floor(t * 1.5 + spot.phase) % LIGHT_COLORS.length;
      const pulse = 0.5 + 0.5 * Math.sin(t * 4 + spot.phase);
      light.color.set(LIGHT_COLORS[colorIdx]);
      light.intensity = 6 * pulse;
    });
  });

  if (phase !== 'victory') return null;

  return (
    <>
      {SPOTS.map((spot, i) => (
        <pointLight
          key={i}
          ref={(l) => { lightRefs.current[i] = l; }}
          position={[spot.x, 8, spot.z]}
          intensity={4}
          color="#ff5a3a"
          distance={18}
          decay={2}
        />
      ))}
    </>
  );
}
