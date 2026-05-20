import { ROOMS, INTERIOR_WALLS } from '../components/hero/floorPlan';
import type { PelletPosition } from '../state/munchiesStore';
import { PLAYER_SPAWN } from './munchiesConfig';

const COOKIE_SPACING = 1.2;
const COOKIE_WALL_MARGIN = 0.55;     // skip cookies this close to any wall
const COOKIE_SPAWN_MARGIN = 0.8;     // skip cookies near player spawn
const COOKIE_BED_MARGIN = 0.7;       // skip cookies near sleepwalker beds

/** World-space coords of sleepwalker bed cells we don't want to pollute. */
const BED_BLOCKERS: [number, number][] = [
  [-7.25, 5.0], // master-bed
  [-4.0,  5.0], // penny-bed
  [ 0.5,  5.0], // luke-bed
  [ 0.3, -4.0], // kitchen dog bed
];

function distToWall(x: number, z: number): number {
  let best = Infinity;
  for (const w of INTERIOR_WALLS) {
    // 'z' axis = constant X = w.at, spans w.from..w.to on Z
    if (w.axis === 'z') {
      const along = Math.max(w.from, Math.min(w.to, z));
      const d = Math.hypot(x - w.at, z - along);
      if (d < best) best = d;
    } else {
      // 'x' axis = constant Z = w.at, spans w.from..w.to on X
      const along = Math.max(w.from, Math.min(w.to, x));
      const d = Math.hypot(z - w.at, x - along);
      if (d < best) best = d;
    }
  }
  return best;
}

function tooCloseToSpawn(x: number, z: number): boolean {
  const [sx, sz] = PLAYER_SPAWN;
  return Math.hypot(x - sx, z - sz) < COOKIE_SPAWN_MARGIN;
}

function tooCloseToBed(x: number, z: number): boolean {
  for (const [bx, bz] of BED_BLOCKERS) {
    if (Math.hypot(x - bx, z - bz) < COOKIE_BED_MARGIN) return true;
  }
  return false;
}

export function generatePellets(): Record<string, PelletPosition> {
  const out: Record<string, PelletPosition> = {};
  let id = 0;
  for (const room of ROOMS) {
    if (room.id === 'garage') continue;       // garage is off-limits
    for (let x = room.minX + 0.6; x < room.maxX; x += COOKIE_SPACING) {
      for (let z = room.minZ + 0.6; z < room.maxZ; z += COOKIE_SPACING) {
        if (distToWall(x, z) < COOKIE_WALL_MARGIN) continue;
        if (tooCloseToSpawn(x, z)) continue;
        if (tooCloseToBed(x, z)) continue;
        const pid = `p${id++}`;
        out[pid] = { id: pid, x, z };
      }
    }
  }
  return out;
}

export function buildMilks(): Record<string, PelletPosition> {
  return {
    'milk-nw': { id: 'milk-nw', x: -8.0, z:  7.0 },  // master bedroom NW corner
    'milk-ne': { id: 'milk-ne', x:  1.5, z:  7.0 },  // Luke's bedroom NE corner
    'milk-sw': { id: 'milk-sw', x: -8.0, z: -7.0 },  // great room SW corner
    'milk-se': { id: 'milk-se', x:  1.5, z: -7.0 },  // kitchen SE corner
  };
}

/** Spawn position for the bonus cookie. */
export const BONUS_SPAWN_POS: [number, number] = [0.3, -4.0]; // kitchen center
