import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Points } from 'three';
import { isNearPlayer } from '../../systems/distance';

interface SprinklerProps {
  position: [number, number, number];
}

/**
 * A pop-up sprinkler with a procedurally animated water fan. The water is
 * a Points cloud where each particle has its own t-offset and respawns when
 * it hits the ground.
 */
export function Sprinkler({ position }: SprinklerProps) {
  const N = 80;
  const pointsRef = useRef<Points>(null);

  // Per-particle initial state
  const init = useMemo(() => {
    const arr: { t0: number; ang: number; speed: number; radius: number }[] = [];
    for (let i = 0; i < N; i++) {
      arr.push({
        t0: Math.random() * 2,
        ang: (i / N) * Math.PI * 2,
        speed: 4 + Math.random() * 1.6,
        radius: 0.05 + Math.random() * 0.05,
      });
    }
    return arr;
  }, []);

  const positionsArr = useMemo(() => new Float32Array(N * 3), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positionsArr, 3));
    return g;
  }, [positionsArr]);

  useFrame((state) => {
    if (!isNearPlayer(position[0], position[2], 40)) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const p = init[i];
      const localT = (t + p.t0) % 1.4;
      const v = p.speed;
      const angle = p.ang + t * 0.4; // sweep
      const vx = Math.cos(angle) * v * 0.7;
      const vz = Math.sin(angle) * v * 0.7;
      const vy = v * 0.7;
      const x = vx * localT;
      const y = vy * localT - 0.5 * 9.81 * localT * localT;
      const z = vz * localT;
      positionsArr[i * 3] = x;
      positionsArr[i * 3 + 1] = Math.max(y, 0);
      positionsArr[i * 3 + 2] = z;
    }
    geom.attributes.position.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* sprinkler head */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 8]} />
        <meshStandardMaterial color="#3a3a3c" />
      </mesh>
      <points ref={pointsRef} geometry={geom}>
        <pointsMaterial color="#aedfff" size={0.06} sizeAttenuation transparent opacity={0.85} />
      </points>
    </group>
  );
}
