import { mat } from '../../world/materials';
import { LivingRoom } from './LivingRoom';
import { Kitchen } from './Kitchen';
import { Bedroom } from './Bedroom';
import { Bathroom } from './Bathroom';
import { Stairs, Loft } from './StairsAndLoft';
import { ROOMS } from './floorPlan';

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
      {/* Per-room floors driven by floorPlan.ts — no overlap by construction */}
      {ROOMS.map((r) => {
        const cx = (r.minX + r.maxX) / 2;
        const cz = (r.minZ + r.maxZ) / 2;
        const sx = r.maxX - r.minX;
        const sz = r.maxZ - r.minZ;
        const material =
          r.floor === 'wood' ? mat.woodFloor() :
          r.floor === 'tile' ? mat.tileFloor() :
          mat.concrete();
        return (
          <mesh key={`floor-${r.id}`} position={[cx, 0.12, cz]} receiveShadow>
            <boxGeometry args={[sx, 0.02, sz]} />
            <primitive object={material} attach="material" />
          </mesh>
        );
      })}

      {/* Per-room ceilings (drywall, semi-transparent so light still reads inside) */}
      {ROOMS.filter((r) => r.ceiling).map((r) => {
        const cx = (r.minX + r.maxX) / 2;
        const cz = (r.minZ + r.maxZ) / 2;
        const sx = r.maxX - r.minX;
        const sz = r.maxZ - r.minZ;
        return (
          <mesh key={`ceil-${r.id}`} position={[cx, 2.95, cz]}>
            <boxGeometry args={[sx, 0.02, sz]} />
            <meshStandardMaterial color="#f5ecd9" transparent opacity={0.92} />
          </mesh>
        );
      })}

      {/* Wall meshes — split into two segments per doorway gap (matches buildInteriorColliders) */}
      {/* lr-kitchen: gap at z 0..0.5 */}
      <InteriorWall position={[-1.5, 1.4, -1.875]} args={[0.15, 2.8, 2.25]} />
      <InteriorWall position={[-1.5, 1.4, 0.625]} args={[0.15, 2.8, 0.75]} />
      {/* kitchen-hall: gap at x -3..-2 */}
      <InteriorWall position={[-4.25, 1.4, 1.5]} args={[2.5, 2.8, 0.15]} />
      <InteriorWall position={[-1.25, 1.4, 1.5]} args={[1.5, 2.8, 0.15]} />
      {/* hall-bed-back: gap at x -2.5..-1.5 */}
      <InteriorWall position={[-4.0, 1.4, 4.0]} args={[3.0, 2.8, 0.15]} />
      <InteriorWall position={[-0.5, 1.4, 4.0]} args={[2.0, 2.8, 0.15]} />
      {/* garage-house: gap at z -0.5..0.5 */}
      <InteriorWall position={[2.0, 1.4, -halfD / 2 + 0.05]} args={[0.15, 2.8, halfD - 0.5]} />
      <InteriorWall position={[2.0, 1.4, halfD / 2 + 0.45]} args={[0.15, 2.8, halfD - 1.1]} />
      {/* bath-1: gap at z 4..5 */}
      <InteriorWall position={[3.0, 1.4, 3.25]} args={[0.15, 2.8, 1.5]} />
      <InteriorWall position={[3.0, 1.4, 5.25]} args={[0.15, 2.8, 0.5]} />
      {/* Solid bedroom dividers + bath back */}
      <InteriorWall position={[-5.5, 1.4, 5.5]} args={[0.15, 2.8, 3.0]} />
      <InteriorWall position={[0.5, 1.4, 5.5]} args={[0.15, 2.8, 3.0]} />
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

      {/* Staircase up to the loft (back-left corner of great room) */}
      <Stairs />
      <Loft />

      {/* Garage interior — workbench against the back (concrete floor is part of the per-room loop above) */}
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

      {/* Indoor lighting comes from hemisphere + ambient + emissive lamp shades */}
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
