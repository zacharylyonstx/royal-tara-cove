// Hide-and-seek (Free Play) — the rules, in one place.
//
// How a game goes: someone walks up to the big oak in our front yard ("Home
// Base") and presses E — they're the seeker. Their screen goes dark while they
// count to 30; everyone else scatters. Then it's "ready or not, here I come":
// three minutes to find everyone. You find someone by SEEING them (close, in
// front of you, nothing solid in between) and calling it, or by walking right
// into them. Found players join the hunt. When it's over a little score card
// pops up and the game is simply done — whoever wants to count next walks up
// to the tree.
import type { CharacterId, RectCollider } from '../types';
import { heroToWorld } from './heroPlace';

// The big live oak in 10600's front yard (house-local 6, −16.5 — see
// components/hero/HeroHouse10600.tsx).
const OAK = heroToWorld(6, -16.5);
export const HS_BASE = { x: OAK.x, z: OAK.z };
/** Where the seeker stands to count: facing the trunk, back to the street. */
export const HS_COUNT_SPOT = { x: OAK.x - 0.4, z: OAK.z - 2.1, yaw: Math.PI };
/** Reach of the "play hide-and-seek" prompt around the tree. */
export const HS_BASE_RADIUS = 4.6;
/** Pets wait for their people here while a round is on (so a loyal puppy
 *  doesn't sit outside your hiding spot and give you away). */
export const HS_PET_WAIT = { x: OAK.x + 2.6, z: OAK.z - 1.2 };

/** The play area: our end of the street — the cul-de-sac, the first two houses
 *  up each side, and every yard around them (10600 inside and out). The north
 *  edge runs down the gap between houses. */
export const HS_BOUNDS = { minX: -48, maxX: 48, minZ: -46, maxZ: 74 };

export const HS_COUNT_S = 30;
export const HS_ROUND_S = 180;
/** How long the score card phase lasts before the game is fully over. */
export const HS_RESULTS_S = 30;
/** "I see you!": within this range, in front of the seeker, with a clear line. */
export const HS_SEE_RANGE = 8;
export const HS_SEE_CONE_COS = Math.cos((58 * Math.PI) / 180);
/** Walk into someone and they're found, no button needed. */
export const HS_TOUCH_RANGE = 2.0;
/** The host re-checks a tag with a little slack for network lag. */
export const HS_TAG_SLACK = 6;

export type HsPhase = 'idle' | 'counting' | 'seeking' | 'results';

export function hsInBounds(x: number, z: number): boolean {
  return x >= HS_BOUNDS.minX && x <= HS_BOUNDS.maxX && z >= HS_BOUNDS.minZ && z <= HS_BOUNDS.maxZ;
}

/** Keep a position inside the force field. Returns true when it had to push. */
export function hsClamp(pos: { x: number; z: number }): boolean {
  const M = 0.45; // stand a little inside the wall, not in it
  const cx = Math.max(HS_BOUNDS.minX + M, Math.min(HS_BOUNDS.maxX - M, pos.x));
  const cz = Math.max(HS_BOUNDS.minZ + M, Math.min(HS_BOUNDS.maxZ - M, pos.z));
  if (cx === pos.x && cz === pos.z) return false;
  pos.x = cx; pos.z = cz;
  return true;
}

/**
 * Can someone at A see someone at B? Walks the line between them and stops at
 * anything solid that stands across eye level — house walls, closed doors,
 * fences, tree trunks, parked trucks. Low furniture doesn't count (you can see
 * over a couch), and neither does anything on another floor.
 */
export function hsSightClear(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  colliders: readonly RectCollider[],
): boolean {
  if (Math.abs(ay - by) > 1.8) return false; // different floors
  const eye = (ay + by) / 2 + 1.1;
  const minX = Math.min(ax, bx) - 0.3, maxX = Math.max(ax, bx) + 0.3;
  const minZ = Math.min(az, bz) - 0.3, maxZ = Math.max(az, bz) + 0.3;
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(2, Math.ceil(dist / 0.18));
  for (const c of colliders) {
    if (c.passable) continue;
    if (eye < (c.minY ?? 0) || eye > (c.maxY ?? 6)) continue;
    const ccx = (c.minX + c.maxX) / 2, ccz = (c.minZ + c.maxZ) / 2;
    const hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
    const reach = c.yaw ? Math.hypot(hx, hz) : 0;
    // Cheap reject: nowhere near the line.
    if (c.yaw) {
      if (ccx + reach < minX || ccx - reach > maxX || ccz + reach < minZ || ccz - reach > maxZ) continue;
    } else if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
    const cn = c.yaw ? Math.cos(-c.yaw) : 1;
    const sn = c.yaw ? Math.sin(-c.yaw) : 0;
    // Skip the very ends so the two players' own spots never block the view.
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t - ccx;
      const z = az + (bz - az) * t - ccz;
      const lx = c.yaw ? x * cn - z * sn : x;
      const lz = c.yaw ? x * sn + z * cn : z;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) return false;
    }
  }
  return true;
}

export const HS_NAME: Record<CharacterId, string> = { dad: 'Dad', penny: 'Penny', luke: 'Luke' };

export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
