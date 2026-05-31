import { mat } from '../../world/materials';
import { LivingRoom } from './LivingRoom';
import { Kitchen } from './Kitchen';
import { Stairs, Upstairs } from './StairsAndLoft';
import { ProjectorScreen } from './ProjectorScreen';
import { ROOMS, INTERIOR_WALLS, WALL_HEIGHT, WALL_THICK, WALL_Y, roomCenter } from './floorPlan';

interface InteriorProps {
  depth: number;
  doorCenterX: number;
  garageCenterX: number;
}

/**
 * Interior of the hero house. House-local coordinates (facing INTO the house, +Z):
 *   +X = your LEFT  (front door, oak, great room + game room above)
 *   -X = your RIGHT (garage, open stairs, family room + bedrooms above)
 *   -Z = front (street side)   +Z = back (yard side)
 *
 * Downstairs flow:
 *   walk in → two-story GREAT ROOM (front, loft balcony overhead) with the open
 *   staircase on the RIGHT → KITCHEN straight back → dog-legs RIGHT into the green
 *   FAMILY ROOM with the corner brick fireplace. GARAGE is front-right.
 *
 * The interior walls are colliders built in HeroHouse10600.tsx (buildInteriorColliders);
 * the second floor + stairs live in StairsAndLoft.tsx.
 */
export function Interior10600({ depth, doorCenterX, garageCenterX }: InteriorProps) {
  void depth;

  return (
    <group>
      {/* Interior lighting — the rooms only got the dim outdoor hemisphere, so they
          read as caves. Warm point lights make them bright & even, like the photos. */}
      {[
        [4, 2.0, -4],     // great room (front-left/center)
        [4, 2.0, 5.5],    // kitchen (back)
        [-8, 2.0, 5.5],   // family den (back-right, green + fireplace)
        [-8, 2.0, 0],     // family den (front)
        [-8, 2.0, -5],    // garage
      ].map((p, i) => (
        <pointLight key={`il-${i}`} position={p as [number, number, number]} intensity={5} distance={11} decay={2} color="#fff2dc" />
      ))}
      {/* A soft fill so corners aren't black */}
      <pointLight position={[4, 1.9, 1]} intensity={4} distance={18} decay={2} color="#fff0d8" />

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

      {/* SECOND-FLOOR ceiling at 5.5m sealing the ENTIRE interior footprint, so the
          two-story open great room is enclosed (no roof void / sky) while still being
          open above the loft. The great room (ceiling:false) is open up to this; the
          single-story rooms keep their own 2.95m ceilings below it. */}
      <mesh position={[0, 5.5, 0]} receiveShadow>
        <boxGeometry args={[24.4, 0.16, 18.4]} />
        <meshStandardMaterial color="#f6efe0" emissive="#f3ead4" emissiveIntensity={0.3} />
      </mesh>
      {/* High light to fill the two-story volume */}
      <pointLight position={[4, 4.6, -4]} intensity={6} distance={14} decay={2} color="#fff2dc" />

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

      {/* Open flow: great room (front) → kitchen (straight back) → family room. */}
      {(() => {
        const greatC = roomCenter('great');
        const kitchenR = ROOMS.find((r) => r.id === 'kitchen')!;
        const familyR = ROOMS.find((r) => r.id === 'family')!;
        const kitchenOriginZ = kitchenR.maxZ - 1.7;   // cabinets against the back wall
        const kitchenOriginX = (kitchenR.minX + kitchenR.maxX) / 2;
        return (
          <>
            <LivingRoom origin={[greatC[0], 0.13, greatC[1]]} doorCenterX={doorCenterX} />
            <ProjectorScreen />
            <Kitchen origin={[kitchenOriginX, 0.13, kitchenOriginZ]} />
            <FamilyRoom minX={familyR.minX} maxX={familyR.maxX} minZ={familyR.minZ} maxZ={familyR.maxZ} />
          </>
        );
      })()}

      {/* Great room: dining table + chandelier centered in the two-story void by the
          front windows — the centerpiece you see walking in (matches the entry photo). */}
      <DiningSet position={[4, 0.13, -6]} />
      {/* Cream drywall lining the interior (in FRONT of the wall faces so it covers
          the exterior siding/brick that would otherwise show inside). */}
      {/* +X exterior wall (door/walkway side) — full two-story height, flush to the
          wall's inner face so no siding peeks at grazing angles */}
      <mesh position={[11.87, 2.75, 0]}><boxGeometry args={[0.06, 5.5, 18]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      {/* -X exterior wall (garage/family side) — full height, flush to the inner face */}
      <mesh position={[-11.87, 2.75, 0]}><boxGeometry args={[0.06, 5.5, 18]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      {/* great-room front (z=-9): cream framing AROUND the tall 2-story formal window
          (window glass sits at x≈0.9). Top band + side returns + sill so no exterior
          brick shows inside, matching the real cream-walled entry. */}
      <mesh position={[4, 4.45, -8.85]}><boxGeometry args={[16, 2.1, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      <mesh position={[-2.35, 1.7, -8.85]}><boxGeometry args={[3.3, 3.4, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      {/* right of window — SPLIT around the front door (x≈9.45..10.55, h=2.2) so you
          don't walk into a wall when you enter */}
      <mesh position={[5.975, 1.7, -8.85]}><boxGeometry args={[6.95, 3.4, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      <mesh position={[11.275, 1.7, -8.85]}><boxGeometry args={[1.45, 3.4, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      <mesh position={[10, 2.8, -8.85]}><boxGeometry args={[1.1, 1.2, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      <mesh position={[0.9, 0.3, -8.85]}><boxGeometry args={[3.2, 0.6, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      {/* Tall formal window (interior glass) filling the cream frame, so the exterior
          brick can't show through — the real cream-walled entry window. */}
      <group position={[0.9, 1.95, -8.8]}>
        <mesh><boxGeometry args={[3.3, 2.9, 0.05]} /><meshStandardMaterial color="#bfe0ef" emissive="#dff0f8" emissiveIntensity={0.45} metalness={0.1} roughness={0.1} /></mesh>
        {[-1.05, 0, 1.05].map((dx, i) => (
          <mesh key={`mv${i}`} position={[dx, 0, 0.02]}><boxGeometry args={[0.07, 2.94, 0.06]} /><meshStandardMaterial color="#fff" /></mesh>
        ))}
        {[-0.95, 0, 0.95].map((dy, i) => (
          <mesh key={`mh${i}`} position={[0, dy, 0.02]}><boxGeometry args={[3.34, 0.07, 0.06]} /><meshStandardMaterial color="#fff" /></mesh>
        ))}
      </group>
      {/* Sheer white curtains framing the tall window (drawn open), like the real entry */}
      <mesh position={[0.9, 3.55, -8.66]} castShadow><boxGeometry args={[3.9, 0.08, 0.08]} /><meshStandardMaterial color="#b8a888" metalness={0.3} roughness={0.5} /></mesh>
      {[-0.9, 2.7].map((cx, i) => (
        <mesh key={`curt-${i}`} position={[cx, 1.95, -8.66]} castShadow>
          <boxGeometry args={[0.6, 3.1, 0.05]} />
          <meshStandardMaterial color="#f6f3ec" roughness={1} transparent opacity={0.6} />
        </mesh>
      ))}
      {/* master front (z=-9, over the garage) — line the whole upstairs face cream */}
      <mesh position={[-8, 4.25, -8.85]}><boxGeometry args={[8, 2.5, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      {/* back wall (z=9, yard side) — lined IN FRONT of the wall's inner face so the
          upstairs bedrooms don't show exterior siding. SPLIT around the patio slider
          (x≈-0.6..1.6, y=0..2.4) so the glass door reads see-through to the backyard. */}
      <mesh position={[-6.3, 2.75, 8.82]}><boxGeometry args={[11.4, 5.5, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      <mesh position={[6.8, 2.75, 8.82]}><boxGeometry args={[10.4, 5.5, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      <mesh position={[0.5, 3.95, 8.82]}><boxGeometry args={[2.2, 3.1, 0.06]} /><meshStandardMaterial color="#efe8d8" roughness={0.95} /></mesh>
      {/* Sliding glass patio door (interior pane) — see-through to the deck/pool */}
      <group position={[0.5, 1.1, 8.72]}>
        <mesh><boxGeometry args={[2.0, 2.2, 0.04]} /><meshStandardMaterial color="#bfe0ef" emissive="#dff0f8" emissiveIntensity={0.3} transparent opacity={0.32} metalness={0.1} roughness={0.1} /></mesh>
        <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.08, 2.2, 0.05]} /><meshStandardMaterial color="#f0ece0" /></mesh>
        <mesh position={[0, 1.12, 0.03]}><boxGeometry args={[2.08, 0.08, 0.05]} /><meshStandardMaterial color="#f0ece0" /></mesh>
        {[-1.02, 1.02].map((dx, i) => (
          <mesh key={`pf${i}`} position={[dx, 0, 0.03]}><boxGeometry args={[0.08, 2.24, 0.05]} /><meshStandardMaterial color="#f0ece0" /></mesh>
        ))}
      </group>

      {/* Open staircase (right side, behind the garage) + the full second floor. */}
      <Stairs />
      <Upstairs />

      {/* Garage interior — workbench against the garage's back wall (z = -1.5). */}
      <group position={[garageCenterX, 0, -2.3]}>
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

/** Dining table + dark chairs under a hanging chandelier — the centerpiece of the
    open two-story great room (matches the entry photo). */
function DiningSet({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* table top */}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.06, 1.0]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.4} />
      </mesh>
      {[[-0.8, -0.42], [0.8, -0.42], [-0.8, 0.42], [0.8, 0.42]].map(([x, z], i) => (
        <mesh key={`leg${i}`} position={[x, 0.37, z]} castShadow>
          <boxGeometry args={[0.07, 0.74, 0.07]} /><meshStandardMaterial color="#241810" />
        </mesh>
      ))}
      {/* six dark chairs, three per long side */}
      {[-0.58, 0, 0.58].flatMap((z) => [-1.0, 1.0].map((sx) => [sx, z] as [number, number])).map(([sx, z], i) => (
        <group key={`ch${i}`} position={[sx, 0, z]}>
          <mesh position={[0, 0.44, 0]} castShadow><boxGeometry args={[0.42, 0.05, 0.42]} /><meshStandardMaterial color="#222226" /></mesh>
          <mesh position={[sx > 0 ? 0.18 : -0.18, 0.72, 0]} castShadow><boxGeometry args={[0.05, 0.58, 0.42]} /><meshStandardMaterial color="#222226" /></mesh>
          {[-0.16, 0.16].flatMap((bx) => [-0.16, 0.16].map((bz) => [bx, bz] as [number, number])).map(([bx, bz], j) => (
            <mesh key={j} position={[bx, 0.21, bz]} castShadow><boxGeometry args={[0.04, 0.42, 0.04]} /><meshStandardMaterial color="#18181a" /></mesh>
          ))}
        </group>
      ))}
      {/* Hanging chandelier (dark modern box pendant) high in the two-story space */}
      <mesh position={[0, 2.7, 0]}><cylinderGeometry args={[0.012, 0.012, 1.4, 4]} /><meshStandardMaterial color="#2a2a2c" /></mesh>
      <mesh position={[0, 1.95, 0]} castShadow><boxGeometry args={[0.52, 0.3, 0.52]} /><meshStandardMaterial color="#34343a" metalness={0.3} roughness={0.5} /></mesh>
      <mesh position={[0, 1.93, 0]}><boxGeometry args={[0.4, 0.22, 0.4]} /><meshStandardMaterial color="#fff0c0" emissive="#ffe6a0" emissiveIntensity={0.9} /></mesh>
      <pointLight position={[0, 1.9, 0]} intensity={4} distance={7} decay={2} color="#fff0d0" />
    </group>
  );
}

/** The family room behind the kitchen (through the kitchen, on the right): olive
    walls, a corner brick fireplace, a ceiling fan, a sofa — the real 10600 den. */
function FamilyRoom({ minX, maxX, minZ, maxZ }: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return (
    <group>
      {/* olive accent walls (in front of the cream drywall): back + right (-X) wall */}
      <mesh position={[cx, 1.45, maxZ - 0.32]}><boxGeometry args={[maxX - minX, 2.8, 0.04]} /><meshStandardMaterial color="#8a8a4a" roughness={0.95} /></mesh>
      <mesh position={[minX + 0.32, 1.45, cz]}><boxGeometry args={[0.04, 2.8, maxZ - minZ]} /><meshStandardMaterial color="#8a8a4a" roughness={0.95} /></mesh>
      {/* Corner brick fireplace in the back-right corner (world -X), angled into the room */}
      <Fireplace position={[minX + 1.0, 0.13, maxZ - 1.0]} rotation={Math.PI / 4} />
      {/* ceiling fan */}
      <CeilingFan position={[cx, 2.82, cz]} />
      {/* sofa facing the fireplace */}
      <mesh position={[cx + 1.6, 0.5, cz + 0.5]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.7, 2.0]} /><meshStandardMaterial color="#7a6a55" roughness={0.95} />
      </mesh>
      <mesh position={[cx + 2.0, 0.85, cz + 0.5]} castShadow><boxGeometry args={[0.2, 0.7, 2.0]} /><meshStandardMaterial color="#7a6a55" roughness={0.95} /></mesh>
    </group>
  );
}

/** Tan-brick corner fireplace with hearth, firebox glow, and a wood mantel. */
function Fireplace({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const brick = mat.brick('#b89270');
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.45, 0]} castShadow receiveShadow><boxGeometry args={[0.5, 2.74, 1.9]} /><primitive object={brick} attach="material" /></mesh>
      <mesh position={[0.42, 0.16, 0]} castShadow receiveShadow><boxGeometry args={[0.85, 0.32, 1.7]} /><primitive object={mat.brick('#a8835f')} attach="material" /></mesh>
      <mesh position={[0.34, 0.82, 0]}><boxGeometry args={[0.18, 0.78, 1.0]} /><meshStandardMaterial color="#3a2418" roughness={1} /></mesh>
      <mesh position={[0.42, 0.55, 0]}><boxGeometry args={[0.14, 0.14, 0.78]} /><meshStandardMaterial color="#ff8a3a" emissive="#ff5a14" emissiveIntensity={1.1} /></mesh>
      <mesh position={[0.5, 1.5, 0]} castShadow><boxGeometry args={[0.72, 0.16, 1.9]} /><meshStandardMaterial color="#6e4a2a" roughness={0.7} /></mesh>
      <pointLight position={[0.6, 0.8, 0]} intensity={1.5} distance={4} decay={2} color="#ff7a30" />
    </group>
  );
}

/** A simple ceiling fan with a light. */
function CeilingFan({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.1, 0.12, 0.1, 12]} /><meshStandardMaterial color="#4a3526" metalness={0.3} /></mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, -0.02, 0]} rotation={[0, (i * Math.PI * 2) / 5, 0.03]}>
          <boxGeometry args={[0.62, 0.015, 0.12]} /><meshStandardMaterial color="#6e4a2a" roughness={0.7} />
        </mesh>
      ))}
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
