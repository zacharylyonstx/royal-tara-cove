// West Avery Ranch — the map expansion, laid out from real geography.
//
// Sources (OpenStreetMap + USGS elevation, sampled around the Royal Tara Cove /
// Avery Ranch Blvd junction, then compressed ≈5:1 like the rest of the game so
// ADJACENCY and ORDER are true even though distances are short):
//   • A creek runs north behind Royal Tara's west-side lots, passes under the
//     boulevard just west of the junction and feeds the duck pond, then carries
//     on north toward South Brushy Creek / Brushy Creek Lake.
//   • Heading west on Avery Ranch Blvd you cross the MetroRail Red Line at
//     grade (with the Red Line Trail beside it), then reach Staked Plains Dr
//     and Rutledge Elementary (Leander ISD) — the real neighbourhood school.
//   • Avery Ranch's HOA pools dot the neighbourhood; one sits where the game's
//     first pretend school used to be, next to the pond playground.
//   • Terrain: the junction sits in the creek's shallow valley (263 m); the
//     boulevard climbs ~6 m both ways, Rutledge is on a rise (277 m), and the
//     land falls ~18 m to Brushy Creek Lake in the north. Royal Tara itself
//     climbs only ~3 m (1.5 %) from the boulevard to the bulb — so the play
//     surface stays flat and the relief lives in the horizon (TerrainBackdrop).
//
// All coordinates are WORLD (+X east, −Z north, y up). Layout source of truth
// for zone/WestAvery.tsx, the colliders, wading, and the vehicle drive regions.
import { rectAt } from './colliders';
import type { RectCollider } from '../types';

// Mirrors of world/acrossBlvd.ts values. Duplicated on purpose: acrossBlvd
// imports THIS module (to merge colliders), so importing back would be a cycle
// (and a load-order crash). acrossBlvd.ts checks they still match in DEV.
export const WEST_BLVD_Z = -183.5;
export const POND_X = -40, POND_Z = -212, POND_RX = 13, POND_RZ = 10;

// ------------------------------------------------------------------- rail --
// The MetroRail Red Line. Two tracks, 8.2 m apart, so each station can be an
// island platform between them (as the real Howard station is). The trains,
// stations and timetable live in world/redLine.ts.
export const RAIL_X = -178;          // west track centreline (runs north–south)
export const RAIL_X_B = RAIL_X + 8.2; // east track
export const RAIL_MID_X = (RAIL_X + RAIL_X_B) / 2;
export const RAIL_Z_N = -330;
export const RAIL_BED_W = 3.6;
/** Crossing gates stand this far outside the outer tracks on the boulevard. */
export const GATE_DX = 5.2;
export const GATE_X_W = RAIL_X - GATE_DX;
export const GATE_X_E = RAIL_X_B + GATE_DX;
/** Red Line Trail: the hike-and-bike path that shadows the tracks (east side). */
export const RAIL_TRAIL_X = RAIL_X_B + 8.4;
export const RAIL_TRAIL_Z_S = -92;   // meets the greenbelt connector
export const RAIL_TRAIL_Z_N = -176;  // meets the boulevard sidewalk
export const TRAIL_W = 2.6;

// ----------------------------------------------------------------- campus --
// Rutledge Elementary. The enterable building is the game's original school
// (world/school.ts), moved here and re-roofed; these are the pieces around it.
// Real plan (aerial): two long parallel wings with silver standing-seam gable
// roofs joined by a flat-roofed connector, a row of white portables along the
// back, blue shade pavilions by the playground, a grass field with a walking
// track and an oak grove, parking in front.
export const CAMPUS = {
  /** Second classroom wing (facade), north of and parallel to the main one. */
  wingB: { minX: -262, maxX: -232, minZ: -230, maxZ: -221 },
  /** Flat-roofed connector between the two wings. */
  link: { minX: -251, maxX: -243, minZ: -221, maxZ: -215 },
  /** Portable classrooms behind wing B. */
  portables: [-258.5, -250.5, -242.5, -234.5].map((x) => ({ x, z: -237.5, w: 6.6, d: 3.2 })),
  /** Front parking lot (between the boulevard and the school). */
  lot: { minX: -259, maxX: -238, minZ: -199.2, maxZ: -191.6 },
  /** Marquee sign at the driveway mouth. */
  marquee: { x: -224.2, z: -191.2 },
  /** Recess: playground + pavilions + court + field, east of Staked Plains Dr. */
  playground: { x: -214, z: -204 },
  pavilions: [{ x: -218.5, z: -213.5 }, { x: -209, z: -196.5 }],
  court: { x: -200, z: -200, w: 9, d: 14 },
  field: { x: -203, z: -226, rx: 15, rz: 9.5 },
  oaks: [[-190, -214], [-188.5, -221], [-193, -236.5], [-216, -238], [-224, -231], [-264, -205], [-266, -224]] as [number, number][],
};

// ------------------------------------------------------------------- pool --
// Avery Ranch neighbourhood pool, on the first school's old plot by the pond park.
export const POOL = {
  deck: { minX: -88, maxX: -66, minZ: -215, maxZ: -201 },
  water: { minX: -84, maxX: -71, minZ: -212.2, maxZ: -204.2 },
  /** Gate gaps in the fence (centre + half-width). */
  gateEastZ: -208, gateSouthX: -77, gateHalf: 1.1,
  house: { x: -86.2, z: -202.6, w: 3.2, d: 2.6 },
  depth: -0.62,
};

// ------------------------------------------------------------------ creek --
/** Creek centreline, south → north (it flows north, into and out of the pond). */
export const CREEK_SOUTH: [number, number][] = [
  [-58, 26], [-55, 4], [-56.5, -22], [-53.5, -52], [-56, -86], [-54, -118], [-56.5, -150], [-51, -172],
  [-49, -177], [-49, -190.5], [-46, -197], [-43, -202.5],
];
export const CREEK_NORTH: [number, number][] = [
  [-38, -221.5], [-35, -232], [-37.5, -246], [-33, -262], [-35, -280], [-31, -298],
];
export const CREEK_HALF_W = 1.25;
export const CREEK_DEPTH = -0.26;
/** Where the creek ducks under the boulevard (a culvert — no water shown). */
export const CULVERT_Z0 = -176.5;
export const CULVERT_Z1 = -191;

/** Greenbelt trail (decomposed granite), east bank of the creek. */
export const GREEN_TRAIL: [number, number][] = [
  [-47.5, 16], [-47.5, -20], [-47, -60], [-48, -92], [-47.5, -130], [-46.5, -160], [-45.5, -175.5],
];
/** Connector from the greenbelt trail over a footbridge to the Red Line Trail. */
export const CONNECTOR_Z = -92;
export const BRIDGE_X0 = -59.5;
export const BRIDGE_X1 = -50.5;
export const BRIDGE_Y = 0.16; // nearly flush, so bikes roll straight over
/** North trail from the pond park up the creek to the Brushy Creek trailhead. */
export const NORTH_TRAIL: [number, number][] = [
  [-29, -223], [-28.5, -240], [-30.5, -258], [-27, -276], [-26.5, -291],
];
export const TRAILHEAD = { x: -26.5, z: -293 };

// ------------------------------------------------------------- wading ------

function distToPolyline(x: number, z: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const vx = bx - ax, vz = bz - az;
    const l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)) : 0;
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
    if (d < best) best = d;
  }
  return best;
}

/**
 * How deep the water is under (x, z): 0 on dry land, negative = you sink that
 * far (shin-deep creek, waist-deep pool). One answer for the player controller.
 */
export function wadeDepthAt(x: number, z: number): number {
  const pdx = (x - POND_X) / POND_RX, pdz = (z - POND_Z) / POND_RZ;
  if (pdx * pdx + pdz * pdz < 1) return -0.32;
  const w = POOL.water;
  if (x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ) return POOL.depth;
  if (x < -25 && x > -64) {
    if (z < CULVERT_Z0 && z > CULVERT_Z1) return 0; // under the road
    if (z > -210 && distToPolyline(x, z, CREEK_SOUTH) < CREEK_HALF_W) return CREEK_DEPTH;
    if (z < -215 && distToPolyline(x, z, CREEK_NORTH) < CREEK_HALF_W) return CREEK_DEPTH;
  }
  return 0;
}

// ---------------------------------------------------------- drive regions --
// Where bikes / cars / the golf cart may go. Data, not code: adding a road is
// one line. (Walkers go anywhere; colliders alone stop them.)
export type DriveRegion =
  | { kind: 'rect'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number };

export const WEST_DRIVE_REGIONS: DriveRegion[] = [
  // Boulevard, all the way west to the turnaround past the school.
  { kind: 'rect', minX: -276, maxX: -70, minZ: WEST_BLVD_Z - 9, maxZ: WEST_BLVD_Z + 9 },
  // Staked Plains Dr + the school's front apron and parking lot.
  { kind: 'rect', minX: -262, maxX: -222, minZ: -216, maxZ: -187 },
  // Red Line Trail and the greenbelt connector (bikes!).
  { kind: 'rect', minX: RAIL_TRAIL_X - 3, maxX: RAIL_TRAIL_X + 3, minZ: RAIL_TRAIL_Z_N - 2, maxZ: RAIL_TRAIL_Z_S + 3 },
  { kind: 'rect', minX: RAIL_TRAIL_X - 3, maxX: -44, minZ: CONNECTOR_Z - 3, maxZ: CONNECTOR_Z + 3 },
  // Greenbelt trail behind Royal Tara's west side, and the trail north of the pond.
  { kind: 'rect', minX: -51, maxX: -43, minZ: -178, maxZ: 20 },
  { kind: 'rect', minX: -33, maxX: -23, minZ: -296, maxZ: -221 },
  // School recess field side (so a bike can reach the playground).
  { kind: 'rect', minX: -226, maxX: -186, minZ: -240, maxZ: -192 },
];

// --------------------------------------------------------------- colliders --

export function buildWestAveryColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const box = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, maxY: number, tag: string) =>
    out.push({ ...r, minY: 0, maxY, tag });

  // Campus: second wing, connector, portables, pavilion posts, marquee, oaks.
  box(CAMPUS.wingB, 6, 'campus-wing');
  box(CAMPUS.link, 4.5, 'campus-link');
  for (const p of CAMPUS.portables) out.push(rectAt(p.x, p.z, p.w, p.d, { maxY: 3.4, tag: 'campus-portable' }));
  for (const pv of CAMPUS.pavilions) {
    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
      out.push(rectAt(pv.x + dx, pv.z + dz, 0.3, 0.3, { maxY: 3.2, tag: 'campus-post' }));
    }
  }
  out.push(rectAt(CAMPUS.marquee.x, CAMPUS.marquee.z, 3.4, 0.7, { maxY: 2.4, tag: 'campus-marquee' }));
  out.push(rectAt(CAMPUS.playground.x, CAMPUS.playground.z, 4.4, 3.2, { maxY: 3.2, tag: 'campus-playset' }));
  // Basketball goal posts at both ends of the court.
  out.push(rectAt(CAMPUS.court.x, CAMPUS.court.z - CAMPUS.court.d / 2 - 0.4, 0.3, 0.3, { maxY: 3.6, tag: 'campus-goal' }));
  out.push(rectAt(CAMPUS.court.x, CAMPUS.court.z + CAMPUS.court.d / 2 + 0.4, 0.3, 0.3, { maxY: 3.6, tag: 'campus-goal' }));
  for (const [x, z] of CAMPUS.oaks) out.push(rectAt(x, z, 0.9, 0.9, { maxY: 6, tag: 'campus-oak' }));

  // Rail crossing: signal masts (the gates themselves are dynamic — WestAvery.tsx).
  for (const sx of [-1, 1]) {
    out.push(rectAt(sx < 0 ? GATE_X_W : GATE_X_E, WEST_BLVD_Z + sx * 7.6, 0.4, 0.4, { maxY: 4.2, tag: 'rail-mast' }));
  }

  // Crossing gates: barriers across the ROADWAY that only exist while a train
  // is due (systems/RailController flips `passable` off when the bells start).
  // The sidewalks stay open so nobody on foot is ever trapped on the tracks.
  for (const sx of [-1, 1]) {
    out.push({ ...rectAt(sx < 0 ? GATE_X_W : GATE_X_E, WEST_BLVD_Z, 0.3, 12.4, { maxY: 1.6, tag: 'rail-gate' }), passable: true });
  }

  // Pool: fence (with two gate gaps), pool house; the water itself only stops
  // vehicles + dogs (same 'pond-water' tag the duck pond uses — walkers wade in).
  const d = POOL.deck, T = 0.14, H = 1.4;
  out.push(rectAt((d.minX + d.maxX) / 2, d.minZ, d.maxX - d.minX, T, { maxY: H, tag: 'pool-fence' }));
  out.push(rectAt(d.minX, (d.minZ + d.maxZ) / 2, T, d.maxZ - d.minZ, { maxY: H, tag: 'pool-fence' }));
  const seg = (a: number, b: number, fixed: number, alongX: boolean) => {
    if (b - a < 0.05) return;
    out.push(alongX
      ? rectAt((a + b) / 2, fixed, b - a, T, { maxY: H, tag: 'pool-fence' })
      : rectAt(fixed, (a + b) / 2, T, b - a, { maxY: H, tag: 'pool-fence' }));
  };
  seg(d.minX, POOL.gateSouthX - POOL.gateHalf, d.maxZ, true);
  seg(POOL.gateSouthX + POOL.gateHalf, d.maxX, d.maxZ, true);
  seg(d.minZ, POOL.gateEastZ - POOL.gateHalf, d.maxX, false);
  seg(POOL.gateEastZ + POOL.gateHalf, d.maxZ, d.maxX, false);
  out.push(rectAt(POOL.house.x, POOL.house.z, POOL.house.w, POOL.house.d, { maxY: 3, tag: 'pool-house' }));
  out.push({ ...POOL.water, minY: 0, maxY: 0.3, tag: 'pond-water' });

  // Footbridge rails (you walk the deck between them) + the trailhead sign.
  out.push(rectAt((BRIDGE_X0 + BRIDGE_X1) / 2, CONNECTOR_Z - 1.15, BRIDGE_X1 - BRIDGE_X0, 0.12, { minY: 0, maxY: 1.5, tag: 'bridge-rail' }));
  out.push(rectAt((BRIDGE_X0 + BRIDGE_X1) / 2, CONNECTOR_Z + 1.15, BRIDGE_X1 - BRIDGE_X0, 0.12, { minY: 0, maxY: 1.5, tag: 'bridge-rail' }));
  out.push(rectAt(TRAILHEAD.x + 2.2, TRAILHEAD.z, 0.3, 1.8, { maxY: 2.2, tag: 'trailhead-sign' }));
  return out;
}

/** Walkable deck of the footbridge (merged into Game.tsx's single setFloors call). */
export function buildWestAveryFloors() {
  const ramp = 1.6;
  return [
    { minX: BRIDGE_X0 - ramp, maxX: BRIDGE_X0, minZ: CONNECTOR_Z - 1.1, maxZ: CONNECTOR_Z + 1.1, baseY: 0, topY: BRIDGE_Y, axis: 'x' as const },
    { minX: BRIDGE_X0, maxX: BRIDGE_X1, minZ: CONNECTOR_Z - 1.1, maxZ: CONNECTOR_Z + 1.1, baseY: BRIDGE_Y, topY: BRIDGE_Y },
    { minX: BRIDGE_X1, maxX: BRIDGE_X1 + ramp, minZ: CONNECTOR_Z - 1.1, maxZ: CONNECTOR_Z + 1.1, baseY: 0, topY: BRIDGE_Y, axis: 'x' as const, invert: true },
  ];
}
