import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Points } from 'three';
import { useGameStore } from '../../state/gameStore';

interface SmokeColumnProps {
  position: [number, number, number];
  /** Particle count cap. */
  count?: number;
  /** Color of the smoke. */
  color?: string;
  /** Whether to include orange ember particles mixed in. */
  embers?: boolean;
}

/**
 * A rising plume of particles. Each particle has its own t-offset and rises
 * from y=0 while drifting outward. When it ages past lifetime, it respawns at
 * the base. Cheap: single Points draw.
 */
export function SmokeColumn({ position, count = 80, color = '#7a7a7c', embers = true }: SmokeColumnProps) {
  const ref = useRef<Points>(null);
  const lifetime = 2.8;

  // Per-particle initial state
  const init = useMemo(() => {
    return Array.from({ length: count }, () => ({
      t0: Math.random() * lifetime,
      ang: Math.random() * Math.PI * 2,
      drift: 0.4 + Math.random() * 0.5,
      rise: 1.6 + Math.random() * 1.0,
      isEmber: embers && Math.random() < 0.18,
    }));
  }, [count, embers]);

  const positionsArr = useMemo(() => new Float32Array(count * 3), [count]);
  const colorsArr = useMemo(() => new Float32Array(count * 3), [count]);
  const sizesArr = useMemo(() => new Float32Array(count), [count]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positionsArr, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizesArr, 1));
    return g;
  }, [positionsArr, colorsArr, sizesArr]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const emberColor = useMemo(() => new THREE.Color('#ff8a3a'), []);

  useFrame((state) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = init[i];
      const localT = (t + p.t0) % lifetime;
      const k = localT / lifetime; // 0..1
      const r = p.drift * k;
      const x = Math.cos(p.ang) * r;
      const z = Math.sin(p.ang) * r;
      const y = p.rise * lifetime * k;
      positionsArr[i * 3] = x;
      positionsArr[i * 3 + 1] = y;
      positionsArr[i * 3 + 2] = z;
      // Color: embers fade red→orange→yellow; smoke fades dark→light→transparent
      if (p.isEmber) {
        const fade = 1 - k * 0.7;
        colorsArr[i * 3] = emberColor.r * fade;
        colorsArr[i * 3 + 1] = emberColor.g * fade * 0.7;
        colorsArr[i * 3 + 2] = emberColor.b * fade * 0.4;
        sizesArr[i] = 0.18;
      } else {
        const grow = 0.6 + k * 0.7;
        colorsArr[i * 3] = baseColor.r * grow;
        colorsArr[i * 3 + 1] = baseColor.g * grow;
        colorsArr[i * 3 + 2] = baseColor.b * grow;
        sizesArr[i] = 0.3 + k * 0.5;
      }
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    geom.attributes.size.needsUpdate = true;
  });

  return (
    <points ref={ref} position={position} geometry={geom}>
      <pointsMaterial
        vertexColors
        size={0.4}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
}
