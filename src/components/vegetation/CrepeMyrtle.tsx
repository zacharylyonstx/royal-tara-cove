import { useMemo } from 'react';

interface CrepeMyrtleProps {
  position: [number, number, number];
  scale?: number;
  bloomColor?: string;
  seed?: number;
}

export function CrepeMyrtle({ position, scale = 1, bloomColor = '#d985b3', seed = 0 }: CrepeMyrtleProps) {
  const blooms = useMemo(() => {
    const rng = mulberry32(seed * 31 + 7);
    return Array.from({ length: 12 }, () => ({
      pos: [(rng() - 0.5) * 1.4, 1.8 + rng() * 0.9, (rng() - 0.5) * 1.4] as [number, number, number],
      r: 0.32 + rng() * 0.18,
      color: bloomColor,
    }));
  }, [bloomColor, seed]);

  return (
    <group position={position} scale={scale}>
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
