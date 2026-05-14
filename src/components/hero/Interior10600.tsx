import { mat } from '../../world/materials';
import { LivingRoom } from './LivingRoom';
import { Kitchen } from './Kitchen';
import { Bedroom } from './Bedroom';
import { Bathroom } from './Bathroom';

interface InteriorProps {
  width: number;
  depth: number;
  doorCenterX: number;
  garageCenterX: number;
}

/**
 * Interior of the hero house. House-local coordinates:
 *   +X = right (toward garage / east in house frame)
 *   -Z = front (street side)
 *   +Z = back (yard side)
 *
 * Floor plan:
 *   front-left half  → great room (couch, TV, coffee table)
 *   center           → kitchen with island
 *   back-left wide   → master bedroom (dad)
 *   back-right small → Penny's bedroom
 *   back-far-right   → Luke's bedroom
 *   middle-right     → bathroom
 *
 * The interior walls are colliders built in HeroHouse10600.tsx (buildInteriorColliders).
 */
export function Interior10600({ width, depth, doorCenterX, garageCenterX }: InteriorProps) {
  const halfW = width / 2;
  const halfD = depth / 2;

  return (
    <group>
      {/* Wood floor (great room + hallway + master) */}
      <mesh position={[-2, 0.12, 0]} receiveShadow>
        <boxGeometry args={[width - 4, 0.02, depth - 0.4]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>

      {/* Tile floor (kitchen + bath area) */}
      <mesh position={[halfW - 3, 0.13, 0]} receiveShadow>
        <boxGeometry args={[4, 0.02, depth - 0.4]} />
        <primitive object={mat.tileFloor()} attach="material" />
      </mesh>

      {/* Ceiling (just enough to read indoor — partial, semi-transparent so light gets in) */}
      <mesh position={[0, 2.95, 0]}>
        <boxGeometry args={[width - 0.4, 0.02, depth - 0.4]} />
        <meshStandardMaterial color="#f5ecd9" transparent opacity={0.92} />
      </mesh>

      {/* Wall meshes (visual only — colliders are separate) */}
      <InteriorWall position={[-1.5, 1.4, -1.0]} args={[0.15, 2.8, 4.0]} />
      <InteriorWall position={[-3.0, 1.4, 1.5]} args={[5.0, 2.8, 0.15]} />
      <InteriorWall position={[-2.5, 1.4, 4.0]} args={[6.0, 2.8, 0.15]} />
      <InteriorWall position={[-5.5, 1.4, 5.5]} args={[0.15, 2.8, 3.0]} />
      <InteriorWall position={[0.5, 1.4, 5.5]} args={[0.15, 2.8, 3.0]} />
      <InteriorWall position={[2.0, 1.4, 0]} args={[0.15, 2.8, 2 * halfD - 0.4]} />
      <InteriorWall position={[3.0, 1.4, 4.0]} args={[0.15, 2.8, 3.0]} />
      <InteriorWall position={[4.0, 1.4, 5.5]} args={[2.0, 2.8, 0.15]} />

      {/* Doorways framed (visual headers) */}
      <DoorwayHeader position={[-1.5, 2.5, 1.0]} args={[0.16, 0.5, 1.0]} />
      <DoorwayHeader position={[-2.0, 2.5, 4.0]} args={[1.0, 0.5, 0.16]} />
      <DoorwayHeader position={[-4.0, 2.5, 4.0]} args={[1.0, 0.5, 0.16]} />
      <DoorwayHeader position={[1.0, 2.5, 4.0]} args={[1.0, 0.5, 0.16]} />

      {/* Rooms */}
      <LivingRoom origin={[-3.5, 0.13, -2.0]} doorCenterX={doorCenterX} />
      <Kitchen origin={[halfW - 3, 0.13, -1]} />
      <Bedroom
        origin={[-3.5, 0.13, 5.5]}
        size={[3.5, 2.5]}
        kid="dad"
      />
      <Bedroom
        origin={[-3.0, 0.13, 5.5]}
        size={[2.5, 2.5]}
        kid="penny"
      />
      <Bedroom
        origin={[1.0, 0.13, 5.5]}
        size={[2.5, 2.5]}
        kid="luke"
      />
      <Bathroom origin={[halfW - 1.5, 0.13, 5.5]} />

      {/* Garage interior — concrete floor + a workbench against the back */}
      <mesh position={[garageCenterX, 0.12, 0]} receiveShadow>
        <boxGeometry args={[6.4, 0.02, depth - 0.4]} />
        <primitive object={mat.concrete()} attach="material" />
      </mesh>
      {/* Workbench */}
      <group position={[garageCenterX, 0, halfD - 0.8]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[3.5, 0.06, 0.8]} />
          <meshStandardMaterial color="#5a3a22" />
        </mesh>
        {[
          [-1.6, 0.43, -0.3],
          [1.6, 0.43, -0.3],
          [-1.6, 0.43, 0.3],
          [1.6, 0.43, 0.3],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <boxGeometry args={[0.08, 0.85, 0.08]} />
            <meshStandardMaterial color="#3a2a1c" />
          </mesh>
        ))}
        {/* Tools on pegboard */}
        <mesh position={[0, 1.7, 0.01]}>
          <boxGeometry args={[3.4, 1.2, 0.04]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
      </group>

      {/* Indoor warm point light to make interior glow */}
      <pointLight position={[-1, 2.6, 0]} intensity={0.7} color="#ffd896" distance={12} decay={2} />
      <pointLight position={[halfW - 2, 2.6, 0]} intensity={0.5} color="#ffe7a8" distance={8} decay={2} />
      <pointLight position={[-2, 2.6, 5.5]} intensity={0.4} color="#fff0c8" distance={7} decay={2} />
    </group>
  );
}

function InteriorWall({
  position,
  args,
}: {
  position: [number, number, number];
  args: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#f5ecd9" roughness={0.85} />
    </mesh>
  );
}

function DoorwayHeader({
  position,
  args,
}: {
  position: [number, number, number];
  args: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#f5ecd9" roughness={0.85} />
    </mesh>
  );
}
