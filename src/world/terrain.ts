// The real lie of the land around Royal Tara Cove, for the horizon.
//
// A 9×9 grid of USGS elevations (metres) sampled every 200 m across ±800 m
// around the Royal Tara Cove / Avery Ranch Blvd junction (263.5 m). Rows run
// north → south, columns west → east. Reading it: the junction sits in a
// shallow creek valley; the ground climbs to ~280 m on the ridge to the south,
// and falls away to ~246 m toward South Brushy Creek and Brushy Creek Lake in
// the north. Royal Tara itself rises only ~3 m from the boulevard to the bulb,
// so the PLAY surface is flat — this relief is drawn where the flat ground ends
// (components/TerrainBackdrop.tsx).
const GRID: number[][] = [
  [253, 249, 248, 247, 250, 248, 246, 255, 260], // 800 m north
  [262, 255, 255, 257, 255, 258, 260, 265, 261],
  [262, 258, 262, 262, 258, 265, 267, 267, 263],
  [261, 262, 267, 266, 260, 267, 269, 269, 264],
  [262, 265, 269, 265, 263, 268, 271, 271, 268], // the boulevard's latitude
  [264, 269, 271, 268, 265, 266, 273, 275, 271],
  [266, 271, 273, 272, 266, 270, 273, 277, 276],
  [270, 270, 274, 274, 272, 273, 275, 277, 276],
  [271, 272, 277, 280, 279, 275, 280, 278, 273], // 800 m south
];
const JUNCTION_ELEV = 263.5;
/** Game metres per real metre (the whole map is compressed about 5:1). */
const COMPRESS = 5;
/** The junction in game coordinates. */
const JX = 0, JZ = -183.5;

/** Where the flat, playable ground ends and the modelled terrain begins. */
export const GROUND_CX = -100;
export const GROUND_CZ = -120;
export const GROUND_R = 240;
/** How far out the relief reaches full strength. */
const BLEND = 90;
/** Relief is real metres, drawn a little taller so it reads at a glance. */
const EXAGGERATE = 1.35;

function realElev(gx: number, gz: number): number {
  const e = (gx - JX) * COMPRESS, n = -(gz - JZ) * COMPRESS;
  const cx = Math.max(0, Math.min(7.999, (e + 800) / 200));
  const cy = Math.max(0, Math.min(7.999, (800 - n) / 200));
  const i = Math.floor(cx), j = Math.floor(cy);
  const fx = cx - i, fy = cy - j;
  const a = GRID[j][i], b = GRID[j][i + 1], c = GRID[j + 1][i], d = GRID[j + 1][i + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function ss(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The backdrop relief as surveyed, before the south land is cut into it. */
function surveyHeight(gx: number, gz: number): number {
  const r = Math.hypot(gx - GROUND_CX, gz - GROUND_CZ);
  if (r <= GROUND_R) return 0;
  const k = Math.min(1, (r - GROUND_R) / BLEND);
  const blend = k * k * (3 - 2 * k);
  // Gentle rolling noise so ridgelines aren't ruler-straight.
  const roll = Math.sin(gx * 0.021) * Math.cos(gz * 0.017) * 2.2 + Math.sin(gx * 0.047 + gz * 0.031) * 1.1;
  return ((realElev(gx, gz) - JUNCTION_ELEV) * EXAGGERATE + roll) * blend;
}

// ------------------------------------------------------------- south land --
// The country the Red Line runs through on its way to the Domain, Downtown
// and Bastrop. It has its own, finer ground (components/rail/SouthLand.tsx);
// the coarse backdrop is sunk out of the way underneath it.
export const SOUTH_X0 = -700, SOUTH_X1 = 190, SOUTH_Z0 = 70, SOUTH_Z1 = 3780;
/** From the Lost Pines on, the land is drawn wider: you get off and walk about
 *  at Bastrop, well to either side of the line. */
export const WIDE_Z0 = 2420, WIDE_X0 = -960, WIDE_X1 = 720;
/** Where the rails end (mirrors redLine.TRACK_Z_S). */
const RAIL_END_Z = 3076.6;
/** Centreline between the two tracks (mirrors westAvery.RAIL_MID_X). */
const SOUTH_RAIL_X = -173.9;
/** Flat half-width of the railway formation; the land may rise beyond it. */
export const SOUTH_BED_HALF = 8.5;
export const SOUTH_SHOULDER = 14;

/** Rail bridges (z spans): the SH-45 toll road and Walnut Creek pass under. */
export const SOUTH_BRIDGES: [number, number][] = [
  [309, 343], [495, 517],
  [1636, 1720],   // Lady Bird Lake (mirrors redLine.LAKE_Z)
  [2796, 2870],   // the Colorado River (mirrors redLine.RIVER_Z)
];

interface Pad { x0: number; x1: number; z0: number; z1: number; y: number; soft: number }
/** Levelled ground: stations, the highway, the quarry floor, the Domain. */
const PADS: Pad[] = [
  { x0: -235, x1: -104, z0: 222, z1: 308, y: 0, soft: 14 },     // Lakeline Blvd, park & ride, Parmer
  { x0: -700, x1: 190, z0: 318, z1: 334, y: -7.5, soft: 9 },    // SH-45 toll road, down in its cut
  { x0: -310, x1: -200, z0: 354, z1: 410, y: -8, soft: 16 },    // quarry pit
  { x0: -160, x1: -96, z0: 348, z1: 412, y: 0, soft: 10 },      // freight yard
  { x0: -230, x1: -104, z0: 426, z1: 480, y: 0, soft: 12 },     // Howard station + park & ride
  { x0: -700, x1: 190, z0: 502, z1: 510, y: -3.6, soft: 7 },    // Walnut Creek
  { x0: -380, x1: -100, z0: 540, z1: 716, y: 0, soft: 16 },     // the Domain
  { x0: -560, x1: 100, z0: 736, z1: 1626, y: 0, soft: 26 },     // the city, Kramer → Downtown
  { x0: -960, x1: 720, z0: 1644, z1: 1712, y: -5, soft: 8 },    // Lady Bird Lake
  { x0: -150, x1: 190, z0: 1846, z1: 2014, y: 0, soft: 22 },    // the airport
  { x0: -300, x1: -120, z0: 2296, z1: 2384, y: 0, soft: 18 },   // the pecan farm
  { x0: -960, x1: 720, z0: 2806, z1: 2860, y: -7, soft: 10 },   // the Colorado River
  { x0: -660, x1: 440, z0: 2900, z1: 3480, y: 0, soft: 44 },    // The Colony
];

/** What grows (or is paved) at a spot — the land mesh tints itself by this. */
export type LandKind = 'hill' | 'city' | 'prairie' | 'pines' | 'lawn';
export function landKind(gx: number, gz: number): LandKind {
  if (gz < 726) return 'hill';
  if (gz < 1640) return gx > -580 && gx < 120 ? 'city' : 'hill';
  if (gz < 2430) return 'prairie';
  if (gz < 2800) return 'pines';
  return gx > -680 && gx < 460 && gz > 2880 && gz < 3500 ? 'lawn' : 'pines';
}

function southLand(gx: number, gz: number): number {
  // Rolling Hill Country, with the limestone ridge the line cuts through.
  const roll = Math.sin(gx * 0.019 + 1.3) * Math.cos(gz * 0.023) * 2.4 + Math.sin(gx * 0.043 + gz * 0.037) * 1.2 + 1.6;
  const ridge = 7.5 * ss(104, 128, gz) * (1 - ss(188, 216, gz));
  // The Lost Pines stand on sandy hills, a good deal lumpier than the prairie.
  const pines = 4.2 * ss(2410, 2500, gz) * (1 - ss(2740, 2790, gz)) * (0.55 + 0.45 * Math.sin(gx * 0.031 + gz * 0.019 + 0.7));
  let h = roll * 0.8 + ridge + pines;
  for (const p of PADS) {
    const dx = Math.max(p.x0 - gx, 0, gx - p.x1);
    const dz = Math.max(p.z0 - gz, 0, gz - p.z1);
    const k = 1 - ss(0, p.soft, Math.hypot(dx, dz));
    h = h * (1 - k) + p.y * k;
  }
  // The railway formation itself is dead level — except where it is carried
  // on a bridge and the cut (a road, a creek) passes underneath.
  const d = Math.abs(gx - SOUTH_RAIL_X);
  let onBridge = false;
  for (const [b0, b1] of SOUTH_BRIDGES) if (gz > b0 && gz < b1) onBridge = true;
  if (!onBridge && gz < RAIL_END_Z + 12) h *= ss(SOUTH_BED_HALF, SOUTH_SHOULDER, d);
  // Never poke up through the flat play disc.
  const r = Math.hypot(gx - GROUND_CX, gz - GROUND_CZ);
  return h * ss(GROUND_R - 2, GROUND_R + 36, r);
}

function inSouth(gx: number, gz: number): boolean {
  if (gz < SOUTH_Z0 || gz > SOUTH_Z1) return false;
  return gz >= WIDE_Z0 ? gx >= WIDE_X0 && gx <= WIDE_X1 : gx >= SOUTH_X0 && gx <= SOUTH_X1;
}

/** Height of the south-land ground mesh (blends in from the surveyed relief). */
export function southHeight(gx: number, gz: number): number {
  const k = ss(SOUTH_Z0, SOUTH_Z0 + 80, gz);
  // (The surveyed relief must not creep over the trackbed while it blends out.)
  const bed = ss(SOUTH_BED_HALF, SOUTH_SHOULDER, Math.abs(gx - SOUTH_RAIL_X));
  return surveyHeight(gx, gz) * (1 - k) * bed + southLand(gx, gz) * k;
}

/** Height (game m, relative to the flat play surface) of the backdrop terrain. */
export function terrainHeight(gx: number, gz: number): number {
  const h = surveyHeight(gx, gz);
  if (!inSouth(gx, gz)) return h;
  // Under the south land the backdrop drops away so the two never fight.
  const m = ss(SOUTH_Z0, SOUTH_Z0 + 40, gz) * ss(SOUTH_X0, SOUTH_X0 + 40, gx) * (1 - ss(SOUTH_X1 - 40, SOUTH_X1, gx)) * (1 - ss(SOUTH_Z1 - 40, SOUTH_Z1, gz));
  return h * (1 - m) - 45 * m;
}

/** The ground you actually SEE at (x, z): play disc, south land, or backdrop. */
export function groundHeight(gx: number, gz: number): number {
  return inSouth(gx, gz) ? southHeight(gx, gz) : terrainHeight(gx, gz);
}
