// The Midnight Munchies maze — INSIDE the real 10600 ground floor.
//
// Everything here is authored in HOUSE-LOCAL coordinates (same frame as
// components/hero/floorPlan.ts) and converted to world space through
// world/heroPlace.ts, so the maze follows the house wherever the lot puts it.
// (The old maze was authored around the world origin from the days the hero
// house lived there; after the house moved to its real lot the whole game was
// being played out on the cul-de-sac asphalt, with a movement clamp that made
// half the cookies unreachable — so a level could never be cleared.)
//
// One walkability grid is the single source of truth for:
//   • where cookies go            (only cells a kid can actually reach)
//   • how sleepwalkers path       (BFS distance fields + line-of-sight steering)
//   • what the player bumps into  (the same rects, exported as colliders)
// It is pure + deterministic, so the host and every guest build the same maze
// and only pellet INDICES need to cross the network.
import { INTERIOR_WALLS, WALL_THICK } from '../components/hero/floorPlan';
import { heroToWorld, worldToHero } from './heroPlace';
import type { RectCollider } from '../types';

export type MunchiesWalkerId = 'dad' | 'penny' | 'dog' | 'schmorgesblob';

// ---------------------------------------------------------------- geometry --

const MIN_X = -12;
const MIN_Z = -9;
const MAX_X = 12;
const MAX_Z = 9;
export const CELL = 0.5;
const NX = Math.round((MAX_X - MIN_X) / CELL); // 48
const NZ = Math.round((MAX_Z - MIN_Z) / CELL); // 36
const N = NX * NZ;

/** Matches PLAYER_RADIUS in systems/collision.ts, plus a hair of slack so a
 *  body centred on a "walkable" cell never touches the thing next to it. */
const BODY_R = 0.32;
const CLEAR = BODY_R + 0.06;
/** Exterior walls are 0.2 thick, centred on the house edge. */
const EXT_CLEAR = 0.1 + CLEAR;

export type MazeBlockKind = 'furniture' | 'blocks' | 'pillows' | 'boxes' | 'bed' | 'closed';

export interface MazeBlock {
  id: string;
  kind: MazeBlockKind;
  /** House-local rect. */
  minX: number; maxX: number; minZ: number; maxZ: number;
}

/**
 * Things you can't walk through, house-local.
 *  - 'furniture': footprints of the REAL furniture already rendered in the house
 *    (it has no colliders in the other modes — here it is part of the maze).
 *  - 'blocks' / 'pillows' / 'boxes': the kids' midnight fort walls — toy bricks,
 *    couch-cushion forts and moving boxes that turn the big open rooms into
 *    corridors. Rendered by components/munchies/MazeForts.tsx.
 *  - 'bed': the sleepwalkers' beds in the den (rendered by Bed.tsx).
 *  - 'closed': the garage — its door is shut for the night.
 */
export const MAZE_BLOCKS: MazeBlock[] = [
  // --- real furniture ---
  { id: 'stairs',   kind: 'furniture', minX: -3.9,  maxX: -2.3,  minZ: -7.3,  maxZ: -4.0 },
  { id: 'dining',   kind: 'furniture', minX: 2.75,  maxX: 5.25,  minZ: -6.8,  maxZ: -5.2 },
  { id: 'couch',    kind: 'furniture', minX: 3.4,   maxX: 5.9,   minZ: -5.2,  maxZ: -2.6 },
  { id: 'kitchen',  kind: 'furniture', minX: 0.9,   maxX: 5.6,   minZ: 6.6,   maxZ: 9.0 },
  { id: 'densofa',  kind: 'furniture', minX: -6.95, maxX: -5.75, minZ: 3.2,   maxZ: 5.3 },
  { id: 'fireplace', kind: 'furniture', minX: -12,  maxX: -10.2, minZ: 7.2,   maxZ: 9.0 },
  // --- sleepwalker beds (the den is the "ghost house") ---
  { id: 'bed-dad',   kind: 'bed', minX: -11.7, maxX: -10.1, minZ: 0.6, maxZ: 2.8 },
  { id: 'bed-penny', kind: 'bed', minX: -11.7, maxX: -10.1, minZ: 4.0, maxZ: 6.2 },
  // --- fort walls ---
  { id: 'fort-stairs',  kind: 'blocks',  minX: -0.5,  maxX: 1.0,   minZ: -7.0,  maxZ: -3.5 },
  { id: 'fort-door',    kind: 'pillows', minX: 8.0,   maxX: 9.75,  minZ: -5.5,  maxZ: -2.5 },
  { id: 'fort-mid-w',   kind: 'boxes',   minX: -2.0,  maxX: 2.0,   minZ: -1.25, maxZ: -0.25 },
  { id: 'fort-mid-e',   kind: 'blocks',  minX: 5.0,   maxX: 9.5,   minZ: 0.5,   maxZ: 1.5 },
  { id: 'fort-kit-w',   kind: 'pillows', minX: -2.25, maxX: -0.5,  minZ: 2.5,   maxZ: 6.0 },
  { id: 'fort-kit-e',   kind: 'boxes',   minX: 7.75,  maxX: 9.75,  minZ: 4.0,   maxZ: 7.0 },
  { id: 'fort-kit-mid', kind: 'blocks',  minX: 1.5,   maxX: 4.5,   minZ: 3.0,   maxZ: 4.5 },
  { id: 'fort-den',     kind: 'pillows', minX: -8.25, maxX: -6.25, minZ: 0.0,   maxZ: 1.5 },
  // --- garage: closed for the night ---
  { id: 'garage', kind: 'closed', minX: -12, maxX: -4, minZ: -9, maxZ: -1.5 },
];

/** The garage man-door opening in the den's front wall (see floorPlan.ts) —
 *  plugged with a closed door in this mode. House-local. */
export const GARAGE_DOOR_PLUG = { minX: -6.0, maxX: -5.0, minZ: -1.6, maxZ: -1.4 };

// House-local authoring points.
const SPAWN_L: [number, number] = [10.75, -7.25];          // just inside the front door
const WALKER_SPAWN_L: Record<MunchiesWalkerId, [number, number]> = {
  dad: [-9.25, 1.75],            // standing beside his bed
  penny: [-9.25, 5.25],
  schmorgesblob: [-8.25, 8.25],  // oozed into the den's back corner
  dog: [6.75, 8.25],             // dog bed beside the kitchen cabinets
};
const MILKS_L: { id: string; at: [number, number] }[] = [
  { id: 'milk-stairs',  at: [-3.25, -8.25] },   // by the foot of the stairs
  { id: 'milk-kitchen', at: [11.25, 8.25] },    // kitchen back corner
  { id: 'milk-nook',    at: [-3.25, 8.25] },    // kitchen nook by the den
  { id: 'milk-den',     at: [-11.25, -0.75] },  // deep in the den (brave!)
];
const BONUS_L: [number, number] = [3.25, 1.75];            // middle of the house

// -------------------------------------------------------------------- grid --

function cellCenterLocal(c: number): [number, number] {
  const i = c % NX;
  const j = (c - i) / NX;
  return [MIN_X + (i + 0.5) * CELL, MIN_Z + (j + 0.5) * CELL];
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az;
  const len2 = vx * vx + vz * vz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2)) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/** Solid interior wall segments (walls split around their door openings). */
const WALL_SEGMENTS: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  for (const w of INTERIOR_WALLS) {
    const ops = [...w.openings].sort((a, b) => a.from - b.from);
    let cursor = w.from;
    const push = (from: number, to: number) => {
      if (to - from < 0.001) return;
      if (w.axis === 'x') out.push([from, w.at, to, w.at]);
      else out.push([w.at, from, w.at, to]);
    };
    for (const op of ops) { push(cursor, op.from); cursor = op.to; }
    push(cursor, w.to);
  }
  return out;
})();

function blockedLocal(x: number, z: number): boolean {
  if (x < MIN_X + EXT_CLEAR || x > MAX_X - EXT_CLEAR || z < MIN_Z + EXT_CLEAR || z > MAX_Z - EXT_CLEAR) return true;
  for (const [ax, az, bx, bz] of WALL_SEGMENTS) {
    if (distToSegment(x, z, ax, az, bx, bz) < WALL_THICK / 2 + CLEAR) return true;
  }
  for (const b of MAZE_BLOCKS) {
    if (x > b.minX - CLEAR && x < b.maxX + CLEAR && z > b.minZ - CLEAR && z < b.maxZ + CLEAR) return true;
  }
  return false;
}

function cellOfLocal(x: number, z: number): number {
  const i = Math.max(0, Math.min(NX - 1, Math.floor((x - MIN_X) / CELL)));
  const j = Math.max(0, Math.min(NZ - 1, Math.floor((z - MIN_Z) / CELL)));
  return j * NX + i;
}

/** 8-neighbour offsets; diagonals last. */
const NB: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** REACH[c] = 1 when a body can stand on cell c AND get there from the spawn. */
const REACH = new Uint8Array(N);
/** For ANY cell (even inside a wall), the nearest reachable cell. */
const NEAREST = new Int16Array(N);

(function build() {
  const open = new Uint8Array(N);
  for (let c = 0; c < N; c++) {
    const [x, z] = cellCenterLocal(c);
    open[c] = blockedLocal(x, z) ? 0 : 1;
  }
  // Flood from the spawn — anything sealed off (inside a fort ring, the garage)
  // never gets a cookie and is never a path target.
  const start = cellOfLocal(SPAWN_L[0], SPAWN_L[1]);
  if (!open[start]) throw new Error('munchiesMap: player spawn is inside a wall');
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  REACH[start] = 1; queue[tail++] = start;
  while (head < tail) {
    const c = queue[head++];
    const i = c % NX, j = (c - i) / NX;
    for (let k = 0; k < 4; k++) {
      const ni = i + NB[k][0], nj = j + NB[k][1];
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = nj * NX + ni;
      if (!open[n] || REACH[n]) continue;
      REACH[n] = 1; queue[tail++] = n;
    }
  }
  // Multi-source flood (through everything) → nearest reachable cell for any cell.
  NEAREST.fill(-1);
  head = 0; tail = 0;
  for (let c = 0; c < N; c++) if (REACH[c]) { NEAREST[c] = c; queue[tail++] = c; }
  while (head < tail) {
    const c = queue[head++];
    const i = c % NX, j = (c - i) / NX;
    for (let k = 0; k < 8; k++) {
      const ni = i + NB[k][0], nj = j + NB[k][1];
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = nj * NX + ni;
      if (NEAREST[n] !== -1) continue;
      NEAREST[n] = NEAREST[c]; queue[tail++] = n;
    }
  }
})();

function reachableLocal(x: number, z: number): boolean {
  if (x < MIN_X || x >= MAX_X || z < MIN_Z || z >= MAX_Z) return false;
  return REACH[cellOfLocal(x, z)] === 1;
}

/** Nearest reachable cell to a WORLD position. */
export function cellAt(wx: number, wz: number): number {
  const l = worldToHero(wx, wz);
  return NEAREST[cellOfLocal(l.x, l.z)];
}

export function cellCenter(c: number): { x: number; z: number } {
  const [lx, lz] = cellCenterLocal(c);
  return heroToWorld(lx, lz);
}

function snapLocal(p: [number, number]): [number, number] {
  return cellCenterLocal(NEAREST[cellOfLocal(p[0], p[1])]);
}
function toWorld(p: [number, number]): { x: number; z: number } {
  const s = snapLocal(p);
  return heroToWorld(s[0], s[1]);
}

// ------------------------------------------------------------- public layout --

/** Where the kids start (world). */
export const MUNCHIES_SPAWN = toWorld(SPAWN_L);
/** Facing into the house from the front door. */
export const MUNCHIES_SPAWN_YAW = Math.PI;

/** Where each sleepwalker wakes up / goes back to (world). */
export const WALKER_HOME: Record<MunchiesWalkerId, { x: number; z: number }> = {
  dad: toWorld(WALKER_SPAWN_L.dad),
  penny: toWorld(WALKER_SPAWN_L.penny),
  dog: toWorld(WALKER_SPAWN_L.dog),
  schmorgesblob: toWorld(WALKER_SPAWN_L.schmorgesblob),
};

export const MUNCHIES_MILKS: { id: string; x: number; z: number }[] =
  MILKS_L.map((m) => ({ id: m.id, ...toWorld(m.at) }));

export const MUNCHIES_BONUS_POS = toWorld(BONUS_L);

/** Every cookie in the maze, in a stable order (index = network id). */
export const MUNCHIES_PELLETS: { id: string; x: number; z: number }[] = (() => {
  const keepAway: { p: [number, number]; r: number }[] = [
    { p: snapLocal(SPAWN_L), r: 1.2 },
    ...MILKS_L.map((m) => ({ p: snapLocal(m.at), r: 0.8 })),
    ...Object.values(WALKER_SPAWN_L).map((p) => ({ p: snapLocal(p), r: 0.8 })),
  ];
  const out: { id: string; x: number; z: number }[] = [];
  // A 1 m lattice (every 2nd cell). Lattice cells that land inside a wall or
  // fort simply get no cookie — every cookie that exists is reachable.
  for (let j = 1; j < NZ; j += 2) {
    for (let i = 1; i < NX; i += 2) {
      const c = j * NX + i;
      if (!REACH[c]) continue;
      const [lx, lz] = cellCenterLocal(c);
      if (keepAway.some((k) => Math.hypot(lx - k.p[0], lz - k.p[1]) < k.r)) continue;
      const w = heroToWorld(lx, lz);
      out.push({ id: `p${out.length}`, x: w.x, z: w.z });
    }
  }
  return out;
})();

/** The rects the PLAYER collides with in this mode (world-space AABBs). */
export function buildMunchiesColliders(): RectCollider[] {
  const toRect = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, tag: string, maxY: number): RectCollider => {
    const corners = [heroToWorld(r.minX, r.minZ), heroToWorld(r.maxX, r.minZ), heroToWorld(r.maxX, r.maxZ), heroToWorld(r.minX, r.maxZ)];
    return {
      minX: Math.min(...corners.map((c) => c.x)), maxX: Math.max(...corners.map((c) => c.x)),
      minZ: Math.min(...corners.map((c) => c.z)), maxZ: Math.max(...corners.map((c) => c.z)),
      minY: 0, maxY, tag,
    };
  };
  const out: RectCollider[] = [];
  for (const b of MAZE_BLOCKS) {
    if (b.kind === 'closed') continue; // the garage walls already exist; only its door needs a plug
    out.push(toRect(b, `munchies-${b.id}`, 2));
  }
  out.push(toRect(GARAGE_DOOR_PLUG, 'munchies-garage-door', 2.2));
  return out;
}

/** Keep a world position inside the house shell (belt-and-braces for the player). */
export function clampToHouse(pos: { x: number; z: number }): void {
  const l = worldToHero(pos.x, pos.z);
  const cx = Math.max(MIN_X + EXT_CLEAR, Math.min(MAX_X - EXT_CLEAR, l.x));
  const cz = Math.max(MIN_Z + EXT_CLEAR, Math.min(MAX_Z - EXT_CLEAR, l.z));
  if (cx === l.x && cz === l.z) return;
  const w = heroToWorld(cx, cz);
  pos.x = w.x; pos.z = w.z;
}

// ------------------------------------------------------------- pathfinding --

/**
 * BFS distance (in cells) from every reachable cell to `goal`. Diagonal steps
 * are only allowed when both orthogonal neighbours are open, so a path never
 * clips a corner. Unreachable cells hold 32767.
 */
export function distanceField(goal: number, out: Int16Array = new Int16Array(N)): Int16Array {
  out.fill(32767);
  if (goal < 0 || !REACH[goal]) return out;
  const queue = FIELD_QUEUE;
  let head = 0, tail = 0;
  out[goal] = 0; queue[tail++] = goal;
  while (head < tail) {
    const c = queue[head++];
    const d = out[c] + 1;
    const i = c % NX, j = (c - i) / NX;
    for (let k = 0; k < 8; k++) {
      const di = NB[k][0], dj = NB[k][1];
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = nj * NX + ni;
      if (!REACH[n] || out[n] <= d) continue;
      if (k >= 4 && (!REACH[j * NX + ni] || !REACH[nj * NX + i])) continue;
      out[n] = d; queue[tail++] = n;
    }
  }
  return out;
}
const FIELD_QUEUE = new Int32Array(N * 2);

function lineOfSightLocal(ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(d / 0.2));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    if (!reachableLocal(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/** How many cells ahead a walker looks when smoothing its path. */
const LOOKAHEAD = 10;

/**
 * Where a walker at (wx, wz) should head next to follow `field` downhill.
 * Looks several cells ahead and picks the farthest one it can walk STRAIGHT
 * to, so paths cut smooth diagonals across open rooms instead of stair-stepping
 * through cell centres. Returns null when already at the goal cell.
 */
export function nextWaypoint(field: Int16Array, wx: number, wz: number): { x: number; z: number } | null {
  const l = worldToHero(wx, wz);
  let cur = NEAREST[cellOfLocal(l.x, l.z)];
  if (cur < 0 || field[cur] === 0 || field[cur] === 32767) return null;
  let best = -1;
  for (let step = 0; step < LOOKAHEAD; step++) {
    const i = cur % NX, j = (cur - i) / NX;
    let next = -1;
    let nd = field[cur];
    for (let k = 0; k < 8; k++) {
      const ni = i + NB[k][0], nj = j + NB[k][1];
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = nj * NX + ni;
      if (!REACH[n] || field[n] >= nd) continue;
      if (k >= 4 && (!REACH[j * NX + ni] || !REACH[nj * NX + i])) continue;
      nd = field[n]; next = n;
    }
    if (next < 0) break;
    cur = next;
    const [cx, cz] = cellCenterLocal(cur);
    if (best < 0 || lineOfSightLocal(l.x, l.z, cx, cz)) best = cur;
    else break;
    if (field[cur] === 0) break;
  }
  if (best < 0) return null;
  const [bx, bz] = cellCenterLocal(best);
  return heroToWorld(bx, bz);
}

/** A reachable cell roughly `dist` metres from (wx, wz) in a seeded direction —
 *  used for the sleepwalkers' aimless shuffling. */
export function wanderCell(wx: number, wz: number, seed: number, dist = 5): number {
  const l = worldToHero(wx, wz);
  for (let tries = 0; tries < 8; tries++) {
    const a = (seed * 2.399963 + tries * 0.785398) % (Math.PI * 2);
    const x = l.x + Math.cos(a) * dist;
    const z = l.z + Math.sin(a) * dist;
    if (reachableLocal(x, z)) return cellOfLocal(x, z);
  }
  return NEAREST[cellOfLocal(l.x, l.z)];
}

/** Debug: print the maze ('#' wall, '.' floor, 'o' cookie). DEV console helper. */
export function mazeAscii(): string {
  const pellets = new Set(MUNCHIES_PELLETS.map((p) => { const l = worldToHero(p.x, p.z); return cellOfLocal(l.x, l.z); }));
  const mark = new Map<number, string>();
  mark.set(cellOfLocal(...snapLocal(SPAWN_L)), 'S');
  for (const m of MILKS_L) mark.set(cellOfLocal(...snapLocal(m.at)), 'M');
  for (const [id, p] of Object.entries(WALKER_SPAWN_L)) mark.set(cellOfLocal(...snapLocal(p)), id[0].toUpperCase());
  mark.set(cellOfLocal(...snapLocal(BONUS_L)), 'B');
  let s = '';
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      s += mark.get(c) ?? (pellets.has(c) ? 'o' : REACH[c] ? '.' : '#');
    }
    s += '\n';
  }
  return s;
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__maze = { mazeAscii, MUNCHIES_PELLETS, MAZE_BLOCKS };
}
