// "Across the Boulevard" — the real geography north of the Royal Tara Cove
// entrance, lovingly compressed: directly across Avery Ranch Blvd sits a treed
// pond at the golf-club edge; The Plaza at Avery Ranch (Brooklyn Heights
// Pizzeria, Orange Leaf, Woof Gang Bakery) is just east; the HOA playground a
// little further. Layout lives here so the zone component, colliders, floors
// and the vehicle clamp all share one source of truth.
//
// World frame: -Z is north. The blvd asphalt spans z -177.5..-189.5; its far
// sidewalk outer edge is z=-190.9. The ground plane ends at z=-300 and the
// fake distant treeline starts at z≈-260 — everything here stays z ≥ -250.
import { rectAt } from './colliders';
import type { Floor, RectCollider } from '../types';

// --- Pond (directly across from the entrance, like the real one) ---
export const POND_X = 0;
export const POND_Z = -222;
export const POND_RX = 19; // east-west radius
export const POND_RZ = 14; // north-south radius

// --- Dock (south shore, walks out over the water) ---
export const DOCK_W = 2.4;
export const DOCK_START_Z = -207.5; // shore end (on grass)
export const DOCK_END_Z = -216.5;   // water end
export const DOCK_Y = 0.35;         // plank deck height

// --- Park path: crosswalk → pond ---
export const PATH_HALF_W = 1.6;
export const PATH_START_Z = -189.5; // far edge of blvd asphalt
export const PATH_END_Z = DOCK_START_Z;

// --- Playground corner (west of the pond) ---
export const PLAYGROUND_X = -32;
export const PLAYGROUND_Z = -210;

// --- Picnic spot ---
export const PICNIC_X = -17;
export const PICNIC_Z = -206;

// --- Ice cream cart (by the path, east side) ---
export const CART_X = 8;
export const CART_Z = -201;

// --- Golf cart parking (east of the dock, golf-club edge) ---
export const GOLFCART_X = 16;
export const GOLFCART_Z = -207;

// --- Shops strip (east, fronting the blvd — The Plaza at Avery Ranch) ---
export const SHOPS_MIN_X = 28;
export const SHOPS_MAX_X = 61;
export const SHOPS_FRONT_Z = -198;  // storefront wall (faces south to the blvd)
export const SHOPS_BACK_Z = -208;
export const SHOPS_H = 4.6;
/** Storefront unit bounds [minX, maxX] + identity. */
export const SHOPS: { name: string; sub: string; minX: number; maxX: number; accent: string }[] = [
  { name: 'BROOKLYN HEIGHTS', sub: 'PIZZERIA', minX: 28, maxX: 39, accent: '#b03a2e' },
  { name: 'ORANGE LEAF', sub: 'FROZEN YOGURT', minX: 39, maxX: 50, accent: '#e8821e' },
  { name: 'WOOF GANG', sub: 'DOG BAKERY', minX: 50, maxX: 61, accent: '#3a6db0' },
];

// --- Limestone entry walls flanking the crosswalk landing ---
export const WALL_Z = -192.4;

// --- Vehicle clamp region for the whole zone (used by PlayerController) ---
export const ZONE_HALF_X = 70;
export const ZONE_MIN_Z = -250;
export const ZONE_MAX_Z = -189;

// Oak ring around the pond (positions also drive trunk colliders).
export const POND_OAKS: { x: number; z: number; s: number }[] = [
  { x: -22, z: -230, s: 1.1 },
  { x: -14, z: -238, s: 0.95 },
  { x: 4, z: -241, s: 1.15 },
  { x: 18, z: -235, s: 1.0 },
  { x: 25, z: -222, s: 0.9 },
  { x: -26, z: -216, s: 1.0 },
  { x: 24, z: -212, s: 0.85 },
];

/**
 * Static colliders for the zone. Pond water is fenced by an octagon of OBB
 * segments (gap on the south edge where the dock crosses); the dock keeps you
 * on its planks with rail colliders; buildings/walls/trees are solid boxes.
 */
export function buildAcrossBlvdColliders(): RectCollider[] {
  const out: RectCollider[] = [];

  // Pond edge: 8 OBB segments approximating the ellipse, with segment centers
  // ON the axis angles so the i=2 segment sits exactly at the south shore
  // (facing the dock) and can be skipped to open the dock corridor.
  const SEGS = 8;
  for (let i = 0; i < SEGS; i++) {
    if (i === 2) continue; // south-center segment — the dock crosses here
    const aMid = (i / SEGS) * Math.PI * 2;
    const ex = Math.cos(aMid) * POND_RX;
    const ez = Math.sin(aMid) * POND_RZ;
    const segLen = (2 * Math.PI * ((POND_RX + POND_RZ) / 2)) / SEGS + 2;
    // OBB long axis (local X) aligned with the ellipse tangent at aMid.
    const yaw = Math.atan2(POND_RZ * Math.cos(aMid), POND_RX * Math.sin(aMid));
    out.push({
      minX: POND_X + ex - segLen / 2,
      maxX: POND_X + ex + segLen / 2,
      minZ: POND_Z + ez - 0.5,
      maxZ: POND_Z + ez + 0.5,
      maxY: 1.2,
      yaw,
      tag: 'pond-edge',
    });
  }
  // The skipped segment leaves ~7m of open shore each side of the dock —
  // close it with straight fills so nobody wades in beside the planks.
  out.push(rectAt(POND_X - 4.8, POND_Z + POND_RZ + 0.2, 7.2, 1, { maxY: 1.2, tag: 'pond-edge' }));
  out.push(rectAt(POND_X + 4.8, POND_Z + POND_RZ + 0.2, 7.2, 1, { maxY: 1.2, tag: 'pond-edge' }));

  // GAPLESS water fill: piecewise rim walls leave thread-able corner gaps
  // (the drive auto-unstick slide actively finds them — a golf cart swam to
  // prove it). These overlapping low slabs approximate the whole ellipse with
  // zero gaps. maxY 0.3 so anyone ON the dock deck (y=0.35, Y-aware collision)
  // walks right over them — the dock needs no corridor at all.
  // Innermost slab stops at z −209 so the dock entry ramp can lift walkers
  // past maxY before they reach it (the shore band z −209..−207.3 is covered
  // by the full-height fills + dock rails + the forced ramp floor).
  const SLABS: [number, number][] = [
    [19, 6], [16.5, 10], [11.5, 13], [6, 13],
  ];
  for (const [hx, hz] of SLABS) {
    out.push(rectAt(POND_X, POND_Z, hx * 2, hz * 2, { maxY: 0.3, tag: 'pond-water' }));
  }

  // Dock side + end rails (keep everyone dry).
  const railLen = DOCK_START_Z - DOCK_END_Z + 1;
  const railMidZ = (DOCK_START_Z + DOCK_END_Z) / 2;
  out.push(rectAt(POND_X - DOCK_W / 2 - 0.15, railMidZ, 0.3, railLen, { maxY: 1.6, tag: 'dock-rail' }));
  out.push(rectAt(POND_X + DOCK_W / 2 + 0.15, railMidZ, 0.3, railLen, { maxY: 1.6, tag: 'dock-rail' }));
  out.push(rectAt(POND_X, DOCK_END_Z - 0.15, DOCK_W + 0.6, 0.3, { maxY: 1.6, tag: 'dock-rail' }));

  // Shops building body (walkway canopy in front stays open).
  out.push(rectAt(
    (SHOPS_MIN_X + SHOPS_MAX_X) / 2,
    (SHOPS_FRONT_Z + SHOPS_BACK_Z) / 2,
    SHOPS_MAX_X - SHOPS_MIN_X,
    SHOPS_BACK_Z - SHOPS_FRONT_Z < 0 ? SHOPS_FRONT_Z - SHOPS_BACK_Z : SHOPS_BACK_Z - SHOPS_FRONT_Z,
    { maxY: SHOPS_H, tag: 'shops' },
  ));

  // Limestone entry walls flanking the crosswalk landing.
  out.push(rectAt(-8, WALL_Z, 8, 0.8, { maxY: 1.1, tag: 'entry-wall' }));
  out.push(rectAt(8, WALL_Z, 8, 0.8, { maxY: 1.1, tag: 'entry-wall' }));

  // Playground central tower (kids can still run under the swings).
  out.push(rectAt(PLAYGROUND_X, PLAYGROUND_Z, 2.4, 2.4, { maxY: 2.6, tag: 'playground' }));

  // Picnic table + ice cream cart footprints.
  out.push(rectAt(PICNIC_X, PICNIC_Z, 2.4, 1.6, { maxY: 1.0, tag: 'picnic' }));
  out.push(rectAt(CART_X, CART_Z, 1.8, 1.2, { maxY: 1.6, tag: 'icecream-cart' }));

  // Pond oak trunks.
  for (const o of POND_OAKS) {
    out.push(rectAt(o.x, o.z, 1.2, 1.2, { maxY: 6, tag: 'zone-oak' }));
  }

  return out;
}

/**
 * Dock floors: a short entry step then the plank deck (merged into the single
 * setFloors call in Game.tsx — never call setFloors separately).
 */
export function buildAcrossBlvdFloors(): Floor[] {
  return [
    // Entry step ramp: grass (0) up to deck height over 1.5m.
    {
      minX: POND_X - DOCK_W / 2,
      maxX: POND_X + DOCK_W / 2,
      minZ: DOCK_START_Z - 1.5,
      maxZ: DOCK_START_Z,
      baseY: 0,
      topY: DOCK_Y,
      axis: 'z',
      invert: true, // climbs as z decreases (walking north onto the dock)
    },
    // The deck itself.
    {
      minX: POND_X - DOCK_W / 2,
      maxX: POND_X + DOCK_W / 2,
      minZ: DOCK_END_Z,
      maxZ: DOCK_START_Z,
      baseY: DOCK_Y,
      topY: DOCK_Y,
    },
  ];
}
