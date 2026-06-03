import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useTornadoStore } from '../../state/tornadoStore';
import { isNearPlayer } from '../../systems/distance';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface CrepeMyrtleProps {
  position: [number, number, number];
  scale?: number;
  /** Retained for API compatibility; the GLB ships its own pink blooms. */
  bloomColor?: string;
  seed?: number;
}

/**
 * Crepe myrtle (real GLB model) wrapped in `trunkGroup` so the existing breeze /
 * storm-wind sway still bends it. Per-seed spin keeps instances from matching.
 */
export function CrepeMyrtle({ position, scale = 1, seed = 0 }: CrepeMyrtleProps) {
  const trunkGroup = useRef<Group>(null);

  const { spin, jitter } = useMemo(() => {
    const rng = mulberry32(seed * 31 + 7);
    return { spin: rng() * Math.PI * 2, jitter: 0.88 + rng() * 0.24 };
  }, [seed]);

  useFrame((state) => {
    if (!isNearPlayer(position[0], position[2], 60)) return;
    const trunk = trunkGroup.current;
    if (!trunk) return;
    const ts = useTornadoStore.getState();
    const windStrength = ts.windStrength;
    if (windStrength > 0.05 && ts.tornadoOpacity > 0.05) {
      const awayX = position[0] - ts.tornadoX;
      const awayZ = position[2] - ts.tornadoZ;
      const dist = Math.hypot(awayX, awayZ);
      if (dist > 0.1) {
        const t = state.clock.elapsedTime;
        const falloff = 1 / Math.max(1, dist / 15);
        const gust = 0.85 + Math.sin(t * 3.0 + position[0] * 0.13) * 0.3;
        // Crepe myrtle bends MORE than the live oak (smaller, lighter tree).
        const amp = windStrength * falloff * 0.65 * gust;
        trunk.rotation.x = (awayZ / dist) * amp * -1;
        trunk.rotation.z = (awayX / dist) * amp;
      }
    } else {
      // Gentle everyday breeze — a slow sway so the tree isn't dead-still.
      const t = state.clock.elapsedTime;
      const swayZ = Math.sin(t * 1.1 + position[0] * 0.2) * 0.03;
      const swayX = Math.sin(t * 0.8 + position[2] * 0.2) * 0.018;
      trunk.rotation.z += (swayZ - trunk.rotation.z) * 0.08;
      trunk.rotation.x += (swayX - trunk.rotation.x) * 0.08;
    }
  });

  return (
    <group position={position} scale={scale * jitter}>
      <group ref={trunkGroup}>
        <GLBModel url={MODELS.crepemyrtle.url} fitHeight={MODELS.crepemyrtle.fitHeight} rotationY={spin} />
      </group>
    </group>
  );
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
