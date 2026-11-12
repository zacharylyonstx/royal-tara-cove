// Where the hero house (10600) sits in the world. One tiny module so anything
// that authors content in HOUSE-LOCAL coordinates (Midnight Munchies' maze,
// future indoor games) can convert to world space without re-deriving the lot.
//
// House-local convention (see components/hero/floorPlan.ts): x = -12..12,
// z = -9..9, -Z = front (street), +Z = back yard.
import { HOUSES } from './houses';
import { buildLots } from './lots';

const hero = HOUSES.find((h) => h.isHero);
const lot = hero ? buildLots(HOUSES).find((l) => l.address === hero.address) : undefined;

export const HERO_PIVOT_X = lot?.housePivot[0] ?? 0;
export const HERO_PIVOT_Z = lot?.housePivot[1] ?? 0;
export const HERO_YAW = lot?.houseYaw ?? 0;

const CY = Math.cos(HERO_YAW);
const SY = Math.sin(HERO_YAW);

/** House-local (x, z) → world (x, z). Same math as the collider builders. */
export function heroToWorld(lx: number, lz: number): { x: number; z: number } {
  return {
    x: HERO_PIVOT_X + lx * CY + lz * SY,
    z: HERO_PIVOT_Z - lx * SY + lz * CY,
  };
}

/** World (x, z) → house-local (x, z). */
export function worldToHero(wx: number, wz: number): { x: number; z: number } {
  const dx = wx - HERO_PIVOT_X;
  const dz = wz - HERO_PIVOT_Z;
  return {
    x: dx * CY - dz * SY,
    z: dx * SY + dz * CY,
  };
}
