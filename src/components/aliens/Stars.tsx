import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Points } from 'three';
import { useCombatStore } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';

/**
 * A dome of starfield Points that fades in as timeOfDay → 1 (night).
 */
export function Stars() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'aliens') return null;
  const N = 320;
  const positions = useMemo(() => {
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Random direction on upper hemisphere, radius ~250
      const u = Math.random();
      const v = Math.random() * 0.5 + 0.05; // top half only
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - 2 * v);
      const r = 250;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  const ref = useRef<Points>(null);
  const timeOfDay = useCombatStore((s) => s.timeOfDay);

  useFrame(() => {
    const r = ref.current;
    if (!r) return;
    const mat = r.material as THREE.PointsMaterial;
    if (mat) mat.opacity = Math.max(0, (timeOfDay - 0.45) / 0.4);
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial color="#ffffff" size={1.2} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  );
}
