import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useTornadoStore } from '../../state/tornadoStore';
import { isNearPlayer } from '../../systems/distance';

interface CrepeMyrtleProps {
  position: [number, number, number];
  scale?: number;
  bloomColor?: string;
  seed?: number;
}

export function CrepeMyrtle({ position, scale = 1, bloomColor = '#d985b3', seed = 0 }: CrepeMyrtleProps) {
  const trunkGroup = useRef<Group>(null);

  const blooms = useMemo(() => {
    const rng = mulberry32(seed * 31 + 7);
    return Array.from({ length: 12 }, () => ({
      pos: [(rng() - 0.5) * 1.4, 1.8 + rng() * 0.9, (rng() - 0.5) * 1.4] as [number, number, number],
      r: 0.32 + rng() * 0.18,
      color: bloomColor,
    }));
  }, [bloomColor, seed]);

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
    } else if (trunk.rotation.x !== 0 || trunk.rotation.z !== 0) {
      trunk.rotation.x *= 0.9;
      trunk.rotation.z *= 0.9;
    }
  });

  return (
    <group position={position} scale={scale}>
      <group ref={trunkGroup}>
        {/* multiple slim trunks */}
        {[
          { x: -0.05, z: -0.02, h: 1.7 },
          { x: 0.06, z: 0.01, h: 1.6 },
          { x: 0.0, z: 0.07, h: 1.8 },
        ].map((t, i) => (
          <mesh key={i} position={[t.x, t.h / 2, t.z]} castShadow>
            <cylinderGeometry args={[0.04, 0.06, t.h, 6]} />
            <meshStandardMaterial color="#7a6044" roughness={0.92} />
          </mesh>
        ))}
        {/* bloom clusters */}
        {blooms.map((b, i) => (
          <mesh key={`bl${i}`} position={b.pos} castShadow>
            <icosahedronGeometry args={[b.r, 0]} />
            <meshStandardMaterial color={b.color} roughness={0.85} />
          </mesh>
        ))}
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
