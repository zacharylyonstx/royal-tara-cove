// Siren Head Night — static layout data (lantern spawns, the home base, hide &
// safe zones, and the patch of street Siren Head roams). Pure data, no logic, so
// it can be imported by both the store (for reset) and the scene components.
//
// Coordinate frame: world XZ. The cul-de-sac bulb is centered on the origin
// (radius ~14.5); the street "stick" runs north into −Z. The family spawns in
// front of 10600 at ~(0, 10) facing the house (+Z). See streetLayout.ts.

export interface NightZone {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface LanternSpawn {
  id: string;
  x: number;
  z: number;
}

/** How many lanterns must reach the base to light the block. */
export const LANTERN_GOAL = 5;

/** Seconds in a round before dawn breaks (a guaranteed positive ending even if
 *  the lanterns aren't all found). Generous on purpose. */
export const NIGHT_ROUND_SECONDS = 240;

/** The porch of 10600 — carry a lantern in here to deliver it. Also a safe zone
 *  Siren Head will not enter, and where the family spawns / regroups. */
export const BASE_ZONE: NightZone = { id: 'base-porch', x: 0, z: 13, radius: 7 };

/** Where the 5 lanterns start, spread around the cul-de-sac + near street so a
 *  round stays cozy and tense rather than a long march. All reachable on foot. */
export const LANTERN_SPAWNS: LanternSpawn[] = [
  { id: 'lantern-1', x: 13, z: 2 },
  { id: 'lantern-2', x: -13, z: -4 },
  { id: 'lantern-3', x: 6, z: -28 },
  { id: 'lantern-4', x: -9, z: -42 },
  { id: 'lantern-5', x: 14, z: -58 },
];

/** Pools of cover (bushes, nooks behind houses) where crouching breaks Siren
 *  Head's line of sight and he loses interest. */
export const HIDE_ZONES: NightZone[] = [
  { id: 'hide-1', x: 17, z: -18, radius: 3.2 },
  { id: 'hide-2', x: -17, z: -32, radius: 3.2 },
  { id: 'hide-3', x: 11, z: -50, radius: 3.0 },
  { id: 'hide-4', x: -12, z: -10, radius: 3.0 },
];

/** Zones Siren Head will never enter — total safety. The base porch + the open
 *  garage of 10600. */
export const SAFE_ZONES: NightZone[] = [
  BASE_ZONE,
  { id: 'garage-10600', x: -7, z: 11, radius: 4 },
];

/** Siren Head's roaming bounds (he patrols inside this box). */
export const SIREN_BOUNDS = { minX: -23, maxX: 23, minZ: -72, maxZ: 6 };

/** Where Siren Head first appears — up the dark street, away from the base. */
export const SIREN_SPAWN = { x: 0, z: -66 };

export function inZone(x: number, z: number, zone: NightZone): boolean {
  return Math.hypot(x - zone.x, z - zone.z) < zone.radius;
}

export function inAnyZone(x: number, z: number, zones: NightZone[]): boolean {
  for (const zn of zones) if (inZone(x, z, zn)) return true;
  return false;
}
