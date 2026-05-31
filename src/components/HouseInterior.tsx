import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { isNearPlayer } from '../systems/distance';
import { mat } from '../world/materials';

const SOFA_COLORS = ['#5f7184', '#8a6a58', '#6f8466', '#86708f', '#9a8a64', '#558486'];
const RUG_COLORS = ['#9c4a4a', '#46689c', '#9c8a46', '#468c6a', '#7a4a8c', '#b06a3a'];
const WALLART = ['#c2603a', '#3a6ec2', '#3aa06a', '#c2a03a'];

/**
 * A simple, cozy living room for a neighbor house — floor + a few furniture
 * pieces (sofa, rug, coffee table, TV, lamp). Rendered in house-LOCAL space
 * (placed inside the house group) and only when the player is nearby, so 24
 * of these stay cheap. Colours vary by seed.
 */
export function HouseInterior({
  width,
  depth,
  worldX,
  worldZ,
  seed,
}: {
  width: number;
  depth: number;
  worldX: number;
  worldZ: number;
  seed: number;
}) {
  const ref = useRef<Group>(null);
  const halfW = width / 2;
  const halfD = depth / 2;
  const sofa = SOFA_COLORS[seed % SOFA_COLORS.length];
  const rug = RUG_COLORS[(seed >> 2) % RUG_COLORS.length];
  const art = WALLART[(seed >> 1) % WALLART.length];

  // Render only when the player is close (perf — there are 24 of these).
  useFrame(() => {
    const g = ref.current;
    if (g) g.visible = isNearPlayer(worldX, worldZ, 24);
  });

  // Sofa sits against the back wall facing the front (-Z); TV on the front wall.
  const sofaZ = halfD - 0.85;
  const tvZ = -halfD + 0.4;

  return (
    <group ref={ref} visible={false}>
      {/* Floor (wood) inset from the walls — above the foundation slab (y≈0.1) */}
      <mesh position={[0, 0.13, 0]} receiveShadow>
        <boxGeometry args={[width - 0.5, 0.06, depth - 0.5]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>

      {/* Rug */}
      <mesh position={[0, 0.085, halfD - 2.4]}>
        <boxGeometry args={[2.8, 0.02, 2.2]} />
        <meshStandardMaterial color={rug} roughness={0.95} />
      </mesh>

      {/* Sofa: base + back + two arms */}
      <group position={[0, 0, sofaZ]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[2.4, 0.5, 0.95]} />
          <meshStandardMaterial color={sofa} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.75, 0.42]} castShadow>
          <boxGeometry args={[2.4, 0.6, 0.2]} />
          <meshStandardMaterial color={sofa} roughness={0.9} />
        </mesh>
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} position={[x, 0.55, 0]} castShadow>
            <boxGeometry args={[0.22, 0.55, 0.95]} />
            <meshStandardMaterial color={sofa} roughness={0.9} />
          </mesh>
        ))}
        {/* cushions */}
        {[-0.6, 0.6].map((x) => (
          <mesh key={`c${x}`} position={[x, 0.7, -0.05]}>
            <boxGeometry args={[1.0, 0.16, 0.8]} />
            <meshStandardMaterial color={sofa} roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* Coffee table */}
      <group position={[0, 0, halfD - 2.5]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.3, 0.08, 0.7]} />
          <meshStandardMaterial color="#6a4a30" roughness={0.6} />
        </mesh>
        {[[-0.55, -0.28], [0.55, -0.28], [-0.55, 0.28], [0.55, 0.28]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.2, z]}>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color="#4a3422" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* TV console + TV against the front wall, facing the sofa */}
      <group position={[0, 0, tvZ]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[1.8, 0.55, 0.4]} />
          <meshStandardMaterial color="#3a2c20" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.05, 0.02]} castShadow>
          <boxGeometry args={[1.5, 0.85, 0.07]} />
          <meshStandardMaterial color="#141416" roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.05, 0.06]}>
          <boxGeometry args={[1.4, 0.76, 0.01]} />
          <meshStandardMaterial color="#26323e" emissive="#1a2630" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Floor lamp in a back corner — gives the room a warm glow */}
      <group position={[-halfW + 0.7, 0, halfD - 0.7]}>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 1.7, 8]} />
          <meshStandardMaterial color="#3a3a3c" />
        </mesh>
        <mesh position={[0, 1.78, 0]}>
          <coneGeometry args={[0.26, 0.34, 12, 1, true]} />
          <meshStandardMaterial color="#fff0c0" emissive="#ffdf90" emissiveIntensity={0.7} side={2} />
        </mesh>
      </group>

      {/* A potted plant in the other corner */}
      <group position={[halfW - 0.7, 0, halfD - 0.7]}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.22, 0.16, 0.4, 10]} />
          <meshStandardMaterial color="#b06a4a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <icosahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color="#3f7a3f" roughness={0.9} />
        </mesh>
      </group>

      {/* Framed wall art on the back wall, above the sofa */}
      <mesh position={[0, 1.9, halfD - 0.18]}>
        <boxGeometry args={[1.3, 0.85, 0.05]} />
        <meshStandardMaterial color="#e8e0cc" />
      </mesh>
      <mesh position={[0, 1.9, halfD - 0.15]}>
        <boxGeometry args={[1.1, 0.65, 0.02]} />
        <meshStandardMaterial color={art} roughness={0.7} />
      </mesh>
    </group>
  );
}
