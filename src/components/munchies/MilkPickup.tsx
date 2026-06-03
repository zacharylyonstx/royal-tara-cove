import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

export function MilkPickupsLive() {
  const milks = useMunchiesStore((s) => s.milks);
  return (
    <>
      {Object.values(milks).map((m) => (
        <MilkPickup key={m.id} x={m.x} z={m.z} />
      ))}
    </>
  );
}

function MilkPickup({ x, z }: { x: number; z: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = 0.4 + Math.sin(t * 1.6 + x * 0.5) * 0.08;
    ref.current.rotation.y = t * 0.9;
  });
  return (
    <group ref={ref} position={[x, 0.4, z]}>
      <GLBModel url={MODELS.milk.url} fitHeight={MODELS.milk.fitHeight} position={[0, -0.3, 0]} />
      {/* glow halo */}
      <pointLight color="#c8d8ff" intensity={1.2} distance={2.5} decay={2} />
    </group>
  );
}
