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
//   • The houses are NOT surveyed: they are generic new-build homes placed on
//     lots along the real streets. None of them is meant to be anybody's.
//   • What the school building and the houses actually look like could not be
//     researched — the looks here are a plausible guess.
// +X east, +Z south.
import type { RectCollider } from '../types';
import { EAST_STREETS, EAST_PATHS, PONDS, POCKET_PARK, type Street } from './colonyData';
import { RAIL_MID_X } from './westAvery';
import { STATIONS, rampSpan, TRACK_Z_S } from './redLine';
import { rng32 } from './corridor';
import type { Treat } from './domain';

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
  { name: '', w: 6.5, pts: [[-436, 3130], [-436, 3170], [-446, 3181], [-504, 3181], [-514, 3170], [-514, 3127.5]] },
  { name: '', w: 6, pts: [[-290, 3134], [-290, 3120]] },
];
export const STREETS: Street[] = [...EAST_STREETS, ...WEST_STREETS];
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
export const LAKEHOUSE = { x0: -306, x1: -268, z0: 3052, z1: 3074, h: 5.2 };
export const LAKEHOUSE_POOL = { x0: -356, x1: -320, z0: 3048, z1: 3072 };
export const LAKEHOUSE_LOT = { x0: -338, x1: -250, z0: 3086, z1: 3121 };
/** Lakehouse Park, south of the road: playground, pickleball, pump track. */
export const PARK = { x0: -338, x1: -210, z0: 3156, z1: 3262 };
export const PARK_PLAY = { x: -304, z: 3186 };
export const PARK_PAVILION = { x: -268, z: 3200, w: 9, d: 6.5 };
export const PICKLEBALL: { x: number; z: number }[] = [{ x: -238, z: 3183 }, { x: -228, z: 3183 }];
export const PUMP_TRACK = { x: -268, z: 3238, rx: 26, rz: 13 };

/** Colony Oaks Elementary: a two-storey L — the front bar along the road (gym
 *  at the west end), a classroom wing running south from its east end. */
export const SCHOOL = {
  bar: { x0: -548, x1: -452, z0: 3192, z1: 3220, h: 8.8 },
  gym: { x0: -548, x1: -514, z0: 3192, z1: 3228, h: 11 },
  wing: { x0: -482, x1: -452, z0: 3220, z1: 3298, h: 8.6 },
  /** Front doors (they face the road, north). */
  entry: { x: -468, z: 3192 },
  sign: { x: -475, z: 3147 },
  flags: { x: -489, z: 3176 },
  lot: { x0: -432, x1: -366, z0: 3196, z1: 3250 },
  play: { x: -512, z: 3262 },
  shade: { x: -522, z: 3240, w: 16, d: 10 },
  field: { x: -505, z: 3350, rx: 44, rz: 30 },
};

// -------------------------------------------------------------- pocket park --
export const POCKET_PAVILION = { x: 60, z: 3044, w: 8, d: 5 };
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
export const LOT_W = 14.2;
const VERGE = 3.0;      // kerb → back of the sidewalk
const SETBACK = 6.2;    // sidewalk → front wall
export const YARD_BACK = 6.5; // fenced back yard behind the house

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
          const w = 11.2 + Math.floor(rnd() * 3) * 0.6, d = 15 + Math.floor(rnd() * 4) * 1.2;
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
          if (PATHS.some((p) => distToLine(x, z, p) < 10.5)) continue;
          if (out.some((h) => Math.hypot(h.x - x, h.z - z) < LOT_W - 0.4)) continue;
          out.push({
            x, z, ry: Math.atan2(-nx, -nz), w, d,
            storeys: r[0] < 0.42 ? 2 : 1, garage: r[1] < 0.5 ? 1 : -1,
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
  [-430, 3138, 0], [-475, 3186, 0], [-520, 3138, 0],                 // the school
  [-300, 3152, 0], [-225, 3152, 0],                                  // Lakehouse Park
];

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
  rect(SCHOOL.bar, 'colony-school', 12); rect(SCHOOL.gym, 'colony-school', 12); rect(SCHOOL.wing, 'colony-school', 12);
  rect(LAKEHOUSE, 'colony-lakehouse', 7);
  box(SCHOOL.sign.x - 3, SCHOOL.sign.x + 3, SCHOOL.sign.z - 0.5, SCHOOL.sign.z + 0.5, 'colony-sign', 2.4);
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
