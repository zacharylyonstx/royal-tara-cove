// Outdoor navigation for the Schmorgesblobs.
//
// The blobs used to steer straight at the player with one hard-coded detour
// point — which happened to sit INSIDE 10600, so every wave oozed through the
// back wall, across the living room and out through the front door. This module
// gives them a real map: a coarse walkability grid over the cul-de-sac + the
// stick street, a BFS distance field per chased player, and line-of-sight
// smoothing so paths cut clean diagonals instead of stair-stepping.
//
// What blocks a blob: anything tall and solid (house walls, tree trunks), plus
// every house FOOTPRINT (so door gaps don't invite them through a living room).
// Fences don't — a blob squeezes through the pickets.
import type { RectCollider } from '../types';
import { HOUSES } from './houses';
import { houseTransform } from './streetLayout';
import { HERO_PIVOT_X, HERO_PIVOT_Z, HERO_YAW } from './heroPlace';

const CELL = 0.8;
const MIN_X = -84;
const MAX_X = 84;
const MIN_Z = -200;
const MAX_Z = 96;
const NX = Math.ceil((MAX_X - MIN_X) / CELL);
const NZ = Math.ceil((MAX_Z - MIN_Z) / CELL);
const N = NX * NZ;
/** A blob is ~0.5 m across the middle; keep its centre this far off walls. */
const PAD = 0.55;
const UNREACHED = 65535;

const NB: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

let blocked: Uint8Array | null = null;
let builtFor: RectCollider[] | null = null;
const queue = new Int32Array(N);

function cellOf(x: number, z: number): number {
  const i = Math.floor((x - MIN_X) / CELL);
  const j = Math.floor((z - MIN_Z) / CELL);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return -1;
  return j * NX + i;
}
function cellX(c: number): number { return MIN_X + ((c % NX) + 0.5) * CELL; }
function cellZ(c: number): number { return MIN_Z + (Math.floor(c / NX) + 0.5) * CELL; }

/** Stamp an oriented box (collision-convention yaw) into the grid. */
function stamp(grid: Uint8Array, cx: number, cz: number, halfX: number, halfZ: number, yaw: number): void {
  const hx = halfX + PAD;
  const hz = halfZ + PAD;
  const reach = Math.hypot(hx, hz);
  const i0 = Math.max(0, Math.floor((cx - reach - MIN_X) / CELL));
  const i1 = Math.min(NX - 1, Math.floor((cx + reach - MIN_X) / CELL));
  const j0 = Math.max(0, Math.floor((cz - reach - MIN_Z) / CELL));
  const j1 = Math.min(NZ - 1, Math.floor((cz + reach - MIN_Z) / CELL));
  const cn = Math.cos(-yaw);
  const sn = Math.sin(-yaw);
  for (let j = j0; j <= j1; j++) {
    const z = MIN_Z + (j + 0.5) * CELL - cz;
    for (let i = i0; i <= i1; i++) {
      const x = MIN_X + (i + 0.5) * CELL - cx;
      const lx = x * cn - z * sn;
      const lz = x * sn + z * cn;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) grid[j * NX + i] = 1;
    }
  }
}

/** (Re)build the grid from the world's static colliders. Cheap (~1 ms). */
export function ensureBlobNav(colliders: RectCollider[]): void {
  if (blocked && builtFor === colliders) return;
  const grid = new Uint8Array(N);
  for (const c of colliders) {
    if (c.passable) continue;
    if ((c.minY ?? 0) > 0.6) continue;            // upstairs / overhead
    if ((c.maxY ?? 6) < 2.2) continue;            // fences, furniture, kerbs
    if (c.tag && c.tag.startsWith('fence')) continue;
    stamp(grid, (c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2, (c.maxX - c.minX) / 2, (c.maxZ - c.minZ) / 2, c.yaw ?? 0);
  }
  // Whole house footprints — walls have door gaps, and a blob should go AROUND
  // a house, not through its hallway.
  for (const h of HOUSES) {
    if (h.isHero) {
      stamp(grid, HERO_PIVOT_X, HERO_PIVOT_Z, h.width / 2, h.depth / 2, -HERO_YAW || 0);
    } else {
      const t = houseTransform(h.position, h.depth);
      stamp(grid, t.worldX, t.worldZ, h.width / 2, h.depth / 2, -t.yaw || 0);
    }
  }
  blocked = grid;
  builtFor = colliders;
  fields.clear();
}

function isOpen(c: number): boolean {
  return c >= 0 && !!blocked && blocked[c] === 0;
}

/** Nearest open cell to (x, z) — a spiral search a few metres out. −1 if none. */
function nearestOpen(x: number, z: number): number {
  const c = cellOf(x, z);
  if (c < 0) return -1;
  if (isOpen(c)) return c;
  const i = c % NX;
  const j = Math.floor(c / NX);
  let best = -1;
  let bestD = Infinity;
  for (let r = 1; r <= 14 && best < 0; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const n = nj * NX + ni;
        if (blocked![n]) continue;
        const d = Math.hypot(cellX(n) - x, cellZ(n) - z);
        if (d < bestD) { bestD = d; best = n; }
      }
    }
  }
  return best;
}

/** Is the straight walk from A to B clear of walls? */
export function blobLineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
  if (!blocked) return true;
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(d / (CELL * 0.45)));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const c = cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
    if (c >= 0 && blocked[c]) return false;
  }
  return true;
}

/** How far a zap travels from (ax, az) along unit (dx, dz) before a wall stops
 *  it (capped at `max`). */
export function blobRayReach(ax: number, az: number, dx: number, dz: number, max: number): number {
  if (!blocked) return max;
  const step = CELL * 0.45;
  for (let d = step; d < max; d += step) {
    const c = cellOf(ax + dx * d, az + dz * d);
    if (c >= 0 && blocked[c]) return d;
  }
  return max;
}

export interface NavField {
  dist: Uint16Array;
  goalCell: number;
  goalX: number;
  goalZ: number;
  /** The player is somewhere a blob can't walk to (indoors) — ooze the last bit. */
  goalBlocked: boolean;
  at: number;
}

const fields = new Map<string, NavField>();
const REFRESH_S = 0.45;

/**
 * Distance field toward a chased player, cached per player id and refreshed a
 * couple of times a second (or sooner when they've moved to another cell).
 */
export function navFieldFor(id: string, gx: number, gz: number, now: number): NavField | null {
  if (!blocked) return null;
  let f = fields.get(id);
  const raw = cellOf(gx, gz);
  if (raw < 0) return null; // player has left the mapped area → chase directly
  if (f && now - f.at < REFRESH_S && now >= f.at) {
    f.goalX = gx; f.goalZ = gz;
    return f;
  }
  const goalCell = isOpen(raw) ? raw : nearestOpen(gx, gz);
  if (goalCell < 0) return null;
  if (!f) {
    f = { dist: new Uint16Array(N), goalCell, goalX: gx, goalZ: gz, goalBlocked: false, at: now };
    fields.set(id, f);
  }
  f.goalCell = goalCell;
  f.goalX = gx; f.goalZ = gz;
  f.goalBlocked = goalCell !== raw;
  f.at = now;
  const dist = f.dist;
  dist.fill(UNREACHED);
  let head = 0, tail = 0;
  dist[goalCell] = 0;
  queue[tail++] = goalCell;
  const grid = blocked;
  while (head < tail) {
    const c = queue[head++];
    const d = dist[c] + 1;
    const i = c % NX, j = (c - i) / NX;
    for (let k = 0; k < 8; k++) {
      const ni = i + NB[k][0], nj = j + NB[k][1];
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = nj * NX + ni;
      if (grid[n] || dist[n] <= d) continue;
      // No cutting corners diagonally past a wall.
      if (k >= 4 && (grid[j * NX + ni] || grid[nj * NX + i])) continue;
      dist[n] = d;
      queue[tail++] = n;
    }
  }
  return f;
}

const LOOKAHEAD = 14;

/**
 * Where a blob at (x, z) should head next. Follows the field downhill, looking
 * several cells ahead and aiming at the farthest one it can reach in a straight
 * line. Falls back to the player's real position when it's in sight, when the
 * blob is off the map, or when there is simply no route.
 */
export function blobWaypoint(f: NavField | null, x: number, z: number, out: { x: number; z: number }): void {
  if (!f || !blocked) { if (f) { out.x = f.goalX; out.z = f.goalZ; } return; }
  out.x = f.goalX; out.z = f.goalZ;
  const here = cellOf(x, z);
  if (here < 0) return;
  let cur = here;
  if (blocked[cur]) {
    // Spawned in / knocked into something solid: wriggle to the nearest floor.
    cur = nearestOpen(x, z);
    if (cur < 0) return;
    out.x = cellX(cur); out.z = cellZ(cur);
    return;
  }
  const d0 = f.dist[cur];
  if (d0 === UNREACHED) return;
  // Close and in the open → just go for them (also the "player is indoors"
  // case: the last stretch oozes under the door).
  if (d0 <= 2) return;
  if (!f.goalBlocked && d0 < 40 && blobLineOfSight(x, z, f.goalX, f.goalZ)) return;
  let best = -1;
  for (let step = 0; step < LOOKAHEAD; step++) {
    const i = cur % NX, j = (cur - i) / NX;
    let next = -1;
    let nd = f.dist[cur];
    for (let k = 0; k < 8; k++) {
      const ni = i + NB[k][0], nj = j + NB[k][1];
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = nj * NX + ni;
      if (blocked[n] || f.dist[n] >= nd) continue;
      if (k >= 4 && (blocked[j * NX + ni] || blocked[nj * NX + i])) continue;
      nd = f.dist[n];
      next = n;
    }
    if (next < 0) break;
    cur = next;
    if (best < 0 || blobLineOfSight(x, z, cellX(cur), cellZ(cur))) best = cur;
    else break;
    if (f.dist[cur] === 0) break;
  }
  if (best < 0) return;
  out.x = cellX(best);
  out.z = cellZ(best);
}

/** Snap a point to somewhere a blob can stand (spawn sites, split babies). */
export function blobSafeSpot(x: number, z: number): { x: number; z: number } {
  if (!blocked) return { x, z };
  const c = cellOf(x, z);
  if (c < 0 || !blocked[c]) return { x, z };
  const n = nearestOpen(x, z);
  return n < 0 ? { x, z } : { x: cellX(n), z: cellZ(n) };
}

/** DEV: print the grid around a point ('#' solid, '.' open). */
export function blobNavAscii(cx = 0, cz = 20, halfW = 60, halfD = 60): string {
  if (!blocked) return '(not built)';
  let s = '';
  for (let z = cz - halfD; z <= cz + halfD; z += CELL * 2) {
    for (let x = cx - halfW; x <= cx + halfW; x += CELL) {
      const c = cellOf(x, z);
      s += c < 0 ? ' ' : blocked[c] ? '#' : '.';
    }
    s += '\n';
  }
  return s;
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__blobNav = { ascii: blobNavAscii, los: blobLineOfSight, safe: blobSafeSpot };
}
