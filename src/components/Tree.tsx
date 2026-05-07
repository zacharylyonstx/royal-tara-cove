interface TreeProps {
  position: [number, number, number];
  scale?: number;
  variant?: 'oak' | 'cedar' | 'crepe';
}

const PALETTES = {
  oak: { trunk: '#5a3d22', leaves: ['#3d6e34', '#4a7a3e', '#356333'] },
  cedar: { trunk: '#4d3a25', leaves: ['#2f5a3a', '#3d6b48', '#26492f'] },
  crepe: { trunk: '#7a6044', leaves: ['#c66ea4', '#d985b3', '#a85490'] },
} as const;

export function Tree({ position, scale = 1, variant = 'oak' }: TreeProps) {
  const palette = PALETTES[variant];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 2.8, 8]} />
        <meshStandardMaterial color={palette.trunk} flatShading />
      </mesh>
      <mesh position={[0, 3.6, 0]} castShadow>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color={palette.leaves[0]} flatShading />
      </mesh>
      <mesh position={[0.7, 3.0, 0.3]} castShadow>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshStandardMaterial color={palette.leaves[1]} flatShading />
      </mesh>
      <mesh position={[-0.6, 3.2, -0.5]} castShadow>
        <icosahedronGeometry args={[1.05, 0]} />
        <meshStandardMaterial color={palette.leaves[2]} flatShading />
      </mesh>
    </group>
  );
}
