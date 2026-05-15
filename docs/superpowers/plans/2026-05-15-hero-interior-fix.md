# Hero House Interior Fix (v11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the hero house interior on a clean room manifest so walls, floors, ceilings, and colliders can't drift; fix bath-in-garage, overlapping bedrooms, floor z-fighting, and trees-inside-house.

**Architecture:** Introduce `src/components/hero/floorPlan.ts` as a single source of truth. Three consumers — `Interior10600.tsx` (rendering), `HeroHouse10600.tsx::buildInteriorColliders` (collision), and `Game.tsx::LotVegetation` (tree placement) — read from it. The manifest self-validates at module load (throws if rooms overlap or walls are off-grid) so structural bugs surface at first render, not after a 15-minute walkthrough.

**Tech Stack:** React 19, React Three Fiber, Three.js, TypeScript, Vite. No test framework exists; verification is `npm run build` (tsc) + `npm run lint` + manual playtest at `http://localhost:5175/`.

---

## File Structure

**New:**
- `src/components/hero/floorPlan.ts` — types + ROOMS + INTERIOR_WALLS + module-load validation

**Modified:**
- `src/components/hero/Interior10600.tsx` — floors, walls, ceilings, room-component placement all derived from the manifest
- `src/components/hero/HeroHouse10600.tsx` — `buildInteriorColliders` reads INTERIOR_WALLS; `BackWallWithSlider` takes `centerX`; `buildHeroFloors` trims the loft to the great room footprint
- `src/components/Game.tsx` — `LotVegetation` derives tree/shrub offsets from `config.depth`

**Unchanged (only their call-site arguments shift):**
- `Bedroom.tsx`, `Bathroom.tsx`, `Kitchen.tsx`, `LivingRoom.tsx`, `StairsAndLoft.tsx`
- All collision, prop, vegetation, and exterior code outside the bullets above

---

## Task 1: Create the room manifest

**Files:**
- Create: `src/components/hero/floorPlan.ts`

Defines the types and the room/wall data. Includes a self-validation pass that runs at module load — throws if any two non-garage rooms overlap, or if any wall references a position outside any room. This is our "test": structural bugs throw before the user sees a broken house.

- [ ] **Step 1: Create `src/components/hero/floorPlan.ts` with types + data + validation**

```typescript
// Single source of truth for the 10600 hero house interior layout.
// Renderer (Interior10600.tsx), collider builder (HeroHouse10600.tsx),
// and any future consumer all read from this file so geometry can't drift.
//
// House-local coordinate system: +X right, -Z front (street side), +Z back.
// Hero house: width=18 (halfW=9), depth=16 (halfD=8). Garage on +X side.

export type FloorMaterial = 'wood' | 'tile' | 'concrete';

export type RoomId =
  | 'great' | 'kitchen' | 'hall'
  | 'master' | 'penny' | 'luke' | 'bath'
  | 'garage';

export interface Room {
  id: RoomId;
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  floor: FloorMaterial;
  /** Drywall ceiling at y=2.95. False for garage (open rafters). */
  ceiling: boolean;
}

export interface InteriorWall {
  /** 'x' = wall runs along the X axis (constant Z); 'z' = wall runs along the Z axis (constant X). */
  axis: 'x' | 'z';
  /** Position on the constant axis. */
  at: number;
  /** Span on the variable axis. */
  from: number; to: number;
  /** Door openings (1m wide) on the variable axis. Wall mesh is split around these. */
  openings: { from: number; to: number }[];
  tag: string;
}

/** Interior wall height (matches the existing `<InteriorWall>` mesh). */
export const WALL_HEIGHT = 2.8;
/** Interior wall thickness. */
export const WALL_THICK = 0.15;
/** Interior wall y-center (mesh position). */
export const WALL_Y = 1.4;

export const ROOMS: Room[] = [
  // Front half (z = -8..0)
  { id: 'great',   minX: -9.0, maxX: -1.5, minZ: -8.0, maxZ:  0.0, floor: 'wood', ceiling: true },
  { id: 'kitchen', minX: -1.5, maxX:  2.0, minZ: -8.0, maxZ:  0.0, floor: 'tile', ceiling: true },
  // Hallway (z = 0..1.5)
  { id: 'hall',    minX: -9.0, maxX:  2.0, minZ:  0.0, maxZ:  1.5, floor: 'wood', ceiling: true },
  // Back row (z = 1.5..8)
  { id: 'master',  minX: -9.0, maxX: -5.5, minZ:  1.5, maxZ:  8.0, floor: 'wood', ceiling: true },
  { id: 'penny',   minX: -5.5, maxX: -2.5, minZ:  1.5, maxZ:  8.0, floor: 'wood', ceiling: true },
  { id: 'bath',    minX: -2.5, maxX: -1.0, minZ:  1.5, maxZ:  8.0, floor: 'tile', ceiling: true },
  { id: 'luke',    minX: -1.0, maxX:  2.0, minZ:  1.5, maxZ:  8.0, floor: 'wood', ceiling: true },
  // Garage (no ceiling = open rafters)
  { id: 'garage',  minX:  2.0, maxX:  8.4, minZ: -8.0, maxZ:  8.0, floor: 'concrete', ceiling: false },
];

export const INTERIOR_WALLS: InteriorWall[] = [
  // Front half: great-room ↔ kitchen divider
  { axis: 'z', at: -1.5, from: -8.0, to: 0.0, openings: [{ from: -3.0, to: -2.0 }], tag: 'great-kitchen' },
  // Front half ↔ hall (split by the great-kitchen divider, so two segments)
  { axis: 'x', at:  0.0, from: -9.0, to: -1.5, openings: [{ from: -5.0, to: -4.0 }], tag: 'great-hall' },
  { axis: 'x', at:  0.0, from: -1.5, to:  2.0, openings: [{ from:  0.5, to:  1.5 }], tag: 'kitchen-hall' },
  // Garage wall, split into three vertical segments
  { axis: 'z', at:  2.0, from: -8.0, to:  0.0, openings: [{ from: -1.0, to:  0.0 }], tag: 'kitchen-garage' },
  { axis: 'z', at:  2.0, from:  0.0, to:  1.5, openings: [], tag: 'hall-garage' },
  { axis: 'z', at:  2.0, from:  1.5, to:  8.0, openings: [], tag: 'luke-garage' },
  // Hall ↔ back row (one wall per bedroom segment so openings stay local)
  { axis: 'x', at:  1.5, from: -9.0, to: -5.5, openings: [{ from: -7.5, to: -6.5 }], tag: 'hall-back-master' },
  { axis: 'x', at:  1.5, from: -5.5, to: -2.5, openings: [{ from: -4.5, to: -3.5 }], tag: 'hall-back-penny' },
  { axis: 'x', at:  1.5, from: -2.5, to: -1.0, openings: [{ from: -2.0, to: -1.0 }], tag: 'hall-back-bath' },
  { axis: 'x', at:  1.5, from: -1.0, to:  2.0, openings: [{ from: -0.5, to:  0.5 }], tag: 'hall-back-luke' },
  // Back-row dividers (solid)
  { axis: 'z', at: -5.5, from: 1.5, to: 8.0, openings: [], tag: 'master-penny' },
  { axis: 'z', at: -2.5, from: 1.5, to: 8.0, openings: [], tag: 'penny-bath' },
  { axis: 'z', at: -1.0, from: 1.5, to: 8.0, openings: [], tag: 'bath-luke' },
];

/**
 * Module-load self-check: throws if rooms overlap, walls cross room interiors,
 * or door openings escape the wall span. We want structural mistakes to surface
 * the first time the renderer mounts, not 15 minutes into a playtest.
 */
function validate(): void {
  // 1. No two non-garage rooms overlap.
  const livable = ROOMS.filter((r) => r.id !== 'garage');
  for (let i = 0; i < livable.length; i++) {
    for (let j = i + 1; j < livable.length; j++) {
      const a = livable[i], b = livable[j];
      const overlaps =
        a.minX < b.maxX && b.minX < a.maxX &&
        a.minZ < b.maxZ && b.minZ < a.maxZ;
      if (overlaps) {
        throw new Error(`floorPlan: rooms "${a.id}" and "${b.id}" overlap`);
      }
    }
  }

  // 2. Every wall opening lies within the wall span.
  for (const w of INTERIOR_WALLS) {
    for (const op of w.openings) {
      if (op.from < w.from - 0.001 || op.to > w.to + 0.001 || op.from >= op.to) {
        throw new Error(`floorPlan: wall "${w.tag}" opening (${op.from}, ${op.to}) escapes span (${w.from}, ${w.to})`);
      }
    }
  }

  // 3. The interior bounds cover x=-9..+2 and z=-8..+8 (the hero house livable + garage).
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of ROOMS) {
    if (r.minX < minX) minX = r.minX;
    if (r.maxX > maxX) maxX = r.maxX;
    if (r.minZ < minZ) minZ = r.minZ;
    if (r.maxZ > maxZ) maxZ = r.maxZ;
  }
  if (minX !== -9.0 || maxX !== 8.4 || minZ !== -8.0 || maxZ !== 8.0) {
    throw new Error(`floorPlan: room bounds (${minX}..${maxX}, ${minZ}..${maxZ}) don't match hero house (-9..8.4, -8..8)`);
  }
}
validate();

export function roomCenter(id: RoomId): [number, number] {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`floorPlan: no room "${id}"`);
  return [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
}
```

- [ ] **Step 2: Verify the file compiles and validation passes**

Run: `npm run build`
Expected: build succeeds (compiles `floorPlan.ts`; validation runs at module load — if it throws, the build still passes but the dev server will crash on mount; that surfaces in Step 3).

- [ ] **Step 3: Verify the dev server picks up the new file without throwing**

Run: `npm run dev` (in a separate terminal if not already running)
Then open `http://localhost:5175/` (or whichever port Vite picks). If the validation throws, the React error overlay will show "floorPlan: …".
Expected: page mounts; nothing in `floorPlan.ts` consumes the manifest yet, so the game looks identical to before.

- [ ] **Step 4: Commit**

```bash
git add src/components/hero/floorPlan.ts
git commit -m "Royal Tara Cove: v11 — add hero house floor plan manifest"
```

---

## Task 2: Render floors and ceilings from the manifest

**Files:**
- Modify: `src/components/hero/Interior10600.tsx`

Replace the two hand-coded floor meshes and the single ceiling mesh with one mesh per room. The garage's concrete floor stays where it is (rendered later in `Interior10600.tsx`) because it's tied to other garage geometry; we just remove the inside-house overlap.

- [ ] **Step 1: Replace the two floor meshes and the ceiling mesh**

Open `src/components/hero/Interior10600.tsx`.

Add the import at the top:

```typescript
import { ROOMS, roomCenter } from './floorPlan';
```

Find this block (currently around lines 37-53):

```typescript
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
```

Replace it with:

```typescript
      {/* Per-room floors driven by floorPlan.ts — no overlap by construction */}
      {ROOMS.filter((r) => r.id !== 'garage').map((r) => {
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
```

Note: `roomCenter` is imported but not yet used; that's fine — it lands in Task 4.

- [ ] **Step 2: Find and remove the now-duplicate garage concrete floor**

Still in `Interior10600.tsx`, find this block (currently around line 107):

```typescript
      {/* Garage interior — concrete floor + a workbench against the back */}
      <mesh position={[garageCenterX, 0.12, 0]} receiveShadow>
        <boxGeometry args={[6.4, 0.02, depth - 0.4]} />
        <primitive object={mat.concrete()} attach="material" />
      </mesh>
```

Delete the `<mesh>` (the garage's concrete floor) but **keep** the comment header and the workbench `<group>` immediately after. The garage floor is now rendered by the manifest loop (since `garage` has `floor: 'concrete'`).

After your edit, the section should read:

```typescript
      {/* Garage interior — workbench against the back (concrete floor is part of the per-room loop above) */}
      {/* Workbench */}
      <group position={[garageCenterX, 0, halfD - 0.8]}>
        ...existing workbench code unchanged...
      </group>
```

Wait — re-add the garage to the floor loop (delete the `r.id !== 'garage'` filter so it gets the concrete):

Change the floor loop's filter from `ROOMS.filter((r) => r.id !== 'garage')` to `ROOMS` so all rooms (including garage) get a floor.

The ceiling loop already skips garage (it has `ceiling: false`).

- [ ] **Step 3: Verify build + visual**

Run: `npm run build`
Expected: success.

Then refresh `http://localhost:5175/` and walk into the hero house. Look at the floor:
- Wood in great room, hall, master, penny, luke.
- Tile in kitchen and bath.
- Concrete in garage.
- No z-fighting / flickering anywhere.

- [ ] **Step 4: Commit**

```bash
git add src/components/hero/Interior10600.tsx
git commit -m "Royal Tara Cove: v11 — render interior floors + ceilings from manifest"
```

---

## Task 3: Render interior walls from the manifest

**Files:**
- Modify: `src/components/hero/Interior10600.tsx`

Replace the 14 hand-coded `<InteriorWall>` calls + 4 `<DoorwayHeader>` calls with iteration over `INTERIOR_WALLS`. Each wall splits into 1+ mesh segments around its openings, with a doorway header above each opening.

- [ ] **Step 1: Add the imports**

At the top of `src/components/hero/Interior10600.tsx`, extend the existing `floorPlan` import:

```typescript
import { ROOMS, INTERIOR_WALLS, WALL_HEIGHT, WALL_THICK, WALL_Y, roomCenter } from './floorPlan';
```

- [ ] **Step 2: Replace the hand-coded walls and headers**

Find this block (currently around lines 55-80):

```typescript
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
```

Replace it with:

```typescript
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
```

- [ ] **Step 3: Verify build + visual**

Run: `npm run build`
Expected: success.

Refresh the browser. Walk into the hero house. The walls should now:
- Separate great-room from kitchen with one doorway gap (passable around z = -3 to -2 visually).
- Separate front half from hallway with two gaps (great-hall, kitchen-hall).
- Four doors off the hallway leading to master, penny, bath, luke.
- Garage wall has one mudroom door.

If the bedrooms still look weird that's expected — they aren't placed on the new grid yet. That's Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/components/hero/Interior10600.tsx
git commit -m "Royal Tara Cove: v11 — render interior walls from manifest"
```

---

## Task 4: Place rooms (Bedroom / Bathroom / Kitchen / LivingRoom) from the manifest

**Files:**
- Modify: `src/components/hero/Interior10600.tsx`

Replace the hand-typed origins for room components with `roomCenter()` calls. `Bedroom` and `Bathroom` treat `origin` as the room **center** (per their existing code), so `roomCenter()` gives us exactly what they expect. `Kitchen` and `LivingRoom` are passed their existing offsets; check both components to see what they expect.

- [ ] **Step 1: Look up what `Kitchen.tsx` and `LivingRoom.tsx` expect for `origin`**

Run: `grep -n "origin" src/components/hero/Kitchen.tsx src/components/hero/LivingRoom.tsx`
Read the first few lines of each to see how `origin` is interpreted (center vs corner). Note the convention in your head — you'll preserve it.

- [ ] **Step 2: Replace the room placements**

Find this block in `Interior10600.tsx` (currently around lines 82-100):

```typescript
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
```

Replace it with:

```typescript
      {/* Rooms — origins derived from the manifest so they can't drift. */}
      {(() => {
        const greatC = roomCenter('great');
        const kitchenC = roomCenter('kitchen');
        const masterC = roomCenter('master');
        const pennyC = roomCenter('penny');
        const lukeC = roomCenter('luke');
        const bathC = roomCenter('bath');
        const masterR = ROOMS.find((r) => r.id === 'master')!;
        const pennyR = ROOMS.find((r) => r.id === 'penny')!;
        const lukeR = ROOMS.find((r) => r.id === 'luke')!;
        return (
          <>
            <LivingRoom origin={[greatC[0], 0.13, greatC[1]]} doorCenterX={doorCenterX} />
            <Kitchen origin={[kitchenC[0], 0.13, kitchenC[1]]} />
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
```

- [ ] **Step 3: If `Kitchen.tsx` or `LivingRoom.tsx` expect `origin` as a CORNER (not center), adjust their call sites**

If your Step 1 reading showed they expect a top-left corner instead of a center, replace `roomCenter('great')` with `[room.minX, room.minZ]` for those two only.

Specifically, if `LivingRoom` interprets origin as `room.minX, room.minZ`:

```typescript
const greatR = ROOMS.find((r) => r.id === 'great')!;
<LivingRoom origin={[greatR.minX, 0.13, greatR.minZ]} doorCenterX={doorCenterX} />
```

Same for `Kitchen` if needed.

- [ ] **Step 4: Verify build + visual + walk through**

Run: `npm run build`
Expected: success.

Refresh browser. Enter the hero house through the front door. Walk:
1. Into great room (bay window seat, couch, TV visible).
2. Into kitchen via the great-kitchen doorway (z ≈ -2.5).
3. Out into the hallway via the great-hall or kitchen-hall door.
4. Through each back door: into master, then back to hall, into penny, into bath, into luke.
5. From luke, walk to the back wall — the patio slider should be visible (still at x=0, will be moved in Task 6).

All four bedrooms should now feel like distinct rooms with their own beds + furniture. The bath should be inside the house, NOT in the garage.

- [ ] **Step 5: Commit**

```bash
git add src/components/hero/Interior10600.tsx
git commit -m "Royal Tara Cove: v11 — place rooms from manifest, fix bath-in-garage and overlapping bedrooms"
```

---

## Task 5: Build interior colliders from the manifest

**Files:**
- Modify: `src/components/hero/HeroHouse10600.tsx`

`buildInteriorColliders` currently hand-codes the same 14 walls as the renderer. Replace its body with iteration over `INTERIOR_WALLS`, same logic as Task 3, but emitting `RectCollider`s in world space.

- [ ] **Step 1: Add the import**

At the top of `src/components/hero/HeroHouse10600.tsx`:

```typescript
import { INTERIOR_WALLS, WALL_THICK } from './floorPlan';
```

- [ ] **Step 2: Replace `buildInteriorColliders`**

Find the entire function `buildInteriorColliders` (currently around lines 784-851). Replace with:

```typescript
export function buildInteriorColliders(config: HouseConfig, lot: Lot): RectCollider[] {
  void config; // accepted for symmetry with sibling builders, not currently used
  const cy = Math.cos(lot.houseYaw);
  const sy = Math.sin(lot.houseYaw);

  const out: RectCollider[] = [];
  for (const w of INTERIOR_WALLS) {
    // Split the wall into solid segments around its openings.
    const ops = [...w.openings].sort((a, b) => a.from - b.from);
    const segments: { from: number; to: number }[] = [];
    let cursor = w.from;
    for (const op of ops) {
      if (op.from - cursor > 0.001) segments.push({ from: cursor, to: op.from });
      cursor = op.to;
    }
    if (w.to - cursor > 0.001) segments.push({ from: cursor, to: w.to });

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const center = (s.from + s.to) / 2;
      const span = s.to - s.from;
      // House-local axis-aligned box; corners rotated to world via houseYaw.
      const halfA = span / 2;
      const halfB = WALL_THICK / 2;
      let cx: number, cz: number, halfX: number, halfZ: number;
      if (w.axis === 'x') {
        cx = center; cz = w.at; halfX = halfA; halfZ = halfB;
      } else {
        cx = w.at; cz = center; halfX = halfB; halfZ = halfA;
      }
      const corners: [number, number][] = [
        [cx - halfX, cz - halfZ], [cx + halfX, cz - halfZ],
        [cx + halfX, cz + halfZ], [cx - halfX, cz + halfZ],
      ];
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [lx, lz] of corners) {
        const wx = lot.housePivot[0] + lx * cy + lz * sy;
        const wz = lot.housePivot[1] - lx * sy + lz * cy;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wz < minZ) minZ = wz;
        if (wz > maxZ) maxZ = wz;
      }
      out.push({ minX, maxX, minZ, maxZ, minY: 0, maxY: 3, tag: `interior-${w.tag}-${i}` });
    }
  }
  return out;
}
```

- [ ] **Step 3: Verify build + walk-through**

Run: `npm run build`
Expected: success.

Refresh browser. Inside the hero house:
- Try walking through a wall (e.g., from kitchen into Penny's room without going through the hallway). You should be blocked.
- Walk through every doorway listed in the manifest. You should pass through cleanly without invisible-wall snags.
- Try walking through the master-penny wall, the penny-bath wall, and the bath-luke wall — all should block you.

- [ ] **Step 4: Commit**

```bash
git add src/components/hero/HeroHouse10600.tsx
git commit -m "Royal Tara Cove: v11 — build interior colliders from manifest"
```

---

## Task 6: Relocate the patio slider to align with Luke's room

**Files:**
- Modify: `src/components/hero/HeroHouse10600.tsx`

`BackWallWithSlider` currently centers the slider at x=0. With the new layout, x=0 lands on the bath/luke wall. Move it to x = +0.5 so it sits inside Luke's room (x = -1..+2). Also update the back-wall exterior collider gap to match.

- [ ] **Step 1: Make `BackWallWithSlider` accept a `centerX` prop**

Find the function `BackWallWithSlider` (around line 226). Update its signature and body:

```typescript
function BackWallWithSlider({
  width,
  height,
  z,
  centerX,
  material,
}: {
  width: number;
  height: number;
  z: number;
  centerX: number;
  material: THREE.Material;
}) {
  const sliderW = 1.6;
  const halfSlider = sliderW / 2;
  const leftEnd = -width / 2;
  const rightEnd = width / 2;
  const sliderLeft = centerX - halfSlider;
  const sliderRight = centerX + halfSlider;
  const leftW = sliderLeft - leftEnd;
  const rightW = rightEnd - sliderRight;
  return (
    <>
      <mesh position={[leftEnd + leftW / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[leftW, height, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[sliderRight + rightW / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[rightW, height, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* header above slider */}
      <mesh position={[centerX, height - 0.15, z]} castShadow receiveShadow>
        <boxGeometry args={[sliderW + 0.2, 0.3, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
    </>
  );
}
```

- [ ] **Step 2: Update the call site to pass `centerX={0.5}` and move the slider Door**

Find this block in `HeroHouse10600` (around line 51):

```typescript
      <BackWallWithSlider width={config.width} height={wallH} z={halfD} material={wallMaterial} />
```

Replace with:

```typescript
      <BackWallWithSlider width={config.width} height={wallH} z={halfD} centerX={0.5} material={wallMaterial} />
```

Find the sliding patio Door block (around line 127):

```typescript
      {/* Sliding patio door */}
      <Door
        id={`hero-patio-${config.address}`}
        x={0}
        z={halfD}
        ...
      />
```

Change `x={0}` to `x={0.5}`.

- [ ] **Step 3: Update `buildHeroExteriorColliders` so the back-wall gap matches**

Find `buildHeroExteriorColliders` (around line 862). The back wall is currently split symmetrically around x=0. Update the split:

Find:

```typescript
    // Back wall: split around centered patio slider
    { cx: (-halfW + (-sliderHalf)) / 2, cz: halfD, sx: (-sliderHalf) - (-halfW), sz: WALL_T, tag: 'back-l' },
    { cx: ((sliderHalf) + halfW) / 2, cz: halfD, sx: halfW - sliderHalf, sz: WALL_T, tag: 'back-r' },
```

Replace with:

```typescript
    // Back wall: split around patio slider relocated to x = +0.5 (inside Luke's room)
    { cx: (-halfW + (0.5 - sliderHalf)) / 2, cz: halfD, sx: (0.5 - sliderHalf) - (-halfW), sz: WALL_T, tag: 'back-l' },
    { cx: ((0.5 + sliderHalf) + halfW) / 2, cz: halfD, sx: halfW - (0.5 + sliderHalf), sz: WALL_T, tag: 'back-r' },
```

- [ ] **Step 4: Verify build + walk-through**

Run: `npm run build`
Expected: success.

Refresh browser. Walk into Luke's room. The patio slider should:
- Be visible on the back wall, slightly to the right of center.
- Fully inside Luke's room (not poking into the bath).
- Open with E to let you out to the back deck.

- [ ] **Step 5: Commit**

```bash
git add src/components/hero/HeroHouse10600.tsx
git commit -m "Royal Tara Cove: v11 — move patio slider into Luke's room"
```

---

## Task 7: Trim the loft to the great-room footprint

**Files:**
- Modify: `src/components/hero/HeroHouse10600.tsx`

The loft currently extends from local x=-9..-2, z=-3..+3.5 (overhanging the hallway and master bedroom). Trim it to the great-room footprint so the loft is a proper "open above the great room" element.

- [ ] **Step 1: Update `buildHeroFloors`**

Find this block (around line 945):

```typescript
  const stairs = toWorldRect(-8.4, -2.5, -5.0, -1.4);
  const loft = toWorldRect(-9.0, -3.0, -2.0, 3.5);
```

Replace with:

```typescript
  // Stairs unchanged (live in the back-left corner of the great room).
  const stairs = toWorldRect(-8.4, -2.5, -5.0, -1.4);
  // Loft trimmed to the great-room footprint (x=-9..-1.5, z=-8..0) so it doesn't
  // overhang the hallway/master. Use a slightly inset box so the railing stays inside.
  const loft = toWorldRect(-9.0, -7.5, -2.0, -0.5);
```

- [ ] **Step 2: Check `StairsAndLoft.tsx` for any hard-coded coords**

Run: `grep -n "loft\|Loft" src/components/hero/StairsAndLoft.tsx`

If `<Loft />` renders a visual platform at coordinates that match the OLD bounds (x=-9..-2, z=-3..+3.5), update them to match the new bounds (x=-9..-1.5, z=-7.5..-0.5) by editing the component, OR — simpler — leave the visible loft mesh where it is and only the collider/floor changed. Decide based on what you see.

If editing: look for box geometry args around the relevant z range and update them.

- [ ] **Step 3: Verify build + walk-through**

Run: `npm run build`
Expected: success.

Refresh. Walk into the great room. Look up — the loft should be visible above. Climb the stairs to reach the loft. The loft should:
- Cover only the great-room ceiling area.
- Not extend over the hallway or master bedroom.

- [ ] **Step 4: Commit**

```bash
git add src/components/hero/HeroHouse10600.tsx src/components/hero/StairsAndLoft.tsx
git commit -m "Royal Tara Cove: v11 — trim loft to great-room footprint"
```

---

## Task 8: Push trees and shrubs outside every house

**Files:**
- Modify: `src/components/Game.tsx`

`LotVegetation` uses hard-coded offsets that work for small houses but plant trees inside the bigger hero house. Derive offsets from `config.depth`.

- [ ] **Step 1: Update `LotVegetation` to accept `config` and use depth-relative offsets**

Find the function `LotVegetation` (around line 303). Change its signature:

```typescript
function LotVegetation({ address, lot, depth }: { address: string; lot: ReturnType<typeof buildLots>[number]; depth: number }) {
```

Inside the function, find the offset calculations (around line 311):

```typescript
  // backyard offset: house-local (0, +6) maps to world via the house yaw
  const backLocalX = (((seed % 7) - 3) * 0.7);
  const backLocalZ = 6 + (seed % 3);
```

Replace with:

```typescript
  const halfD = depth / 2;
  // backyard offset: well behind the back wall + any back deck
  const backLocalX = (((seed % 7) - 3) * 0.7);
  const backLocalZ = halfD + 4 + (seed % 3);
```

Find the crepe myrtle offset (around line 319):

```typescript
  // crepe near the curb on the door side
  const sideLocalX = (seed % 11) > 5 ? -3 : 3;
  const sideLocalZ = -7;
```

Replace with:

```typescript
  // crepe in front yard between house and sidewalk
  const sideLocalX = (seed % 11) > 5 ? -3 : 3;
  const sideLocalZ = -halfD - FRONT_YARD_DEPTH * 0.55;
```

Find the hedge offset (around line 326):

```typescript
  // Hedge against the front foundation (some lots only)
  const showHedge = (seed % 3) === 0;
  const hedgeLocalZ = -(7); // along front of house
```

Replace with:

```typescript
  // Hedge against the front foundation (outside, hugging the front wall)
  const showHedge = (seed % 3) === 0;
  const hedgeLocalZ = -halfD - 0.7;
```

- [ ] **Step 2: Ensure `FRONT_YARD_DEPTH` is imported**

At the top of `Game.tsx`, look for the existing import from `'./world/streetLayout'` (or `../world/streetLayout`). It should already import `FRONT_YARD_DEPTH` (the Yard component uses it). If not, add it:

```typescript
import { FRONT_YARD_DEPTH } from './world/streetLayout';
```

(Or wherever the streetLayout import lives — match the existing style.)

- [ ] **Step 3: Update the call site to pass `depth`**

Find where `<LotVegetation>` is rendered (around line 120):

```typescript
            <LotVegetation address={h.address} lot={lot} />
```

Replace with:

```typescript
            <LotVegetation address={h.address} lot={lot} depth={h.depth} />
```

- [ ] **Step 4: Verify build + visual**

Run: `npm run build`
Expected: success.

Refresh. Walk around every house on the street:
- Backyard live oak should be behind the back wall and back deck/pool (where applicable).
- Front crepe myrtle should be in the front yard between sidewalk and house, NOT inside the house.
- Hedges should hug the front foundation from the outside.
- Inside the hero house: NO TREES.

- [ ] **Step 5: Commit**

```bash
git add src/components/Game.tsx
git commit -m "Royal Tara Cove: v11 — derive tree placement from house depth so plants stay outside"
```

---

## Task 9: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full TypeScript build**

Run: `npm run build`
Expected: builds without errors.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: zero errors (warnings are fine if pre-existing — don't fix unrelated ones).

If you introduced new warnings (e.g., unused vars), fix them inline now.

- [ ] **Step 3: Full walk-through test**

Refresh `http://localhost:5175/`. As Dad, starting from the spawn:

1. Walk to the hero house front door. Press E. Walk inside.
2. Walk through the great room. Confirm bay window seat, couch, TV are visible.
3. Pass through the great-kitchen doorway into the kitchen. Confirm island, no tile-overlap z-fighting.
4. Pass through the kitchen-garage door (mudroom) into the garage. Confirm workbench is there, concrete floor, no overlapping tile.
5. Back into kitchen, through the kitchen-hall door into the hallway.
6. Through each back-row door in turn:
   - Master: bed, dresser, desk. Largest room.
   - Penny: bed, dresser, polaroid wall, soccer ball.
   - Bathroom: toilet, vanity, mirror. NOT in the garage.
   - Luke: bed, dresser, toy chest, legos. Patio slider on back wall.
7. From Luke's room, press E at the slider. Walk out to the back deck. Walk to the pool.
8. Around to the front yard. Verify the crepe myrtle is in the yard (not inside), hedge against foundation, live oak in the deep back behind the pool.
9. Walk past every other house on the street. Verify trees are in their yards, not inside walls.

- [ ] **Step 4: If everything passes, no commit needed (verification only)**

If you find a regression in steps 1-9, go back to the relevant Task above, fix, recommit. Don't bundle multiple fixes into one final-verification commit.

---

## Self-review notes

- **Spec coverage:**
  - Bath-in-garage → Task 4 (manifest-driven placement).
  - Overlapping bedrooms → Task 4.
  - Luke in garage → Task 4 (bound to manifest, no overflow possible).
  - Floor overlap → Task 2 (one floor per room).
  - Garage floor doubled → Task 2 (removed standalone garage floor, manifest provides).
  - Trees inside house → Task 8.
  - Walls don't match rooms → Tasks 3 + 5 (rendered + collided from same manifest).
  - GARAGE_W mismatch → out of scope per spec (comment-only fix, can land any time; not in the plan).
  - Patio slider relocation → Task 6.
  - Loft trim → Task 7.

- **Placeholder scan:** all code blocks are concrete; no TBDs. Task 4 Step 3 is conditional on what `Kitchen.tsx` / `LivingRoom.tsx` expect — the engineer reads them in Step 1 and acts accordingly. Both fallbacks are spelled out.

- **Type consistency:** `floorPlan.ts` exports `WALL_HEIGHT`, `WALL_THICK`, `WALL_Y`, `Room`, `InteriorWall`, `RoomId`, `ROOMS`, `INTERIOR_WALLS`, `roomCenter`. Used as-defined in Tasks 2, 3, 4, 5. `buildInteriorColliders` signature unchanged. `BackWallWithSlider` adds one prop (`centerX`).
