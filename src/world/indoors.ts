import { HOUSES } from './houses';
import { buildLots } from './lots';
import { SCHOOL_MIN_X, SCHOOL_MAX_X, SCHOOL_MIN_Z, SCHOOL_MAX_Z, SCHOOL_SHIFT_X } from './school';
import { WINGA_MIN_X, WINGA_MAX_X, WINGA_FRONT_Z, WINGA_BACK_Z, WINGB_FRONT_X, WINGB_BACK_X, WINGB_MIN_Z, WINGB_MAX_Z } from './acrossBlvd';

/**
 * "Am I inside a building?" — the safety rule for Siren Head after dark.
 * Every house footprint (all 25 lots, rotated with the house), 10600's
 * playhouse, the school and both shop wings count as indoors. A small margin
 * keeps a kid standing in a doorway safe too.
 */
interface Rect { cx: number; cz: number; yaw: number; hw: number; hd: number }

const MARGIN = 0.7;

function buildRects(): Rect[] {
  const rects: Rect[] = [];
  const lots = buildLots(HOUSES);
  for (const h of HOUSES) {
    const lot = lots.find((l) => l.address === h.address);
    if (!lot) continue;
    rects.push({ cx: lot.housePivot[0], cz: lot.housePivot[1], yaw: lot.houseYaw, hw: h.width / 2 + MARGIN, hd: h.depth / 2 + MARGIN });
  }
  // 10600's "68" playhouse (house-local [3,17] → world z + 37.9).
  rects.push({ cx: 3, cz: 54.9, yaw: 0, hw: 2.3, hd: 2.3 });
  // Avery Ranch Elementary.
  rects.push({ cx: (SCHOOL_MIN_X + SCHOOL_MAX_X) / 2 + SCHOOL_SHIFT_X, cz: (SCHOOL_MIN_Z + SCHOOL_MAX_Z) / 2, yaw: 0, hw: (SCHOOL_MAX_X - SCHOOL_MIN_X) / 2 + MARGIN, hd: (SCHOOL_MAX_Z - SCHOOL_MIN_Z) / 2 + MARGIN });
  // The shops across the boulevard.
  // The covered storefront walkways count too: the boutique's dress-up spot and
  // the Woof Gang pen sit a couple of metres out from the wall, and a kid
  // input-locked in the wardrobe (or cuddling a puppy) must not get swatted.
  const WALK_A = 3.4; // Wing A faces south (+Z)
  const WALK_B = 5.0; // Wing B faces west (−X) — covers the pup pens + treat jar
  rects.push({ cx: (WINGA_MIN_X + WINGA_MAX_X) / 2, cz: (WINGA_FRONT_Z + WALK_A + WINGA_BACK_Z) / 2, yaw: 0, hw: (WINGA_MAX_X - WINGA_MIN_X) / 2 + MARGIN, hd: Math.abs(WINGA_FRONT_Z + WALK_A - WINGA_BACK_Z) / 2 + MARGIN });
  rects.push({ cx: (WINGB_FRONT_X - WALK_B + WINGB_BACK_X) / 2, cz: (WINGB_MIN_Z + WINGB_MAX_Z) / 2, yaw: 0, hw: Math.abs(WINGB_BACK_X - (WINGB_FRONT_X - WALK_B)) / 2 + MARGIN, hd: (WINGB_MAX_Z - WINGB_MIN_Z) / 2 + MARGIN });
  return rects;
}

let RECTS: Rect[] | null = null;

export function isIndoors(x: number, z: number): boolean {
  if (!RECTS) RECTS = buildRects();
  for (const r of RECTS) {
    const dx = x - r.cx, dz = z - r.cz;
    // r.yaw is a three.js rotation.y (house → world), so world → house-local is
    // this rotation (the old −yaw mirrored the two angled houses' footprints).
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (lx > -r.hw && lx < r.hw && lz > -r.hd && lz < r.hd) return true;
  }
  return false;
}
