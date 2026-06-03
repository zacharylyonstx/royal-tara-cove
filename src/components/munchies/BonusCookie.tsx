import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

export function BonusCookieLive() {
  const bonus = useMunchiesStore((s) => s.bonus);
  if (!bonus || bonus.eaten) return null;
  return <BonusCookie x={bonus.x} z={bonus.z} spawnedAt={bonus.spawnedAt} />;
}

function BonusCookie({ x, z, spawnedAt }: { x: number; z: number; spawnedAt: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const age = performance.now() / 1000 - spawnedAt;
    ref.current.position.y = 0.35 + Math.sin(t * 4) * 0.08;
    ref.current.rotation.y = t * 1.4;
    const wobble = 1 + Math.sin(t * 12) * 0.04;
    ref.current.scale.set(wobble, wobble, wobble);
    void age;
  });
  return (
    <group ref={ref} position={[x, 0.35, z]}>
      <GLBModel url={MODELS.bonuscookie.url} fitHeight={MODELS.bonuscookie.fitHeight} position={[0, -0.1, 0]} />
      <pointLight color="#ffd080" intensity={2.5} distance={4} decay={2} />
    </group>
  );
}
