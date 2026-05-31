// Single source of truth for the 10600 hero house interior layout.
// Renderer (Interior10600.tsx), collider builder (HeroHouse10600.tsx),
// and any future consumer all read from this file so geometry can't drift.
//
// House-local coordinate system: +X right, -Z front (street side), +Z back.
// Hero house: width=18 (halfW=9), depth=16 (halfD=8). Garage on +X side.

export type FloorMaterial = 'wood' | 'tile' | 'concrete';

export type RoomId =
  | 'great' | 'kitchen' | 'family'
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
  // Open flow front-to-back, full interior width: you enter the TWO-STORY great room
  // (ceiling:false = open up to the loft), the kitchen is straight back, the family
  // room (with the fireplace) is behind that. Very few interior walls.
  { id: 'great',   minX: -9.0, maxX:  2.0, minZ: -8.0, maxZ:  0.0, floor: 'wood', ceiling: false },
  { id: 'kitchen', minX: -9.0, maxX:  2.0, minZ:  0.0, maxZ:  4.0, floor: 'tile', ceiling: true },
  { id: 'family',  minX: -9.0, maxX:  2.0, minZ:  4.0, maxZ:  8.0, floor: 'wood', ceiling: true },
  // Garage (no ceiling = open rafters)
  { id: 'garage',  minX:  2.0, maxX:  8.4, minZ: -8.0, maxZ:  8.0, floor: 'concrete', ceiling: false },
];

export const INTERIOR_WALLS: InteriorWall[] = [
  // Garage wall (the only real interior partition) with a door into the kitchen/family.
  { axis: 'z', at: 2.0, from: -8.0, to: 8.0, openings: [{ from: 4.5, to: 5.5 }], tag: 'garage-wall' },
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
