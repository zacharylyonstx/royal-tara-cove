// What stands beside the Red Line between Avery Ranch and the Domain — the
// layout shared by the scenery (components/rail/Corridor.tsx) and collision.
// Order and character follow the real line (see world/redLine.ts); distances
// are compressed. +X east, +Z south; the two tracks straddle RAIL_MID_X.
import type { RectCollider } from '../types';
import { RAIL_MID_X, RAIL_X_B } from './westAvery';
import { SH45_Z, CREEK_Z, MOPAC_Z, QUARRY_Z, LAKELINE_Z, HOWARD_Z } from './redLine';

export const MID = RAIL_MID_X;
/** Half-width of the railway formation (nothing is planted inside it). */
export const CLEAR = 9;

/** Park & ride lots (asphalt) beside the two stations the train passes. */
export const LOTS = [
  { x0: RAIL_X_B + 7.5, x1: -113, z0: LAKELINE_Z - 20, z1: LAKELINE_Z + 26, name: 'LAKELINE  PARK & RIDE' },
  { x0: RAIL_X_B + 7.5, x1: -113, z0: HOWARD_Z - 19, z1: HOWARD_Z + 21, name: 'HOWARD  PARK & RIDE' },
];

/** The SH-45 toll road and Walnut Creek, down in their cuts under the bridges. */
export const SH45 = { z0: SH45_Z - 7, z1: SH45_Z + 7, y: -7.5 };
export const CREEK = { z0: CREEK_Z - 3.2, z1: CREEK_Z + 3.2, y: -3.6 };
/** MoPac's main lanes, carried over the railway. */
export const MOPAC = { z0: MOPAC_Z - 9, z1: MOPAC_Z + 9, y: 7.4 };

/** Austin White Lime's quarry pit (west of the line at McNeil). */
export const QUARRY = { x0: -306, x1: -203, z0: QUARRY_Z - 24, z1: QUARRY_Z + 28, y: -8 };
/** The Union Pacific sidings at McNeil junction (east of the line). */
export const SIDINGS = [RAIL_X_B + 7.6, RAIL_X_B + 12.2];
export const YARD = { z0: QUARRY_Z - 28, z1: QUARRY_Z + 28 };

/** Back fences of the houses the line passes as it leaves Avery Ranch. */
export const BACK_FENCE = { x: MID - 21, z0: -24, z1: 96 };

export function buildCorridorColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const wall = (minX: number, maxX: number, minZ: number, maxZ: number, tag: string, maxY = 2) =>
    out.push({ minX, maxX, minZ, maxZ, minY: 0, maxY, tag });
  // The cuts are only LOOKS (the walkable ground is flat), so fence their rims
  // everywhere except across the rail bridges.
  for (const cut of [SH45, CREEK]) {
    for (const z of [cut.z0 - 5.5, cut.z1 + 5.5]) {
      wall(-700, MID - CLEAR, z - 0.15, z + 0.15, 'cut-fence');
      wall(MID + CLEAR, 190, z - 0.15, z + 0.15, 'cut-fence');
    }
    // …and the bridge parapets, so you can't step off the side of the deck.
    wall(MID - CLEAR - 0.2, MID - CLEAR + 0.2, cut.z0 - 5.5, cut.z1 + 5.5, 'cut-fence');
    wall(MID + CLEAR - 0.2, MID + CLEAR + 0.2, cut.z0 - 5.5, cut.z1 + 5.5, 'cut-fence');
  }
  // Quarry rim.
  const q = QUARRY, m = 12;
  wall(q.x0 - m, q.x1 + m, q.z0 - m - 0.15, q.z0 - m + 0.15, 'quarry-fence');
  wall(q.x0 - m, q.x1 + m, q.z1 + m - 0.15, q.z1 + m + 0.15, 'quarry-fence');
  wall(q.x1 + m - 0.15, q.x1 + m + 0.15, q.z0 - m, q.z1 + m, 'quarry-fence');
  wall(q.x0 - m - 0.15, q.x0 - m + 0.15, q.z0 - m, q.z1 + m, 'quarry-fence');
  // Parked freight cars.
  for (const x of SIDINGS) wall(x - 1.5, x + 1.5, YARD.z0 + 2, YARD.z1 - 2, 'freight', 4);
  // Back-yard fence.
  wall(BACK_FENCE.x - 0.12, BACK_FENCE.x + 0.12, BACK_FENCE.z0, BACK_FENCE.z1, 'back-fence');
  return out;
}

/** Deterministic random numbers (same scenery on every screen). */
export function rng32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
