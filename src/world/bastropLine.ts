// What you see out of the window between Downtown Austin and Bastrop — the
// made-up Red Line extension (see world/redLine.ts). Layout shared by the
// scenery (components/rail/BastropLine.tsx) and collision. North → south:
// Lady Bird Lake, south-east Austin, TX-71 running alongside, the airport,
// the SH-130 toll road overhead, longhorn prairie, the pecan farm with the
// giant squirrel, the Lost Pines and the Colorado River.
// +X east, +Z south; the two tracks straddle MID. Everything here is planted
// on the visible ground (terrain.groundHeight); you can only walk at y = 0.
import type { RectCollider } from '../types';
import { groundHeight } from './terrain';
import { MID, CLEAR } from './corridor';
import { LAKE_Z, AIRPORT_Z, SH130_Z, FM_ROAD_Z, SQUIRREL_Z, PINES_Z, RIVER_Z } from './redLine';

export interface Rect { x0: number; x1: number; z0: number; z1: number }
const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });

/** The stretch this module owns. */
export const LINE_Z0 = 1626;
export const LINE_Z1 = 2890;
/** It is built (and culled) a section at a time: [name, z0, z1]. */
export const SECTIONS: [string, number, number][] = [
  ['lake', LINE_Z0, 1722],
  ['south-austin', 1722, 1846],
  ['airport', 1846, 2100],
  ['prairie', 2100, 2292],
  ['pecan-farm', 2292, 2440],
  ['pines-north', 2440, 2615],
  ['pines-south', 2615, 2790],
  ['river', 2790, LINE_Z1],
];

// ------------------------------------------------------------------ water --
/** Water surfaces under the two long rail bridges. `rim` = how far back from
 *  the span the bank fence stands. */
export const LAKE = { z0: LAKE_Z[0], z1: LAKE_Z[1], y: -0.9, x0: -700, x1: 190, rim: 1.4 };
export const RIVER = { z0: RIVER_Z[0], z1: RIVER_Z[1], y: -1.6, x0: -960, x1: 720, rim: 2.5 };

/** The arched Congress Avenue bridge, a silhouette west of the rail bridge. */
export const CONGRESS = { x: MID - 150, half: 5.5, y: 3.4 };
/** Bastrop's old iron bridge (three truss spans), east of the rail bridge. */
export const OLD_BRIDGE = { x: MID + 70, half: 3.6, y: 1.7 };

export type BoatKind = 'kayak' | 'sup' | 'shell' | 'jon';
export interface Boat { kind: BoatKind; x: number; z: number; ry: number; color: string }
/** Empty boats on the water (static). `ry` turns the bow away from +Z. */
export const LAKE_BOATS: Boat[] = [
  { kind: 'kayak', x: MID + 22, z: 1662, ry: 0.5, color: '#d7372f' },
  { kind: 'kayak', x: MID + 27, z: 1668, ry: 0.9, color: '#f0b429' },
  { kind: 'kayak', x: MID - 24, z: 1684, ry: -0.4, color: '#2aa5a0' },
  { kind: 'kayak', x: MID - 46, z: 1668, ry: 1.2, color: '#f08a24' },
  { kind: 'kayak', x: MID + 70, z: 1700, ry: 1.0, color: '#7a4fb5' },
  { kind: 'kayak', x: MID - 82, z: 1656, ry: 0.3, color: '#3fae6a' },
  { kind: 'sup', x: MID + 40, z: 1690, ry: 0.2, color: '#f4f1e6' },
  { kind: 'sup', x: MID - 30, z: 1702, ry: 1.4, color: '#7fd0e0' },
  { kind: 'sup', x: MID + 58, z: 1655, ry: -0.7, color: '#f6c8d8' },
  { kind: 'shell', x: MID - 62, z: 1692, ry: Math.PI / 2, color: '#f4f1e6' },
];
export const RIVER_BOATS: Boat[] = [
  { kind: 'jon', x: MID + 26, z: 2836, ry: 1.3, color: '#5f6b4a' },
  { kind: 'kayak', x: MID - 22, z: 2828, ry: 0.4, color: '#f08a24' },
  { kind: 'kayak', x: MID - 30, z: 2846, ry: 1.9, color: '#d7372f' },
];

// ------------------------------------------------------------------ TX-71 --
/** The four-lane highway that races the train down the east side. It swings
 *  in from the east at the north end and away behind the pines at the south. */
export const TX71 = {
  x: -122, z0: 1765, z1: 2785, bendN: 1835, bendS: 2700,
  /** Centre of each carriageway, and of each lane, out from the median. */
  carriage: 7.5, lanes: [5.7, 9.3] as [number, number],
  /** Half-width of everything it occupies (keep trees out of this). */
  half: 15,
};
/** Centreline x of the highway at z. */
export function tx71X(z: number): number {
  if (z < TX71.bendN) {
    const s = (TX71.bendN - Math.max(z, TX71.z0)) / (TX71.bendN - TX71.z0);
    return TX71.x + 40 * s * s;
  }
  if (z > TX71.bendS) {
    const s = (Math.min(z, TX71.z1) - TX71.bendS) / (TX71.z1 - TX71.bendS);
    return TX71.x + 50 * s * s;
  }
  return TX71.x;
}
const TX71_STEP = 5;
let tx71Table: Float32Array | null = null;
function tx71Heights(): Float32Array {
  if (tx71Table) return tx71Table;
  const n = Math.round((TX71.z1 - TX71.z0) / TX71_STEP) + 1;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const z = TX71.z0 + i * TX71_STEP, x = tx71X(z);
    let h = -99;
    for (const o of [-13, -6.5, 0, 6.5, 13]) h = Math.max(h, groundHeight(x + o, z));
    raw[i] = h + 0.4;
  }
  // The roadbed is graded: never below the land, never steeper than 8 %
  // (it rides up on fill where the land dips), and eased at the crests.
  const fall = 0.08 * TX71_STEP;
  for (let i = 1; i < n; i++) raw[i] = Math.max(raw[i], raw[i - 1] - fall);
  for (let i = n - 2; i >= 0; i--) raw[i] = Math.max(raw[i], raw[i + 1] - fall);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, k = 0;
    for (let j = -2; j <= 2; j++) { const q = i + j; if (q >= 0 && q < n) { s += raw[q]; k++; } }
    out[i] = Math.max(s / k, raw[i] - 0.2);
  }
  tx71Table = out;
  return out;
}
/** Height of the road surface at z (it rides a low embankment over the land). */
export function tx71Y(z: number): number {
  const t = tx71Heights();
  const f = Math.max(0, Math.min(t.length - 1.001, (z - TX71.z0) / TX71_STEP));
  const i = Math.floor(f);
  return t[i] + (t[i + 1] - t[i]) * (f - i);
}

// ---------------------------------------------------------------- airport --
/** On the flat pad east of the highway (x −150..190, z 1846..2014). */
export const AIRPORT = {
  tower: { x: -90, z: AIRPORT_Z - 66, half: 4.5 },
  garage: rect(-58, -30, AIRPORT_Z - 78, AIRPORT_Z - 56),
  terminal: rect(-60, -36, AIRPORT_Z - 46, AIRPORT_Z + 34),
  apron: rect(-101, -60, AIRPORT_Z - 52, AIRPORT_Z + 46),
  /** Parked airliners (z of each): noses south, side-on to the railway. */
  gateX: -76,
  gates: [AIRPORT_Z - 35, AIRPORT_Z - 5, AIRPORT_Z + 25],
  /** The runway runs east–west, so the jet climbs out across the tracks. */
  runway: { z: AIRPORT_Z + 60, half: 10, x0: -98, x1: 190 },
  hangar: rect(18, 62, AIRPORT_Z - 42, AIRPORT_Z + 10),
  /** Air-cargo sheds on the west side of the line. */
  cargo: [rect(-244, -208, AIRPORT_Z - 52, AIRPORT_Z - 2), rect(-256, -220, AIRPORT_Z + 16, AIRPORT_Z + 66)],
};
/** One jet takes off this often (seconds). */
export const JET_PERIOD_S = 40;

/** The SH-130 toll road on its viaduct: `y` is the top of the deck. */
export const SH130 = {
  z0: SH130_Z - 9, z1: SH130_Z + 9, slab: 1.4,
  y: Math.max(9.4, Math.ceil((tx71Y(SH130_Z) + 7.2) * 2) / 2),
};

// ---------------------------------------------------------------- prairie --
export const FM_ROAD = { z: FM_ROAD_Z, w: 9 };
export const PRAIRIE = {
  barn: rect(-247, -233, 2131, 2149),
  silo: { x: -240, z: 2124, r: 2.6 },
  windmill: { x: MID - 34, z: 2176, hub: 10.4 },
  tanks: [{ x: MID - 41, z: 2181, r: 2.4 }, { x: MID + 26, z: 2206, r: 2.2 }],
  /** The huge, plain, low silver factory far out to the east. */
  factory: rect(-30, 150, 2116, 2204),
};

// ------------------------------------------------------------- pecan farm --
export const FARM = {
  barn: rect(-240, -222, SQUIRREL_Z + 6, SQUIRREL_Z + 32),
  lot: rect(-220, -201, SQUIRREL_Z + 8, SQUIRREL_Z + 34),
  kiosk: rect(-205.2, -202.4, SQUIRREL_Z + 3.4, SQUIRREL_Z + 6.6),
  /** The statue: sits facing the track (+X) on a low deck. `height` is the
   *  squirrel itself, ear tips above the deck. */
  squirrel: { x: MID - 20.5, z: SQUIRREL_Z, height: 4.3, plinth: { w: 4.8, d: 4.0, h: 0.5 } },
  /** The little sign stands low, in front of the deck. */
  sign: { x: MID - 17.2, z: SQUIRREL_Z, w: 5.6 },
  /** Orchard trees, in rows that open up as the train passes. */
  orchard: ((): [number, number][] => {
    const out: [number, number][] = [];
    for (const z of [2302, 2314, 2326]) for (let x = -192; x >= -296; x -= 13) out.push([x, z]);
    for (const z of [2338, 2350, 2362, 2374]) for (let x = -254; x >= -296; x -= 14) out.push([x, z]);
    for (let x = -192; x >= -244; x -= 13) out.push([x, 2380.5]);
    for (let z = 2302; z <= 2380; z += 13) out.push([MID + 22, z]);
    return out;
  })(),
};

// ------------------------------------------------------------------ pines --
export const PINES = {
  z0: PINES_Z[0] - 6, z1: PINES_Z[1] + 30,
  sign: { x: MID - 17, z: PINES_Z[0] + 6, ry: 2.1, w: 9 },
  cabins: [
    { x: MID - 33, z: 2530, w: 7, d: 5.6 },
    { x: MID - 46, z: 2672, w: 7.6, d: 6 },
  ],
  lookout: { x: MID - 62, z: 2604, half: 2.4, h: 24 },
  camp: { x: MID - 23, z: 2694 },
};
export const RIVER_SIGN = { x: MID - 16, z: RIVER_Z[0] - 8, ry: 2.1, w: 8 };

// ------------------------------------------------------- south-east Austin --
export interface Block { r: Rect; floors: number; wall: string; trim: string; face: 1 | -1 }
/** Apartment blocks; `face` = which x side looks at the railway. */
export const BLOCKS: Block[] = [
  { r: rect(-226, -204, 1734, 1762), floors: 6, wall: '#d8cdb9', trim: '#8a8172', face: 1 },
  { r: rect(-292, -264, 1740, 1776), floors: 7, wall: '#b9c2c9', trim: '#6f7a84', face: 1 },
  { r: rect(-146, -124, 1731, 1757), floors: 5, wall: '#c9a98a', trim: '#7a6450', face: -1 },
  { r: rect(-118, -92, 1736, 1760), floors: 7, wall: '#aeb6ae', trim: '#6c756e', face: -1 },
  { r: rect(-236, -216, 1800, 1822), floors: 2, wall: '#d9b38c', trim: '#7d5f48', face: 1 },
  { r: rect(-272, -248, 1790, 1814), floors: 3, wall: '#c8d0c4', trim: '#6f7a6c', face: 1 },
];
export interface Taqueria { r: Rect; face: 1 | -1; name: string; wall: string; accent: string }
export const TAQUERIAS: Taqueria[] = [
  { r: rect(-212, -198, 1778, 1792), face: 1, name: 'EL TRENECITO\nTACOS', wall: '#2aa5a0', accent: '#f0b429' },
  { r: rect(-152, -141, 1769, 1782), face: -1, name: 'TACO COMETA', wall: '#e86a92', accent: '#f4efe6' },
];
/** Little houses: [x, z, which side faces the track]. */
export const BUNGALOWS: [number, number, 1 | -1][] = [
  [-204, 1830, 1], [-206, 1843, 1], [-232, 1836, 1],
  [-146.5, 1797, -1], [-146.5, 1811, -1], [-146.5, 1825, -1],
];

// --------------------------------------------------------------- planting --
/** Footprints nothing is scattered into (buildings, lots, the airfield…). */
const RESERVED: Rect[] = [
  ...BLOCKS.map((k) => k.r), ...TAQUERIAS.map((t) => t.r),
  ...BUNGALOWS.map(([x, z]) => rect(x - 5, x + 5, z - 4.5, z + 4.5)),
  rect(-106, 190, 1846, 2014),                                   // the airfield
  ...AIRPORT.cargo,
  PRAIRIE.barn, PRAIRIE.factory,
  rect(PRAIRIE.windmill.x - 4, PRAIRIE.windmill.x + 4, PRAIRIE.windmill.z - 4, PRAIRIE.windmill.z + 4),
  rect(-300, MID - CLEAR, 2296, 2384),                           // the farm plants its own
  rect(MID + CLEAR, -136, 2296, 2384),
  ...PINES.cabins.map((c) => rect(c.x - c.w / 2 - 3, c.x + c.w / 2 + 3, c.z - c.d / 2 - 4, c.z + c.d / 2 + 4)),
  rect(PINES.lookout.x - 7, PINES.lookout.x + 7, PINES.lookout.z - 7, PINES.lookout.z + 7),
  rect(PINES.sign.x - 7, PINES.sign.x + 8, PINES.sign.z - 7, PINES.sign.z + 7),
  rect(PINES.camp.x - 5, PINES.camp.x + 5, PINES.camp.z - 5, PINES.camp.z + 5),
  rect(RIVER_SIGN.x - 6, RIVER_SIGN.x + 7, RIVER_SIGN.z - 6, RIVER_SIGN.z + 6),
  rect(CONGRESS.x - 9, CONGRESS.x + 9, LAKE.z0 - 12, LAKE.z1 + 30),
  rect(OLD_BRIDGE.x - 6, OLD_BRIDGE.x + 6, RIVER.z0 - 22, RIVER.z1 + 20),
];

/** May a tree (or a cow, or a hay bale) stand at (x, z)? `m` = extra margin. */
export function clearOf(x: number, z: number, m = 0): boolean {
  if (Math.abs(x - MID) < CLEAR + 3 + m) return false;
  if (z > TX71.z0 - 6 && z < TX71.z1 + 6 && Math.abs(x - tx71X(z)) < TX71.half + m) return false;
  if (z > LAKE.z0 - 0.5 && z < LAKE.z1 + 0.5) return false;
  if (z > RIVER.z0 - 0.5 && z < RIVER.z1 + 0.5) return false;
  if (z > SH130.z0 - 3 - m && z < SH130.z1 + 3 + m) return false;
  if (Math.abs(z - FM_ROAD.z) < FM_ROAD.w / 2 + 2.5 + m) return false;
  for (const r of RESERVED) if (x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m) return false;
  return true;
}

/** Lowest and highest ground under a footprint (buildings sit on the high
 *  side and carry a footing down to the low side). */
export function footing(r: Rect): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const x of [r.x0, (r.x0 + r.x1) / 2, r.x1]) {
    for (const z of [r.z0, (r.z0 + r.z1) / 2, r.z1]) {
      const h = groundHeight(x, z);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
  }
  return [lo, hi];
}

// -------------------------------------------------------------- colliders --
export function buildBastropLineColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const wall = (minX: number, maxX: number, minZ: number, maxZ: number, tag: string, maxY = 2) =>
    out.push({ minX, maxX, minZ, maxZ, minY: 0, maxY, tag });
  const solid = (r: Rect, tag: string, maxY = 8) => wall(r.x0, r.x1, r.z0, r.z1, tag, maxY);
  const around = (x: number, z: number, half: number, tag: string, maxY = 8) => wall(x - half, x + half, z - half, z + half, tag, maxY);

  // The lake and the river are only LOOKS (the walkable ground is flat), so
  // fence both banks everywhere except across the rail bridge, and give the
  // bridge deck parapets so you can't step off its side.
  for (const w of [LAKE, RIVER]) {
    for (const z of [w.z0 - w.rim, w.z1 + w.rim]) {
      wall(w.x0, MID - CLEAR, z - 0.15, z + 0.15, 'water-fence');
      wall(MID + CLEAR, w.x1, z - 0.15, z + 0.15, 'water-fence');
    }
    wall(MID - CLEAR - 0.2, MID - CLEAR + 0.2, w.z0 - w.rim, w.z1 + w.rim, 'water-fence');
    wall(MID + CLEAR - 0.2, MID + CLEAR + 0.2, w.z0 - w.rim, w.z1 + w.rim, 'water-fence');
  }
  // South-east Austin.
  for (const k of BLOCKS) solid(k.r, 'bastrop-line-block', 24);
  for (const t of TAQUERIAS) solid(t.r, 'taqueria', 5);
  for (const [x, z] of BUNGALOWS) wall(x - 4.5, x + 4.5, z - 4, z + 4, 'bungalow', 6);
  // The airport.
  around(AIRPORT.tower.x, AIRPORT.tower.z, AIRPORT.tower.half, 'airport-tower', 40);
  solid(AIRPORT.terminal, 'airport-terminal', 10);
  solid(AIRPORT.garage, 'airport-garage', 13);
  solid(AIRPORT.hangar, 'airport-hangar', 12);
  for (const z of AIRPORT.gates) {
    wall(AIRPORT.gateX - 1.9, AIRPORT.gateX + 1.9, z - 15, z + 12.4, 'airliner', 6);
    wall(AIRPORT.gateX - 12, AIRPORT.gateX + 12, z - 6, z + 1, 'airliner', 4);
  }
  for (const c of AIRPORT.cargo) solid(c, 'air-cargo', 9);
  // The prairie.
  solid(PRAIRIE.barn, 'prairie-barn', 9);
  around(PRAIRIE.silo.x, PRAIRIE.silo.z, PRAIRIE.silo.r, 'silo', 12);
  around(PRAIRIE.windmill.x, PRAIRIE.windmill.z, 1.3, 'windmill', 10);
  for (const t of PRAIRIE.tanks) around(t.x, t.z, t.r, 'stock-tank', 1);
  solid(PRAIRIE.factory, 'factory', 15);
  // The pecan farm.
  solid(FARM.barn, 'pecan-barn', 10);
  solid(FARM.kiosk, 'pie-kiosk', 3);
  const s = FARM.squirrel;
  wall(s.x - s.plinth.w / 2, s.x + s.plinth.w / 2, s.z - s.plinth.d / 2, s.z + s.plinth.d / 2, 'giant-squirrel', 6);
  wall(FARM.sign.x - 0.15, FARM.sign.x + 0.15, FARM.sign.z - FARM.sign.w / 2, FARM.sign.z + FARM.sign.w / 2, 'squirrel-sign', 1.2);
  // The Lost Pines.
  for (const c of PINES.cabins) wall(c.x - c.w / 2, c.x + c.w / 2, c.z - c.d / 2, c.z + c.d / 2, 'log-cabin', 6);
  around(PINES.lookout.x, PINES.lookout.z, PINES.lookout.half, 'fire-lookout', 28);
  return out;
}
