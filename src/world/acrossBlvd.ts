// "Across the Boulevard" — corrected to the REAL Avery Ranch geography
// (Google-satellite + OSM way geometry, meters relative to the Royal Tara
// Cove × Avery Ranch Blvd junction, proportionally compressed ~5:1):
//
//   - CASITAS DR starts DIRECTLY across the junction, runs north lined with
//     garden homes on both sides, then horseshoes east to meet Parmer Ln.
//   - THE DUCK POND sits WEST, nestled between the blvd and Casitas.
//   - THE PLAZA AT AVERY RANCH is a large L of shops + parking lot inside
//     the Casitas dogleg, at the NW corner of Parmer & the blvd.
//   - PARMER LN is the big median-divided road on the east edge.
//   - Little Twist Bakery really is one of the Casitas garden homes.
//
// World frame: -Z is north, +X is east. Blvd asphalt z -177.5..-189.5 (far
// sidewalk edge -190.9). Ground ends at z=-300; distant treeline ≈-260; the
// zone stays z ≥ -250, x within ±70 (vehicle clamp ZONE_* below).
import { rectAt } from './colliders';
import type { Floor, RectCollider } from '../types';

// --- Duck pond (west pocket between the blvd and Casitas) ---
export const POND_X = -40;
export const POND_Z = -212;
export const POND_RX = 13; // east-west radius
export const POND_RZ = 10; // north-south radius

// --- Dock (south shore, walks north out over the water) ---
export const DOCK_W = 2.4;
export const DOCK_START_Z = -200.8; // shore end (grass)
export const DOCK_END_Z = -208.5;   // water end
export const DOCK_Y = 0.35;         // plank deck height

// --- Casitas Dr (straight across, north segment + east horseshoe leg) ---
export const CAS_HALF_W = 3.5;
export const CAS_NORTH_X = 0;          // north segment centerline
export const CAS_NORTH_Z0 = -191;      // starts at the blvd sidewalk
export const CAS_NORTH_Z1 = -226;      // corner
export const CAS_EAST_Z = -233;        // east segment centerline
export const CAS_EAST_X0 = 0;          // corner
export const CAS_EAST_X1 = 53;         // meets Parmer west curb

// --- Casitas garden homes (small, dense rows lining the street) ---
export interface GardenHome { x: number; z: number; faceYaw: number; body: string; roof: string; bakery?: boolean }
const HOME_BODIES = ['#e3d6bd', '#d9c8ad', '#cfd6c2', '#e6dcc8', '#d6cdb8', '#dccfae'];
const HOME_ROOFS = ['#6b5b4a', '#5a5a5e', '#75604a', '#62584e'];
export const GARDEN_HOMES: GardenHome[] = [
  // West column (face east toward Casitas).
  ...[-196.5, -203, -209.5, -216, -222.5].map((z, i) => ({
    x: -10, z, faceYaw: -Math.PI / 2,
    body: HOME_BODIES[i % HOME_BODIES.length], roof: HOME_ROOFS[i % HOME_ROOFS.length],
    // The real-life neighborhood home bakery on Casitas.
    bakery: i === 2,
  })),
  // East column (face west toward Casitas).
  ...[-196.5, -203, -209.5, -216].map((z, i) => ({
    x: 10, z, faceYaw: Math.PI / 2,
    body: HOME_BODIES[(i + 3) % HOME_BODIES.length], roof: HOME_ROOFS[(i + 1) % HOME_ROOFS.length],
  })),
  // North of the east leg (face south toward the street).
  ...[16, 26, 36].map((x, i) => ({
    x, z: -241.5, faceYaw: Math.PI,
    body: HOME_BODIES[(i + 1) % HOME_BODIES.length], roof: HOME_ROOFS[(i + 2) % HOME_ROOFS.length],
  })),
];
export const HOME_W = 6.4;  // along the street
export const HOME_D = 5.2;  // depth
export const HOME_H = 3.1;

// --- The Plaza at Avery Ranch (L of shops + parking inside the dogleg) ---
export const LOT_MIN_X = 16;
export const LOT_MAX_X = 44;
export const LOT_MIN_Z = -214; // north edge (deeper)
export const LOT_MAX_Z = -196; // south edge (toward blvd)
export const SHOPS_H = 4.6;
/** Wing A: long strip on the lot's north side, storefronts face SOUTH. */
export const WINGA_MIN_X = 16;
export const WINGA_MAX_X = 44;
export const WINGA_FRONT_Z = -215;  // storefront wall
export const WINGA_BACK_Z = -223.5;
/** Wing B: shorter strip on the lot's east side, storefronts face WEST. */
export const WINGB_FRONT_X = 45;    // storefront wall
export const WINGB_BACK_X = 52;
export const WINGB_MIN_Z = -223.5;
export const WINGB_MAX_Z = -196;
export interface ShopUnit { name: string; sub: string; accent: string; min: number; max: number }
export const WINGA_SHOPS: ShopUnit[] = [
  { name: 'BROOKLYN HEIGHTS', sub: 'PIZZERIA', accent: '#b03a2e', min: 16, max: 23.5 },
  { name: 'BLUE AGAVE', sub: 'TEX MEX', accent: '#2e7a6e', min: 23.5, max: 30.5 },
  { name: 'ORANGE LEAF', sub: 'FROZEN YOGURT', accent: '#e8821e', min: 30.5, max: 37 },
  // The kids asked to actually BUY things at the shopping center — this one
  // really works: mannequins out front, E → the dress-up wardrobe.
  { name: 'PENNY & LUKE\'S', sub: 'KIDS\' BOUTIQUE 🛍️', accent: '#d64a7a', min: 37, max: 44 },
];
/** Woof Gang puppy pen (on the Wing B walkway in front of the south unit). */
export const PEN_X = WINGB_FRONT_X - 2.6;
export const PEN_Z = -200.75;
export const PEN_W = 3.0;
export const PEN_D = 3.4;
/** Where the boutique's "shop outfits" spot + mannequins sit (on the Wing A walkway). */
export const BOUTIQUE_X = 40.5;
export const BOUTIQUE_Z = WINGA_FRONT_Z + 1.9;
// Woof Gang takes the south unit (nearest the lot entrance — it's where the
// adoptable pups will be); the corner slot (hidden behind Wing A's end wall)
// gets Kumon.
export const WINGB_SHOPS: ShopUnit[] = [
  { name: 'KUMON', sub: 'LEARNING CENTER', accent: '#3a8ac4', min: -223.5, max: -214.5 },
  { name: 'HUNAN RANCH', sub: 'CHINESE KITCHEN', accent: '#a8333d', min: -214.5, max: -205.5 },
  { name: 'WOOF GANG', sub: 'DOG BAKERY', accent: '#3a6db0', min: -205.5, max: -196 },
];

// --- Parmer Ln (massive divided road, north-south on the east edge) ---
export const PARMER_CENTER_X = 62;
export const PARMER_MEDIAN_HALF = 2;   // grass median x 60..64
export const PARMER_LANE_W = 7;        // each carriageway
export const PARMER_Z0 = -189.5;       // meets the blvd
export const PARMER_Z1 = -250;

// --- Park furnishings (all in the west pond pocket now) ---
export const PLAYGROUND_X = -58;
export const PLAYGROUND_Z = -210;
export const PICNIC_X = -52;
export const PICNIC_Z = -220;
export const CART_X = -16;   // ice cream cart at the pond path fork
export const CART_Z = -194.5;
export const GOLFCART_X = -24;
export const GOLFCART_Z = -198.5;

// --- Casitas entry monument walls flanking the crosswalk landing ---
export const WALL_Z = -192.2;

// --- Vehicle clamp region for the whole zone (used by PlayerController) ---
export const ZONE_HALF_X = 70;
export const ZONE_MIN_Z = -250;
export const ZONE_MAX_Z = -189;

// Oak ring around the pond + west greenbelt feel.
export const POND_OAKS: { x: number; z: number; s: number }[] = [
  { x: -57, z: -222, s: 1.1 },
  { x: -50, z: -228, s: 0.95 },
  { x: -38, z: -230, s: 1.15 },
  { x: -26, z: -226, s: 1.0 },
  { x: -22, z: -214, s: 0.9 },
  { x: -56, z: -200, s: 1.0 },
  { x: -64, z: -214, s: 1.05 },
  { x: -28, z: -199, s: 0.85 },
];

/** Parking-island oaks inside the Plaza lot. */
export const LOT_OAKS: { x: number; z: number }[] = [
  { x: 23, z: -205 },
  { x: 37, z: -205 },
];

/**
 * Static colliders for the zone: gapless pond water fill (the lesson: piecewise
 * wall rings have thread-able corner gaps), dock rails, garden homes, Plaza
 * wings, entry walls, props, oak trunks.
 */
export function buildAcrossBlvdColliders(): RectCollider[] {
  const out: RectCollider[] = [];

  // Pond rim ring (OBB chords; hop-height) — segment centered at the south
  // axis (i=2) skipped for the dock corridor.
  const SEGS = 8;
  for (let i = 0; i < SEGS; i++) {
    if (i === 2) continue;
    const aMid = (i / SEGS) * Math.PI * 2;
    const ex = Math.cos(aMid) * POND_RX;
    const ez = Math.sin(aMid) * POND_RZ;
    const segLen = (2 * Math.PI * ((POND_RX + POND_RZ) / 2)) / SEGS + 2;
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
  // Shore fills flanking the dock.
  out.push(rectAt(POND_X - 4.4, POND_Z + POND_RZ + 0.2, 6.4, 1, { maxY: 1.2, tag: 'pond-edge' }));
  out.push(rectAt(POND_X + 4.4, POND_Z + POND_RZ + 0.2, 6.4, 1, { maxY: 1.2, tag: 'pond-edge' }));
  // GAPLESS water fill: overlapping low slabs (maxY 0.3 — dock walkers at
  // y=0.35 pass over). Innermost slab stops short of the dock entry ramp.
  const SLABS: [number, number][] = [
    [13, 4], [11, 7], [8, 9], [4.5, 9.3],
  ];
  for (const [hx, hz] of SLABS) {
    out.push(rectAt(POND_X, POND_Z, hx * 2, hz * 2, { maxY: 0.3, tag: 'pond-water' }));
  }

  // Dock rails.
  const railLen = DOCK_START_Z - DOCK_END_Z + 1;
  const railMidZ = (DOCK_START_Z + DOCK_END_Z) / 2;
  out.push(rectAt(POND_X - DOCK_W / 2 - 0.15, railMidZ, 0.3, railLen, { maxY: 1.6, tag: 'dock-rail' }));
  out.push(rectAt(POND_X + DOCK_W / 2 + 0.15, railMidZ, 0.3, railLen, { maxY: 1.6, tag: 'dock-rail' }));
  out.push(rectAt(POND_X, DOCK_END_Z - 0.15, DOCK_W + 0.6, 0.3, { maxY: 1.6, tag: 'dock-rail' }));

  // Garden homes (one box each; faceYaw only flips facade, footprint is AABB
  // because every home is axis-aligned).
  for (const h of GARDEN_HOMES) {
    const alongX = Math.abs(Math.abs(h.faceYaw) - Math.PI / 2) < 0.1; // faces ±X → width along Z
    out.push(rectAt(h.x, h.z, alongX ? HOME_D : HOME_W, alongX ? HOME_W : HOME_D, { maxY: HOME_H + 1, tag: 'casitas-home' }));
  }

  // Plaza wings.
  out.push(rectAt(
    (WINGA_MIN_X + WINGA_MAX_X) / 2, (WINGA_FRONT_Z + WINGA_BACK_Z) / 2,
    WINGA_MAX_X - WINGA_MIN_X, WINGA_FRONT_Z - WINGA_BACK_Z,
    { maxY: SHOPS_H, tag: 'plaza' },
  ));
  out.push(rectAt(
    (WINGB_FRONT_X + WINGB_BACK_X) / 2, (WINGB_MIN_Z + WINGB_MAX_Z) / 2,
    WINGB_BACK_X - WINGB_FRONT_X, WINGB_MAX_Z - WINGB_MIN_Z,
    { maxY: SHOPS_H, tag: 'plaza' },
  ));

  // Casitas entry walls.
  out.push(rectAt(-9, WALL_Z, 6.5, 0.8, { maxY: 1.1, tag: 'entry-wall' }));
  out.push(rectAt(9, WALL_Z, 6.5, 0.8, { maxY: 1.1, tag: 'entry-wall' }));

  // Playground tower, picnic table, ice cream cart.
  out.push(rectAt(PLAYGROUND_X, PLAYGROUND_Z, 2.4, 2.4, { maxY: 2.6, tag: 'playground' }));
  out.push(rectAt(PICNIC_X, PICNIC_Z, 2.4, 1.6, { maxY: 1.0, tag: 'picnic' }));
  out.push(rectAt(CART_X, CART_Z, 1.8, 1.2, { maxY: 1.6, tag: 'icecream-cart' }));

  // Oak trunks (pond ring + parking islands).
  for (const o of POND_OAKS) out.push(rectAt(o.x, o.z, 1.2, 1.2, { maxY: 6, tag: 'zone-oak' }));
  // Woof Gang puppy pen: thin rails (north/south/east) + two west stubs with a gap.
  out.push(rectAt(PEN_X, PEN_Z - PEN_D / 2, PEN_W, 0.12, { maxY: 0.7, tag: 'pen' }));
  out.push(rectAt(PEN_X, PEN_Z + PEN_D / 2, PEN_W, 0.12, { maxY: 0.7, tag: 'pen' }));
  out.push(rectAt(PEN_X + PEN_W / 2, PEN_Z, 0.12, PEN_D, { maxY: 0.7, tag: 'pen' }));
  out.push(rectAt(PEN_X - PEN_W / 2, PEN_Z - PEN_D / 2 + 0.55, 0.12, 1.1, { maxY: 0.7, tag: 'pen' }));
  out.push(rectAt(PEN_X - PEN_W / 2, PEN_Z + PEN_D / 2 - 0.55, 0.12, 1.1, { maxY: 0.7, tag: 'pen' }));
  // Boutique storefront props (three mannequin plinths + a clothes rack).
  for (const dx of [-1.7, 0, 1.7]) out.push(rectAt(BOUTIQUE_X + dx, BOUTIQUE_Z - 1.1, 0.8, 0.8, { maxY: 1.9, tag: 'boutique' }));
  out.push(rectAt(BOUTIQUE_X + 3.2, BOUTIQUE_Z - 0.9, 1.6, 0.5, { maxY: 1.5, tag: 'boutique' }));
  for (const o of LOT_OAKS) out.push(rectAt(o.x, o.z, 1.0, 1.0, { maxY: 6, tag: 'zone-oak' }));

  return out;
}

/** Dock floors (merged into Game.tsx's single setFloors call). */
export function buildAcrossBlvdFloors(): Floor[] {
  return [
    // Entry step ramp: grass up to deck height, climbing north.
    {
      minX: POND_X - DOCK_W / 2,
      maxX: POND_X + DOCK_W / 2,
      minZ: DOCK_START_Z - 1.5,
      maxZ: DOCK_START_Z,
      baseY: 0,
      topY: DOCK_Y,
      axis: 'z',
      invert: true,
    },
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
