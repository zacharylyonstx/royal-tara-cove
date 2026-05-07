import { useMemo } from 'react';

interface FenceProps {
  start: [number, number]; // XZ
  end: [number, number];
  height?: number;
  color?: string;
}

// A privacy fence section between two XZ points. Visually a single planked panel —
// we treat it as one box for performance. Detailed slats can come in a v2.
export function Fence({ start, end, height = 1.7, color = '#a08560' }: FenceProps) {
  const { length, midX, midZ, angle } = useMemo(() => {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    return {
      length: Math.hypot(dx, dz),
      midX: (start[0] + end[0]) / 2,
      midZ: (start[1] + end[1]) / 2,
      angle: Math.atan2(dz, dx),
    };
  }, [start, end]);

  if (length < 0.01) return null;

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, height, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, height + 0.04, 0]} castShadow>
        <boxGeometry args={[length + 0.05, 0.08, 0.16]} />
        <meshStandardMaterial color="#7a5e3f" />
      </mesh>
    </group>
  );
}
