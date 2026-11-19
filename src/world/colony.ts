// The Colony, Bastrop — the end of the Red Line. Where the kids' other house
// is: the real street plan around Chinaberry Bend (world/colonyData.ts, from
// OpenStreetMap), with Sam Houston Drive as the spine, the pocket park and
// pool across the road, the two ponds a short walk east — and, on the other
// side of the tracks, the lake, the Lakehouse, Lakehouse Park and Colony Oaks
// Elementary.
//
// True to the real place where it matters, re-arranged where it has to be:
//   • East of the tracks every street, the park and the ponds are where they
//     really are relative to each other, at full size. North is still −Z.
//   • The real school is ~700 m west of Chinaberry Bend. Here that gap is
//     closed up: the (made-up) railway runs through it, the lake / Lakehouse /
//     park / school are laid out west of the line in their real order (lake
//     north of the road, park east of the school, both south of the road).
//   • The houses are NOT surveyed one by one: they are placed on 45-ft lots
//     along the real streets, in the builder's style seen in aerial imagery
//     and published designs (painted brick, steep front gables, charcoal
//     roofs, two single garage doors). None of them is meant to be anybody's.
//   • Colony Oaks Elementary follows the real building: its footprint is
//     traced from aerial imagery (a brick office block, cream classroom wings
//     staggered either side of a glass entry, the gym at the back, lime-green
//     shade sails) and its colours from a photo of the front. The school's
//     colours are navy and green; its mascot is the Cougars.
// +X east, +Z south.
import type { RectCollider } from '../types';
import { EAST_STREETS, EAST_PATHS, PONDS, POCKET_PARK, type Street } from './colonyData';
import { RAIL_MID_X } from './westAvery';
import { STATIONS, rampSpan, TRACK_Z_S } from './redLine';
import { rng32 } from './corridor';
import type { Treat } from './domain';
import { SX, SZ, MASSES, buildColonySchoolColliders } from './colonySchool';
import { buildColonySchoolFurnitureColliders } from './colonySchoolRooms';

export type Pt = [number, number];

/** Everything you can walk to out here is inside this box (a ranch fence). */
export const BOUNDS = { x0: -652, x1: 353, z0: 2903, z1: 3440 };

// ------------------------------------------------------------------ streets --
/** Sam Houston Drive carried on west of the surveyed part: its two
 *  carriageways come together just past the end of the railway and run on to
 *  the school. Plus the school's drop-off loop and the Lakehouse drive. */
const WEST_STREETS: Street[] = [
  { name: 'Sam Houston Drive', w: 7.4, pts: [[-149, 3127], [-180, 3131.5], [-208, 3137]] },
  { name: 'Sam Houston Drive', w: 7.4, pts: [[-149, 3146.5], [-182, 3143], [-208, 3137]] },
  { name: 'Sam Houston Drive', w: 9, pts: [[-208, 3137], [-330, 3134], [-470, 3129], [-652, 3125]] },
  { name: '', w: 6, pts: [[-290, 3134], [-290, 3120]] },
];
export const STREETS: Street[] = [...EAST_STREETS, ...WEST_STREETS];
/** (The school's loop drive is added below, once the school is laid out.) */
export const PATHS: Pt[][] = [
  ...EAST_PATHS,
  // Smokebush Trail ends beside the platform; a path leads round to the plaza.
  [[-149, 3064], [-153, 3078], [-156, 3090]],
];

// ------------------------------------------------------------ station plaza --
const foot = rampSpan(STATIONS.bastrop).z1;
/** Paved square at the end of the line, between the buffer stops and the road. */
export const PLAZA = { x0: -198, x1: -150, z0: foot + 0.5, z1: 3123 };
export const SNOW_CONE = { x: -158, z: 3101 };

// --------------------------------------------------------------- west side --
/** The lake (outline, clockwise from the east shore). */
export const LAKE: Pt[] = [
  [-213, 2960], [-217, 2936], [-236, 2919], [-270, 2912], [-310, 2915], [-345, 2926], [-368, 2948],
  [-373, 2975], [-361, 3000], [-336, 3018], [-300, 3026], [-262, 3022], [-232, 3008], [-217, 2988],
];
export const LAKE_FOUNTAIN = { x: -296, z: 2966 };
export const DOCK = { x: -301, z0: 3004, z1: 3031, w: 3 };
/** The Lakehouse (blue-grey metal roof) with its lap pool to the east. */
export const LAKEHOUSE = { x0: -332, x1: -306, z0: 3050, z1: 3074, h: 5.2 };
export const LAKEHOUSE_POOL = { x0: -284, x1: -270, z0: 3044, z1: 3074 };
export const LAKEHOUSE_LOT = { x0: -338, x1: -250, z0: 3086, z1: 3121 };
/** Lakehouse Park, south of the road: pickleball in the north-west corner, the
 *  looping concrete pump track beside it, the playground to the south. */
export const PARK = { x0: -338, x1: -210, z0: 3156, z1: 3262 };
export const PICKLEBALL: { x: number; z: number }[] = [{ x: -329.5, z: 3187 }, { x: -320.5, z: 3187 }];
export const PUMP_TRACK = { x: -280, z: 3204, rx: 24, rz: 12 };
export const PARK_PLAY = { x: -316, z: 3238 };
export const PARK_PAVILION = { x: -262, z: 3238, w: 9, d: 6.5 };

/** Colony Oaks Elementary. The outline was traced from aerial imagery; what is
 *  inside it follows the district's floor plans (world/colonySchool.ts). */
export interface SchoolBlock { x0: number; x1: number; z0: number; z1: number; h: number; kind: 'brick' | 'cream' }
export const SCHOOL = {
  /** The roofed blocks the building is made of. */
  blocks: MASSES.map((m): SchoolBlock => ({ x0: SX + m.u0, x1: SX + m.u1, z0: SZ + m.v0, z1: SZ + m.v1, h: m.h, kind: m.kind })),
  /** The front doors: a glass wall facing north, between the two wings. */
  entry: { x: SX + 44.4, z: SZ + 18.6, w: 11.2 },
  /** The covered walk along the front of the brick block. */
  walk: { x0: SX + 44, x1: SX + 76, z0: SZ - 4, z1: SZ - 0.5 },
  /** Staff + visitor parking in front, ringed by the drop-off loop. */
  lot: { x0: SX + 8, x1: SX + 110, z0: SZ - 60, z1: SZ - 16 },
  lot2: { x0: SX - 22, x1: SX + 24, z0: SZ + 84, z1: SZ + 108 },
  /** The hard-surface play court behind the gym. */
  court: { x0: SX + 48, x1: SX + 82.7, z0: SZ + 82.7, z1: SZ + 106 },
  /** Lime-green shade sails over the two playgrounds (centre, size). */
  shades: [{ x: SX + 86, z: SZ - 6, s: 16 }, { x: SX - 6, z: SZ + 22, s: 11 }],
  play: { x: SX + 106, z: SZ - 2 },
  sign: { x: SX + 12, z: 3146 },
  flags: { x: SX + 36, z: SZ + 6 },
};
/** The loop drive: in from Sam Houston Drive, along the front, back out. */
const SCHOOL_LOOP: Pt[] = [[SX - 6, 3128], [SX - 6, SZ - 16], [SX + 2, SZ - 8], [SX + 110, SZ - 8], [SX + 118, SZ - 16], [SX + 118, 3131]];

STREETS.push({ name: '', w: 6.5, pts: SCHOOL_LOOP });

// -------------------------------------------------------------- pocket park --
/** The pool's bath-house, on its west side (as in the aerial). */
export const POCKET_PAVILION = { x: 30, z: 3037, w: 7, d: 12 };
export const LEMONADE = { x: 104, z: 3084 };

// ------------------------------------------------------------- geometry kit --
export function distToSeg(px: number, pz: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
export function distToLine(px: number, pz: number, pts: Pt[], closed = false): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSeg(px, pz, pts[i], pts[i + 1]));
  if (closed) d = Math.min(d, distToSeg(px, pz, pts[pts.length - 1], pts[0]));
  return d;
}
export function inPoly(px: number, pz: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function inRect(x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, m = 0): boolean {
  return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
}
/** The x-extent of a closed outline across each `step`-deep slice of z. */
export function polySlices(poly: Pt[], step: number, inset = 0): { x0: number; x1: number; z0: number; z1: number }[] {
  const zs = poly.map((p) => p[1]);
  const zMin = Math.min(...zs), zMax = Math.max(...zs);
  const out: { x0: number; x1: number; z0: number; z1: number }[] = [];
  for (let z = zMin; z < zMax; z += step) {
    const zm = Math.min(zMax, z + step);
    let x0 = Infinity, x1 = -Infinity;
    for (const zz of [z + step * 0.25, z + step * 0.75]) {
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if ((zi > zz) !== (zj > zz)) { const x = ((xj - xi) * (zz - zi)) / (zj - zi) + xi; x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      }
    }
    if (x1 - x0 > inset * 2 + 0.5) out.push({ x0: x0 + inset, x1: x1 - inset, z0: z, z1: zm });
  }
  return out;
}

// ------------------------------------------------------------------- houses --
export interface House {
  x: number; z: number;
  /** three.js yaw: the front (local +Z) faces the street. */
  ry: number;
  /** Width along the street, depth back from it. */
  w: number; d: number;
  storeys: 1 | 2;
  /** Which side the garage is on (−1 = left as you face the house from inside). */
  garage: 1 | -1;
  style: number; roof: number; door: number;
  /** How far the front wall is from the kerb (the driveway's length). */
  drive: number;
  car: number; // −1 = none, else a colour index
  seed: number;
}
const HOUSE_STREETS = new Set([
  'Chinaberry Bend', 'Ironbark Bend', 'Rosemary Court', 'Sweetgum Cove', 'Plumbago Loop', 'Smokebush Trail',
  'George Neggan Lane', 'Isaac Millsaps Trail', 'Claiborne Wright Way',
]);
/** 45-ft lots. */
export const LOT_W = 13.7;
const VERGE = 3.0;      // kerb → back of the sidewalk
const SETBACK = 6.4;    // sidewalk → front wall
export const YARD_BACK = 6; // fenced back yard behind the house

export const HOUSES: House[] = (() => {
  const out: House[] = [];
  const rnd = rng32(71);
  for (const s of STREETS) {
    if (!HOUSE_STREETS.has(s.name)) continue;
    // Walk the street; a lot each side every LOT_W metres.
    let carry = LOT_W * 0.6;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i], b = s.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
      let t = carry;
      for (; t < L; t += LOT_W) {
        for (const side of [1, -1]) {
          // Narrow and deep, a couple of metres apart — as they really are.
          const w = 11.2 + Math.floor(rnd() * 3) * 0.4, d = 19 + Math.floor(rnd() * 4) * 1.2;
          const off = s.w / 2 + VERGE + SETBACK + d / 2;
          const nx = -tz * side, nz = tx * side;
          const x = a[0] + tx * t + nx * off, z = a[1] + tz * t + nz * off;
          const r = [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()];
          // Nothing may be nearer a street than this house is to its own.
          let ok = true;
          for (const o of STREETS) if (distToLine(x, z, o.pts) < off - 0.6 - (o.w < 6 ? 2 : 0)) { ok = false; break; }
          if (!ok) continue;
          if (x < RAIL_MID_X + 26 || !inRect(x, z, BOUNDS, -d / 2 - YARD_BACK - 1)) continue;
          if (inPoly(x, z, POCKET_PARK) || distToLine(x, z, POCKET_PARK, true) < 12) continue;
          if (PONDS.some((p) => inPoly(x, z, p) || distToLine(x, z, p, true) < 20)) continue;
          if (PATHS.some((p) => distToLine(x, z, p) < 8)) continue;
          // (Chinaberry Bend's short north leg has open land on its east side.)
          if (s.name === 'Chinaberry Bend' && x > 116 && z < 3140) continue;
          if (out.some((h) => Math.hypot(h.x - x, h.z - z) < LOT_W - 0.4)) continue;
          out.push({
            x, z, ry: Math.atan2(-nx, -nz), w, d,
            storeys: r[0] < 0.22 ? 2 : 1, garage: r[1] < 0.5 ? 1 : -1,
            style: Math.floor(r[2] * 6), roof: Math.floor(r[3] * 3), door: Math.floor(r[4] * 4),
            drive: VERGE + SETBACK, car: r[5] < 0.45 ? Math.floor(r[5] * 22) : -1, seed: out.length,
          });
        }
      }
      carry = t - L;
    }
  }
  return out;
})();

// ------------------------------------------------------------ treats, lamps --
export const COLONY_TREATS: Treat[] = [
  { id: 'colony-snowcone', label: 'get a snow cone 🍧', emoji: '🍧', x: SNOW_CONE.x - 1.9, z: SNOW_CONE.z },
  { id: 'colony-lemonade', label: 'get lemonade 🍋', emoji: '🍋', x: LEMONADE.x, z: LEMONADE.z + 1.4 },
  { id: 'colony-popsicle', label: 'get a popsicle 🍡', emoji: '🍡', x: LAKEHOUSE.x1 + 1.6, z: LAKEHOUSE.z1 - 5 },
];

/** Acorn lamp posts (x, z, yaw) for the shared StreetLamps rig. */
export const COLONY_LAMPS: [number, number, number][] = [
  [PLAZA.x0 + 2, PLAZA.z0 + 6, 0], [PLAZA.x1 - 2, PLAZA.z1 - 6, 0],
  [101, 3079, 0], [112, 3118, 0], [78, 3154, 0], [28, 3186, 0],       // Chinaberry Bend
  [-52, 3128, 0], [-20, 3190, 0],                                    // Ironbark Bend
  [10, 3066, 0], [58, 3068, 0],                                      // the pocket park
  [-290, 3126, 0], [-262, 3080, 0],                                  // the Lakehouse
  [SX + 20, SZ - 12, 0], [SX + 33, SZ + 2, 0], [SX + 96, SZ - 12, 0],  // the school
  [-300, 3152, 0], [-225, 3152, 0],                                  // Lakehouse Park
];
// …and a tall street light about every 36 m down every street, on alternating sides, at
// the lot lines (never across a driveway) — so the whole neighbourhood is lit
// after dark, not just the corners.
/** Tall cobra-head street lights (x, z, yaw): one about every 36 m. */
export const COLONY_STREET_LAMPS: [number, number, number][] = [];
(() => {
  const SPACING = 36;
  let side = 1;
  for (const st of STREETS) {
    if (!st.name) continue;   // (the school's loop drive has its own)
    let since = SPACING * 0.5;
    for (let i = 0; i < st.pts.length - 1; i++) {
      const a = st.pts[i], b = st.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.1) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (let t = 0; t < L; t += 3) {
        since += 3;
        if (since < SPACING) continue;
        const off = st.w / 2 + 1.1;
        const x = a[0] + ux * t - uz * off * side, z = a[1] + uz * t + ux * off * side;
        if (x < BOUNDS.x0 + 4 || x > BOUNDS.x1 - 4 || z < BOUNDS.z0 + 4 || z > BOUNDS.z1 - 4) continue;
        if (Math.abs(x - RAIL_MID_X) < 16) continue;
        // Keep clear of driveways: only at a lot line of the nearest house.
        let near: House | null = null, nd = 26;
        for (const h of HOUSES) { const d = Math.hypot(h.x - x, h.z - z); if (d < nd) { nd = d; near = h; } }
        if (near && Math.abs((x - near.x) * Math.cos(near.ry) - (z - near.z) * Math.sin(near.ry)) < LOT_W / 2 - 1.3) continue;
        if (COLONY_LAMPS.some((l) => Math.hypot(l[0] - x, l[1] - z) < 14) || COLONY_STREET_LAMPS.some((l) => Math.hypot(l[0] - x, l[1] - z) < 24)) continue;
        COLONY_STREET_LAMPS.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.atan2(-uz * side, ux * side)]);
        since = 0; side = -side;
      }
    }
  }
})();

// ---------------------------------------------------------------- colliders --
export function buildColonyColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const box = (minX: number, maxX: number, minZ: number, maxZ: number, tag: string, maxY = 6) =>
    out.push({ minX, maxX, minZ, maxZ, minY: 0, maxY, tag });
  const rect = (r: { x0: number; x1: number; z0: number; z1: number }, tag: string, maxY = 6) => box(r.x0, r.x1, r.z0, r.z1, tag, maxY);
  // Each lot from the front wall back to the back fence: one turned box.
  for (const h of HOUSES) {
    const depth = h.d + YARD_BACK, back = (YARD_BACK) / 2; // box centre sits behind the house centre
    const cx = h.x - Math.sin(h.ry) * back, cz = h.z - Math.cos(h.ry) * back;
    out.push({ minX: cx - LOT_W / 2 + 0.5, maxX: cx + LOT_W / 2 - 0.5, minZ: cz - depth / 2, maxZ: cz + depth / 2, minY: 0, maxY: 9, yaw: -h.ry, tag: 'colony-house' });
  }
  // Water you can't walk into (the pools are for wading — no colliders).
  for (const p of [...PONDS, LAKE]) for (const s of polySlices(p, 5, 0.6)) rect(s, 'colony-water', 3);
  // The school, the Lakehouse, the pavilions' posts stay walk-through.
  out.push(...buildColonySchoolColliders(), ...buildColonySchoolFurnitureColliders());
  rect(LAKEHOUSE, 'colony-lakehouse', 7);
  box(SCHOOL.sign.x - 3.4, SCHOOL.sign.x + 3.4, SCHOOL.sign.z - 0.6, SCHOOL.sign.z + 0.6, 'colony-sign', 2.6);
  box(POCKET_PAVILION.x - POCKET_PAVILION.w / 2, POCKET_PAVILION.x + POCKET_PAVILION.w / 2, POCKET_PAVILION.z - POCKET_PAVILION.d / 2, POCKET_PAVILION.z + POCKET_PAVILION.d / 2, 'colony-bathhouse', 5);
  box(SNOW_CONE.x - 1.1, SNOW_CONE.x + 1.1, SNOW_CONE.z - 1.6, SNOW_CONE.z + 1.6, 'colony-cart', 3);
  box(LEMONADE.x - 1, LEMONADE.x + 1, LEMONADE.z - 0.5, LEMONADE.z + 0.5, 'colony-stand', 1.2);
  // Fences either side of the railway, down to the plaza.
  box(RAIL_MID_X + 12.9, RAIL_MID_X + 13.1, BOUNDS.z0, 3060, 'colony-railfence', 2);
  box(RAIL_MID_X - 13.1, RAIL_MID_X - 12.9, BOUNDS.z0, TRACK_Z_S + 4, 'colony-railfence', 2);
  // The ranch fence round the edge (a gap where the railway comes in).
  const B = BOUNDS, t = 0.15;
  box(B.x0, RAIL_MID_X - 13, B.z0 - t, B.z0 + t, 'colony-edge', 2.2);
  box(RAIL_MID_X + 13, B.x1, B.z0 - t, B.z0 + t, 'colony-edge', 2.2);
  box(B.x0, B.x1, B.z1 - t, B.z1 + t, 'colony-edge', 2.2);
  box(B.x0 - t, B.x0 + t, B.z0, B.z1, 'colony-edge', 2.2);
  box(B.x1 - t, B.x1 + t, B.z0, B.z1, 'colony-edge', 2.2);
  return out;
}
