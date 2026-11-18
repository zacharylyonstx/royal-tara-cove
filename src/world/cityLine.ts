// The Red Line from the Domain into Downtown Austin — everything that slides
// past the train windows between Kramer and Lady Bird Lake, and the walkable
// station plaza + "4th Street" at Downtown. Layout shared by the scenery
// (components/rail/CityLine.tsx) and collision.
//
// Order and character follow the real line (see world/redLine.ts), distances
// compressed: Kramer's tech offices and warehouses, Q2 Stadium beside McKalla
// station, US-183 overhead, North Lamar at grade, Crestview's bungalows and
// apartments, the old Highland Mall (now ACC Highland), I-35 overhead, MLK
// Blvd at grade, East Austin's colourful bungalows, the five-storey blocks at
// Plaza Saltillo, I-35 overhead again, then Downtown: the Convention Center on
// the east, the station plaza and skyline on the west, and Cesar Chavez St
// just short of the lake.
//
// NOT true to the real plan: the real Downtown station runs east–west along
// 4th Street, and the Fairmont and Waterline towers stand east of it; here the
// line runs straight on south, so the whole skyline is gathered west of it,
// heights at about 0.45× real. Shop names are made up. +X east, +Z south.
import type { RectCollider } from '../types';
import { RAIL_X, RAIL_X_B, RAIL_MID_X } from './westAvery';
import {
  STATIONS, rampSpan, CITY_STOPS, SIDE_PLAT_HALF,
  KRAMER_Z, Q2_Z, US183_Z, LAMAR_Z, CRESTVIEW_Z, HIGHLAND_Z, I35_N_Z, MLK_BLVD_Z, MLK_Z, SALTILLO_Z, I35_S_Z, CHAVEZ_Z,
} from './redLine';
import type { Shop, Tower, Treat } from './domain';
import { rng32 } from './corridor';

export const MID = RAIL_MID_X;
/** Half-width of the railway formation: nothing stands inside it. */
export const CLEAR = 9;
/** The nearest our scenery comes to the midline (side platforms reach 10.1 m). */
export const NEAR = 12;

export interface Rect { x0: number; x1: number; z0: number; z1: number }
const W = (d: number) => MID - d, E = (d: number) => MID + d;
/** A rectangle `d0`–`d1` metres out from the line on one side (−1 west, +1 east). */
const beside = (side: 1 | -1, d0: number, d1: number, z0: number, z1: number): Rect =>
  (side < 0 ? { x0: W(d1), x1: W(d0), z0, z1 } : { x0: E(d0), x1: E(d1), z0, z1 });

/** The build is baked a stretch at a time so the far stretches can be culled. */
export const CITY_SECTIONS: { id: string; z0: number; z1: number }[] = [
  { id: 'kramer', z0: 716, z1: 1000 },
  { id: 'crestview', z0: 1000, z1: 1260 },
  { id: 'east', z0: 1260, z1: 1500 },
  { id: 'downtown', z0: 1500, z1: 1626 },
];
export function citySection(z: number): number {
  return Math.max(0, CITY_SECTIONS.findIndex((s) => z >= s.z0 && z < s.z1));
}

// ------------------------------------------------- freeways + cross streets --
/** A freeway carried over the railway. `y` is the road surface. */
export interface Overpass { id: string; z0: number; z1: number; y: number; x0: number; x1: number; lanes: number; vehicles: number; trucks: number }
/** Deck thickness: the underside (y − DECK_T) clears the trains by 3.5 m. */
export const DECK_T = 1.4;
export const PIER_R = 0.9;
export const OVERPASSES: Overpass[] = [
  { id: 'us183', z0: US183_Z - 10, z1: US183_Z + 10, y: 8.2, x0: -500, x1: 150, lanes: 2, vehicles: 10, trucks: 2 },
  { id: 'i35n', z0: I35_N_Z - 15, z1: I35_N_Z + 15, y: 8.4, x0: -500, x1: 150, lanes: 3, vehicles: 14, trucks: 4 },
  { id: 'i35s', z0: I35_S_Z - 15, z1: I35_S_Z + 15, y: 8.4, x0: -500, x1: 150, lanes: 3, vehicles: 14, trucks: 4 },
];
/** Pier columns (x, z): a pair every 30 m, the first 13 m clear of the midline. */
export function overpassPiers(o: Overpass): [number, number][] {
  const out: [number, number][] = [];
  for (const side of [-1, 1]) {
    for (let d = 13; ; d += 30) {
      const x = MID + side * d;
      if (x < o.x0 + 6 || x > o.x1 - 6) break;
      out.push([x, o.z0 + 4], [x, o.z1 - 4]);
    }
  }
  return out;
}

/** Streets crossed at grade (the gates and panels are world/redLine + Track). */
export const CITY_ROADS: { id: string; z: number; w: number }[] = [
  { id: 'lamar', z: LAMAR_Z, w: 12 },
  { id: 'mlk', z: MLK_BLVD_Z, w: 11 },
  { id: 'chavez', z: CHAVEZ_Z, w: 12 },
];
/** x-spans of those roads either side of the formation. */
export const ROAD_SPANS: [number, number][] = [[-560, RAIL_X - 4.6], [RAIL_X_B + 4.6, 100]];

// --------------------------------------------------------- pass-by blocks --
export type BlockKind = 'office' | 'warehouse' | 'retail' | 'apartment' | 'mixed' | 'far';
export interface CityBlock extends Rect { side: 1 | -1; h: number; kind: BlockKind; wall: string; trim: string; accent: string }
const blk = (side: 1 | -1, d0: number, d1: number, z0: number, z1: number, h: number, kind: BlockKind, wall: string, trim: string, accent: string): CityBlock =>
  ({ ...beside(side, d0, d1, z0, z1), side, h, kind, wall, trim, accent });
/** Storeys → height: apartments sit on a low plinth, mixed-use on a shop floor. */
const APT = (floors: number) => 1.9 + floors * 3.1;
const MIX = (floors: number) => 5 + floors * 3.1;

const K = KRAMER_Z, Q = Q2_Z, U = US183_Z, L = LAMAR_Z, CP = CRESTVIEW_Z + 22, H = HIGHLAND_Z, I = I35_N_Z, M = MLK_BLVD_Z, MS = MLK_Z + 14, S = SALTILLO_Z;
const DT = STATIONS.downtown.z;

export const CITY_BLOCKS: CityBlock[] = [
  // ---- Kramer: tech offices and warehouses ----
  blk(-1, 20, 62, K - 30, K - 8, 9, 'office', '#d9d4c7', '#f1ede2', '#5f88a8'),
  blk(-1, 22, 58, K + 8, K + 28, 12.5, 'office', '#c8cdd2', '#eef1f3', '#4f7f9a'),
  blk(-1, 74, 132, K - 28, K + 26, 8.5, 'warehouse', '#cfc8ba', '#e9e4d8', '#2e7fd0'),
  blk(-1, 150, 214, K - 30, K + 20, 17, 'far', '#b9c2c9', '#dfe5ea', '#5f88a8'),
  blk(1, 66, 124, K - 30, K + 28, 8, 'warehouse', '#bfc5c9', '#e9e6dc', '#c8102e'),
  blk(1, 17, 56, K + 34, K + 60, 10.5, 'office', '#e3dccb', '#f4efe6', '#6b8ca3'),
  // ---- around the stadium ----
  blk(-1, 160, 232, Q - 65, Q - 5, 11, 'far', '#c9c5ba', '#e9e4d8', '#6b7f8f'),
  blk(-1, 164, 240, Q + 10, Q + 68, 13, 'far', '#bfc5c9', '#e9e6dc', '#5f88a8'),
  blk(1, 16, 50, Q - 40, Q - 23, 7, 'warehouse', '#d6cfc0', '#eee9dc', '#e9a020'),
  blk(1, 46, 100, Q - 18, Q + 22, 9.5, 'warehouse', '#e9e6dc', '#ffffff', '#1f5fae'),
  blk(1, 17, 58, Q + 30, Q + 68, 13.5, 'office', '#cdd3d6', '#eef1f3', '#4f7f9a'),
  blk(1, 72, 130, Q - 72, Q - 28, 9, 'warehouse', '#c9c2b2', '#e9e4d8', '#3fae6a'),
  blk(1, 112, 172, Q + 26, Q + 70, 15, 'far', '#c2c9cf', '#e9e6dc', '#6b8ca3'),
  // ---- between US-183 and North Lamar: strip retail ----
  blk(-1, 16, 50, U + 15, U + 29, 6.2, 'retail', '#e4d9c6', '#3b4652', '#c8102e'),
  blk(1, 16, 48, U + 15, U + 29, 6.2, 'retail', '#d9d4c7', '#3b4652', '#2e7fd0'),
  blk(-1, 16, 46, L - 25, L - 9, 6.5, 'retail', '#e8dcc8', '#3b4652', '#e9a020'),
  blk(1, 17, 52, L - 25, L - 10, 7, 'retail', '#d9d4c7', '#3b4652', '#3fae6a'),
  // ---- Crestview: four-storey apartments hard against the platform ----
  blk(1, 17, 46, CP - 34, CP - 8, APT(4), 'apartment', '#b5654a', '#efe6d6', '#2f5d50'),
  blk(1, 17, 46, CP, CP + 30, APT(4), 'apartment', '#d8c7a6', '#f4efe6', '#7a4b2a'),
  blk(1, 58, 98, CP - 34, CP + 26, 12, 'far', '#c9b8a0', '#e9e4d8', '#6b7f8f'),
  blk(-1, 120, 184, CP - 28, CP + 30, 18, 'far', '#c9b8a0', '#e9e4d8', '#6b7f8f'),
  // ---- Highland ----
  blk(-1, 21, 43, H - 44, H - 22, APT(3), 'apartment', '#a8553f', '#e9dfcf', '#2f5d50'),
  blk(-1, 130, 200, H - 10, H + 46, 13, 'far', '#b9c2c9', '#dfe5ea', '#5f88a8'),
  blk(-1, 16, 50, I - 36, I - 20, 7, 'warehouse', '#d9d4c7', '#eeeae0', '#e86a2a'),
  blk(1, 18, 60, I - 36, I - 20, 8, 'warehouse', '#cfc8ba', '#e9e4d8', '#7a4fc3'),
  // ---- MLK Jr. ----
  blk(-1, 120, 176, M + 10, M + 62, 20, 'far', '#b9a58c', '#e9e4d8', '#6b7f8f'),
  blk(1, 100, 160, M + 8, M + 64, 14, 'far', '#c9c5ba', '#e9e4d8', '#6b7f8f'),
  // ---- Plaza Saltillo: five- and six-storey mixed-use ----
  blk(-1, 18, 54, S - 36, S - 6, MIX(5), 'mixed', '#d9b98a', '#f4efe6', '#b5533c'),
  blk(-1, 18, 54, S - 2, S + 22, MIX(6), 'mixed', '#cf7f4a', '#f1e9d8', '#2f5d50'),
  blk(-1, 18, 50, S + 42, S + 54, MIX(4), 'mixed', '#c9b08a', '#f4efe6', '#35567e'),
  blk(1, 16, 52, S - 36, S - 4, MIX(6), 'mixed', '#e2c9a0', '#f4efe6', '#c8102e'),
  blk(1, 16, 56, S + 2, S + 36, MIX(5), 'mixed', '#b5654a', '#efe6d6', '#e9a020'),
  blk(1, 18, 50, S + 40, S + 54, MIX(3), 'mixed', '#d9d4c7', '#3b4652', '#2e7fd0'),
  blk(1, 90, 150, S - 24, S + 36, 26, 'far', '#b9c2c9', '#dfe5ea', '#5f88a8'),
  // ---- Downtown: a hotel slab behind the Convention Center ----
  blk(1, 112, 150, DT - 34, DT + 16, 46, 'far', '#d9cdb8', '#efe9dc', '#7a9bb0'),
];

/** Park-and-ride / surface parking (asphalt with parked cars). */
export const KRAMER_LOT: Rect = beside(1, 15.5, 58, K - 24, K + 26);
export const CITY_LOTS: Rect[] = [
  KRAMER_LOT,
  beside(1, 14, 40, Q - 18, Q + 22),          // behind McKalla's east platform
  beside(1, 14, 38, H - 36, H + 38),          // in front of ACC Highland
];
/** Narrow streets running alongside the line, with houses fronting them. */
export const CITY_STREETS: Rect[] = [
  beside(-1, 13, 18.6, L + 7.4, I - 38),
  beside(-1, 13, 18.6, M - 32, M + 74),
  beside(1, 13, 18.6, M - 32, M - 6.9),
];

// ------------------------------------------------------------- bungalows --
export interface CityHouse { x: number; z: number; w: number; d: number; wall: string; roof: string; door: string; /** Which way (±X) the porch faces. */ face: 1 | -1 }
const MUTED = ['#d9cdb8', '#c9b8a0', '#a8b5a0', '#e4d9c6', '#b9c4cc', '#d4b9a0', '#e9e4d6'];
const BRIGHT = ['#e86a92', '#3fb6b2', '#f0b429', '#7a4fc3', '#d7523f', '#5a9a4e', '#2e7fd0', '#f4efe6', '#f08a4b'];
const ROOFS = ['#5a4a42', '#6b5446', '#4d4a48', '#7a3b2e', '#55606b'];
const DOORS = ['#c8102e', '#2e7fd0', '#f0b429', '#2f5d50', '#7a4fc3', '#f4efe6'];
function houseRow(side: 1 | -1, dist: number, z0: number, z1: number, palette: string[], seed: number, toTrack = true): CityHouse[] {
  const r = rng32(seed);
  const out: CityHouse[] = [];
  for (let z = z0 + 6; z < z1 - 5; z += 13 + r() * 3) {
    const w = 8.4 + r() * 1.4, d = 8 + r() * 1.6;
    out.push({
      x: MID + side * (dist + w / 2 + r() * 1.5), z, w, d,
      wall: palette[Math.floor(r() * palette.length)], roof: ROOFS[Math.floor(r() * ROOFS.length)], door: DOORS[Math.floor(r() * DOORS.length)],
      face: (toTrack ? -side : side) as 1 | -1,
    });
  }
  return out;
}
export const CITY_HOUSES: CityHouse[] = [
  // Crestview + Highland, west of the line.
  ...houseRow(-1, 21.5, L + 12, H - 46, MUTED, 11),
  ...houseRow(-1, 21.5, H - 20, I - 38, MUTED, 12),
  ...houseRow(-1, 46, L + 12, I - 38, MUTED, 13, false),
  // East Austin either side of MLK Jr.
  ...houseRow(-1, 21.5, M - 32, M - 7, BRIGHT, 21),
  ...houseRow(-1, 21.5, M + 7, M + 74, BRIGHT, 22),
  ...houseRow(-1, 46, M - 32, M - 7, BRIGHT, 23, false),
  ...houseRow(-1, 46, M + 7, M + 74, BRIGHT, 24, false),
  ...houseRow(1, 21.5, M - 32, M - 7, BRIGHT, 25),
  ...houseRow(1, 21.5, MS + 14, MS + 34, BRIGHT, 26),
];

// --------------------------------------------------------------- landmarks --
/** Q2 Stadium (Austin FC), west of McKalla station. The pitch runs north–south. */
const Q2_CX = MID - 85;
export const Q2 = { ...beside(-1, 25, 145, Q - 72, Q + 72), cx: Q2_CX, cz: Q, pitchW: 64, pitchL: 100, standTop: 14.2, roofY: 22.5, /** Centre of the name board on the east stand. */ signZ: Q - 28 };
/** The four stands (the corners between them are open). `dir` = outward. */
export interface Q2Stand extends Rect { axis: 'x' | 'z'; dir: 1 | -1 }
export const Q2_STANDS: Q2Stand[] = [
  { axis: 'x', dir: 1, x0: Q2_CX + 36, x1: Q2_CX + 60, z0: Q - 40, z1: Q + 40 },
  { axis: 'x', dir: -1, x0: Q2_CX - 60, x1: Q2_CX - 36, z0: Q - 40, z1: Q + 40 },
  { axis: 'z', dir: -1, x0: Q2_CX - 26, x1: Q2_CX + 26, z0: Q - 72, z1: Q - 54 },
  { axis: 'z', dir: 1, x0: Q2_CX - 26, x1: Q2_CX + 26, z0: Q + 54, z1: Q + 72 },
];
/** The queue plaza between McKalla's west platform and the stadium gates. */
export const Q2_PLAZA: Rect = beside(-1, 10.6, 25, Q - 34, Q + 34);

/** ACC Highland: the old mall, a long low white box east of Highland station. */
export const ACC = { ...beside(1, 40, 112, H - 38, H + 40), h: 11, signZ: H + 26 };
/** The mural wall: the track-side face of a low building by MLK Jr. station. */
export const MURAL = { ...beside(1, 15, 42, MS - 30, MS + 12), h: 7 };
/** Plaza Saltillo's bandstand, behind the platform. */
export const BANDSTAND = { x: W(14.6), z: S - 4 };
/** Austin Convention Center, east of Downtown station. */
export const CONVENTION = { x0: -152, x1: -70, z0: DT - 43, z1: DT + 42, h: 18 };

// ------------------------------------------------------ Downtown, on foot --
const tFoot = rampSpan(STATIONS.downtown).z1;        // foot of the platform ramp
/** Centreline of the walk from the crossing boards down 4th Street. */
export const CITY_WALK_Z = tFoot + 2.6;
export const CITY_PLAZA: Rect = { x0: -194, x1: RAIL_X - 2.6, z0: CITY_WALK_Z - 14, z1: CITY_WALK_Z + 14 };
/** The pedestrian "4th Street", running west from the plaza. */
export const FOURTH = { x0: -286, x1: -196, z: CITY_WALK_Z, half: 6.5 };
/** The little square at its west end. */
export const SQUARE: Rect = { x0: -316, x1: -286, z0: CITY_WALK_Z - 17, z1: CITY_WALK_Z + 17 };
/** "Congress Avenue": north from the square, under I-35, to the Capitol lawn. */
export const CONGRESS: Rect = { x0: -299, x1: -285, z0: S + 41, z1: SQUARE.z0 };
/** The cross street beside Plaza Saltillo that gives the train a glimpse of the dome. */
export const VISTA: Rect = { x0: -256, x1: W(18), z0: S + 26, z1: S + 38 };
export const CITY_SHOP_DEPTH = 12;

const LOT_W = 19, LOT_GAP = 3;
const lot = (k: number) => { const x1 = FOURTH.x1 - 2 - k * (LOT_W + LOT_GAP); return { x0: x1 - LOT_W, x1 }; };
/** Shopfronts on 4th Street (same shape as the Domain's — names made up). */
export const CITY_SHOPS: Shop[] = [
  { id: 'bbq', name: 'Smoky Oak BBQ', sub: 'BRISKET + RIBS', side: 'n', ...lot(0), floors: 3, wall: '#8a4b32', trim: '#f1e4c8', awning: '#c8102e', treat: { label: 'get BBQ 🍖', emoji: '🍖' } },
  { id: 'records', name: 'Grackle Records', sub: 'MUSIC + VINYL', side: 'n', ...lot(1), floors: 4, wall: '#2f3a55', trim: '#f2d27a', awning: '#e86a92', treat: { label: 'spin a record 🎵', emoji: '🎵' } },
  { id: 'paletas', name: 'Paleta Palace', sub: 'ICE POPS', side: 'n', ...lot(3), floors: 3, wall: '#f6d7c4', trim: '#ffffff', awning: '#3fb6b2', treat: { label: 'get a paleta 🍧', emoji: '🍧' } },
  { id: 'btacos', name: 'Sunrise Tacos', sub: 'BREAKFAST TACOS', side: 's', ...lot(0), floors: 4, wall: '#f0b429', trim: '#fbf5e2', awning: '#d7372f', treat: { label: 'get a breakfast taco 🌮', emoji: '🌮' } },
  { id: 'bats', name: 'Bat Bridge Gifts', sub: 'BATS + SOUVENIRS', side: 's', ...lot(1), floors: 3, wall: '#4a4458', trim: '#e9dfcf', awning: '#7a4fc3', treat: { label: 'get a bat sticker 🦇', emoji: '🦇' } },
  { id: 'lemonade', name: 'Lady Bird Lemonade', sub: 'FRESH SQUEEZED', side: 's', ...lot(2), floors: 4, wall: '#f4efe6', trim: '#ffe680', awning: '#f2c94c', treat: { label: 'get lemonade 🍋', emoji: '🍋' } },
  { id: 'bakery', name: 'Bluebonnet Bakery', sub: 'COOKIES + PIES', side: 's', ...lot(3), floors: 3, wall: '#9fb7d6', trim: '#f4efe6', awning: '#35567e', treat: { label: 'get a cookie 🍪', emoji: '🍪' } },
];
/** The old red-brick fire station in the north row (no sign, big red doors). */
export const FIREHOUSE = { side: 'n' as const, ...lot(2), h: 9.6 };
/** Front wall z of a shop row, and which way it faces (+1 = toward +Z). */
export function cityShopFront(side: 'n' | 's'): { z: number; face: 1 | -1 } {
  return side === 'n' ? { z: FOURTH.z - FOURTH.half, face: 1 } : { z: FOURTH.z + FOURTH.half, face: -1 };
}
function shopRect(s: { side: 'n' | 's'; x0: number; x1: number }): Rect {
  const f = cityShopFront(s.side), back = f.z - f.face * CITY_SHOP_DEPTH;
  return { x0: s.x0, x1: s.x1, z0: Math.min(f.z, back), z1: Math.max(f.z, back) };
}

/** Big live oaks shading the square (x, z, scale). */
export const SQUARE_OAKS: [number, number, number][] = [
  [-309, CITY_WALK_Z - 10.5, 1.25], [-311.5, CITY_WALK_Z + 5.5, 1.1], [-293, CITY_WALK_Z + 12, 1.15],
];
/** The food trailer under them (long side east–west, serving north). */
export const TRAILER = { x: -302.5, z: CITY_WALK_Z + 13 };
/** Planters down 4th Street: x, and which side of the centre line. */
export const CITY_PLANTERS: [number, number][] = [[-208, -3], [-230, 3], [-252, -3], [-274, 3]];
/** The MetroRail totem and the painted-guitar statue on the station plaza. */
export const TOTEM = { x: -185, z: CITY_WALK_Z + 5.2 };
export const GUITAR = { x: -190.5, z: CITY_WALK_Z - 9 };
/** The little park north of 4th Street, with its old cottage. */
export const PARK: Rect = { x0: -280, x1: -202, z0: DT - 56, z1: DT + 0 };
export const COTTAGE = { x: -262, z: DT - 27, w: 8, d: 6.6 };
/** A bus waiting at the Convention Center kerb. */
export const CITY_BUS = { x: -158, z: DT - 26 };

// ---------------------------------------------------------------- skyline --
export type SkyShape = 'frost' | 'independent' | 'austonian' | 'sixth' | 'waterline' | 'fairmont' | 'block185';
export interface SkyTower extends Tower { id: SkyShape; name: string }
/** Each has its own silhouette (CityLine.tsx); `h` is the very top. Real
 *  heights × ~0.45: Waterline 312 m, Sixth and Guadalupe 267 m, The
 *  Independent 212 m, The Austonian 208 m, Fairmont 180 m, Block 185 176 m,
 *  Frost Bank Tower 157 m. */
export const SKYLINE: SkyTower[] = [
  { id: 'fairmont', name: 'Fairmont Austin', x0: -336, x1: -312, z0: DT - 59, z1: DT - 33, h: 81, glass: '#8fb0b4', frame: '#eef0ee' },
  { id: 'frost', name: 'Frost Bank Tower', x0: -340, x1: -316, z0: DT - 24, z1: DT, h: 71, glass: '#a9c4d6', frame: '#e6edf1' },
  { id: 'waterline', name: 'Waterline', x0: -398, x1: -378, z0: DT - 48, z1: DT - 18, h: 140, glass: '#3f78a8', frame: '#cfdbe4' },
  { id: 'independent', name: 'The Independent', x0: -396, x1: -370, z0: DT - 10, z1: DT + 14, h: 95, glass: '#aab6bf', frame: '#e9ecee' },
  { id: 'austonian', name: 'The Austonian', x0: -348, x1: -334, z0: CITY_WALK_Z - 11, z1: CITY_WALK_Z + 11, h: 94, glass: '#3d6f9c', frame: '#cfdbe4' },
  { id: 'block185', name: 'Block 185', x0: -392, x1: -360, z0: DT + 20, z1: DT + 46, h: 79, glass: '#6fb0c0', frame: '#e6edf1' },
  { id: 'sixth', name: 'Sixth and Guadalupe', x0: -402, x1: -372, z0: S - 42, z1: S - 12, h: 120, glass: '#4c7fa6', frame: '#d9e2e8' },
];
/** The Texas Capitol: pink granite, at the head of the avenue. `h` = the top of the statue. */
export const CAPITOL = { x: (CONGRESS.x0 + CONGRESS.x1) / 2, z: S + 14, w: 60, d: 20, h: 43 };
export const CAPITOL_LAWN: Rect = { x0: CAPITOL.x - 40, x1: CAPITOL.x + 40, z0: S - 8, z1: S + 41 };

// --------------------------------------------------- treats, lamps, solids --
export const CITY_TREATS: Treat[] = [
  ...CITY_SHOPS.filter((s) => s.treat).map((s) => {
    const f = cityShopFront(s.side);
    return { id: `city-${s.id}`, label: s.treat!.label, emoji: s.treat!.emoji, x: (s.x0 + s.x1) / 2, z: f.z + f.face * 1.3 };
  }),
  { id: 'city-trailer', label: 'get a corn dog 🌭', emoji: '🌭', x: TRAILER.x, z: TRAILER.z - 2.5 },
];

/** Acorn lamp posts (world x, z, yaw) — for the shared StreetLamps rig. */
export const CITY_LAMPS: [number, number, number][] = [
  // 4th Street: in the gaps between the buildings, alternating sides.
  [lot(0).x0 - LOT_GAP / 2, FOURTH.z - FOURTH.half + 1.1, 0], [lot(2).x0 - LOT_GAP / 2, FOURTH.z - FOURTH.half + 1.1, 0],
  [lot(1).x0 - LOT_GAP / 2, FOURTH.z + FOURTH.half - 1.1, Math.PI], [lot(3).x0 - LOT_GAP / 2, FOURTH.z + FOURTH.half - 1.1, Math.PI],
  // Station plaza.
  [CITY_PLAZA.x0 + 1.5, CITY_WALK_Z - 5, 0], [-184.6, CITY_WALK_Z + 11, 0],
  // The square.
  [SQUARE.x0 + 2, SQUARE.z0 + 2.5, 0], [SQUARE.x0 + 2, SQUARE.z1 - 2.5, 0], [SQUARE.x1 - 3, SQUARE.z1 - 2.5, 0],
];

/** Everything our scenery occupies — trees are only planted outside these. */
const KEEP_OUT: Rect[] = [
  ...CITY_BLOCKS, ...CITY_LOTS, ...CITY_STREETS, Q2, Q2_PLAZA, ACC, MURAL, CONVENTION, CITY_PLAZA, SQUARE, CONGRESS, VISTA,
  { x0: FOURTH.x0, x1: FOURTH.x1, z0: FOURTH.z - FOURTH.half, z1: FOURTH.z + FOURTH.half },
  ...CITY_SHOPS.map(shopRect), shopRect(FIREHOUSE), ...SKYLINE,
  { x0: CAPITOL.x - CAPITOL.w / 2 - 2, x1: CAPITOL.x + CAPITOL.w / 2 + 2, z0: CAPITOL.z - 15, z1: CAPITOL.z + 16 },
  { x0: COTTAGE.x - COTTAGE.w / 2 - 2, x1: COTTAGE.x + COTTAGE.w / 2 + 2, z0: COTTAGE.z - COTTAGE.d / 2 - 1, z1: COTTAGE.z + COTTAGE.d / 2 + 3 },
  ...CITY_HOUSES.map((h) => ({ x0: h.x - h.w / 2 - 3, x1: h.x + h.w / 2 + 3, z0: h.z - h.d / 2 - 0.5, z1: h.z + h.d / 2 + 0.5 })),
  // Behind the side platforms (their shelters overhang a little).
  ...CITY_STOPS.flatMap((c) => ([1, -1] as const)
    .filter((side) => c.kind === 'both' || c.kind === (side > 0 ? 'east' : 'west'))
    .map((side) => beside(side, CLEAR, 16, c.z - SIDE_PLAT_HALF - 2, c.z + SIDE_PLAT_HALF + 2))),
];
export function cityOccupied(x: number, z: number, m = 2): boolean {
  if (Math.abs(x - MID) < NEAR || z < 742 || z > 1625) return true;
  for (const o of OVERPASSES) if (z > o.z0 - 3 && z < o.z1 + 3) return true;
  for (const r of CITY_ROADS) if (Math.abs(z - r.z) < r.w / 2 + 2.6) return true;
  for (const r of KEEP_OUT) if (x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m) return true;
  return false;
}

export function buildCityColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const box = (r: Rect, tag: string, maxY = 6) => out.push({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, minY: 0, maxY, tag });
  const at = (x: number, z: number, hx: number, hz: number, tag: string, maxY = 6) => box({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz }, tag, maxY);
  // Pass-by buildings, the stadium's four stands (the corners are open — you
  // can walk out onto the pitch), the campus, the mural building.
  for (const k of CITY_BLOCKS) box(k, 'city-block', k.h);
  for (const s of Q2_STANDS) box(s, 'city-stadium', Q2.standTop);
  box(ACC, 'city-acc', ACC.h);
  box(MURAL, 'city-mural', MURAL.h);
  // Freeway piers: only the ones anyone could plausibly walk into.
  for (const o of OVERPASSES) {
    const reach = o.id === 'i35s' ? 140 : 50;
    for (const [x, z] of overpassPiers(o)) if (Math.abs(x - MID) <= reach) at(x, z, PIER_R, PIER_R, 'city-pier', o.y);
  }
  // Downtown.
  box(CONVENTION, 'city-convention', CONVENTION.h);
  for (const s of CITY_SHOPS) box(shopRect(s), 'city-shop', 30);
  box(shopRect(FIREHOUSE), 'city-shop', 30);
  for (const t of SKYLINE) box(t, 'city-tower', 60);
  at(CAPITOL.x, CAPITOL.z, CAPITOL.w / 2, CAPITOL.d / 2, 'city-capitol', 20);
  at(CAPITOL.x, CAPITOL.z, 11, 13, 'city-capitol', 20);
  for (const [x, z] of SQUARE_OAKS) at(x, z, 0.6, 0.6, 'city-oak');
  for (const [x, dz] of CITY_PLANTERS) at(x, FOURTH.z + dz, 1, 1, 'city-planter', 1.2);
  at(TRAILER.x, TRAILER.z, 3.4, 1.3, 'city-trailer', 3.4);
  at(TOTEM.x, TOTEM.z, 0.2, 1.75, 'city-totem', 3.6);
  at(GUITAR.x, GUITAR.z, 0.9, 0.9, 'city-statue', 3);
  at(COTTAGE.x, COTTAGE.z, COTTAGE.w / 2, COTTAGE.d / 2, 'city-cottage', 5);
  at(CITY_BUS.x, CITY_BUS.z, 1.35, 5.6, 'city-bus', 3.4);
  return out;
}
