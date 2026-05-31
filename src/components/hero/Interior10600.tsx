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
            <meshStandardMaterial color="#f5ecd9" emissive="#f3ead4" emissiveIntensity={0.35} />
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

      {/* Family room (great room): olive walls, corner fireplace, ceiling fan —
          matching the real 10600. */}
      <Fireplace />
      {/* Olive accent walls (thin panels just inside the great-room perimeter) */}
      {[
        { p: [-8.88, 1.45, -4.0] as [number, number, number], a: [0.04, 2.9, 8.0] as [number, number, number] }, // left wall
        { p: [-5.25, 1.45, -7.88] as [number, number, number], a: [7.5, 2.9, 0.04] as [number, number, number] }, // front wall
        { p: [-5.25, 1.45, -0.12] as [number, number, number], a: [7.5, 2.9, 0.04] as [number, number, number] }, // back wall
      ].map((w, i) => (
        <mesh key={`olive-${i}`} position={w.p}>
          <boxGeometry args={w.a} />
          <meshStandardMaterial color="#8a8a4a" roughness={0.95} />
        </mesh>
      ))}
      {/* Ceiling fan over the family room */}
      <CeilingFan position={[-5.0, 2.85, -3.5]} />

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

/** Tan-brick CORNER fireplace in the great room's back-left corner, angled 45°
    into the room (matching the real 10600 family room). */
function Fireplace() {
  const brick = mat.brick('#b89270');
  return (
    <group position={[-8.0, 0.13, -1.0]} rotation={[0, Math.PI / 4, 0]}>
      {/* Brick chimney breast, floor to ceiling */}
      <mesh position={[0.0, 1.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 2.74, 1.9]} />
        <primitive object={brick} attach="material" />
      </mesh>
      {/* Raised hearth slab */}
      <mesh position={[0.42, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.85, 0.32, 1.7]} />
        <primitive object={mat.brick('#a8835f')} attach="material" />
      </mesh>
      {/* Firebox: a shallow warm recess (not a bottomless black void) */}
      <mesh position={[0.34, 0.82, 0]}>
        <boxGeometry args={[0.18, 0.78, 1.0]} />
        <meshStandardMaterial color="#3a2418" roughness={1} />
      </mesh>
      {/* Logs + ember glow */}
      <mesh position={[0.4, 0.52, 0]} castShadow>
        <boxGeometry args={[0.16, 0.1, 0.7]} />
        <meshStandardMaterial color="#4a3322" roughness={1} />
      </mesh>
      <mesh position={[0.42, 0.55, 0]}>
        <boxGeometry args={[0.14, 0.14, 0.78]} />
        <meshStandardMaterial color="#ff8a3a" emissive="#ff5a14" emissiveIntensity={1.1} />
      </mesh>
      {/* Wood mantle */}
      <mesh position={[0.5, 1.5, 0]} castShadow>
        <boxGeometry args={[0.72, 0.16, 1.9]} />
        <meshStandardMaterial color="#6e4a2a" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** A simple ceiling fan with a light, like the family room's. */
function CeilingFan({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* downrod */}
      <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.02, 0.02, 0.16, 6]} /><meshStandardMaterial color="#3a2a1c" /></mesh>
      {/* motor housing */}
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.1, 0.12, 0.1, 12]} /><meshStandardMaterial color="#4a3526" metalness={0.3} /></mesh>
      {/* blades */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, -0.02, 0]} rotation={[0, (i * Math.PI * 2) / 5, 0.03]}>
          <boxGeometry args={[0.62, 0.015, 0.12]} />
          <meshStandardMaterial color="#6e4a2a" roughness={0.7} />
        </mesh>
      ))}
      {/* light globe */}
      <mesh position={[0, -0.1, 0]}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color="#fff4d6" emissive="#ffe9b0" emissiveIntensity={0.7} /></mesh>
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
