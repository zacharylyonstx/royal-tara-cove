import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { RAIL_X, RAIL_X_B } from '../../world/westAvery';
import { Q2_Z, SALTILLO_Z, CHAVEZ_Z, LAMAR_Z, MLK_BLVD_Z } from '../../world/redLine';
import {
  MID, NEAR, CITY_SECTIONS, citySection, cityOccupied, OVERPASSES, DECK_T, PIER_R, overpassPiers, CITY_ROADS, ROAD_SPANS,
  CITY_BLOCKS, CITY_LOTS, KRAMER_LOT, CITY_STREETS, CITY_HOUSES, Q2, Q2_STANDS, Q2_PLAZA, ACC, MURAL, BANDSTAND, CONVENTION,
  CITY_WALK_Z, CITY_PLAZA, FOURTH, SQUARE, CONGRESS, VISTA, CITY_SHOP_DEPTH, CITY_SHOPS, FIREHOUSE, cityShopFront,
  SQUARE_OAKS, TRAILER, CITY_PLANTERS, TOTEM, GUITAR, PARK, COTTAGE, CITY_BUS, SKYLINE, CAPITOL, CAPITOL_LAWN, CITY_TREATS,
  type CityBlock, type CityHouse, type Overpass, type Rect, type SkyTower,
} from '../../world/cityLine';
import type { Shop } from '../../world/domain';
import { rng32 } from '../../world/corridor';
import { useZoneStore } from '../../state/zoneStore';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { Batch, glowPaint, paint } from './batch';

// The view from the train window, the Domain → Downtown Austin, and the bit of
// Downtown you can walk around (layout + the real-world notes: world/cityLine.ts).
// Baked a stretch at a time — four stretches of line plus the skyline — each
// into the usual four meshes (paint, dark glass, windows lit after dark, glow),
// so the stretches out of sight are culled whole. Only the freeway traffic moves.

const PAVER = '#cdbfa6';
const PAVER_DARK = '#b7a78c';
const ASPHALT = '#4a4f57';
const WALK = '#cfc9bc';
const GLASS = '#26323d';
const CONCRETE = '#b9b5aa';
const STEEL = '#5f7383';
const BARK = '#4a3a2c';
const LIT = ['#ffd89a', '#ffe7b8', '#ffc978', '#fff1d0'];
const CAR_COLORS = ['#c7ccd3', '#2f3b4f', '#8c1f24', '#e9e4d6', '#35567e', '#4a4f55', '#d7a23a', '#2d5f46', '#f2f2f0', '#6b7f95'];
const GREENS = ['#3f6b3a', '#4a7a40', '#365f38', '#557f46', '#4f8a45'];
const AWNINGS = ['#c8102e', '#2f5d50', '#e9a020', '#2e7fd0', '#e86a92', '#3fb6b2'];

type Rnd = () => number;
type Ori = 'x' | 'z';
const pick = <T,>(r: Rnd, a: readonly T[]): T => a[Math.floor(r() * a.length)];
const mid = (r: Rect): [number, number, number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, r.z1 - r.z0];

// ------------------------------------------------------------ small parts --
/** A thin panel on a wall. `ori` 'x': the wall is the plane x = pos and `u`
 *  runs along z; 'z': the plane z = pos, `u` along x. `out` = the way it faces. */
function onWall(b: Batch, group: string, color: string, ori: Ori, pos: number, out: number, off: number, u: number, uw: number, y: number, yh: number, t = 0.1) {
  if (ori === 'x') b.box(group, color, t, yh, uw, pos + out * off, y, u);
  else b.box(group, color, uw, yh, t, u, y, pos + out * off);
}

/** Flats: a tall strip of glass per bay with the floors banded across it. */
function grid(b: Batch, rnd: Rnd, ori: Ori, pos: number, out: number, u0: number, u1: number, y0: number, floors: number, fh: number, wall: string, litP: number) {
  const span = u1 - u0 - 1.2, cols = Math.max(1, Math.round(span / 4.2)), cw = span / cols, top = y0 + floors * fh;
  for (let c = 0; c < cols; c++) {
    const u = u0 + 0.6 + (c + 0.5) * cw;
    onWall(b, 'glass', GLASS, ori, pos, out, 0.03, u, cw * 0.62, (y0 + top) / 2, top - y0 - 1.1);
    for (let f = 0; f < floors; f++) {
      if (rnd() < litP) onWall(b, 'lit', pick(rnd, LIT), ori, pos, out, 0.1, u, cw * 0.62 - 0.15, y0 + (f + 0.5) * fh, fh - 1.25, 0.02);
    }
  }
  for (let f = 1; f < floors; f++) onWall(b, 'solid', wall, ori, pos, out, 0, (u0 + u1) / 2, u1 - u0 - 0.4, y0 + f * fh, 1.1, 0.26);
}

/** Offices: a ribbon of glass per floor, cut into bays by mullions (`wall`).
 *  `p` pushes everything further proud of the wall for buildings seen from afar. */
function ribbon(b: Batch, rnd: Rnd, ori: Ori, pos: number, out: number, u0: number, u1: number, y0: number, floors: number, fh: number, glass: string, litP: number, wall?: string, p = 1) {
  const span = u1 - u0 - 1.4, n = Math.max(1, Math.floor(span / 4.5));
  for (let f = 0; f < floors; f++) {
    const y = y0 + (f + 0.5) * fh;
    onWall(b, 'glass', glass, ori, pos, out, 0.03 * p, (u0 + u1) / 2, span, y, fh - 1.4, 0.1 * p);
    for (let k = 0; k < n; k++) {
      if (rnd() < litP) onWall(b, 'lit', pick(rnd, LIT), ori, pos, out, 0.11 * p, u0 + 0.7 + (k + 0.5) * (span / n), span / n - 0.4, y, fh - 1.6, 0.02);
    }
  }
  if (wall) for (let k = 1; k < n; k++) onWall(b, 'solid', wall, ori, pos, out, 0, u0 + 0.7 + k * (span / n), 0.3, y0 + (floors * fh) / 2, floors * fh - 0.6, 0.2);
}

/** Street-level shopfront: plate glass, lit from inside, a row of awnings. */
function shopfront(b: Batch, rnd: Rnd, ori: Ori, pos: number, out: number, u0: number, u1: number, accent: string, wall: string) {
  const span = u1 - u0, um = (u0 + u1) / 2;
  onWall(b, 'solid', '#2a2f36', ori, pos, out, 0.03, um, span - 0.8, 2.0, 3.4, 0.12);
  onWall(b, 'glass', GLASS, ori, pos, out, 0.08, um, span - 1.6, 1.9, 2.6);
  onWall(b, 'lit', pick(rnd, LIT), ori, pos, out, 0.15, um, span - 1.8, 1.9, 2.4, 0.02);
  const bays = Math.max(1, Math.round(span / 7.5)), bw = span / bays;
  for (let i = 0; i < bays; i++) {
    const u = u0 + (i + 0.5) * bw, col = i % 2 ? pick(rnd, AWNINGS) : accent;
    if (ori === 'x') b.box('solid', col, 1.8, 0.12, bw - 1.2, pos + out * 0.9, 3.75, u, 0, 0, -out * 0.28);
    else b.box('solid', col, bw - 1.2, 0.12, 1.8, u, 3.75, pos + out * 0.9, 0, out * 0.28);
    if (i > 0) onWall(b, 'solid', wall, ori, pos, out, 0, u - bw / 2, 0.8, 2.0, 3.6, 0.36);    // the pier between two shops
    onWall(b, 'solid', '#2a2f36', ori, pos, out, 0.14, u + bw * 0.22, 1.2, 1.5, 2.6, 0.04);          // a door
  }
}

function car(b: Batch, x: number, z: number, color: string, ry = 0) {
  b.box('solid', color, 1.85, 0.7, 4.2, x, 0.6, z, ry);
  b.box('solid', '#20262d', 1.6, 0.55, 2.1, x - Math.sin(ry) * 0.2, 1.2, z - Math.cos(ry) * 0.2, ry);
}
function bus(b: Batch, x: number, z: number) {
  b.box('solid', '#f1f2f4', 2.6, 2.9, 11, x, 1.75, z);
  b.box('solid', '#1f5fae', 2.64, 0.5, 11.04, x, 0.9, z);
  b.box('solid', '#1c232c', 2.66, 0.9, 9.6, x, 2.35, z);
}
/** A street tree. */
function tree(b: Batch, x: number, z: number, s: number, color: string) {
  b.box('solid', BARK, 0.32 * s, 2.6 * s, 0.32 * s, x, 1.3 * s, z);
  b.blob('solid', color, 2.2 * s, x, 3.9 * s, z, 0.85);
}
/** A big pecan / shade tree: thick trunk, broad lumpy crown. */
function bigTree(b: Batch, rnd: Rnd, x: number, z: number, s: number) {
  const a = rnd() * Math.PI * 2;
  b.cyl('solid', BARK, 0.3 * s, 0.48 * s, 3.6 * s, x, 1.8 * s, z, 6);
  b.blob('solid', pick(rnd, GREENS), 3.3 * s, x, 5.8 * s, z, 0.78);
  b.blob('solid', pick(rnd, GREENS), 2.5 * s, x + Math.cos(a) * 2.3 * s, 5.0 * s, z + Math.sin(a) * 2.3 * s, 0.78);
  b.blob('solid', pick(rnd, GREENS), 2.3 * s, x - Math.cos(a) * 2.1 * s, 5.2 * s, z - Math.sin(a) * 2.1 * s, 0.78);
}
/** A live oak: short trunk, heavy limbs reaching out, a wide low canopy. */
function liveOak(b: Batch, rnd: Rnd, x: number, z: number, s: number) {
  b.cyl('solid', BARK, 0.46 * s, 0.72 * s, 3.2 * s, x, 1.6 * s, z, 7);
  b.blob('solid', '#3f6b3a', 4.0 * s, x, 7.0 * s, z, 0.6);
  const a0 = rnd() * Math.PI * 2, tilt = 0.95, len = 4.6 * s;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.09 + (rnd() - 0.5) * 0.5, dx = Math.sin(a), dz = Math.cos(a);
    const hx = Math.sin(tilt) * len, hy = Math.cos(tilt) * len;
    b.cyl('solid', BARK, 0.16 * s, 0.3 * s, len, x + dx * hx / 2, 2.8 * s + hy / 2, z + dz * hx / 2, 5, tilt, 0, a);
    b.blob('solid', GREENS[k], 3.3 * s, x + dx * (hx + 0.6 * s), 2.8 * s + hy + 1.3 * s, z + dz * (hx + 0.6 * s), 0.62);
  }
}
function bench(b: Batch, x: number, z: number, alongX: boolean) {
  b.box('solid', '#8a6a48', alongX ? 1.8 : 0.5, 0.08, alongX ? 0.5 : 1.8, x, 0.46, z);
  for (const e of [-0.7, 0.7]) b.box('solid', '#5b6068', alongX ? 0.08 : 0.45, 0.45, alongX ? 0.45 : 0.08, x + (alongX ? e : 0), 0.23, z + (alongX ? 0 : e));
}
/** Chain-link along the railway boundary (reads as a pale rail from the train). */
function linkFence(b: Batch, x: number, z0: number, z1: number) {
  for (const y of [0.75, 1.4]) b.box('solid', '#9aa3a8', 0.05, 0.05, z1 - z0, x, y, (z0 + z1) / 2);
  for (let z = z0; z <= z1 + 0.01; z += 8) b.box('solid', '#8a9399', 0.07, 1.45, 0.07, x, 0.73, z);
}

// ------------------------------------------------------- pass-by buildings --
function block(b: Batch, k: CityBlock, rnd: Rnd) {
  const [cx, cz, w, d] = mid(k);
  const face = k.side < 0 ? k.x1 : k.x0, out = -k.side;                 // the wall that faces the track
  const ends: [number, number][] = [[k.z0, -1], [k.z1, 1]];
  b.box('solid', k.wall, w, k.h, d, cx, k.h / 2, cz);
  if (k.kind === 'far') {
    // Only a silhouette at this distance: bands of glass on the near face.
    const floors = Math.max(2, Math.floor(k.h / 4.4));
    ribbon(b, rnd, 'x', face, out, k.z0, k.z1, 1.2, floors, (k.h - 1.6) / floors, k.accent, 0.16, undefined, 2.5);
    b.box('solid', k.trim, w * 0.5, 1.6, d * 0.4, cx, k.h + 0.8, cz);
    return;
  }
  // What lies between the building and the railway: a walk along flats and
  // shops, a paved apron with a few cars (or a truck at the dock) elsewhere.
  const edge = MID + k.side * (NEAR + 0.6), gap = Math.abs(face - edge);
  if (k.kind === 'apartment' || k.kind === 'mixed') {
    b.box('solid', WALK, 2.4, 0.06, d, face + out * 1.2, 0.03, cz);
  } else if (gap > 2 && gap < 14) {
    b.box('solid', gap > 6 ? ASPHALT : WALK, gap, 0.04, d + 4, (face + edge) / 2, 0.02, cz);
    if (gap > 6) {
      for (let z = k.z0 + 2; z < k.z1 - 1; z += 2.9) if (rnd() < 0.45) car(b, face + out * 2.7, z, pick(rnd, CAR_COLORS), Math.PI / 2);
    }
    if (k.kind === 'warehouse') {
      const z = k.z1 - 7, x = face + out * 1.95;                                              // a box truck drawn up alongside
      b.box('solid', '#f2f2f0', 2.5, 3.0, 7.2, x, 2.0, z);
      b.box('solid', k.accent, 2.4, 2.3, 2.0, x, 1.5, z - 4.7);
      b.box('solid', '#1c1f23', 2.3, 0.5, 9.2, x, 0.45, z - 1.0);
    }
  }
  b.box('solid', k.trim, w + 0.3, 0.45, d + 0.3, cx, k.h + 0.22, cz);
  b.box('solid', '#8e959b', 2.6, 1.3, 2.6, cx + k.side * w * 0.2, k.h + 0.85, cz - d * 0.2);
  if (k.kind === 'warehouse') {
    // A colour band under the eaves, roller doors, a little office door.
    onWall(b, 'solid', k.accent, 'x', face, out, 0.03, cz, d, k.h - 1.5, 1.0);
    for (const [z, o] of ends) onWall(b, 'solid', k.accent, 'z', z, o, 0.03, cx, w, k.h - 1.5, 1.0);
    const n = Math.max(1, Math.floor(d / 11));
    for (let i = 0; i < n; i++) {
      const z = k.z0 + (i + 0.5) * (d / n);
      onWall(b, 'solid', i % 3 === 2 ? k.trim : '#5b6068', 'x', face, out, 0.04, z, 3.4, 1.9, 3.8);
    }
    onWall(b, 'glass', GLASS, 'x', face, out, 0.05, k.z0 + 2.2, 2.4, 1.5, 2.4);
    if (rnd() < 0.5) onWall(b, 'lit', pick(rnd, LIT), 'x', face, out, 0.11, k.z0 + 2.2, 2.2, 1.5, 2.2, 0.02);
  } else if (k.kind === 'office') {
    const floors = Math.max(1, Math.floor((k.h - 0.9) / 3.5)), fh = (k.h - 0.9) / floors;
    ribbon(b, rnd, 'x', face, out, k.z0, k.z1, 0.5, floors, fh, k.accent, 0.3, k.wall);
    for (const [z, o] of ends) ribbon(b, rnd, 'z', z, o, k.x0, k.x1, 0.5, floors, fh, k.accent, 0.18, k.wall);
    b.box('solid', k.trim, 3.2, 0.2, 5, face + out * 1.6, 3.3, cz);                       // entrance canopy
    for (const dz of [-2.2, 2.2]) b.box('solid', STEEL, 0.14, 3.3, 0.14, face + out * 3.0, 1.65, cz + dz);
  } else if (k.kind === 'retail') {
    shopfront(b, rnd, 'x', face, out, k.z0, k.z1, k.accent, k.wall);
    onWall(b, 'solid', k.trim, 'x', face, out, 0.05, cz, d - 1, k.h - 1.1, 1.3);
    for (const [z, o] of ends) onWall(b, 'glass', GLASS, 'z', z, o, 0.04, face - out * 3, 4.6, 1.9, 2.6);
  } else {
    const shops = k.kind === 'mixed', y0 = shops ? 4.7 : 1.2;
    const floors = Math.round((k.h - (shops ? 5 : 1.9)) / 3.1);
    if (shops) shopfront(b, rnd, 'x', face, out, k.z0, k.z1, k.accent, k.wall);
    grid(b, rnd, 'x', face, out, k.z0, k.z1, y0, floors, 3.1, k.wall, 0.45);
    for (const [z, o] of ends) grid(b, rnd, 'z', z, o, k.x0, k.x1, y0, floors, 3.1, k.wall, 0.22);
    // Balconies under some of the windows (same bays as the glass), and a coloured cornice.
    const span = d - 1.2, cols = Math.max(1, Math.round(span / 4.2)), cw = span / cols;
    for (let f = shops ? 0 : 1; f < floors; f++) {
      for (let c = (f * 2) % 3; c < cols; c += 3) {
        const z = k.z0 + 0.6 + (c + 0.5) * cw, y = y0 + f * 3.1 + 0.5;
        b.box('solid', '#3b4652', 1.0, 0.1, cw * 0.62 + 0.5, face + out * 0.5, y, z);
        b.box('solid', '#3b4652', 0.05, 0.95, cw * 0.62 + 0.5, face + out * 1.0, y + 0.5, z);
      }
    }
    onWall(b, 'solid', k.accent, 'x', face, out, 0.06, cz, d, k.h - 0.5, 0.5, 0.2);
  }
}

function house(b: Batch, h: CityHouse, rnd: Rnd) {
  const HH = 3.5, f = h.face, fx = h.x + f * h.w / 2, pd = h.d * 0.62;
  b.box('solid', h.wall, h.w, HH, h.d, h.x, HH / 2, h.z);
  b.cyl('solid', h.roof, 0, Math.max(h.w, h.d) * 0.76, 2.7, h.x, HH + 1.35, h.z, 4, 0, 0, Math.PI / 4);
  // Front porch: deck, two posts, a lean-to roof.
  b.box('solid', '#b9b0a0', 2.2, 0.35, pd, fx + f * 1.1, 0.18, h.z);
  b.box('solid', h.roof, 2.7, 0.12, pd + 0.6, fx + f * 1.2, 3.0, h.z, 0, 0, -f * 0.18);
  for (const dz of [-pd / 2 + 0.2, pd / 2 - 0.2]) b.box('solid', '#f4efe6', 0.16, 2.5, 0.16, fx + f * 2.05, 1.55, h.z + dz);
  onWall(b, 'solid', h.door, 'x', fx, f, 0.03, h.z, 1.0, 1.4, 2.1);
  for (const dz of [-h.d * 0.3, h.d * 0.3]) {
    onWall(b, 'solid', '#f4efe6', 'x', fx, f, 0.02, h.z + dz, 1.7, 1.95, 1.6, 0.08);
    onWall(b, 'glass', GLASS, 'x', fx, f, 0.05, h.z + dz, 1.4, 1.95, 1.3, 0.08);
    if (rnd() < 0.5) onWall(b, 'lit', pick(rnd, LIT), 'x', fx, f, 0.11, h.z + dz, 1.3, 1.95, 1.2, 0.02);
  }
  // A shade tree in the back yard, more often than not.
  if (rnd() < 0.55) tree(b, h.x - f * (h.w / 2 + 3.5 + rnd() * 2.5), h.z + (rnd() - 0.5) * 5, 1.0 + rnd() * 0.5, pick(rnd, GREENS));
}

/** Surface parking: asphalt, double rows of nose-in cars, a couple of lights. */
function parking(b: Batch, rnd: Rnd, r: Rect, fill: number) {
  const [cx, cz, w, d] = mid(r);
  b.box('solid', ASPHALT, w, 0.04, d, cx, 0.02, cz);
  for (let x = r.x0 + 4.5, k = 0; x < r.x1 - 2.6; x += k % 2 ? 13.5 : 6.5, k++) {
    b.box('solid', '#e9e6dc', 0.1, 0.045, d - 4, x + (k % 2 ? -3.25 : 3.25), 0.025, cz);
    for (let z = r.z0 + 3; z < r.z1 - 2; z += 2.9) {
      if (rnd() < fill) car(b, x, z, pick(rnd, CAR_COLORS), Math.PI / 2);
    }
  }
  for (const lz of [r.z0 + 7, r.z1 - 7]) {
    b.box('solid', '#6b7078', 0.18, 7.5, 0.18, cx, 3.75, lz);
    b.box('glow', '#fff0c8', 1.4, 0.12, 0.4, cx, 7.5, lz);
  }
}

/** A street crossed at grade: asphalt both sides of the formation, a double
 *  yellow line, lane dashes near the line, kerb-side walks, cars at the gates. */
function road(b: Batch, rnd: Rnd, z: number, w: number) {
  for (const [x0, x1] of ROAD_SPANS) {
    const len = x1 - x0, xc = (x0 + x1) / 2;
    b.box('solid', '#4d525b', len, 0.06, w, xc, 0.03, z);
    for (const dz of [-0.18, 0.18]) b.box('solid', '#e2c23e', len, 0.09, 0.14, xc, 0.045, z + dz);
    for (const s of [-1, 1]) b.box('solid', WALK, len, 0.1, 1.4, xc, 0.05, z + s * (w / 2 + 0.7));
  }
  for (const side of [-1, 1]) {
    for (let d = 16; d < 112; d += 9) for (const dz of [-w / 4, w / 4]) b.box('solid', '#f3f1e8', 3, 0.09, 0.14, MID + side * d, 0.045, z + dz);
  }
  // Waiting short of the gates (keep right: eastbound on the south side)…
  const stopW = RAIL_X - 6.5 - 3.4, stopE = RAIL_X_B + 6.5 + 3.4, l0 = w / 8, l1 = (w * 3) / 8;
  car(b, stopW, z + l0, pick(rnd, CAR_COLORS), Math.PI / 2);
  car(b, stopW - 6.6, z + l0, pick(rnd, CAR_COLORS), Math.PI / 2);
  car(b, stopW - 0.6, z + l1, pick(rnd, CAR_COLORS), Math.PI / 2);
  car(b, stopE, z - l0, pick(rnd, CAR_COLORS), -Math.PI / 2);
  car(b, stopE + 0.8, z - l1, pick(rnd, CAR_COLORS), -Math.PI / 2);
  car(b, stopE + 7.6, z - l1, pick(rnd, CAR_COLORS), -Math.PI / 2);
  // …and a few already through, further off.
  car(b, MID - 58, z - l0, pick(rnd, CAR_COLORS), -Math.PI / 2);
  car(b, MID + 52, z + l1, pick(rnd, CAR_COLORS), Math.PI / 2);
  car(b, MID - 96, z - l1, pick(rnd, CAR_COLORS), -Math.PI / 2);
}

/** A freeway over the railway: deck, parapets, piers well clear of the tracks. */
function overpass(b: Batch, o: Overpass) {
  const w = o.z1 - o.z0, zc = (o.z0 + o.z1) / 2, len = o.x1 - o.x0, xc = (o.x0 + o.x1) / 2;
  b.box('solid', CONCRETE, len, DECK_T, w, xc, o.y - DECK_T / 2, zc);
  b.box('solid', '#474c55', len, 0.06, w - 1.2, xc, o.y + 0.03, zc);
  for (const pz of [o.z0 + 0.25, o.z1 - 0.25, zc]) b.box('solid', '#c9c5ba', len, 0.9, 0.4, xc, o.y + 0.45, pz);
  for (const s of [-1, 1]) {
    for (let l = 1; l <= o.lanes; l++) b.box('solid', '#e9e6dc', len, 0.07, 0.14, xc, o.y + 0.04, zc + s * (0.7 + l * 3.5));
    // The run down to the ground at each end (out in the haze).
    const run = 46;
    b.box('solid', CONCRETE, Math.hypot(run, o.y), DECK_T, w, (s < 0 ? o.x0 : o.x1) + s * run / 2, o.y / 2 - DECK_T / 2, zc, 0, 0, -s * Math.atan2(o.y, run));
  }
  const ph = o.y - DECK_T - 1.0, piers = overpassPiers(o);
  for (const [x, z] of piers) b.cyl('solid', '#b5b0a4', PIER_R, PIER_R, ph, x, ph / 2, z, 8);
  for (let i = 0; i < piers.length; i += 2) b.box('solid', '#b5b0a4', 1.8, 1.0, w - 3, piers[i][0], o.y - DECK_T - 0.5, zc);
  // Light masts down the median, and the big green signs riders see coming.
  for (let x = MID - 170; x <= MID + 171; x += 68) {
    b.box('solid', '#7a8086', 0.2, 7, 0.2, x, o.y + 3.5, zc);
    b.box('glow', '#fff0c8', 0.5, 0.14, 3.4, x, o.y + 7, zc);
  }
  for (const face of [-1, 1]) {
    const x = MID + face * 24, z = face < 0 ? o.z0 - 0.4 : o.z1 + 0.4;
    b.box('solid', '#f4f4ee', 9.4, 3.0, 0.12, x, o.y + 3.0, z - face * 0.1);
    b.box('solid', '#1f6b45', 9, 2.6, 0.2, x, o.y + 3.0, z);
    for (const px of [-4.2, 4.2]) b.box('solid', '#7a8086', 0.2, 2.2, 0.2, x + px, o.y + 1.1, z - face * 0.1);
    if (o.id === 'us183' && face < 0) continue;                          // this one is lettered (a Text label)
    b.box('solid', '#f4f4ee', 1.3, 1.5, 0.06, x - face * 3.3, o.y + 3.0, z + face * 0.1);
    b.box('solid', '#f4f4ee', 5.2, 0.36, 0.06, x + face * 0.9, o.y + 3.5, z + face * 0.1);
    b.box('solid', '#f4f4ee', 3.8, 0.3, 0.06, x + face * 0.2, o.y + 2.6, z + face * 0.1);
  }
}

// ---------------------------------------------------------------- Q2 Stadium --
function stadium(b: Batch) {
  const { cx, cz, pitchW: pw, pitchL: pl, roofY } = Q2;
  const VERDE = '#00b140', BLACK = '#17191c', WHITE = '#f4f5f2', FRAME = '#6f7880', LINE = '#f4f4ee';
  // Apron, then the pitch, mown in bands, with its lines and goals.
  b.box('solid', '#8a8f86', Q2.x1 - Q2.x0, 0.04, Q2.z1 - Q2.z0, cx, 0.02, cz);
  b.box('solid', '#3d9446', pw + 9, 0.07, pl + 9, cx, 0.035, cz);
  for (let k = 0; k < 10; k++) b.box('solid', k % 2 ? '#4fb053' : '#46a64d', pw, 0.1, pl / 10, cx, 0.05, cz - pl / 2 + (k + 0.5) * (pl / 10));
  b.cyl('solid', LINE, 8, 8, 0.13, cx, 0.065, cz, 20);
  b.cyl('solid', '#46a64d', 7.7, 7.7, 0.15, cx, 0.075, cz, 20);
  b.box('solid', LINE, pw, 0.17, 0.3, cx, 0.085, cz);
  for (const s of [-1, 1]) {
    b.box('solid', LINE, 0.3, 0.13, pl, cx + s * pw / 2, 0.065, cz);
    b.box('solid', LINE, pw, 0.13, 0.3, cx, 0.065, cz + s * pl / 2);
    b.box('solid', LINE, 36, 0.13, 0.3, cx, 0.065, cz + s * (pl / 2 - 15));
    for (const sx of [-1, 1]) {
      b.box('solid', LINE, 0.3, 0.13, 15, cx + sx * 18, 0.065, cz + s * (pl / 2 - 7.5));
      b.box('solid', WHITE, 0.16, 2.44, 0.16, cx + sx * 3.66, 1.22, cz + s * pl / 2);
    }
    b.box('solid', WHITE, 7.5, 0.16, 0.16, cx, 2.44, cz + s * pl / 2);
  }
  // Four stands of verde and black seats, climbing away from the pitch.
  const rows = 6;
  for (const s of Q2_STANDS) {
    const [sx, sz, sw, sd] = mid(s);
    const depth = (s.axis === 'x' ? sw : sd) / rows;
    for (let i = 0; i < rows; i++) {
      const top = 1.6 + (i + 1) * 2.1, col = i % 2 ? BLACK : VERDE;
      const o = s.dir * (-(rows - 1) / 2 + i) * depth;                    // row 0 is at the pitch side
      if (s.axis === 'x') b.box('solid', col, depth, top, sd, sx + o, top / 2, sz);
      else b.box('solid', col, sw, top, depth, sx, top / 2, sz + o);
    }
    const back = s.axis === 'x' ? (s.dir > 0 ? s.x1 : s.x0) : (s.dir > 0 ? s.z1 : s.z0);
    const along = s.axis === 'x' ? sz : sx, span = s.axis === 'x' ? sd : sw;
    // Outside: black cladding banded in verde, with dark gateways at the foot.
    onWall(b, 'solid', VERDE, s.axis, back, s.dir, 0.06, along, span, 7.6, 2.2, 0.14);
    onWall(b, 'solid', VERDE, s.axis, back, s.dir, 0.06, along, span, 13.4, 1.6, 0.14);
    for (let u = -span / 2 + 8; u < span / 2 - 4; u += 16) onWall(b, 'solid', '#0b0c0e', s.axis, back, s.dir, 0.08, along + u, 5, 1.9, 3.8, 0.14);
    // The canopy over it: white, floating clear of the top row on steel columns.
    const outer = back + s.dir * 1.8, inner = back - s.dir * ((s.axis === 'x' ? sw : sd) + 5), rw = Math.abs(outer - inner);
    const rise = (rw / 2) * 0.05;
    if (s.axis === 'x') {
      const zl = Q2.z1 - Q2.z0 + 4;
      b.box('solid', WHITE, rw, 0.7, zl, (outer + inner) / 2, roofY, cz, 0, 0, -s.dir * 0.05);
      b.box('solid', FRAME, 0.6, 1.5, zl, inner + s.dir * 0.5, roofY + rise - 1.0, cz);
      b.box('glow', '#fff6da', 0.3, 0.2, sd, inner + s.dir * 0.5, roofY + rise - 1.85, cz);
      for (let z = Q2.z0 - 1; z <= Q2.z1 + 1.1; z += 12.17) b.box('solid', FRAME, 0.7, roofY, 0.7, outer - s.dir * 0.5, roofY / 2, z);
    } else {
      const xl = 64;
      b.box('solid', WHITE, xl, 0.7, rw, cx, roofY, (outer + inner) / 2, 0, s.dir * 0.05);
      b.box('solid', FRAME, xl, 1.5, 0.6, cx, roofY + rise - 1.0, inner + s.dir * 0.5);
      b.box('glow', '#fff6da', sw, 0.2, 0.3, cx, roofY + rise - 1.85, inner + s.dir * 0.5);
      for (const x of [-52, -40, -26, -13, 0, 13, 26, 40, 52]) b.box('solid', FRAME, 0.7, roofY, 0.7, cx + x, roofY / 2, outer - s.dir * 0.5);
    }
  }
  // The scoreboard under the north roof.
  b.box('solid', BLACK, 18, 7, 0.8, cx, 17.6, cz - 70);
  b.box('glow', '#2fd36b', 16.6, 5.8, 0.1, cx, 17.6, cz - 69.55);
  // Outside, toward the platform: the name board, banners, a paved queue plaza.
  // (The board hangs north of the platform, clear of its shelter roof.)
  b.box('solid', BLACK, 0.3, 4.2, 22, Q2.x1 + 2.2, 8.6, Q2.signZ);
  b.box('solid', VERDE, 0.34, 0.4, 22, Q2.x1 + 2.2, 6.3, Q2.signZ);
  const [px, pz, pwid, pd] = mid(Q2_PLAZA);
  b.box('solid', PAVER, pwid, 0.05, pd, px, 0.03, pz);
  for (let z = cz - 30, k = 0; z <= cz + 30.1; z += 12, k++) {
    b.box('solid', FRAME, 0.12, 7, 0.12, MID - 19, 3.5, z);
    b.box('solid', k % 2 ? BLACK : VERDE, 0.06, 3.0, 1.1, MID - 19, 5.3, z + 0.62);
  }
}

// ---------------------------------------------------------- other landmarks --
function accHighland(b: Batch, rnd: Rnd) {
  const [cx, cz, w, d] = mid(ACC), fx = ACC.x0, WHITE = '#f1efe8', BAND = '#dcd8cc', BLUE = '#1d4f91';
  b.box('solid', WHITE, w, ACC.h, d, cx, ACC.h / 2, cz);
  b.box('solid', BAND, w + 0.4, 0.6, d + 0.4, cx, ACC.h + 0.3, cz);
  for (const [x, z] of [[cx - 12, cz - 18], [cx + 10, cz + 14]]) b.box('solid', '#c9d3d8', 16, 2.2, 22, x, ACC.h + 1.1, z);      // old mall skylights
  // The long front: a clerestory ribbon, storefront glass, fins.
  onWall(b, 'glass', '#5f88a8', 'x', fx, -1, 0.04, cz, d - 3, 8.2, 2.0);
  onWall(b, 'glass', GLASS, 'x', fx, -1, 0.04, cz, d - 8, 2.2, 2.8);
  for (let z = ACC.z0 + 5; z < ACC.z1 - 3; z += 6.2) {
    onWall(b, 'solid', BAND, 'x', fx, -1, 0.1, z, 0.7, ACC.h / 2, ACC.h, 0.5);
    if (rnd() < 0.5) onWall(b, 'lit', pick(rnd, LIT), 'x', fx, -1, 0.11, z + 3.1, 5.2, 2.2, 2.5, 0.02);
    if (rnd() < 0.4) onWall(b, 'lit', pick(rnd, LIT), 'x', fx, -1, 0.11, z + 3.1, 5.2, 8.2, 1.7, 0.02);
  }
  for (const [z, o] of [[ACC.z0, -1], [ACC.z1, 1]]) onWall(b, 'glass', '#5f88a8', 'z', z, o, 0.04, cx, w - 6, 8.2, 2.0);
  // The entrance portal that carries the name.
  b.box('solid', BLUE, 1.6, 13.5, 24, fx - 0.5, 6.75, ACC.signZ);
  b.box('glass', GLASS, 0.2, 4.2, 12, fx - 1.36, 2.3, ACC.signZ);
  b.box('lit', LIT[1], 0.02, 4.0, 11.6, fx - 1.48, 2.3, ACC.signZ);
  b.box('solid', WHITE, 4, 0.25, 14, fx - 3, 5.0, ACC.signZ);
}

/** The mural: bright shapes painted along the wall that faces the track. */
function muralBuilding(b: Batch) {
  const [cx, cz, w, d] = mid(MURAL), fx = MURAL.x0, h = MURAL.h;
  const paintOn = (color: string, off: number, z: number, zw: number, y: number, yh: number) => onWall(b, 'solid', color, 'x', fx, -1, off, z, zw, y, yh, 0.04);
  const disc = (color: string, off: number, r: number, y: number, z: number) => b.cyl('solid', color, r, r, 0.04, fx - off, y, z, 18, 0, Math.PI / 2);
  b.box('solid', '#e9e4d6', w, h, d, cx, h / 2, cz);
  b.box('solid', '#3b4652', w + 0.3, 0.4, d + 0.3, cx, h + 0.2, cz);
  paintOn('#3fb6b2', 0.03, cz, d, h / 2, h - 0.1);                                         // sky
  disc('#f0b429', 0.06, 2.3, 4.4, cz - 6);                                                  // sun
  for (let k = 0; k < 10; k++) {                                                             // …and its rays
    const a = (k / 10) * Math.PI * 2;
    b.box('solid', '#f6d365', 0.04, 0.34, 1.5, fx - 0.06, 4.4 + Math.sin(a) * 3.4, cz - 6 + Math.cos(a) * 3.4, 0, -a);
  }
  for (const [z, r, c] of [[cz - 17, 5.2, '#7a4fc3'], [cz - 2, 4.2, '#e86a92'], [cz + 9, 6.0, '#5a9a4e'], [cz + 19, 4.4, '#2e7fd0']] as [number, number, string][]) {
    disc(c, 0.09, Math.min(r, h - 0.4), 0, z);                                             // hills
  }
  paintOn('#f4efe6', 0.12, cz, d, 0.5, 0.3);
  // A row of music notes dancing across it (MLK Jr. station has a musical theme).
  for (let k = 0; k < 5; k++) {
    const z = cz + 3 + k * 3.6, y = 4.6 + Math.sin(k * 1.7) * 0.9;
    disc('#22282f', 0.15, 0.42, y, z);
    paintOn('#22282f', 0.15, z + 0.36, 0.12, y + 0.95, 1.9);
    paintOn('#22282f', 0.15, z + 0.72, 0.7, y + 1.8, 0.2);
  }
  for (const [z, c] of [[cz - 19, '#f0b429'], [cz - 13.5, '#f4efe6'], [cz + 1.5, '#f4efe6']] as [number, string][]) {
    for (let k = 0; k < 5; k++) {                                                            // star bursts
      b.box('solid', c, 0.04, 0.18, 1.5, fx - 0.15, 5.5, z, 0, (k / 5) * Math.PI);
    }
  }
}

/** A Texas water tower: a silhouette on the skyline east of the stadium. */
function waterTower(b: Batch, x: number, z: number) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box('solid', '#c9cfd4', 0.5, 27, 0.5, x + dx * 4.4, 13.5, z + dz * 4.4, 0, dz * 0.06, -dx * 0.06);
  b.cyl('solid', '#c9cfd4', 0.9, 0.9, 27, x, 13.5, z, 8);
  b.cyl('solid', '#e9edf0', 7.2, 6.2, 5.5, x, 29.5, z, 14);
  b.blob('solid', '#e9edf0', 7.2, x, 32.2, z, 0.45);
  b.cyl('solid', '#c8102e', 7.26, 7.26, 0.9, x, 30.6, z, 14);
}

/** A giant doughnut on the roof of the strip mall by North Lamar. */
function doughnut(b: Batch, x: number, z: number) {
  const FLAT = Math.PI / 2;
  b.box('solid', '#5b6068', 0.3, 3.2, 0.3, x, 8.0, z);
  b.cyl('solid', '#d9a05b', 2.3, 2.3, 0.7, x, 11.4, z, 18, 0, FLAT);
  b.cyl('solid', '#f08ab0', 2.05, 2.05, 0.78, x, 11.4, z, 18, 0, FLAT);
  b.cyl('solid', '#7a5636', 0.75, 0.75, 0.82, x, 11.4, z, 12, 0, FLAT);
  for (let k = 0; k < 9; k++) {                                                            // sprinkles, both faces
    const a = k * 2.4, r = 1.1 + (k % 3) * 0.3;
    b.box('solid', ['#fff1d0', '#3fb6b2', '#f0b429'][k % 3], 0.84, 0.14, 0.42, x, 11.4 + Math.sin(a) * r, z + Math.cos(a) * r, 0, a);
  }
}

function bandstand(b: Batch) {
  const { x, z } = BANDSTAND;
  b.cyl('solid', '#d9c9a8', 2.2, 2.3, 0.5, x, 0.25, z, 8);
  for (let k = 0; k < 4; k++) {
    const a = (k + 0.5) * (Math.PI / 2);
    b.box('solid', '#1f5d46', 0.14, 2.9, 0.14, x + Math.cos(a) * 1.9, 1.95, z + Math.sin(a) * 1.9);
  }
  b.cyl('solid', '#b5533c', 0.15, 2.7, 1.5, x, 4.15, z, 8);
  b.cyl('solid', '#1f5d46', 0.06, 0.06, 0.8, x, 5.2, z, 5);
}

function convention(b: Batch, rnd: Rnd) {
  const c = CONVENTION, [cx, cz, w, d] = mid(c), fx = c.x0;
  const LIME = '#e3d9c3', LIME_D = '#d2c6ac', TEAL = '#4f9aa0', WHITE = '#f4f5f2';
  b.box('solid', LIME, w, c.h, d, cx, c.h / 2, cz);
  b.box('solid', LIME_D, w + 0.6, 0.7, d + 0.6, cx, c.h + 0.35, cz);
  b.box('glass', '#3f7f88', w * 0.5, 5, d * 0.6, cx + 6, c.h + 2.5, cz);                   // the glass hall on the roof
  b.box('solid', WHITE, w * 0.5 + 1.2, 0.4, d * 0.6 + 1.2, cx + 6, c.h + 5.2, cz);
  // Toward the tracks: doors under a long canopy, a limestone band for the
  // name, then the blue-green curtain wall in its white steel grid.
  const g0 = c.z0 + 8, gl = d - 16, bays = 12, bw = gl / bays;
  b.box('glass', TEAL, 0.3, 8.2, gl, fx - 0.1, 12.6, cz);
  for (let k = 0; k <= bays; k++) b.box('solid', WHITE, 0.5, 8.4, 0.3, fx - 0.2, 12.6, g0 + k * bw);
  for (const y of [8.5, 11.2, 13.9, 16.7]) b.box('solid', WHITE, 0.5, 0.3, gl, fx - 0.2, y, cz);
  for (let k = 0; k < bays; k++) {
    for (const y of [9.85, 12.55, 15.3]) if (rnd() < 0.32) b.box('lit', pick(rnd, LIT), 0.02, 2.3, bw - 0.5, fx - 0.27, y, g0 + (k + 0.5) * bw);
  }
  b.box('solid', LIME_D, 0.5, 3.0, d - 4, fx - 0.2, 6.7, cz);
  for (let k = -3; k <= 3; k++) {
    b.box('glass', GLASS, 0.2, 3.4, 6, fx - 0.08, 2.0, cz + k * 10.5);
    if (rnd() < 0.7) b.box('lit', pick(rnd, LIT), 0.02, 3.2, 5.6, fx - 0.2, 2.0, cz + k * 10.5);
  }
  b.box('solid', WHITE, 5, 0.3, 26, fx - 2.5, 4.6, cz);
  for (const dz of [-12, -4, 4, 12]) b.cyl('solid', WHITE, 0.16, 0.16, 4.5, fx - 4.6, 2.25, cz + dz, 8);
  for (const z of [c.z0 + 3, c.z1 - 3]) b.box('solid', LIME_D, 2, c.h + 2, 6, fx - 0.4, (c.h + 2) / 2, z);
  // North and south ends: tall slot windows in the stone.
  for (const [z, o] of [[c.z0, -1], [c.z1, 1]]) {
    for (let x = c.x0 + 8; x < c.x1 - 4; x += 9) {
      onWall(b, 'glass', TEAL, 'z', z, o, 0.04, x, 3.2, 9.5, 11);
      if (rnd() < 0.4) onWall(b, 'lit', pick(rnd, LIT), 'z', z, o, 0.11, x, 3.0, 5.6, 3, 0.02);
    }
  }
  // Kerb, a waiting bus, flagpoles.
  b.box('solid', PAVER, 10, 0.05, d + 8, fx - 5, 0.025, cz);
  bus(b, CITY_BUS.x, CITY_BUS.z);
  for (const [dz, col] of [[-22, '#bf0a30'], [22, '#002868']] as [number, string][]) {
    b.cyl('solid', '#c9cfd4', 0.07, 0.09, 9, fx - 7, 4.5, cz + dz, 6);
    b.box('solid', col, 0.05, 1.2, 2.0, fx - 7, 8.2, cz + dz + 1.05);
    b.box('solid', '#f4f4ee', 0.06, 0.4, 2.0, fx - 7, 8.2, cz + dz + 1.05);
  }
}

// ----------------------------------------------------------------- Downtown --
function shopBuilding(b: Batch, s: Shop, rnd: Rnd) {
  const f = cityShopFront(s.side), D = CITY_SHOP_DEPTH;
  const w = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2;
  const H = 4.4 + s.floors * 3.1;
  const cz = f.z - f.face * D / 2;
  const fz = (d: number) => f.z + f.face * d;                       // d metres out from the front wall
  b.box('solid', s.wall, w, H, D, cx, H / 2, cz);
  b.box('solid', s.trim, w + 0.3, 0.5, D + 0.3, cx, H + 0.25, cz);                       // parapet
  b.box('solid', '#8e959b', 2.4, 1.2, 2.4, cx + 3, H + 1.1, cz);                          // rooftop unit
  // ---- shopfront: plate glass, a door, a fabric awning, the sign band ----
  b.box('solid', '#2a2f36', w - 0.6, 3.5, 0.16, cx, 1.85, fz(0.05));
  b.box('glass', GLASS, w - 1.4, 2.5, 0.1, cx, 1.75, fz(0.13));
  b.box('lit', pick(rnd, LIT), w - 1.6, 2.3, 0.04, cx, 1.75, fz(0.2));
  b.box('solid', s.trim, 1.5, 2.6, 0.12, cx, 1.35, fz(0.2));                             // door frame
  b.box('glass', GLASS, 1.2, 2.3, 0.1, cx, 1.3, fz(0.26));
  b.box('solid', s.awning, w - 0.8, 0.12, 2.0, cx, 3.55, fz(1.0), 0, f.face * 0.28);
  b.box('solid', s.awning, w - 0.8, 0.5, 0.08, cx, 3.02, fz(1.95));
  b.box('solid', s.trim, w - 1.2, 1.0, 0.14, cx, 4.35, fz(0.1));                         // sign band
  // ---- flats above: a grid of windows, some with balconies ----
  const cols = 5;
  for (let fl = 0; fl < s.floors; fl++) {
    const y = 6.3 + fl * 3.1;
    for (let c = 0; c < cols; c++) {
      const x = s.x0 + (c + 0.5) * (w / cols);
      b.box('solid', s.trim, 2.0, 1.9, 0.1, x, y, fz(0.04));
      b.box('glass', GLASS, 1.7, 1.6, 0.08, x, y, fz(0.1));
      if (rnd() < 0.55) b.box('lit', pick(rnd, LIT), 1.6, 1.5, 0.03, x, y, fz(0.16));
      if ((c + fl) % 3 === 0) {
        b.box('solid', '#3b4652', 2.3, 0.1, 1.0, x, y - 1.0, fz(0.5));
        b.box('solid', '#3b4652', 2.3, 0.9, 0.05, x, y - 0.5, fz(1.0));
      }
    }
  }
  // ---- the back, and the side walls where the row ends ----
  grid(b, rnd, 'z', f.z - f.face * D, -f.face, s.x0, s.x1, 4.7, s.floors, 3.1, s.wall, 0.4);
  for (const [x, o] of [[s.x1, 1], [s.x0, -1]]) {
    if (o > 0 ? s.x1 < FOURTH.x1 - 3 : s.x0 > FOURTH.x0 + 4) continue;
    grid(b, rnd, 'x', x, o, cz - D / 2, cz + D / 2, 4.7, s.floors, 3.1, s.wall, 0.45);
  }
}

/** The old fire station: red brick, two big red doors, a hose tower. */
function firehouse(b: Batch, rnd: Rnd) {
  const f = cityShopFront(FIREHOUSE.side), D = CITY_SHOP_DEPTH, H = FIREHOUSE.h;
  const w = FIREHOUSE.x1 - FIREHOUSE.x0, cx = (FIREHOUSE.x0 + FIREHOUSE.x1) / 2, cz = f.z - f.face * D / 2;
  const fz = (d: number) => f.z + f.face * d;
  const BRICK = '#a3442f', STONE = '#e6dcc6', RED = '#c8102e';
  b.box('solid', BRICK, w, H, D, cx, H / 2, cz);
  b.box('solid', STONE, w + 0.4, 0.6, D + 0.4, cx, H + 0.3, cz);
  b.box('solid', STONE, w, 0.45, 0.2, cx, 5.2, fz(0.06));
  for (const dx of [-4.9, 1.1]) {                                                        // the engine bays
    b.box('solid', STONE, 5.2, 4.6, 0.14, cx + dx, 2.3, fz(0.04));
    b.box('solid', RED, 4.6, 4.2, 0.12, cx + dx, 2.1, fz(0.1));
    b.box('glass', GLASS, 4.0, 0.9, 0.08, cx + dx, 3.3, fz(0.17));
    b.box('lit', LIT[0], 3.8, 0.8, 0.03, cx + dx, 3.3, fz(0.22));
    for (const y of [0.9, 1.8, 2.6]) b.box('solid', '#9c0c22', 4.6, 0.06, 0.03, cx + dx, y, fz(0.17));
  }
  b.box('solid', STONE, 1.5, 2.7, 0.12, cx + 6.6, 1.35, fz(0.06));                       // the side door
  b.box('solid', RED, 1.1, 2.3, 0.1, cx + 6.6, 1.25, fz(0.12));
  for (let c = 0; c < 5; c++) {
    const x = FIREHOUSE.x0 + (c + 0.5) * (w / 5);
    b.box('solid', STONE, 1.9, 2.3, 0.1, x, 7.2, fz(0.04));
    b.box('glass', GLASS, 1.5, 1.9, 0.08, x, 7.2, fz(0.1));
    if (rnd() < 0.6) b.box('lit', pick(rnd, LIT), 1.4, 1.8, 0.03, x, 7.2, fz(0.16));
  }
  b.box('glow', '#ff5a3c', 0.4, 0.5, 0.3, cx - 1.9, 5.0, fz(0.3));                       // the lamp between the bays
  // Hose tower at the back corner.
  b.box('solid', BRICK, 3.4, 15, 3.4, FIREHOUSE.x0 + 1.9, 7.5, f.z - f.face * (D - 1.9));
  b.box('solid', STONE, 3.8, 0.5, 3.8, FIREHOUSE.x0 + 1.9, 13.2, f.z - f.face * (D - 1.9));
  b.cyl('solid', '#55606b', 0, 2.9, 2.2, FIREHOUSE.x0 + 1.9, 16.1, f.z - f.face * (D - 1.9), 4, 0, 0, Math.PI / 4);
}

/** The corn-dog trailer: a polished aluminium caravan with a striped awning. */
function trailer(b: Batch) {
  const { x, z } = TRAILER, SILVER = '#c9d0d6';
  b.box('solid', SILVER, 5.0, 2.2, 2.4, x, 1.75, z);
  for (const s of [-1, 1]) {
    b.cyl('solid', SILVER, 1.1, 1.1, 2.4, x + s * 2.5, 1.75, z, 12, Math.PI / 2);          // rounded ends
    b.cyl('solid', '#1c1f23', 0.42, 0.42, 2.5, x + s * 1.2, 0.42, z, 10, Math.PI / 2);     // wheels
  }
  b.box('solid', '#8e969c', 6.6, 0.18, 2.3, x, 0.72, z);
  b.box('solid', '#8e969c', 1.6, 0.12, 0.12, x + 4.0, 0.7, z);                            // tow bar
  b.box('solid', '#f0b429', 5.02, 0.3, 2.42, x, 1.1, z);                                  // a yellow stripe
  // Serving hatch on the north side, counter, awning, menu board, name board.
  b.box('glass', GLASS, 2.8, 1.0, 0.1, x - 0.4, 2.1, z - 1.2);
  b.box('lit', LIT[0], 2.7, 0.9, 0.04, x - 0.4, 2.1, z - 1.27);
  b.box('solid', '#8a8378', 3.0, 0.06, 0.6, x - 0.4, 1.55, z - 1.5);
  for (let k = 0; k < 6; k++) b.box('solid', k % 2 ? '#f4efe6' : '#c8102e', 0.55, 0.08, 1.3, x - 1.775 + k * 0.55, 2.95, z - 1.75, 0, -0.3);
  b.box('solid', '#22282f', 1.0, 1.3, 0.08, x + 1.9, 1.9, z - 1.25);
  b.box('solid', '#c8102e', 3.6, 0.9, 0.14, x, 3.4, z - 1.2);
  for (let k = 0; k < 8; k++) b.box('glow', LIT[k % 4], 0.14, 0.16, 0.14, x - 1.75 + k * 0.5, 3.95, z - 1.2);
}

function totem(b: Batch) {
  const { x, z } = TOTEM;
  b.box('solid', '#16335c', 0.3, 2.6, 3.4, x, 2.0, z);
  b.box('solid', '#c8102e', 0.32, 0.3, 3.4, x, 3.45, z);
  for (const dz of [-1.3, 1.3]) b.box('solid', STEEL, 0.14, 0.8, 0.14, x, 0.4, z + dz);
}

/** A painted guitar, three metres tall, on a plinth (Austin loves these). */
function guitar(b: Batch) {
  const { x, z } = GUITAR, BODY = '#3fb6b2', FLAT = Math.PI / 2;
  b.box('solid', '#8a8378', 1.7, 0.6, 1.7, x, 0.3, z);
  b.cyl('solid', BODY, 0.95, 0.95, 0.3, x, 1.7, z, 16, 0, FLAT);
  b.cyl('solid', BODY, 0.7, 0.7, 0.3, x, 2.75, z, 16, 0, FLAT);
  b.box('solid', BODY, 0.3, 0.9, 1.0, x, 2.25, z);
  for (const s of [-1, 1]) {
    b.cyl('solid', '#2a1d14', 0.3, 0.3, 0.02, x + s * 0.16, 2.35, z, 12, 0, FLAT);          // sound hole
    b.box('solid', '#f4efe6', 0.02, 0.12, 0.7, x + s * 0.16, 1.5, z);                      // bridge
    b.cyl('solid', '#f0b429', 0.14, 0.14, 0.02, x + s * 0.16, 1.1, z + 0.45, 8, 0, FLAT);   // painted flowers
    b.cyl('solid', '#e86a92', 0.14, 0.14, 0.02, x + s * 0.16, 1.25, z - 0.5, 8, 0, FLAT);
  }
  b.box('solid', '#6b4a2e', 0.16, 2.1, 0.26, x, 4.35, z);                                 // neck
  b.box('solid', '#2a1d14', 0.18, 0.7, 0.42, x, 5.7, z);                                  // head
}

/** The lone star set into the paving of the square. */
function loneStar(b: Batch, x: number, z: number, r: number) {
  b.cyl('solid', '#b9a88c', r + 1.2, r + 1.2, 0.012, x, 0.057, z, 24);
  // A solid five-pointed star: a pentagon with a triangle on each side.
  const rp = r / 1.827, side = 2 * rp * Math.sin(Math.PI / 5);
  b.cyl('solid', '#a3442f', rp, rp, 0.014, x, 0.066, z, 5, 0, 0, Math.PI - Math.PI / 5);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, d = rp * Math.cos(Math.PI / 5) + side / (2 * Math.sqrt(3));
    b.cyl('solid', '#a3442f', side / Math.sqrt(3), side / Math.sqrt(3), 0.014, x + Math.sin(a) * d, 0.066, z - Math.cos(a) * d, 3, 0, 0, Math.PI - a);
  }
}

function buildDowntown(b: Batch, rnd: Rnd) {
  const wz = CITY_WALK_Z, P = CITY_PLAZA, F = FOURTH, SQ = SQUARE;
  // ------------------------------------------------------ ground planes --
  b.box('solid', PAVER, P.x1 - P.x0, 0.05, P.z1 - P.z0, (P.x0 + P.x1) / 2, 0.025, (P.z0 + P.z1) / 2);
  b.box('solid', PAVER_DARK, P.x1 - P.x0, 0.055, 3.6, (P.x0 + P.x1) / 2, 0.028, wz);
  // 4th Street: pavers, a darker band down the middle, cross bands.
  const fl = P.x0 - F.x0, fcx = (P.x0 + F.x0) / 2;
  b.box('solid', PAVER, fl, 0.05, F.half * 2, fcx, 0.025, wz);
  b.box('solid', PAVER_DARK, fl, 0.055, 2.6, fcx, 0.028, wz);
  for (let x = F.x1 - 5; x > F.x0 + 2; x -= 11) b.box('solid', PAVER_DARK, 0.3, 0.055, F.half * 2, x, 0.027, wz);
  // The square, with its star.
  const [sx, sz, sw, sd] = mid(SQ);
  b.box('solid', PAVER, sw, 0.05, sd, sx, 0.025, sz);
  b.box('solid', PAVER_DARK, sw, 0.055, 0.5, sx, 0.028, SQ.z0 + 0.25);
  b.box('solid', PAVER_DARK, sw, 0.055, 0.5, sx, 0.028, SQ.z1 - 0.25);
  loneStar(b, sx - 1, wz - 0.5, 3.6);
  // The avenue north from the square (it carries on under I-35 to the Capitol).
  const cw = CONGRESS.x1 - CONGRESS.x0, ccx = (CONGRESS.x0 + CONGRESS.x1) / 2, cl = CONGRESS.z1 - 1500;
  b.box('solid', ASPHALT, cw - 3, 0.04, cl, ccx, 0.02, 1500 + cl / 2);
  b.box('solid', '#e2c23e', 0.2, 0.045, cl, ccx, 0.025, 1500 + cl / 2);
  for (const s of [-1, 1]) b.box('solid', WALK, 1.5, 0.07, cl, ccx + s * (cw / 2 - 0.75), 0.035, 1500 + cl / 2);
  for (let z = 1506; z < CONGRESS.z1 - 6; z += 14) {
    for (const s of [-1, 1]) tree(b, ccx + s * (cw / 2 + 1.8), z, 0.95, GREENS[(z / 14 | 0) % GREENS.length]);
  }

  // -------------------------------------------------------- 4th Street --
  for (const s of CITY_SHOPS) shopBuilding(b, s, rnd);
  firehouse(b, rnd);
  for (const [x, dz] of CITY_PLANTERS) {
    const pz = wz + dz;
    b.box('solid', '#8a8378', 2, 0.9, 2, x, 0.45, pz);
    b.box('solid', '#5a4636', 1.7, 0.1, 1.7, x, 0.92, pz);
    b.cyl('solid', BARK, 0.12, 0.16, 2.6, x, 2.2, pz, 6);
    b.blob('solid', '#4f8a45', 1.9, x, 4.3, pz, 0.9);
    for (const dx of [-3.2, 3.2]) bench(b, x + dx, pz, true);
  }
  // String lights zig-zagging between poles down the length of the street.
  const poles: [number, number][] = [];
  for (let x = F.x1 - 3, k = 0; x > F.x0 + 2; x -= 11, k++) poles.push([x, wz + (k % 2 ? 1 : -1) * (F.half - 0.8)]);
  for (const [x, z] of poles) b.cyl('solid', '#2f343a', 0.07, 0.1, 6.4, x, 3.2, z, 6);
  for (let i = 0; i < poles.length - 1; i++) {
    const [ax, az] = poles[i], [bx, bz] = poles[i + 1];
    b.box('solid', '#1c1f23', 0.03, 0.03, Math.hypot(bx - ax, bz - az), (ax + bx) / 2, 6.0, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
    for (let k = 1; k < 10; k++) {
      const t = k / 10, sag = Math.sin(t * Math.PI) * 0.55;
      b.box('glow', LIT[k % 4], 0.16, 0.2, 0.16, ax + (bx - ax) * t, 5.92 - sag, az + (bz - az) * t);
    }
  }

  // ------------------------------------------------------- station plaza --
  totem(b);
  guitar(b);
  for (const k of [0, 1, 2]) b.box('solid', STEEL, 0.06, 0.8, 0.9, P.x0 + 2.2 + k * 0.9, 0.4, wz + 10.5);        // bike hoops
  bench(b, P.x0 + 6.5, wz + 11.5, true);
  bench(b, P.x0 + 4.2, wz - 11.5, true);
  for (const [x, z] of [[P.x0 + 1.6, wz - 12.4], [P.x0 + 1.6, wz + 12.4]]) {
    b.box('solid', '#8a8378', 1.8, 0.8, 1.8, x, 0.4, z);
    tree(b, x, z, 1.0, '#4f8a45');
  }

  // ------------------------------------------------------- the square --
  for (const [x, z, s] of SQUARE_OAKS) {
    b.cyl('solid', '#8a8378', 1.7, 1.7, 0.4, x, 0.2, z, 12);                              // a stone ring to sit on
    b.cyl('solid', '#5a4636', 1.45, 1.45, 0.42, x, 0.21, z, 12);
    liveOak(b, rnd, x, z, s);
  }
  trailer(b);
  bench(b, sx + 8, wz - 6, false);
  bench(b, sx - 9, wz - 1.5, false);
  bench(b, sx + 2, wz + 6.5, true);
  // Picnic tables by the trailer.
  for (const [x, z] of [[TRAILER.x - 3.2, TRAILER.z - 5.2], [TRAILER.x + 2.4, TRAILER.z - 5.6]]) {
    b.box('solid', '#9b7a55', 1.9, 0.08, 0.8, x, 0.78, z);
    for (const dz of [-0.75, 0.75]) b.box('solid', '#9b7a55', 1.9, 0.07, 0.3, x, 0.46, z + dz);
    for (const dx of [-0.7, 0.7]) b.box('solid', '#6b5a48', 0.1, 0.78, 1.6, x + dx, 0.39, z);
  }

  // ------------------------------------- the little park north of 4th St --
  const [pkx, pkz, pkw, pkd] = mid(PARK);
  b.box('solid', '#62a64c', pkw, 0.06, pkd, pkx, 0.03, pkz);
  const diag = Math.hypot(pkw, pkd) - 6;
  for (const s of [-1, 1]) b.box('solid', '#d9cfb8', 2.2, 0.07, diag, pkx, 0.035, pkz, s * Math.atan2(pkw, pkd));
  b.cyl('solid', '#d9cfb8', 4.5, 4.5, 0.075, pkx, 0.038, pkz, 16);
  b.cyl('solid', '#8a8378', 1.3, 1.5, 0.7, pkx, 0.35, pkz, 10);                          // a little fountain bowl
  b.cyl('solid', '#6aa9c4', 1.1, 1.1, 0.06, pkx, 0.7, pkz, 10);
  // The old cottage (a writer's house turned museum, in real life).
  const co = COTTAGE;
  b.box('solid', '#f1ede2', co.w, 3.4, co.d, co.x, 1.7, co.z);
  b.cyl('solid', '#5a6a5c', 0, co.w * 0.78, 2.4, co.x, 4.6, co.z, 4, 0, 0, Math.PI / 4);
  b.box('solid', '#b9b0a0', co.w, 0.3, 1.8, co.x, 0.15, co.z + co.d / 2 + 0.9);
  b.box('solid', '#5a6a5c', co.w + 0.4, 0.1, 2.2, co.x, 2.9, co.z + co.d / 2 + 1.0, 0, 0.16);
  for (const dx of [-co.w / 2 + 0.2, -1.3, 1.3, co.w / 2 - 0.2]) b.box('solid', '#f4efe6', 0.14, 2.6, 0.14, co.x + dx, 1.5, co.z + co.d / 2 + 1.7);
  onWall(b, 'solid', '#2f5d50', 'z', co.z + co.d / 2, 1, 0.03, co.x, 1.0, 1.35, 2.1);
  for (const dx of [-2.4, 2.4]) {
    onWall(b, 'glass', GLASS, 'z', co.z + co.d / 2, 1, 0.04, co.x + dx, 1.3, 1.9, 1.4);
    onWall(b, 'lit', LIT[2], 'z', co.z + co.d / 2, 1, 0.1, co.x + dx, 1.2, 1.9, 1.3, 0.02);
  }
  for (const [x, z, s] of [[PARK.x0 + 6, PARK.z0 + 6, 1.0], [PARK.x1 - 8, PARK.z0 + 8, 1.15], [PARK.x0 + 30, PARK.z0 + 5, 0.9], [PARK.x1 - 26, PARK.z1 - 6, 0.95], [PARK.x0 + 5, PARK.z1 - 8, 1.1]]) {
    bigTree(b, rnd, x, z, s);
  }
  for (const [x, z] of [[pkx - 7, pkz + 2], [pkx + 7, pkz - 2]]) bench(b, x, z, false);
  // Cars parked along the kerb between the park and the tracks.
  b.box('solid', ASPHALT, 6, 0.04, 62, MID - 17, 0.02, 1531);
  for (let z = 1504; z < 1560; z += 6.6) if (rnd() < 0.7) car(b, MID - 15.6, z, pick(rnd, CAR_COLORS));
  for (const z of [1502, 1518, 1534]) tree(b, MID - 22.5, z, 0.95, pick(rnd, GREENS));

  // --------------------------------------------- east: Convention Center --
  convention(b, rnd);
  for (const z of [CONVENTION.z0 - 10, CONVENTION.z0 - 4.5]) {
    for (const x of [-154, -140, -124, -106, -88]) tree(b, x + (z > CONVENTION.z0 - 6 ? 6 : 0), z, 0.9 + rnd() * 0.3, pick(rnd, GREENS));
  }

  // ---------------------------- Cesar Chavez St and the lake-shore trail --
  road(b, rnd, CHAVEZ_Z, 12);
  const shoreZ = CHAVEZ_Z + 10.8;
  for (const [x0, x1] of [[-430, MID - NEAR], [MID + NEAR, 70]]) {
    b.box('solid', '#7fae5a', x1 - x0, 0.05, 6.2, (x0 + x1) / 2, 0.025, shoreZ - 0.1);
    b.box('solid', '#d9cfb8', x1 - x0, 0.06, 2.4, (x0 + x1) / 2, 0.03, shoreZ - 1.4);      // the hike-and-bike trail
    for (let x = x0 + 6; x < x1 - 3; x += 17 + rnd() * 9) {
      if (Math.abs(x - MID) < 16) continue;
      const s = 0.85 + rnd() * 0.4;
      b.box('solid', BARK, 0.4 * s, 3 * s, 0.4 * s, x, 1.5 * s, shoreZ + 0.8);            // bald cypress on the bank
      b.blob('solid', '#3c6d43', 1.7 * s, x, 4.6 * s, shoreZ + 0.8, 1.35);
      if (rnd() < 0.4) bench(b, x + 5, shoreZ + 0.4, true);
    }
  }
}

// ------------------------------------------------------------------ skyline --
/** One glazed tier of a tower: glass body, a spandrel line every `fh`, and a
 *  scatter of lit offices on the three faces anyone ever sees. */
function glassTier(b: Batch, rnd: Rnd, r: Rect, y0: number, y1: number, glass: string, frame: string, fh = 4.2, litP = 0.24) {
  const [cx, cz, w, d] = mid(r);
  b.box('glass', glass, w, y1 - y0, d, cx, (y0 + y1) / 2, cz);
  for (let y = y0 + fh; y < y1 - 0.6; y += fh) b.box('solid', frame, w + 0.24, 0.4, d + 0.24, cx, y, cz);
  b.box('solid', frame, w + 0.3, 0.5, d + 0.3, cx, y1 - 0.25, cz);
  const faces: [Ori, number, number, number, number][] = [['x', r.x1, 1, r.z0, r.z1], ['z', r.z0, -1, r.x0, r.x1], ['z', r.z1, 1, r.x0, r.x1]];
  for (let y = y0; y < y1 - fh * 0.6; y += fh) {
    for (const [ori, pos, out, u0, u1] of faces) {
      const n = Math.max(1, Math.floor((u1 - u0) / 5.5)), cw = (u1 - u0 - 1) / n;
      for (let k = 0; k < n; k++) {
        if (rnd() < litP) onWall(b, 'lit', pick(rnd, LIT), ori, pos, out, 0.15, u0 + 0.5 + (k + 0.5) * cw, cw - 0.5, y + fh / 2 + 0.2, fh - 1.1, 0.02);
      }
    }
  }
}

function skyTower(b: Batch, t: SkyTower, rnd: Rnd) {
  const [cx, cz, w, d] = mid(t);
  /** A tier inset `ix`/`iz` from the footprint and shifted by `ox`/`oz`. */
  const tier = (ix: number, iz: number, y0: number, y1: number, ox = 0, oz = 0) =>
    glassTier(b, rnd, { x0: t.x0 + ix + ox, x1: t.x1 - ix + ox, z0: t.z0 + iz + oz, z1: t.z1 - iz + oz }, y0, y1, t.glass, t.frame);
  const podium = (h: number, grow: number, color = '#cfc8ba') => {
    b.box('solid', color, w + grow * 2, h, d + grow * 2, cx, h / 2, cz);
    b.box('glass', GLASS, w + grow * 2 + 0.2, 3, d + grow * 2 - 3, cx, 2.2, cz);
    b.box('lit', LIT[1], 0.02, 2.6, d + grow * 2 - 4, t.x1 + grow + 0.13, 2.2, cz);
  };
  switch (t.id) {
    case 'frost': {
      // Silver-blue shaft, two setbacks, and the folded, pointed crown with a
      // spike at each corner.
      tier(0, 0, 0, 46); tier(2.5, 2.5, 46, 55); tier(5, 5, 55, 61);
      b.cyl('glass', '#a9c8dc', 0, (w - 10) / Math.SQRT2, t.h - 61, cx, (61 + t.h) / 2, cz, 4, 0, 0, Math.PI / 4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.cyl('glass', '#a9c8dc', 0, 2.3, 9, cx + sx * (w / 2 - 3.9), 59.5, cz + sz * (d / 2 - 3.9), 4, 0, 0, Math.PI / 4);
      }
      break;
    }
    case 'independent': {
      // The "Jenga tower": blocks stacked off-centre, an open frame on top.
      podium(12, 1.5, '#aeb4b8');
      tier(1, 1, 12, 36); tier(1, 1, 36, 58, -2.5, 3.5); tier(1, 1, 58, 78, 2, -3.5); tier(1, 1, 78, 88, -1.5, 2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('solid', t.frame, 0.6, t.h - 88, 0.6, cx - 1.5 + sx * (w / 2 - 1.4), (88 + t.h) / 2, cz + 2 + sz * (d / 2 - 1.4));
      for (const s of [-1, 1]) {
        b.box('solid', t.frame, w - 2.2, 0.6, 0.6, cx - 1.5, t.h - 0.3, cz + 2 + s * (d / 2 - 1.4));
        b.box('solid', t.frame, 0.6, 0.6, d - 2.2, cx - 1.5 + s * (w / 2 - 1.4), t.h - 0.3, cz + 2);
      }
      break;
    }
    case 'austonian': {
      // Slender, with rounded north and south ends and a lantern under its cap.
      const flat = d / 2 - w / 2, top = t.h - 8;
      b.box('glass', t.glass, w, top, flat * 2, cx, top / 2, cz);
      for (const s of [-1, 1]) b.cyl('glass', t.glass, w / 2, w / 2, top, cx, top / 2, cz + s * flat, 14);
      for (let y = 8; y <= top; y += 8) {
        b.box('solid', t.frame, w + 0.3, 0.45, flat * 2, cx, y, cz);
        for (const s of [-1, 1]) b.cyl('solid', t.frame, w / 2 + 0.15, w / 2 + 0.15, 0.45, cx, y, cz + s * flat, 14);
      }
      for (let y = 2; y < top - 6; y += 4.2) {
        if (rnd() < 0.5) b.box('lit', pick(rnd, LIT), 0.02, 3, flat * 2 - 1, t.x1 + 0.12, y + 2.2, cz);
      }
      b.box('glow', '#fff1cf', w - 4, 5, flat * 2 + w - 5, cx, top + 2.5, cz);              // the lantern
      b.box('solid', t.frame, w - 1, 0.8, flat * 2 + w - 2, cx, top + 5.4, cz);
      b.cyl('solid', t.frame, 0.2, 0.5, 2.2, cx, top + 6.9, cz, 6);
      break;
    }
    case 'sixth': {
      // A tall glass box with a terrace notched out part-way up.
      podium(10, 2);
      tier(0, 0, 10, 50);
      b.box('solid', '#39424c', w - 7, 5, d - 7, cx, 52.5, cz);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.blob('solid', '#4f8a45', 1.6, cx + sx * (w / 2 - 2), 51.4, cz + sz * (d / 2 - 2), 0.8);
      tier(1.5, 1.5, 55, 116);
      b.box('solid', t.frame, w - 9, t.h - 116, d - 9, cx, (116 + t.h) / 2, cz);
      break;
    }
    case 'waterline': {
      // The tallest: a slim slab that steps down toward the lake at the top.
      podium(14, 3, '#c9b8a0');
      tier(0, 0, 14, 114);
      glassTier(b, rnd, { x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1 - 9 }, 114, 127, t.glass, t.frame);
      glassTier(b, rnd, { x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1 - 19 }, 127, t.h, t.glass, t.frame);
      break;
    }
    case 'fairmont': {
      // A broad hotel slab with a thin lit needle on the roof.
      const roof = 58;
      podium(8, 2.5, '#d9cdb8');
      tier(0, 0, 8, roof);
      b.box('solid', t.frame, w * 0.5, 2.4, d * 0.5, cx, roof + 1.2, cz);
      b.cyl('solid', '#dfe5ea', 0.22, 0.6, t.h - roof - 2.4, cx, (roof + 2.4 + t.h) / 2, cz, 6);
      for (let y = roof + 6; y < t.h; y += 4) b.box('glow', '#ffe7b8', 0.9, 0.5, 0.9, cx, y, cz);
      b.box('glow', '#ff5a4a', 0.7, 0.7, 0.7, cx, t.h, cz);
      break;
    }
    case 'block185': {
      // The "sail": each tier steps further back from the lake as it climbs.
      const tiers = 8, th = t.h / tiers;
      for (let i = 0; i < tiers; i++) {
        const cut = (d - 8) * Math.pow(i / (tiers - 1), 1.5);
        glassTier(b, rnd, { x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1 - cut }, i * th, (i + 1) * th, t.glass, t.frame, 4.9, 0.22);
      }
      break;
    }
  }
}

function capitol(b: Batch, rnd: Rnd) {
  const { x, z, w, d } = CAPITOL, PINK = '#cfa08a', PINK_L = '#dcb6a2', ROOF = '#8b8f8a';
  // Lawn, the Great Walk up from the avenue, live oaks either side.
  const [lx, lz, lw, ld] = mid(CAPITOL_LAWN);
  b.box('solid', '#62a64c', lw, 0.05, ld, lx, 0.025, lz);
  b.box('solid', '#d9cfb8', 7, 0.06, CAPITOL_LAWN.z1 - (z + 13), x, 0.03, (CAPITOL_LAWN.z1 + z + 13) / 2);
  for (const s of [-1, 1]) for (const dz of [18, 25]) bigTree(b, rnd, x + s * (9 + (dz - 18) * 1.4), z + dz, 1.0);
  // Wings, the centre pavilion, the portico.
  b.box('solid', PINK, w, 13, d, x, 6.5, z);
  b.box('solid', ROOF, w + 0.6, 0.6, d + 0.6, x, 13.3, z);
  for (const s of [-1, 1]) {
    b.box('solid', PINK, 10, 14.5, d + 5, x + s * (w / 2 - 5), 7.25, z);
    b.box('solid', ROOF, 10.6, 0.6, d + 5.6, x + s * (w / 2 - 5), 14.8, z);
  }
  b.box('solid', PINK, 22, 16, 26, x, 8, z);
  b.box('solid', ROOF, 22.6, 0.6, 26.6, x, 16.3, z);
  for (const s of [-1, 1]) {
    for (let fl = 0; fl < 3; fl++) {
      const y = 3.2 + fl * 3.6;
      for (const e of [-1, 1]) {
        onWall(b, 'glass', GLASS, 'z', z + s * d / 2, s, 0.04, x + e * 15.5, 7.4, y, 2.0);               // between the pavilions
        onWall(b, 'glass', GLASS, 'z', z + s * (d / 2 + 2.5), s, 0.04, x + e * (w / 2 - 5), 7, y, 2.0);   // the end pavilions
      }
      onWall(b, 'glass', GLASS, 'x', x + s * w / 2, s, 0.04, z, d + 2, y, 2.0);
    }
    for (let k = -2.5; k <= 2.5; k++) b.cyl('solid', PINK_L, 0.55, 0.6, 9, x + k * 3.4, 6.5, z + s * 15, 8);
    b.box('solid', PINK, 21, 2, 4.4, x, 12, z + s * 14.2);
    for (let k = 0; k < 3; k++) b.box('solid', PINK_L, 19 - k * 6, 1.1, 4.2, x, 13.5 + k * 1.1, z + s * 14.2);       // pediment
    b.box('solid', '#b9b0a0', 22, 2, 4, x, 1, z + s * 15);
  }
  for (let k = 0; k < 8; k++) {
    if (rnd() < 0.6) onWall(b, 'lit', pick(rnd, LIT), 'z', z + d / 2, 1, 0.1, x + (k < 4 ? -1 : 1) * (12.6 + (k % 4) * 1.9), 1.6, 3.2 + (k % 3) * 3.6, 1.8, 0.02);
  }
  // Drum, dome, lantern, and the statue on top.
  b.box('solid', PINK, 18, 3, 18, x, 17.5, z);
  b.cyl('solid', PINK, 7.6, 7.9, 10, x, 24, z, 14);
  b.cyl('glass', GLASS, 7.72, 7.72, 4, x, 24.5, z, 14);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    b.box('solid', PINK_L, 0.7, 6.4, 0.7, x + Math.cos(a) * 7.9, 24.4, z + Math.sin(a) * 7.9, -a);
  }
  b.cyl('solid', PINK_L, 8.3, 8.3, 0.7, x, 29.2, z, 14);
  b.blob('solid', '#d6ab97', 7.9, x, 29.4, z, 1.12);
  b.cyl('solid', PINK_L, 1.5, 1.7, 3.6, x, 39.6, z, 8);
  b.cyl('solid', '#d6ab97', 0, 1.7, 1.4, x, 42.1, z, 8);
  b.box('solid', '#e9e4d6', 0.3, CAPITOL.h - 42.2, 0.3, x, (42.2 + CAPITOL.h) / 2, z);
  b.box('glow', '#fff1cf', 1.2, 2.2, 1.2, x, 39.6, z);
}

function buildSkyline(b: Batch, rnd: Rnd) {
  for (const t of SKYLINE) skyTower(b, t, rnd);
  capitol(b, rnd);
  // The avenue from the freeway up to the lawn, and the cross street the
  // train looks along to see the dome.
  const cw = CONGRESS.x1 - CONGRESS.x0, ccx = (CONGRESS.x0 + CONGRESS.x1) / 2, cl = 1500 - CONGRESS.z0;
  b.box('solid', ASPHALT, cw - 3, 0.04, cl, ccx, 0.02, CONGRESS.z0 + cl / 2);
  b.box('solid', '#e2c23e', 0.2, 0.045, cl, ccx, 0.025, CONGRESS.z0 + cl / 2);
  for (const s of [-1, 1]) b.box('solid', WALK, 1.5, 0.07, cl, ccx + s * (cw / 2 - 0.75), 0.035, CONGRESS.z0 + cl / 2);
  const [vx, vz, vw, vd] = mid(VISTA);
  b.box('solid', ASPHALT, vw, 0.04, vd - 3, vx, 0.021, vz);
  for (const s of [-1, 1]) {
    b.box('solid', WALK, vw, 0.07, 1.5, vx, 0.035, vz + s * (vd / 2 - 0.75));
    for (let x = VISTA.x0 + 6; x < VISTA.x1 - 4; x += 15) tree(b, x, vz + s * (vd / 2 + 1.6), 0.8, GREENS[((x | 0) + 300) % GREENS.length]);
  }
}

// ----------------------------------------------------- the four stretches --
/** Street trees in a broken row either side, then a thinning scatter behind. */
function plant(b: Batch, rnd: Rnd, z0: number, z1: number, n: number, bigShare: number) {
  for (const side of [-1, 1]) {
    for (let z = z0 + 5 + rnd() * 8; z < z1 - 3; z += 15 + rnd() * 12) {
      // On the verge; tight against the boundary where a street or a forecourt runs alongside.
      const wide = MID + side * (13 + rnd() * 2.2), tight = MID + side * (NEAR + 0.35), s = 0.85 + rnd() * 0.35;
      if (!cityOccupied(wide, z, 1.2)) tree(b, wide, z, s, pick(rnd, GREENS));
      else if (!cityOccupied(tight, z, 0.3)) tree(b, tight, z, s * 0.85, pick(rnd, GREENS));
    }
  }
  for (let i = 0; i < n; i++) {
    const z = z0 + rnd() * (z1 - z0), side = rnd() < 0.5 ? -1 : 1;
    const x = MID + side * (15 + Math.pow(rnd(), 1.9) * 150), s = 0.9 + rnd() * 0.6, kind = rnd();
    if (cityOccupied(x, z, 3.2)) continue;
    if (kind < bigShare) bigTree(b, rnd, x, z, s);
    else if (kind < 0.86) tree(b, x, z, s * 1.1, pick(rnd, GREENS));
    else {
      b.box('solid', '#3d3026', 0.2 * s, 1.0 * s, 0.2 * s, x, 0.5 * s, z);                 // a cedar
      b.cyl('solid', '#2f5137', 0.05, 1.5 * s, 4.4 * s, x, 3.0 * s, z, 7);
    }
  }
}
/** Lineside poles down the east side, wherever nothing else stands. */
function poles(b: Batch, z0: number, z1: number) {
  for (let z = Math.ceil(z0 / 30) * 30 + 8; z < z1; z += 30) {
    const x = MID + NEAR + 0.3;
    if (cityOccupied(x, z, 0.4)) continue;
    b.box('solid', '#5b4a3a', 0.22, 8.4, 0.22, x, 4.2, z);
    b.box('solid', '#5b4a3a', 2.0, 0.12, 0.12, x, 7.6, z);
  }
}
/** Blocks, bungalows, parking and side streets whose centre is in stretch `i`. */
function common(b: Batch, rnd: Rnd, i: number) {
  const here = (r: Rect) => citySection((r.z0 + r.z1) / 2) === i;
  for (const k of CITY_BLOCKS) if (here(k)) block(b, k, rnd);
  for (const h of CITY_HOUSES) if (citySection(h.z) === i) house(b, h, rnd);
  for (const l of CITY_LOTS) if (here(l)) parking(b, rnd, l, 0.6);
  for (const s of CITY_STREETS) {
    if (!here(s)) continue;
    const [cx, cz, w, d] = mid(s);
    b.box('solid', ASPHALT, w, 0.04, d, cx, 0.02, cz);
    const kerb = cx < MID ? s.x1 - 1.1 : s.x0 + 1.1;                                      // cars park on the track side
    for (let z = s.z0 + 5; z < s.z1 - 4; z += 6.8) if (rnd() < 0.42 && !CITY_ROADS.some((r) => Math.abs(z - r.z) < r.w / 2 + 5)) car(b, kerb, z, pick(rnd, CAR_COLORS));
  }
  for (const r of CITY_ROADS) if (citySection(r.z) === i && r.z !== CHAVEZ_Z) road(b, rnd, r.z, r.w);
  for (const o of OVERPASSES) if (here(o)) overpass(b, o);
  poles(b, CITY_SECTIONS[i].z0, CITY_SECTIONS[i].z1);
}

interface Stretch { id: string; walk: boolean; geo: Record<string, THREE.BufferGeometry> }
function buildCityLine(): Stretch[] {
  const out: Stretch[] = [];
  const bake = (id: string, walk: boolean, fill: (b: Batch, rnd: Rnd) => void, seed: number) => {
    const b = new Batch();
    fill(b, rng32(seed));
    const geo = b.build();
    for (const g of Object.values(geo)) g.computeBoundingSphere();
    out.push({ id, walk, geo });
  };
  // Kramer, the stadium, US-183.
  bake('kramer', false, (b, rnd) => {
    common(b, rnd, 0);
    stadium(b);
    bus(b, KRAMER_LOT.x0 + 3, KRAMER_LOT.z0 + 12);
    waterTower(b, MID + 142, Q2_Z - 2);
    linkFence(b, MID - 12.6, Q2.z0, Q2_PLAZA.z0 - 2);
    linkFence(b, MID - 12.6, Q2_PLAZA.z1 + 2, Q2.z1);
    linkFence(b, MID + 12.6, Q2_Z - 74, Q2_Z - 20);
    linkFence(b, MID + 12.6, Q2_Z + 26, Q2_Z + 72);
    plant(b, rnd, 742, 1000, 100, 0.12);
  }, 716);
  // North Lamar, Crestview, Highland, I-35.
  bake('crestview', false, (b, rnd) => {
    common(b, rnd, 1);
    accHighland(b, rnd);
    doughnut(b, MID - 17.5, LAMAR_Z - 12);
    linkFence(b, MID + 12.6, LAMAR_Z + 9, LAMAR_Z + 28);
    plant(b, rnd, 1000, 1260, 90, 0.2);
  }, 1000);
  // MLK Blvd, East Austin, Plaza Saltillo, I-35 again.
  bake('east', false, (b, rnd) => {
    common(b, rnd, 2);
    muralBuilding(b);
    bandstand(b);
    b.box('solid', PAVER, 7, 0.05, 34, MID - 14.3, 0.025, SALTILLO_Z);                    // Plaza Saltillo's paving
    // The big pecans East Austin's streets are known for.
    for (const [d, z, s] of [[-37, MLK_BLVD_Z + 18, 1.5], [-39, MLK_BLVD_Z + 44, 1.7], [-36, MLK_BLVD_Z + 66, 1.4], [47, MLK_BLVD_Z + 30, 1.6], [50, MLK_BLVD_Z + 62, 1.5], [-38, MLK_BLVD_Z - 20, 1.5], [38, MLK_BLVD_Z - 19, 1.6]]) {
      bigTree(b, rnd, MID + d, z, s);
    }
    plant(b, rnd, 1260, 1500, 80, 0.3);
  }, 1260);
  // Downtown.
  bake('downtown', true, (b, rnd) => {
    common(b, rnd, 3);
    buildDowntown(b, rnd);
  }, 1558);
  bake('skyline', false, buildSkyline, 512);
  return out;
}

// ----------------------------------------------------------------- traffic --
interface Vehicle { lane: number; dir: 1 | -1; speed: number; phase: number; len: number; h: number; wid: number; color: string }
/** Traffic loops along this much of each freeway, centred a little west. */
const LOOP = 560, LOOP_X0 = MID - 300;
function makeTraffic(o: Overpass, seed: number): Vehicle[] {
  const r = rng32(seed);
  const list: Vehicle[] = [];
  const laneSpeed = (lane: number) => 26 - lane * (o.lanes > 2 ? 4 : 6.5);
  for (let i = 0; i < o.vehicles; i++) {
    const dir = (i % 2 ? -1 : 1) as 1 | -1;
    const truck = i < o.trucks, van = !truck && r() < 0.25;
    // Trucks keep to the outside lane; everyone in a lane goes the same speed,
    // so nobody ever drives through anybody.
    const lane = truck ? o.lanes - 1 : Math.floor(r() * o.lanes);
    list.push({
      lane, dir, speed: laneSpeed(lane), phase: 0,
      len: truck ? 11 + r() * 3 : van ? 5.2 : 4.3, h: truck ? 3.4 : van ? 2.0 : 1.35, wid: truck ? 2.5 : van ? 2.0 : 1.85,
      color: truck ? pick(r, ['#f2f2f0', '#e9e4d6', '#c8102e', '#35567e', '#d7a23a']) : pick(r, CAR_COLORS),
    });
  }
  // Space the ones that share a lane evenly round the loop.
  for (const dir of [1, -1]) {
    for (let lane = 0; lane < o.lanes; lane++) {
      const same = list.filter((v) => v.dir === dir && v.lane === lane);
      same.forEach((v, k) => { v.phase = ((k + r() * 0.45) / same.length) * LOOP + lane * 37; });
    }
  }
  return list;
}

/** Cars and trucks crossing one freeway deck: a single instanced mesh. */
function OverpassTraffic({ o, seed }: { o: Overpass; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cars = useMemo(() => makeTraffic(o, seed), [o, seed]);
  const zc = (o.z0 + o.z1) / 2;
  const place = useMemo(() => (m: THREE.InstancedMesh, t: number) => {
    cars.forEach((c, i) => {
      const u = (((c.phase + t * c.speed) % LOOP) + LOOP) % LOOP;
      // Grow in / shrink away at the ends of the loop, far off in the haze.
      const k = Math.min(1, Math.min(u, LOOP - u) / 22);
      dummy.position.set(c.dir > 0 ? LOOP_X0 + u : LOOP_X0 + LOOP - u, o.y + 0.22 + (c.h * k) / 2, zc + c.dir * (2.5 + c.lane * 3.5));
      dummy.scale.set(c.len * k, c.h * k, c.wid * k);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [cars, dummy, o, zc]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    cars.forEach((v, i) => m.setColorAt(i, c.set(v.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // Culled as one object (the instances never leave the loop).
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(LOOP_X0 + LOOP / 2, o.y + 2, zc), LOOP / 2 + 16);
    place(m, 0);
  }, [cars, place, o, zc]);
  useFrame(({ clock, camera }) => {
    const m = ref.current;
    if (!m || Math.abs(camera.position.z - zc) > 640) return;            // beyond the far plane
    place(m, clock.elapsedTime);
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cars.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
}

function Label({ x, y, z, ry, text, size, color = '#ffffff', width }: { x: number; y: number; z: number; ry: number; text: string; size: number; color?: string; width?: number }) {
  return (
    <Text position={[x, y, z]} rotation={[0, ry, 0]} fontSize={size} color={color} anchorX="center" anchorY="middle" letterSpacing={0.04} maxWidth={width} textAlign="center">
      {text}
    </Text>
  );
}

/** Dark lettering on light sign bands, light on dark. */
function inkFor(hex: string): string {
  const c = new THREE.Color(hex);
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5 ? '#22282f' : '#ffffff';
}

export function CityLine() {
  const stretches = useMemo(() => buildCityLine(), []);
  const mats = useMemo(() => ({
    solid: paint(0.9),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.55 }),
    lit: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    glow: glowPaint(0.5),
  }), []);
  useFrame(() => {
    const sky = useSkyStore.getState();
    const on = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    mats.lit.opacity = on * 0.95;
    mats.lit.visible = on > 0.02;
    mats.glow.emissiveIntensity = 0.7 + 2.6 * on;
  });

  // Treat spots at the shop doors and the trailer (same "E" + bubble as the Domain's).
  useEffect(() => {
    const zs = useZoneStore.getState();
    for (const t of CITY_TREATS) zs.register({ id: t.id, kind: 'icecream', label: t.label, emoji: t.emoji, x: t.x, z: t.z, radius: 2.4 });
    return () => { for (const t of CITY_TREATS) useZoneStore.getState().unregister(t.id); };
  }, []);

  const us183 = OVERPASSES[0];
  return (
    <group>
      {stretches.map((s) => (
        <group key={s.id}>
          {s.geo.solid && <mesh geometry={s.geo.solid} material={mats.solid} castShadow={s.walk} receiveShadow />}
          {s.geo.glass && <mesh geometry={s.geo.glass} material={mats.glass} />}
          {s.geo.lit && <mesh geometry={s.geo.lit} material={mats.lit} renderOrder={2} />}
          {s.geo.glow && <mesh geometry={s.geo.glow} material={mats.glow} />}
        </group>
      ))}
      {OVERPASSES.map((o, i) => <OverpassTraffic key={o.id} o={o} seed={183 + i * 35} />)}

      {/* ---- lettering: 16 labels in all ---- */}
      <Label x={Q2.x1 + 2.38} y={8.6} z={Q2.signZ} ry={Math.PI / 2} text="Q2 STADIUM" size={2.5} color="#f4f5f2" />
      <Label x={MID - 24} y={us183.y + 3.0} z={us183.z0 - 0.52} ry={Math.PI} text={'US 183\nResearch Blvd'} size={0.82} />
      <Label x={ACC.x0 - 1.33} y={10.0} z={ACC.signZ} ry={-Math.PI / 2} text="ACC HIGHLAND" size={2.2} />
      <Label x={CONVENTION.x0 - 0.48} y={6.7} z={(CONVENTION.z0 + CONVENTION.z1) / 2} ry={-Math.PI / 2} text="AUSTIN CONVENTION CENTER" size={1.5} color="#4a4034" />
      {/* Station totem: the full legend toward 4th Street, the name toward the platform. */}
      <Label x={TOTEM.x - 0.17} y={2.78} z={TOTEM.z} ry={-Math.PI / 2} text="MetroRail" size={0.36} />
      <Label x={TOTEM.x - 0.17} y={2.26} z={TOTEM.z} ry={-Math.PI / 2} text="DOWNTOWN" size={0.3} color="#ffd98a" />
      <Label x={TOTEM.x - 0.17} y={1.5} z={TOTEM.z} ry={-Math.PI / 2} text={'Trains to The Domain,\nAvery Ranch + Bastrop'} size={0.2} width={3.1} />
      <Label x={TOTEM.x + 0.17} y={2.3} z={TOTEM.z} ry={Math.PI / 2} text={'MetroRail\nDOWNTOWN'} size={0.36} />
      {/* Shop signs. */}
      {CITY_SHOPS.map((s) => {
        const f = cityShopFront(s.side);
        return <Label key={s.id} x={(s.x0 + s.x1) / 2} y={4.38} z={f.z + f.face * 0.19} ry={f.face > 0 ? 0 : Math.PI} text={s.name} size={0.7} color={inkFor(s.trim)} width={17} />;
      })}
      <Label x={TRAILER.x} y={3.4} z={TRAILER.z - 1.29} ry={Math.PI} text="CORN DOGS" size={0.52} color="#fff3c8" />
    </group>
  );
}
