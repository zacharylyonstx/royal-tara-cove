import type { RectCollider } from '../types';
import { HOUSES } from './houses';
import { buildLots } from './lots';
import { LOT_FRONT_RADIUS, STRAIGHT_LOT_FRONT_X } from './streetLayout';
import { POND_X, POND_Z, DOCK_START_Z, WINGA_MIN_X, WINGA_MAX_X, WINGA_FRONT_Z } from './acrossBlvd';
import { SCHOOL_MAX_X, SCHOOL_CZ } from './school';

/**
 * Street-lamp layout for Free Play (single source of truth for the renderer
 * and the pole colliders). Positions are world XZ.
 *
 *  • 'cobra' — the tall aluminium cobra-head pole on a residential street,
 *    planted just behind the sidewalk at a PROPERTY LINE (never a driveway),
 *    every other lot boundary, alternating sides of the stick.
 *  • 'acorn' — the shorter decorative post used on the cul-de-sac bulb and
 *    around the pond / plaza / school.
 * `yaw` turns the arm toward the road.
 */
export type LampKind = 'cobra' | 'acorn';
export interface StreetLamp { x: number; z: number; kind: LampKind; yaw: number }

function buildLamps(): StreetLamp[] {
  const lamps: StreetLamp[] = [];
  const lots = buildLots(HOUSES);

  // --- the stick: property lines on each side, every other one, alternating ---
  const sideBounds = (side: 'east' | 'west') => {
    const zs = new Set<number>();
    for (const h of HOUSES) {
      if (h.position.kind !== 'straight' || h.position.side !== side) continue;
      const lot = lots.find((l) => l.address === h.address)!;
      for (const [, z] of lot.polygon) zs.add(Math.round(z * 10) / 10);
    }
    return [...zs].sort((a, b) => b - a); // south → north (z decreasing)
  };
  const east = sideBounds('east');
  const west = sideBounds('west');
  const lampX = STRAIGHT_LOT_FRONT_X + 0.55; // just behind the sidewalk
  // Skip the first boundary (it's the bulb junction) and stagger the sides.
  east.forEach((z, i) => {
    if (i === 0 || i === east.length - 1) return;
    if (i % 2 === 1) lamps.push({ x: lampX, z, kind: 'cobra', yaw: Math.PI / 2 });
  });
  west.forEach((z, i) => {
    if (i === 0 || i === west.length - 1) return;
    if (i % 2 === 0) lamps.push({ x: -lampX, z, kind: 'cobra', yaw: -Math.PI / 2 });
  });

  // --- cul-de-sac bulb: two acorn posts between the wedge lots ---
  const r = LOT_FRONT_RADIUS + 0.6;
  for (const deg of [20, 118]) {
    const a = (deg * Math.PI) / 180;
    // Arm points back toward the bulb centre.
    lamps.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, kind: 'acorn', yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
  }

  // --- the boulevard entry corner + pond + plaza + school ---
  lamps.push({ x: -8.5, z: -181, kind: 'cobra', yaw: -Math.PI / 2 });
  lamps.push({ x: 9.0, z: -176, kind: 'cobra', yaw: Math.PI / 2 });
  lamps.push({ x: POND_X + 2.5, z: DOCK_START_Z + 1.5, kind: 'acorn', yaw: Math.PI });
  lamps.push({ x: POND_X - 14, z: POND_Z - 6, kind: 'acorn', yaw: 0 });
  lamps.push({ x: (WINGA_MIN_X + WINGA_MAX_X) / 2, z: WINGA_FRONT_Z + 5.5, kind: 'acorn', yaw: Math.PI });
  lamps.push({ x: WINGA_MIN_X + 3, z: WINGA_FRONT_Z + 5.5, kind: 'acorn', yaw: Math.PI });
  lamps.push({ x: SCHOOL_MAX_X + 4.5, z: SCHOOL_CZ + 5, kind: 'acorn', yaw: -Math.PI / 2 });
  return lamps;
}

export const STREET_LAMPS: StreetLamp[] = buildLamps();

export const LAMP_HEIGHT: Record<LampKind, number> = { cobra: 7.4, acorn: 3.9 };
/** Horizontal reach of the arm (the luminaire sits this far toward the road). */
export const LAMP_ARM: Record<LampKind, number> = { cobra: 1.9, acorn: 0 };

/** World position of the light source (the luminaire), not the pole base. */
export function lampLightPos(l: StreetLamp): [number, number, number] {
  const arm = LAMP_ARM[l.kind];
  return [l.x + Math.sin(l.yaw) * arm, LAMP_HEIGHT[l.kind] - 0.2, l.z + Math.cos(l.yaw) * arm];
}

export function buildStreetLampColliders(): RectCollider[] {
  return STREET_LAMPS.map((l, i) => ({
    minX: l.x - 0.18, maxX: l.x + 0.18, minZ: l.z - 0.18, maxZ: l.z + 0.18,
    minY: 0, maxY: 2.5,
    tag: `lamp-${i}`,
  }));
}
