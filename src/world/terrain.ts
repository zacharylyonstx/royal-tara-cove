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

/** Height (game m, relative to the flat play surface) of the backdrop terrain. */
export function terrainHeight(gx: number, gz: number): number {
  const r = Math.hypot(gx - GROUND_CX, gz - GROUND_CZ);
  if (r <= GROUND_R) return 0;
  const k = Math.min(1, (r - GROUND_R) / BLEND);
  const blend = k * k * (3 - 2 * k);
  // Gentle rolling noise so ridgelines aren't ruler-straight.
  const roll = Math.sin(gx * 0.021) * Math.cos(gz * 0.017) * 2.2 + Math.sin(gx * 0.047 + gz * 0.031) * 1.1;
  return ((realElev(gx, gz) - JUNCTION_ELEV) * EXAGGERATE + roll) * blend;
}
