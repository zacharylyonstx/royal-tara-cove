import { mat } from '../../world/materials';
import { LivingRoom } from './LivingRoom';
import { Kitchen } from './Kitchen';
import { Bedroom } from './Bedroom';
import { Bathroom } from './Bathroom';
import { Stairs, Loft } from './StairsAndLoft';
import { ProjectorScreen } from './ProjectorScreen';
import { ROOMS, INTERIOR_WALLS, WALL_HEIGHT, WALL_THICK, WALL_Y, roomCenter } from './floorPlan';

interface InteriorProps {
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
export function Interior10600({ depth, doorCenterX, garageCenterX }: InteriorProps) {
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

      {/* Interior wall meshes driven by floorPlan.ts. Each wall splits into 1+
          segments around its door openings, with a header over each opening. */}
      {INTERIOR_WALLS.flatMap((w) => {
        // Sorted opening list; segments fill the gaps between them.
        const ops = [...w.openings].sort((a, b) => a.from - b.from);
        const segments: { from: number; to: number }[] = [];
        let cursor = w.from;
        for (const op of ops) {
          if (op.from - cursor > 0.001) segments.push({ from: cursor, to: op.from });
          cursor = op.to;
        }
        if (w.to - cursor > 0.001) segments.push({ from: cursor, to: w.to });

        // Render solid segments + header above each opening.
        const meshes: React.ReactElement[] = [];
        for (let i = 0; i < segments.length; i++) {
          const s = segments[i];
          const center = (s.from + s.to) / 2;
          const span = s.to - s.from;
          if (w.axis === 'x') {
            // Wall runs along X; thin in Z.
            meshes.push(
              <InteriorWall key={`${w.tag}-seg-${i}`} position={[center, WALL_Y, w.at]} args={[span, WALL_HEIGHT, WALL_THICK]} />
            );
          } else {
            // Wall runs along Z; thin in X.
            meshes.push(
              <InteriorWall key={`${w.tag}-seg-${i}`} position={[w.at, WALL_Y, center]} args={[WALL_THICK, WALL_HEIGHT, span]} />
            );
          }
        }
        for (let i = 0; i < ops.length; i++) {
          const op = ops[i];
          const center = (op.from + op.to) / 2;
          const span = op.to - op.from;
          if (w.axis === 'x') {
            meshes.push(
              <DoorwayHeader key={`${w.tag}-hdr-${i}`} position={[center, 2.5, w.at]} args={[span, 0.5, WALL_THICK + 0.01]} />
            );
          } else {
            meshes.push(
              <DoorwayHeader key={`${w.tag}-hdr-${i}`} position={[w.at, 2.5, center]} args={[WALL_THICK + 0.01, 0.5, span]} />
            );
          }
        }
        return meshes;
      })}

      {/* Rooms — origins derived from the manifest so they can't drift. */}
      {(() => {
        const greatC = roomCenter('great');
        const kitchenR = ROOMS.find((r) => r.id === 'kitchen')!;
        const masterC = roomCenter('master');
        const pennyC = roomCenter('penny');
        const lukeC = roomCenter('luke');
        const bathC = roomCenter('bath');
        const masterR = ROOMS.find((r) => r.id === 'master')!;
        const pennyR = ROOMS.find((r) => r.id === 'penny')!;
        const lukeR = ROOMS.find((r) => r.id === 'luke')!;
        // Kitchen origin offset south of room center so cabinets/fridge/stove/sink
        // (which the component places at origin.z + 1..1.4) land against the back wall.
        const kitchenOriginZ = kitchenR.maxZ - 1.7;
        const kitchenOriginX = (kitchenR.minX + kitchenR.maxX) / 2;
        return (
          <>
            <LivingRoom origin={[greatC[0], 0.13, greatC[1]]} doorCenterX={doorCenterX} />
            <ProjectorScreen />
            <Kitchen origin={[kitchenOriginX, 0.13, kitchenOriginZ]} />
            <Bedroom
              origin={[masterC[0], 0.13, masterC[1]]}
              size={[masterR.maxX - masterR.minX, masterR.maxZ - masterR.minZ]}
              kid="dad"
            />
            <Bedroom
              origin={[pennyC[0], 0.13, pennyC[1]]}
              size={[pennyR.maxX - pennyR.minX, pennyR.maxZ - pennyR.minZ]}
              kid="penny"
            />
            <Bedroom
              origin={[lukeC[0], 0.13, lukeC[1]]}
              size={[lukeR.maxX - lukeR.minX, lukeR.maxZ - lukeR.minZ]}
              kid="luke"
            />
            <Bathroom origin={[bathC[0], 0.13, bathC[1]]} />
          </>
        );
      })()}

      {/* Brick fireplace on the great-room left wall — the family hearth. Faces
          +X into the room; visible from the kitchen looking left. */}
      <Fireplace />

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

/** Tan-brick fireplace on the great room's left wall (x = -9), facing +X. */
function Fireplace() {
  const wallX = -8.78;
  const z = -3.2;
  const brick = mat.brick('#b89270');
  return (
    <group position={[wallX, 0.13, z]}>
      {/* Brick chimney breast floor-to-ceiling */}
      <mesh position={[0.0, 2.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 4.8, 2.4]} />
        <primitive object={brick} attach="material" />
      </mesh>
      {/* Raised hearth slab */}
      <mesh position={[0.45, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.36, 2.0]} />
        <primitive object={mat.brick('#a8835f')} attach="material" />
      </mesh>
      {/* Firebox recess (dark) */}
      <mesh position={[0.46, 0.95, 0]}>
        <boxGeometry args={[0.5, 1.0, 1.3]} />
        <meshStandardMaterial color="#1a1410" roughness={1} />
      </mesh>
      {/* Warm ember glow */}
      <mesh position={[0.5, 0.62, 0]}>
        <boxGeometry args={[0.3, 0.12, 1.0]} />
        <meshStandardMaterial color="#ff7a2a" emissive="#ff6a1a" emissiveIntensity={0.9} />
      </mesh>
      {/* Wood mantle */}
      <mesh position={[0.5, 1.62, 0]} castShadow>
        <boxGeometry args={[0.7, 0.16, 2.0]} />
        <meshStandardMaterial color="#6e4a2a" roughness={0.7} />
      </mesh>
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
