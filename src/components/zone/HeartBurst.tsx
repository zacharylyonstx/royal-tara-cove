import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Reusable "being petted" hearts: a little ring of emissive hearts that orbit,
// rise and fade while `activeUntil` (clock seconds) is in the future. Used by
// the ducks (Sparky has his own older inline copy). Materials are memoized so
// repeated pets never allocate.

const HEART_COUNT = 6;
const HEART_LIFE = 1.4;

export function HeartBurst({ until, y = 0.5, radius = 0.35 }: { until: { current: number }; y?: number; radius?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => Array.from({ length: HEART_COUNT }, () => new THREE.MeshStandardMaterial({
      color: '#ff5a8a',
      emissive: '#ff5a8a',
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0,
    })),
    [],
  );

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const on = t < until.current;
    for (let i = 0; i < g.children.length; i++) {
      const h = g.children[i];
      const mat = mats[i];
      if (on) {
        const age = ((t * 0.9 + i / HEART_COUNT) % 1) * HEART_LIFE;
        const a = (i / HEART_COUNT) * Math.PI * 2 + t * 0.6;
        h.visible = true;
        h.position.set(Math.cos(a) * radius, y + age * 0.8, Math.sin(a) * radius);
        h.rotation.y = t * 2 + i;
        const fade = 1 - age / HEART_LIFE;
        mat.opacity = Math.max(0, Math.min(1, fade * 1.4));
        h.scale.setScalar(0.6 + age * 0.4);
      } else if (h.visible) {
        h.visible = false;
        mat.opacity = 0;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {mats.map((mat, i) => (
        <group key={i} visible={false}>
          <mesh material={mat} position={[-0.035, 0.02, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
          </mesh>
          <mesh material={mat} position={[0.035, 0.02, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
          </mesh>
          <mesh material={mat} position={[0, -0.04, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.08, 0.08, 0.05]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
