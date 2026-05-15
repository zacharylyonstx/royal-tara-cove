# Hero house interior fix (v11)

## Problem

The hero house (10600 Royal Tara Cv, the player's home) has multiple architectural bugs in its interior that make it feel cramped and confusing — and there are trees physically inside the house.

Concrete bugs found in the current code:

1. **Bathroom rendered inside the garage.** `Bathroom origin = (halfW - 1.5, 5.5) = (7.5, 5.5)`. Garage occupies x = 2..8.4. Toilet and vanity sit on the garage concrete next to the workbench.
2. **Penny's bedroom overlaps the master.** Master center (-3.5, 5.5) size 3.5×2.5 → spans x=-5.25..-1.75. Penny center (-3.0, 5.5) size 2.5×2.5 → spans x=-4.25..-1.75. Penny's room is almost entirely inside the master.
3. **Luke's bedroom pokes into the garage.** Center (1.0, 5.5) size 2.5×2.5 → spans to x=+2.25; garage wall is at x=+2.
4. **Wood floor and tile floor overlap.** Wood spans x=-9..+5; tile spans x=4..8. Z-fighting from x=4..5.
5. **Garage floor double-rendered.** Tile floor extends into the garage; the standalone garage concrete also covers the same area.
6. **Trees inside the house.** `LotVegetation` plants the backyard live oak at house-local z = 6..8 (hero halfD = 8 → tree spawns in back rooms or on back wall). Crepe myrtle at z = -7 and hedge at z = -7 sit inside the front wall (1m inside the great room).
7. **Interior dividing walls don't match room boundaries** as a downstream effect of the wrong bedroom origins. Wall at x=-5.5 sits outside any bedroom.
8. **GARAGE_W constant mismatch.** `HeroHouse10600.tsx` uses 6.4m, `colliders.ts` uses 5.6m (commented "mirror of HouseProps.tsx"). Hero garage is the visible 6.4m; the 5.6m constant is for non-hero houses.

Root cause: the interior was laid out with hand-typed coordinates, with `Bedroom origin` interpreted as top-left corner in the call site but as room center in the component. There is no single source of truth tying floors, walls, ceilings, and colliders together — so they drifted apart.

## Goals

- Player can walk through every room without hitting an invisible wall or seeing a wall in the wrong place.
- Master, Penny, Luke, and bathroom each occupy non-overlapping space and each open onto the same hallway.
- Bathroom is inside the house, not the garage.
- No floor overlaps / z-fighting.
- Trees and front-yard plants land outside the hero house footprint, regardless of house size.

## Non-goals

- New furniture or decor (handled in a future pass).
- Lighting / shaders / shadow tweaks.
- Changing non-hero houses' interiors (they don't have one).
- Changing exterior walls, roof, porch, or vehicle/prop placement.

## Architecture

### Single source of truth: `floorPlan.ts`

New file: `src/components/hero/floorPlan.ts`. Exports two arrays consumed by both the renderer and the collider builder. Wall, floor, ceiling, and collider geometry derive from this manifest, so they cannot drift.

```ts
export type FloorMaterial = 'wood' | 'tile' | 'concrete';

export type RoomId =
  | 'great' | 'kitchen' | 'hall'
  | 'master' | 'penny' | 'luke' | 'bath'
  | 'garage';

export interface Room {
  id: RoomId;
  /** House-local axis-aligned bounds (inclusive). */
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  floor: FloorMaterial;
  /** True for rooms that get a flat drywall ceiling. False for garage (open rafters). */
  ceiling: boolean;
}

export interface InteriorWall {
  /** 'x' = wall runs along world X (constant Z); 'z' = wall runs along world Z (constant X). */
  axis: 'x' | 'z';
  /** Position of the wall on the constant axis (house-local). */
  at: number;
  /** Span on the variable axis. */
  from: number; to: number;
  /** Door openings as ranges on the variable axis. Wall mesh is split around these. */
  openings: { from: number; to: number }[];
  tag: string;
}

export const ROOMS: Room[] = [/* see "Room layout" table below */];
export const INTERIOR_WALLS: InteriorWall[] = [/* see "Interior walls" table below */];
```

### Room layout (house-local, +X right, -Z front, +Z back)

Hero house: width=18 (halfW=9), depth=16 (halfD=8). Garage occupies x=2..8.4 the full depth. Front door at x=-6.6. Patio slider at x=0 (relocated; see below).

```
                           FRONT (z = -8)
        +------------------------+----------+----------+
        |                        |          |          |
        |       GREAT ROOM       |  KITCHEN |          |
        |       7.5m × 8m        |  3.5m×8  |  GARAGE  |
        |   front door @ x=-6.6  |          |  6.4m ×  |
        |     bay window seat    |          |  16m     |
        |     stairs to loft     |          |  open    |
        |                        |          | rafters  |
        +------------------------+----------+ workbench|
        |  HALLWAY  (z = 0..1.5, runs full 11m wide)   |
        +-------+-------+-------+-------+--------------+
        |       |       |       |       |          |
        |MASTER | PENNY |  BATH |  LUKE |          |
        |3.5×6.5| 3×6.5 |1.5×6.5| 3×6.5 |  GARAGE  |
        |       |       |       | patio |          |
        |       |       |       | slider|          |
        +-------+-------+-------+-------+----------+
                           BACK (z = +8)
```

Exact bounds:

| Room | minX | maxX | minZ | maxZ | floor | ceiling |
|------|------|------|------|------|-------|---------|
| great | -9.0 | -1.5 | -8.0 |  0.0 | wood  | yes |
| kitchen | -1.5 | 2.0 | -8.0 |  0.0 | tile  | yes |
| hall   | -9.0 |  2.0 |  0.0 |  1.5 | wood  | yes |
| master | -9.0 | -5.5 |  1.5 |  8.0 | wood  | yes |
| penny  | -5.5 | -2.5 |  1.5 |  8.0 | wood  | yes |
| bath   | -2.5 | -1.0 |  1.5 |  8.0 | tile  | yes |
| luke   | -1.0 |  2.0 |  1.5 |  8.0 | wood  | yes |
| garage |  2.0 |  8.4 | -8.0 |  8.0 | concrete | no |

### Interior walls (with door gaps, all 1m wide)

All interior walls are 2.8m tall and 0.15m thick (matching today's `<InteriorWall>` defaults).


| Tag | axis | at | from | to | openings |
|-----|------|----|------|----|----------|
| great-kitchen | z | -1.5 | -8.0 | 0.0 | (-3.0, -2.0) |
| great-hall    | x | 0.0  | -9.0 | -1.5 | (-5.0, -4.0) |
| kitchen-hall  | x | 0.0  | -1.5 | 2.0  | (0.5, 1.5) |
| kitchen-garage | z | 2.0 | -8.0 | 0.0 | (-1.0, 0.0) (mudroom door) |
| hall-garage    | z | 2.0 |  0.0 | 1.5 | (no opening) |
| hall-back-master | x | 1.5 | -9.0 | -5.5 | (-7.5, -6.5) |
| hall-back-penny  | x | 1.5 | -5.5 | -2.5 | (-4.5, -3.5) |
| hall-back-bath   | x | 1.5 | -2.5 | -1.0 | (-2.0, -1.0) |
| hall-back-luke   | x | 1.5 | -1.0 |  2.0 | (-0.5,  0.5) |
| master-penny | z | -5.5 | 1.5 | 8.0 | (no opening) |
| penny-bath   | z | -2.5 | 1.5 | 8.0 | (no opening) |
| bath-luke    | z | -1.0 | 1.5 | 8.0 | (no opening) |
| luke-garage  | z |  2.0 | 1.5 | 8.0 | (no opening — solid garage wall) |

### Patio slider relocation

The patio slider currently sits centered at x=0 in the back wall. With the new layout, x=0 lands inside Luke's room (x=-1..+2). That's fine and even kid-pleasing (Luke can run straight to the pool), but it means the slider should be positioned to fit cleanly inside Luke's back wall:

- Slider center: house-local x = +0.5, z = +8 (back wall).
- Slider width: stays 1.6m (spans x = -0.3..+1.3, fully inside Luke's room x=-1..+2).
- `BackWallWithSlider` updated to take a `centerX` prop; passed `+0.5` for the hero.

### Stairs and loft

- Stairs unchanged (currently x=-8.4..-5.0, z=-2.5..-1.4 in the great room — fits in the new great room x=-9..-1.5, z=-8..0).
- Loft trimmed to x = -9..-3, z = -7..-1 (fits inside the great room footprint instead of overhanging the master bedroom). Loft floor stays at y = STORY_H.

### Renderers and consumers

`Interior10600.tsx`:
- Replace the two hand-coded floor meshes (wood + tile) with one mesh per room iterated from `ROOMS` (excluding garage, which is rendered separately as it always was).
- Replace the hand-coded `<InteriorWall>` calls with iteration over `INTERIOR_WALLS`. Each wall splits into one or more mesh segments around its `openings`.
- Replace the single ceiling mesh with one mesh per room where `ceiling = true`.
- Keep the workbench (it belongs in the garage).
- Compute `Bedroom`/`Bathroom` `origin` from the room manifest: `cx = (room.minX + room.maxX) / 2`, `cz = (room.minZ + room.maxZ) / 2`. No more hand-typed centers.

`HeroHouse10600.tsx::buildInteriorColliders`:
- Iterate `INTERIOR_WALLS`; for each wall and each gap, emit one `RectCollider` per solid segment (axis-aligned in house-local, transformed to world via `lot.houseYaw` exactly as today).

`HeroHouse10600.tsx`:
- Pass `centerX = +0.5` to `BackWallWithSlider` so the visible slider matches the Luke-room placement.

### Tree placement (`Game.tsx::LotVegetation`)

Pass `config.depth` (or full `config`) to `LotVegetation`. Compute `halfD = depth / 2` and use:

| Plant | Today | New |
|-------|-------|-----|
| Backyard live oak | `z = 6 + (seed % 3)` | `z = halfD + 4 + (seed % 3)` |
| Crepe myrtle | `z = -7` | `z = -halfD - FRONT_YARD_DEPTH * 0.55` |
| Hedge | `z = -7` | `z = -halfD - 0.7` |

`FRONT_YARD_DEPTH` is already exported from `streetLayout.ts`. The crepe myrtle lands halfway down the front yard; the hedge sits just outside the foundation; the live oak lands well past the back wall + back deck.

### GARAGE_W mismatch

Out of scope to fully unify — both constants stay. Add a code comment in `HeroHouse10600.tsx` noting that the hero's 6.4m garage is intentional (vs 5.6m on stock houses).

## Files touched

**New:**
- `src/components/hero/floorPlan.ts`

**Modified:**
- `src/components/hero/Interior10600.tsx` — read manifest, replace hand-coded layout
- `src/components/hero/HeroHouse10600.tsx` — `buildInteriorColliders` reads manifest; `BackWallWithSlider` takes `centerX`
- `src/components/Game.tsx` — `LotVegetation` derives offsets from house depth

**Unchanged:**
- `src/components/hero/Bedroom.tsx`, `Bathroom.tsx`, `Kitchen.tsx`, `LivingRoom.tsx`, `StairsAndLoft.tsx` — all keep their current props and behavior; only their callers' arguments change
- All collision, prop, vegetation modules outside the bullets above

## Test plan

- Walk through the hero house from the front door:
  - Through the great room, into the kitchen, through the kitchen-garage door into the garage.
  - Back through the kitchen, into the hallway via the LR-to-hall door.
  - From the hall: into master, into Penny, into bath, into Luke.
  - From Luke through the patio slider to the back deck and pool.
- Verify no invisible walls, no walking through walls, no z-fighting on floors.
- Verify trees and shrubs are outside the house at every other lot too (not just hero).
- Run `npm run build` cleanly.

## Out of scope / followups

- Furniture polish / kid-room personality (option C from the brainstorm).
- Lighting tuning.
- Decor for the bathroom-luke-bedroom slider area (towel rack, etc).
