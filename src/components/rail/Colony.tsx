import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  BOUNDS, STREETS, PATHS, PLAZA, SNOW_CONE, LAKE, LAKE_FOUNTAIN, DOCK, LAKEHOUSE, LAKEHOUSE_POOL, LAKEHOUSE_LOT, PARK, PARK_PLAY,
  PARK_PAVILION, PICKLEBALL, PUMP_TRACK, SCHOOL, POCKET_PAVILION, LEMONADE, HOUSES, LOT_W, YARD_BACK, COLONY_TREATS,
  distToLine, inPoly, type House, type Pt,
} from '../../world/colony';
import { PONDS, POCKET_PARK, POCKET_POOL } from '../../world/colonyData';
import { rng32 } from '../../world/corridor';
import { RAIL_MID_X } from '../../world/westAvery';
import { TRACK_Z_S } from '../../world/redLine';
import { useZoneStore } from '../../state/zoneStore';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { LiveOak } from '../vegetation/LiveOak';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';
import { Batch, glowPaint, paint } from './batch';

// The Colony, Bastrop (layout + what is real and what is guessed:
// world/colony.ts). Static, baked a district at a time so the far districts
// are skipped; only the fountains move.

const ASPHALT = '#4b4e54';
const KERB = '#bdb9ae';
const WALK = '#d2cdc0';
const DRIVE = '#cfcabd';
const GRANITE = '#c9b48f';
const GLASS = '#27333e';
const LIT = ['#ffd89a', '#ffe7b8', '#ffc978', '#fff1d0'];
const CEDAR = '#a5764a';
const STEEL = '#5f7383';
const NAVY = '#16335c';
const RED = '#c8102e';
const STONE = '#cfc6b3';
const OAK = ['#3f6b3a', '#4a7a40', '#365f38', '#557f46'];
const CAR_COLORS = ['#c7ccd3', '#2f3b4f', '#8c1f24', '#e9e4d6', '#35567e', '#4a4f55', '#d7a23a', '#2d5f46', '#f2f2f0', '#6b7f95', '#1d1f23'];

// House finishes (a guess at a 2020s Texas builder street: brick + stone
// fronts, pale trim, dark shingles, two-car garages).
const BRICK = ['#b79f85', '#a8674d', '#cbbfa8', '#8d8a84', '#9a7b62', '#d9cdb8'];
const SIDING = ['#d9d2c2', '#e6dfd0', '#c9cfc9', '#b8b3a8', '#ded3bd', '#eee8da'];
const ROOF = ['#3d3d40', '#4a4138', '#55504a'];
const DOOR = ['#5a2e22', '#1f3d4d', '#2b2b2b', '#7a1f1f'];
const GARAGE = ['#efe8da', '#6b4a32', '#d8cfbd'];
const TRIM = '#f1ece0';

type Sec = Record<string, THREE.BufferGeometry>;

/** A flat strip along a line of points (roads, sidewalks, paths). */
function ribbon(b: Batch, color: string, pts: Pt[], w: number, top: number, closed = false) {
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 0.05) continue;
    b.box('ground', color, w, 0.03, L, (a[0] + c[0]) / 2, top - 0.015, (a[1] + c[1]) / 2, Math.atan2(c[0] - a[0], c[1] - a[1]));
  }
  for (const p of pts) b.cyl('ground', color, w / 2, w / 2, 0.03, p[0], top - 0.015, p[1], 8);
}
/** The same line moved sideways by `off` metres. */
function offsetLine(pts: Pt[], off: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    return [p[0] - ((c[1] - a[1]) / L) * off, p[1] + ((c[0] - a[0]) / L) * off] as Pt;
  });
}
function scalePoly(poly: Pt[], k: number, grow = 0): Pt[] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map((p) => {
    const d = Math.hypot(p[0] - cx, p[1] - cz) || 1;
    return [cx + (p[0] - cx) * k + ((p[0] - cx) / d) * grow, cz + (p[1] - cz) * k + ((p[1] - cz) / d) * grow] as Pt;
  });
}
/** A flat filled outline at height y (water, lawns, decks). */
function flat(poly: Pt[], y: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  poly.forEach((p, i) => (i === 0 ? s.moveTo(p[0], -p[1]) : s.lineTo(p[0], -p[1])));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}
function tree(b: Batch, x: number, z: number, s: number, rnd: () => number) {
  b.cyl('solid', '#5a4632', 0.14 * s, 0.2 * s, 2.4 * s, x, 1.2 * s, z, 6);
  b.blob('solid', OAK[Math.floor(rnd() * OAK.length)], 1.7 * s, x, 3.2 * s, z, 0.8);
}
function car(b: Batch, x: number, z: number, color: string, ry: number) {
  b.box('solid', color, 1.85, 0.7, 4.3, x, 0.62, z, ry);
  b.box('solid', '#20262d', 1.6, 0.55, 2.2, x - Math.sin(ry) * 0.25, 1.22, z - Math.cos(ry) * 0.25, ry);
}
function bench(b: Batch, x: number, z: number, ry: number) {
  b.box('solid', '#8a6a48', 1.9, 0.07, 0.5, x, 0.46, z, ry);
  b.box('solid', '#8a6a48', 1.9, 0.45, 0.07, x - Math.sin(ry) * 0.24, 0.72, z - Math.cos(ry) * 0.24, ry);
}
/** A see-through pool railing from a to c. */
function railing(b: Batch, a: Pt, c: Pt) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]), ry = Math.atan2(c[0] - a[0], c[1] - a[1]);
  for (const y of [1.15, 0.65, 0.15]) b.box('solid', '#2b2f33', 0.05, 0.05, L, (a[0] + c[0]) / 2, y, (a[1] + c[1]) / 2, ry);
  for (let t = 0; t < L; t += 2.2) b.box('solid', '#2b2f33', 0.05, 1.15, 0.05, a[0] + ((c[0] - a[0]) * t) / L, 0.58, a[1] + ((c[1] - a[1]) * t) / L);
}
/** An open-sided shelter: posts and a low hip roof. */
function pavilion(b: Batch, x: number, z: number, w: number, d: number, roof: string) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('solid', '#6b5a48', 0.3, 3, 0.3, x + sx * (w / 2 - 0.3), 1.5, z + sz * (d / 2 - 0.3));
  b.roof('solid', roof, w + 1.2, 1.3, d + 1.2, x, 3, z, 0, d / 2);
  b.box('ground', DRIVE, w + 0.6, 0.03, d + 0.6, x, 0.03, z);
  b.box('solid', '#8a6a48', 2.2, 0.08, 0.9, x, 0.76, z);
  for (const s of [-1, 1]) b.box('solid', '#8a6a48', 2.2, 0.06, 0.32, x, 0.46, z + s * 0.75);
}

// -------------------------------------------------------------------- houses --
function house(b: Batch, h: House, rnd: () => number) {
  const c = Math.cos(h.ry), s = Math.sin(h.ry);
  const P = (lx: number, lz: number): Pt => [h.x + lx * c + lz * s, h.z - lx * s + lz * c];
  const box = (group: string, color: string, w: number, hh: number, d: number, lx: number, y: number, lz: number) => {
    const [x, z] = P(lx, lz);
    b.box(group, color, w, hh, d, x, y, z, h.ry);
  };
  const roof = (color: string, w: number, hh: number, d: number, lx: number, y: number, lz: number, turned: boolean, hip: number) => {
    const [x, z] = P(lx, lz);
    b.roof('solid', color, w, hh, d, x, y, z, h.ry + (turned ? Math.PI / 2 : 0), hip);
  };
  const W = h.w, D = h.d, g = h.garage, H1 = 3.0;
  const GW = 6.0, GP = 1.7;                 // garage width, how far it stands forward
  const wall = BRICK[h.style], upper = SIDING[h.style], rf = ROOF[h.roof];
  const zf = D / 2 - GP;                    // the main front wall
  const gx = g * (W / 2 - GW / 2);          // garage centre
  const Wn = W - GW, nx = -g * (GW / 2);    // the rest of the front: width, centre

  // Body + garage.
  box('solid', wall, W, H1, D - GP, 0, H1 / 2, -GP / 2);
  box('solid', wall, GW, H1, GP + 0.05, gx, H1 / 2, D / 2 - GP / 2);
  box('solid', GARAGE[h.seed % 3], 4.9, 2.25, 0.07, gx, 1.125, D / 2 + 0.03);
  for (const y of [0.6, 1.15, 1.7]) box('solid', '#9a9488', 4.9, 0.025, 0.075, gx, y, D / 2 + 0.032);
  for (const sx of [-1, 1]) box('solid', TRIM, 0.16, 2.4, 0.09, gx + sx * 2.53, 1.2, D / 2 + 0.03);
  box('solid', TRIM, 5.2, 0.16, 0.09, gx, 2.33, D / 2 + 0.03);
  // Stone below the front window, the door, a little porch.
  box('solid', STONE, Wn, 1.0, 0.1, nx, 0.5, zf + 0.04);
  const dx = nx + g * (Wn / 2 - 0.95), wx = nx - g * (Wn / 2 - 1.75);
  box('solid', DOOR[h.door], 1.0, 2.15, 0.08, dx, 1.075, zf + 0.05);
  box('solid', TRIM, 1.24, 2.3, 0.05, dx, 1.15, zf + 0.03);
  box('solid', DRIVE, 1.7, 0.14, 1.3, dx, 0.07, zf + 0.65);
  box('solid', TRIM, 2.3, 0.14, 1.5, dx, H1 - 0.35, zf + 0.75);
  box('solid', TRIM, 0.16, H1 - 0.4, 0.16, dx - g * 0.95, (H1 - 0.4) / 2, zf + 1.35);
  box('solid', TRIM, 2.1, 1.75, 0.05, wx, 1.6, zf + 0.03);
  box('glass', GLASS, 1.85, 1.5, 0.05, wx, 1.6, zf + 0.05);
  if (rnd() < 0.6) box('lit', LIT[Math.floor(rnd() * 4)], 1.75, 1.4, 0.03, wx, 1.6, zf + 0.085);
  // Side windows.
  for (const sx of [-1, 1]) for (const lz of [-D / 4, D / 8]) {
    box('glass', GLASS, 0.05, 1.3, 1.3, sx * (W / 2 + 0.02), 1.65, lz - GP / 2);
    if (rnd() < 0.3) box('lit', LIT[Math.floor(rnd() * 4)], 0.03, 1.2, 1.2, sx * (W / 2 + 0.05), 1.65, lz - GP / 2);
  }
  const bodyD = D - GP;
  if (h.storeys === 2) {
    // Upstairs sits back from the front; a skirt roof covers the ground floor.
    const uD = bodyD - 3.2, uz = -GP / 2 - 1.6, H2 = 2.7;
    box('solid', upper, W - 0.5, H2, uD, 0, H1 + H2 / 2, uz);
    roof(rf, uD + 0.9, 2.3, W + 0.4, 0, H1 + H2, uz, true, (W + 0.4) / 2 * 0.8);
    roof(rf, W + 0.9, 1.25, 4.6, 0, H1, zf - 1.6, false, 1.6);
    for (const k of [-1, 1]) {
      const ux = k * (W / 2 - 2.2);
      box('solid', TRIM, 1.6, 1.5, 0.05, ux, H1 + 1.45, uz + uD / 2 + 0.03);
      box('glass', GLASS, 1.4, 1.3, 0.05, ux, H1 + 1.45, uz + uD / 2 + 0.05);
      if (rnd() < 0.5) box('lit', LIT[Math.floor(rnd() * 4)], 1.3, 1.2, 0.03, ux, H1 + 1.45, uz + uD / 2 + 0.085);
    }
  } else {
    roof(rf, bodyD + 0.9, 2.5, W + 0.9, 0, H1, -GP / 2, true, (W + 0.9) / 2 * 0.82);
  }
  // The gable over the garage: wall-coloured, with the roof framing it.
  roof(wall, GP + 1.8, 1.5, GW, gx, H1, D / 2 - (GP + 1.8) / 2, true, 0);
  roof(rf, GP + 2.8, 1.72, GW + 0.7, gx, H1 - 0.06, D / 2 - 0.06 - (GP + 2.8) / 2, true, 0);
  // Driveway, a car on some, the fenced back yard, a young tree out front.
  box('ground', DRIVE, 5.3, 0.03, h.drive + 0.5, gx, 0.03, D / 2 + (h.drive + 0.5) / 2);
  if (h.car >= 0) { const [x, z] = P(gx - 1.1 + (h.seed % 2) * 2.2, D / 2 + 3.3); car(b, x, z, CAR_COLORS[h.car % CAR_COLORS.length], h.ry); }
  const fw = LOT_W - 0.7, back = -D / 2 - YARD_BACK + 0.4, sideLen = YARD_BACK + D * 0.4;
  box('solid', CEDAR, fw, 1.8, 0.08, 0, 0.9, back);
  for (const sx of [-1, 1]) box('solid', CEDAR, 0.08, 1.8, sideLen, sx * fw / 2, 0.9, back + sideLen / 2);
  const [tx, tz] = P(-g * (W / 2 - 1.4), D / 2 + 3.6);
  tree(b, tx, tz, 0.75 + rnd() * 0.35, rnd);
}

// ------------------------------------------------------------------- build --
function buildColony() {
  const rnd = rng32(4407);
  const out: { ground: Sec; houses: Sec[]; east: Sec; west: Sec; far: Sec; flats: { g: THREE.BufferGeometry; kind: string }[] } =
    { ground: {}, houses: [], east: {}, west: {}, far: {}, flats: [] };

  // ---------------- ground: roads, sidewalks, paths, paving ----------------
  {
    const b = new Batch();
    for (const s of STREETS) {
      ribbon(b, KERB, s.pts, s.w + 0.6, 0.03);
      if (s.name) for (const side of [1, -1]) ribbon(b, WALK, offsetLine(s.pts, side * (s.w / 2 + 2.1)), 1.4, 0.04);
    }
    for (const s of STREETS) ribbon(b, ASPHALT, s.pts, s.w, 0.055);
    for (const p of PATHS) ribbon(b, GRANITE, p, 2.0, 0.045);
    ribbon(b, GRANITE, scalePoly(LAKE, 1, 6), 2.4, 0.045, true);
    // Station plaza.
    const pw = PLAZA.x1 - PLAZA.x0, pd = PLAZA.z1 - PLAZA.z0, pcx = (PLAZA.x0 + PLAZA.x1) / 2, pcz = (PLAZA.z0 + PLAZA.z1) / 2;
    b.box('ground', '#d8d3c6', pw, 0.03, pd, pcx, 0.04, pcz);
    for (let k = 0; k < 5; k++) b.box('ground', '#c4bca9', pw, 0.031, 0.3, pcx, 0.041, PLAZA.z0 + 4 + k * 8);
    // Lakehouse lot, school lot, courts.
    for (const lot of [LAKEHOUSE_LOT, SCHOOL.lot]) {
      b.box('ground', ASPHALT, lot.x1 - lot.x0, 0.03, lot.z1 - lot.z0, (lot.x0 + lot.x1) / 2, 0.04, (lot.z0 + lot.z1) / 2);
      for (let x = lot.x0 + 3; x < lot.x1 - 2; x += 2.8) for (const z of [lot.z0 + 3, lot.z1 - 3]) b.box('ground', '#e8e4d8', 0.12, 0.031, 5, x, 0.042, z);
    }
    b.box('ground', ASPHALT, 6, 0.03, 16, SCHOOL.lot.x0 - 2, 0.04, SCHOOL.lot.z0 - 7);
    for (const c of PICKLEBALL) {
      b.box('ground', '#3f8f6a', 8.4, 0.03, 16, c.x, 0.04, c.z);
      b.box('ground', '#3a6fb5', 6.1, 0.031, 13.4, c.x, 0.045, c.z);
      for (const lz of [-6.7, -2.13, 2.13, 6.7]) b.box('ground', '#f4f1e6', 6.1, 0.032, 0.08, c.x, 0.05, c.z + lz);
      for (const lx of [-3.05, 0, 3.05]) b.box('ground', '#f4f1e6', 0.08, 0.032, lx === 0 ? 9.1 : 13.4, c.x + lx, 0.05, c.z);
    }
    // School field: a mown rectangle with a running loop.
    const f = SCHOOL.field;
    b.box('ground', '#7fb85a', f.rx * 2, 0.03, f.rz * 2, f.x, 0.02, f.z);
    for (const sz of [-1, 1]) b.box('ground', '#f4f1e6', f.rx * 2, 0.031, 0.12, f.x, 0.03, f.z + sz * f.rz);
    for (const sx of [-1, 0, 1]) b.box('ground', '#f4f1e6', 0.12, 0.031, f.rz * 2, f.x + sx * f.rx, 0.03, f.z);
    // Playground mulch.
    for (const p of [PARK_PLAY, SCHOOL.play, { x: 6, z: 3051 }]) b.cyl('ground', '#9b7a55', 8.5, 8.5, 0.03, p.x, 0.035, p.z, 16);
    // Pump track: a dirt loop.
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const x = PUMP_TRACK.x + Math.cos(a) * PUMP_TRACK.rx, z = PUMP_TRACK.z + Math.sin(a) * PUMP_TRACK.rz;
      b.cyl('ground', '#b08a5c', 2.2, 2.6, 0.12 + 0.35 * Math.abs(Math.sin(a * 5)), x, 0.06, z, 8);
    }
    out.ground = b.build();
  }

  // ------------------------------------------------------------- houses ----
  for (const [z0, z1] of [[0, 3110], [3110, 3215], [3215, 9999]]) {
    const b = new Batch();
    for (const h of HOUSES) if (h.z >= z0 && h.z < z1) house(b, h, rng32(900 + h.seed));
    out.houses.push(b.build());
  }

  // ------------------------------------------------- east: park, ponds ----
  {
    const b = new Batch();
    // Pocket park: pavilion by the pool, benches, the pool fence, loungers.
    pavilion(b, POCKET_PAVILION.x, POCKET_PAVILION.z, POCKET_PAVILION.w, POCKET_PAVILION.d, '#55504a');
    const deck = scalePoly(POCKET_POOL, 1, 4.5);
    for (let i = 0; i < deck.length; i++) {
      const a = deck[i], c = deck[(i + 1) % deck.length];
      // A gap in the railing is the gate.
      if (i === 0) continue;
      railing(b, a, c);
    }
    for (const [x, z, ry] of [[44, 3037.5, 0.3], [47, 3038.5, 0.3], [58, 3020, 2.6]] as [number, number, number][]) {
      b.box('solid', '#f2f2ee', 0.7, 0.3, 1.9, x, 0.2, z, ry);
    }
    bench(b, -18, 3080, 0.5); bench(b, 30, 3066, Math.PI); bench(b, 0, 3042, 0);
    // Mail kiosk at the Chinaberry Bend corner.
    b.box('solid', '#6b7078', 2.4, 1.5, 0.6, 84, 0.95, 3066, 0.25);
    b.roof('solid', '#55504a', 3.0, 0.5, 1.2, 84, 1.7, 3066, 0.25, 0.6);
    // Lemonade stand on the corner.
    b.box('solid', '#d9b77a', 1.8, 0.9, 0.7, LEMONADE.x, 0.45, LEMONADE.z);
    b.box('solid', '#ffd84a', 2.0, 0.5, 0.06, LEMONADE.x, 2.0, LEMONADE.z + 0.34);
    for (const sx of [-1, 1]) b.box('solid', '#8a6a48', 0.07, 2.2, 0.07, LEMONADE.x + sx * 0.92, 1.1, LEMONADE.z + 0.3);
    b.cyl('solid', '#fff2a8', 0.14, 0.12, 0.3, LEMONADE.x - 0.4, 1.05, LEMONADE.z, 8);
    for (const k of [0, 1, 2]) b.cyl('solid', '#f6f4ea', 0.05, 0.04, 0.12, LEMONADE.x + 0.2 + k * 0.18, 0.96, LEMONADE.z + 0.1, 6);
    // Pond: benches + a little overlook deck on the big one.
    bench(b, 262, 3004, Math.PI / 2); bench(b, 300, 2944, 0); bench(b, 296, 3048, 0.4);
    b.box('solid', '#9b7b55', 5, 0.16, 7, 277, 0.3, 2996, 0.5);
    // Street-name sign posts.
    for (const sg of STREET_SIGNS) {
      b.cyl('solid', '#7c838a', 0.045, 0.045, 3, sg.x, 1.5, sg.z, 6);
      b.box('solid', '#1f6b3e', 1.9, 0.26, 0.04, sg.x, 2.86, sg.z, sg.ry);
    }
    // Trees: the park, the pond banks, the open ground between the streets.
    const tooClose = (x: number, z: number) => STREETS.some((s) => distToLine(x, z, s.pts) < s.w / 2 + 3.4)
      || HOUSES.some((h) => Math.hypot(h.x - x, h.z - z) < 15) || PONDS.some((p) => inPoly(x, z, p) || distToLine(x, z, p, true) < 2.5)
      || inPoly(x, z, deck) || PATHS.some((p) => distToLine(x, z, p) < 2.2) || Math.hypot(x - 6, z - 3051) < 10;
    let n = 0;
    for (let i = 0; i < 900 && n < 170; i++) {
      const x = RAIL_MID_X + 16 + rnd() * (BOUNDS.x1 - RAIL_MID_X - 18), z = BOUNDS.z0 + 3 + rnd() * (3343 - BOUNDS.z0);
      if (tooClose(x, z)) continue;
      tree(b, x, z, 1.0 + rnd() * 0.9, rnd); n++;
    }
    // Fence between the back gardens and the railway.
    b.box('solid', CEDAR, 0.1, 1.9, 3060 - BOUNDS.z0, RAIL_MID_X + 13, 0.95, (3060 + BOUNDS.z0) / 2);
    out.east = b.build();
  }

  // ------------------------------- west: plaza, lake, park, school --------
  {
    const b = new Batch();
    // --- station plaza ---
    b.box('solid', NAVY, 2.6, 2.9, 0.3, PLAZA.x0 + 5, 1.45, PLAZA.z1 - 6);
    b.box('solid', RED, 2.6, 0.3, 0.32, PLAZA.x0 + 5, 2.95, PLAZA.z1 - 6);
    b.box('solid', STONE, 7.5, 1.5, 0.9, -174, 0.75, PLAZA.z1 - 1.6);
    b.box('solid', '#a89f8c', 8.1, 0.2, 1.1, -174, 1.6, PLAZA.z1 - 1.6);
    bench(b, PLAZA.x0 + 3, PLAZA.z0 + 12, Math.PI / 2); bench(b, PLAZA.x1 - 3, PLAZA.z0 + 22, -Math.PI / 2);
    for (const k of [0, 1, 2, 3]) b.box('solid', STEEL, 0.06, 0.8, 0.06, PLAZA.x0 + 9 + k * 0.9, 0.4, PLAZA.z0 + 5);
    b.box('solid', STEEL, 2.9, 0.06, 0.06, PLAZA.x0 + 10.35, 0.8, PLAZA.z0 + 5);
    // Snow-cone cart.
    b.box('solid', '#f4f1e6', 1.6, 1.1, 2.6, SNOW_CONE.x, 0.95, SNOW_CONE.z);
    b.box('solid', '#39b6c9', 1.64, 0.3, 2.64, SNOW_CONE.x, 0.6, SNOW_CONE.z);
    for (const k of [-1, 0, 1]) b.box('solid', k === 0 ? '#ffffff' : '#e8477a', 1.9, 0.08, 0.92, SNOW_CONE.x, 2.5, SNOW_CONE.z + k * 0.92);
    for (const sz of [-1, 1]) b.cyl('solid', STEEL, 0.03, 0.03, 1.1, SNOW_CONE.x - 0.7, 1.95, SNOW_CONE.z + sz * 1.2, 6);
    for (const sz of [-1, 1]) b.cyl('solid', '#2a2d31', 0.3, 0.3, 0.12, SNOW_CONE.x, 0.3, SNOW_CONE.z + sz * 0.9, 10, 0, Math.PI / 2);
    for (const [k, col] of [[-0.5, '#e8477a'], [0, '#3aa0ff'], [0.5, '#ffd84a']] as [number, string][]) b.blob('solid', col, 0.13, SNOW_CONE.x - 0.5, 1.62, SNOW_CONE.z + k, 1);
    // Low rail fence between the lake path and the railway.
    b.box('solid', '#2b2f33', 0.06, 0.06, TRACK_Z_S + 4 - BOUNDS.z0, RAIL_MID_X - 13, 1.05, (TRACK_Z_S + 4 + BOUNDS.z0) / 2);
    b.box('solid', '#2b2f33', 0.06, 0.06, TRACK_Z_S + 4 - BOUNDS.z0, RAIL_MID_X - 13, 0.55, (TRACK_Z_S + 4 + BOUNDS.z0) / 2);
    for (let z = BOUNDS.z0; z < TRACK_Z_S + 4; z += 4) b.box('solid', '#2b2f33', 0.07, 1.1, 0.07, RAIL_MID_X - 13, 0.55, z);

    // --- the lake: dock, benches ---
    b.box('solid', '#9b7b55', DOCK.w, 0.16, DOCK.z1 - DOCK.z0, DOCK.x, 0.34, (DOCK.z0 + DOCK.z1) / 2);
    b.box('solid', '#9b7b55', 8, 0.16, 3, DOCK.x, 0.34, DOCK.z0 + 1.5);
    for (let z = DOCK.z0 + 0.5; z < DOCK.z1; z += 4.4) for (const sx of [-1, 1]) b.cyl('solid', '#6b5a48', 0.12, 0.12, 1.2, DOCK.x + sx * DOCK.w / 2, 0.5, z, 6);
    bench(b, -232, 3018, -0.6); bench(b, -344, 3022, 0.5); bench(b, -208, 2972, -Math.PI / 2);
    // --- the Lakehouse: stone + glass under a metal roof, its pool beside it ---
    {
      const L = LAKEHOUSE, w = L.x1 - L.x0, d = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
      b.box('solid', STONE, w, L.h, d, cx, L.h / 2, cz);
      b.roof('solid', '#5d6f7a', w + 2.4, 2.6, d + 2.4, cx, L.h, cz, 0, 0);
      b.box('glass', GLASS, w - 8, 3.2, 0.08, cx, 2.1, L.z0 - 0.05);
      b.box('lit', LIT[1], w - 8.4, 3.0, 0.04, cx, 2.1, L.z0 - 0.1);
      for (let k = 0; k < 5; k++) b.box('solid', '#4a3b2c', 0.12, 3.3, 0.14, L.x0 + 4 + k * (w - 8) / 4, 2.1, L.z0 - 0.08);
      b.box('solid', '#6b5a48', w, 0.25, 4, cx, L.h - 1.2, L.z1 + 2);
      for (const sx of [-1, 0, 1]) b.box('solid', '#6b5a48', 0.3, L.h - 1.3, 0.3, cx + sx * (w / 2 - 0.4), (L.h - 1.3) / 2, L.z1 + 3.7);
      b.box('glass', GLASS, 3, 2.4, 0.08, cx, 1.25, L.z1 + 0.05);
      b.box('ground', DRIVE, w + 4, 0.03, 13, cx, 0.04, L.z1 + 6.5);
      b.box('solid', '#e0503a', 1.2, 1.6, 0.8, L.x1 + 1.2, 0.8, L.z1 - 5);   // the popsicle freezer
      const Pl = LAKEHOUSE_POOL, pw = Pl.x1 - Pl.x0, pd = Pl.z1 - Pl.z0, px = (Pl.x0 + Pl.x1) / 2, pz = (Pl.z0 + Pl.z1) / 2;
      b.box('ground', '#e6e1d4', pw + 9, 0.03, pd + 9, px, 0.045, pz);
      const fx0 = px - pw / 2 - 4.5, fx1 = px + pw / 2 + 4.5, fz0 = Pl.z0 - 4.5, fz1 = Pl.z1 + 4.5;
      railing(b, [fx0, fz0], [fx1, fz0]); railing(b, [fx0, fz0], [fx0, fz1]); railing(b, [fx1, fz0], [fx1, fz1]);
      railing(b, [fx0, fz1], [fx1 - 6, fz1]);   // (gate gap at the east end)
      for (const k of [0, 1, 2, 3]) b.box('solid', '#f2f2ee', 0.7, 0.3, 1.9, Pl.x0 + 4 + k * 3, 0.2, Pl.z0 - 2.4);
      for (const k of [0, 1]) { b.cyl('solid', STEEL, 0.04, 0.04, 2.4, Pl.x1 - 4 - k * 12, 1.2, Pl.z1 + 2.6, 6); b.cyl('solid', k ? '#e8477a' : '#39b6c9', 0.1, 1.7, 0.5, Pl.x1 - 4 - k * 12, 2.5, Pl.z1 + 2.6, 8); }
    }
    for (let k = 0; k < 7; k++) car(b, LAKEHOUSE_LOT.x0 + 7 + k * 11.2, LAKEHOUSE_LOT.z0 + 3.4, CAR_COLORS[(k * 3 + 1) % CAR_COLORS.length], 0);
    // --- Lakehouse Park ---
    pavilion(b, PARK_PAVILION.x, PARK_PAVILION.z, PARK_PAVILION.w, PARK_PAVILION.d, '#5d6f7a');
    for (const c of PICKLEBALL) {
      b.box('solid', '#22262b', 6.3, 0.9, 0.04, c.x, 0.47, c.z);
      for (const sx of [-1, 1]) b.cyl('solid', '#22262b', 0.04, 0.04, 1, c.x + sx * 3.15, 0.5, c.z, 6);
    }
    for (const sz of [-1, 1]) b.box('solid', '#3a3f45', 20, 2.6, 0.04, -233, 1.3, 3183 + sz * 8.2);
    bench(b, -246, 3183, Math.PI / 2); bench(b, -290, 3176, 0); bench(b, -316, 3196, Math.PI / 2);
    b.box('solid', '#6b5a48', 3.2, 1.1, 0.25, PARK.x1 - 8, 1.2, PARK.z0 + 2);
    for (const sx of [-1, 1]) b.box('solid', '#6b5a48', 0.22, 1.7, 0.22, PARK.x1 - 8 + sx * 1.4, 0.85, PARK.z0 + 2);

    // --- Colony Oaks Elementary ---
    {
      const S = SCHOOL, LIME = '#ddd3bd', DARK = '#474d55', BRICKS = '#a9694b', ACCENT = '#2f8f7a';
      const block = (r: { x0: number; x1: number; z0: number; z1: number; h: number }, lower: string, upperC: string, split: number) => {
        const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
        b.box('solid', lower, w, split, d, cx, split / 2, cz);
        b.box('solid', upperC, w + 0.3, r.h - split, d + 0.3, cx, (r.h + split) / 2, cz);
        b.box('solid', '#33383f', w + 0.6, 0.3, d + 0.6, cx, r.h + 0.15, cz);
      };
      block(S.bar, LIME, DARK, 4.3);
      block(S.wing, LIME, DARK, 4.3);
      block(S.gym, BRICKS, BRICKS, 6);
      b.box('solid', ACCENT, S.bar.x1 - S.gym.x1 + 0.4, 0.5, 0.2, (S.gym.x1 + S.bar.x1) / 2, 4.55, S.bar.z0 - 0.2);
      b.box('solid', ACCENT, 0.2, 0.5, S.wing.z1 - S.bar.z0 + 0.4, S.wing.x1 + 0.2, 4.55, (S.bar.z0 + S.wing.z1) / 2);
      // Classroom windows: two rows along every long face.
      const row = (x0: number, x1: number, z: number, face: number, alongX: boolean) => {
        for (const y of [2.2, 6.4]) for (let t = x0 + 3; t < x1 - 2.5; t += 5.2) {
          const lit = rnd() < 0.35;
          if (alongX) { b.box('glass', GLASS, 3.6, 1.7, 0.08, t, y, z + face * 0.2); if (lit) b.box('lit', LIT[Math.floor(rnd() * 4)], 3.4, 1.5, 0.04, t, y, z + face * 0.26); }
          else { b.box('glass', GLASS, 0.08, 1.7, 3.6, z + face * 0.2, y, t); if (lit) b.box('lit', LIT[Math.floor(rnd() * 4)], 0.04, 1.5, 3.4, z + face * 0.26, y, t); }
        }
      };
      row(S.gym.x1, S.entry.x - 7, S.bar.z0, -1, true);
      row(S.gym.x1, S.wing.x0, S.bar.z1, 1, true);
      row(S.bar.z0 + 4, S.wing.z1, S.wing.x1, 1, false);
      row(S.bar.z1, S.wing.z1, S.wing.x0, -1, false);
      for (let t = S.gym.x0 + 4; t < S.gym.x1 - 2; t += 6) b.box('glass', GLASS, 3.6, 1.4, 0.08, t, 9.2, S.gym.z0 - 0.06);
      // The entrance: a two-storey glass front under a deep canopy.
      b.box('glass', '#35506a', 12, 7.4, 0.3, S.entry.x, 3.9, S.entry.z - 0.4);
      b.box('lit', LIT[3], 11.4, 6.8, 0.05, S.entry.x, 3.9, S.entry.z - 0.6);
      for (let k = -2; k <= 2; k++) b.box('solid', '#e8e4d8', 0.14, 7.4, 0.36, S.entry.x + k * 3, 3.9, S.entry.z - 0.42);
      for (const y of [2.6, 5.1]) b.box('solid', '#e8e4d8', 12, 0.14, 0.36, S.entry.x, y, S.entry.z - 0.42);
      b.box('solid', ACCENT, 15, 0.35, 7, S.entry.x, 4.0, S.entry.z - 3.9);
      for (const sx of [-1, 1]) for (const dz of [-1.2, -6.6]) b.cyl('solid', '#e8e4d8', 0.16, 0.16, 3.85, S.entry.x + sx * 6.6, 1.92, S.entry.z + dz, 8);
      for (const sx of [-1, 1]) b.box('solid', '#7a1f1f', 1.1, 2.3, 0.1, S.entry.x + sx * 0.6, 1.15, S.entry.z - 0.62);
      b.box('ground', DRIVE, 20, 0.03, 12, S.entry.x, 0.045, S.entry.z - 5.6);
      // Name band over the doors (the lettering is Text), the sign by the road.
      b.box('solid', '#f1ece0', 38, 2.0, 0.12, S.entry.x - 27, 6.9, S.bar.z0 - 0.26);
      b.box('solid', STONE, 6.4, 1.1, 1.0, S.sign.x, 0.55, S.sign.z);
      b.box('solid', '#f1ece0', 5.6, 1.2, 0.5, S.sign.x, 1.7, S.sign.z);
      b.box('solid', ACCENT, 6.0, 0.18, 0.7, S.sign.x, 2.39, S.sign.z);
      // Flags.
      for (const [k, cols] of [[0, ['#b22234', '#ffffff', '#3c3b6e']], [1, ['#bf0a30', '#ffffff', '#002868']]] as [number, string[]][]) {
        const fx = S.flags.x - k * 3;
        b.cyl('solid', '#c9ccd1', 0.06, 0.08, 9, fx, 4.5, S.flags.z, 8);
        b.box('solid', cols[1], 2.2, 0.65, 0.04, fx + 1.15, 8.42, S.flags.z);
        b.box('solid', cols[0], 2.2, 0.65, 0.04, fx + 1.15, 7.77, S.flags.z);
        b.box('solid', cols[2], k ? 0.75 : 0.95, k ? 1.3 : 0.7, 0.05, fx + (k ? 0.4 : 0.5), k ? 8.1 : 8.4, S.flags.z);
      }
      // Covered play court + a few cars in the lot + bike racks.
      const sh = S.shade;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('solid', '#e8e4d8', 0.14, 0.14, 5, sh.x + sx * (sh.w / 2 - 0.4), 2.5, sh.z + sz * (sh.d / 2 - 0.4), 8);
      b.roof('solid', ACCENT, sh.w + 1, 1.2, sh.d + 1, sh.x, 5, sh.z, 0, 0);
      b.box('ground', '#8a8f96', sh.w, 0.03, sh.d, sh.x, 0.04, sh.z);
      b.cyl('solid', '#c9ccd1', 0.06, 0.06, 3.05, sh.x - sh.w / 2 + 1, 1.52, sh.z, 6);
      b.box('solid', '#f4f1e6', 0.05, 1.05, 1.8, sh.x - sh.w / 2 + 1.3, 3.3, sh.z);
      for (let k = 0; k < 9; k++) car(b, S.lot.x0 + 6 + k * 6.4, S.lot.z0 + 3.2 + (k % 2) * (S.lot.z1 - S.lot.z0 - 6.4), CAR_COLORS[(k * 5 + 2) % CAR_COLORS.length], 0);
      for (const sx of [-1, 1]) {
        b.cyl('solid', '#f4f1e6', 0.05, 0.05, 2.2, S.field.x + sx * S.field.rx, 1.1, S.field.z - 3.6, 6);
        b.cyl('solid', '#f4f1e6', 0.05, 0.05, 2.2, S.field.x + sx * S.field.rx, 1.1, S.field.z + 3.6, 6);
        b.box('solid', '#f4f1e6', 0.08, 0.08, 7.3, S.field.x + sx * S.field.rx, 2.2, S.field.z);
      }
      // School-zone signs on Sam Houston Drive.
      for (const x of [-405, -545]) { b.cyl('solid', '#7c838a', 0.045, 0.045, 2.6, x, 1.3, 3142, 6); b.box('solid', '#e8e337', 0.9, 0.9, 0.04, x, 2.5, 3142, 0, 0, Math.PI / 4); }
    }
    // Trees west of the line: round the lake, the park, the school grounds.
    const blocked = (x: number, z: number) => STREETS.some((s) => distToLine(x, z, s.pts) < s.w / 2 + 3.2) || inPoly(x, z, scalePoly(LAKE, 1, 9))
      || [SCHOOL.bar, SCHOOL.gym, SCHOOL.wing, SCHOOL.lot, LAKEHOUSE, LAKEHOUSE_LOT, PLAZA].some((r) => x > r.x0 - 5 && x < r.x1 + 5 && z > r.z0 - 5 && z < r.z1 + 5)
      || (x > LAKEHOUSE_POOL.x0 - 7 && x < LAKEHOUSE_POOL.x1 + 7 && z > LAKEHOUSE_POOL.z0 - 7 && z < LAKEHOUSE_POOL.z1 + 16)
      || (Math.abs(x - SCHOOL.field.x) < SCHOOL.field.rx + 2 && Math.abs(z - SCHOOL.field.z) < SCHOOL.field.rz + 2)
      || (x > -256 && x < -218 && z > 3172 && z < 3194) || Math.hypot(x - PARK_PLAY.x, z - PARK_PLAY.z) < 11 || Math.hypot(x - SCHOOL.play.x, z - SCHOOL.play.z) < 11
      || Math.hypot((x - PUMP_TRACK.x) / (PUMP_TRACK.rx + 4), (z - PUMP_TRACK.z) / (PUMP_TRACK.rz + 4)) < 1
      || (x > SCHOOL.entry.x - 14 && x < SCHOOL.entry.x + 14 && z > 3176 && z < 3194)
      || Math.hypot(x - SCHOOL.shade.x, z - SCHOOL.shade.z) < 12 || x > RAIL_MID_X - 15;
    let n = 0;
    for (let i = 0; i < 1400 && n < 210; i++) {
      const x = BOUNDS.x0 + 3 + rnd() * (RAIL_MID_X - 16 - BOUNDS.x0), z = BOUNDS.z0 + 3 + rnd() * (BOUNDS.z1 - BOUNDS.z0 - 6);
      if (blocked(x, z)) continue;
      tree(b, x, z, 1.0 + rnd() * 1.1, rnd); n++;
    }
    out.west = b.build();
  }

  // ------------------- far: the ranch fence, and the woods beyond it -------
  {
    const b = new Batch();
    const B = BOUNDS, gapA = RAIL_MID_X - 13, gapB = RAIL_MID_X + 13;
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      for (const y of [0.55, 1.05]) b.box('solid', '#8f7a5c', 0.07, 0.12, L, (x0 + x1) / 2, y, (z0 + z1) / 2, ry);
      for (let t = 0; t <= L; t += 9) b.box('solid', '#7c684c', 0.16, 1.3, 0.16, x0 + ((x1 - x0) * t) / L, 0.65, z0 + ((z1 - z0) * t) / L);
    };
    rail(B.x0, B.z0, gapA, B.z0); rail(gapB, B.z0, B.x1, B.z0); rail(B.x0, B.z1, B.x1, B.z1); rail(B.x0, B.z0, B.x0, B.z1); rail(B.x1, B.z0, B.x1, B.z1);
    // Where a street runs on past the fence: a barricade (the next phase isn't built yet).
    for (const s of STREETS) for (const p of [s.pts[0], s.pts[s.pts.length - 1]]) {
      const atX = Math.abs(p[0] - B.x0) < 5 || Math.abs(p[0] - B.x1) < 5, atZ = Math.abs(p[1] - B.z0) < 5 || Math.abs(p[1] - 3343) < 2;
      if (!atX && !atZ) continue;
      const ry = atX ? Math.PI / 2 : 0;
      b.box('solid', '#f4f1e6', s.w + 1, 0.3, 0.1, p[0], 1.0, p[1], ry);
      b.box('solid', '#e8772a', s.w + 1, 0.3, 0.1, p[0], 0.55, p[1], ry);
      for (const k of [-1, 1]) b.box('solid', '#f4f1e6', 0.12, 1.2, 0.5, p[0] + (atX ? 0 : k * s.w / 2), 0.6, p[1] + (atX ? k * s.w / 2 : 0), ry);
    }
    // Post oaks and pines beyond the fence, thinning into the haze.
    for (let i = 0; i < 260; i++) {
      const side = Math.floor(rnd() * 4), t = rnd(), out2 = 6 + Math.pow(rnd(), 1.5) * 130;
      let x: number, z: number;
      if (side === 0) { x = B.x0 + t * (B.x1 - B.x0); z = B.z1 + out2; }
      else if (side === 1) { x = B.x0 - out2; z = B.z0 + t * (B.z1 - B.z0); }
      else if (side === 2) { x = B.x1 + out2; z = B.z0 + t * (B.z1 - B.z0); }
      else { x = B.x0 + t * (B.x1 - B.x0); z = B.z0 - out2 * 0.25; if (Math.abs(x - RAIL_MID_X) < 16) continue; }
      const s = 1.3 + rnd() * 1.6;
      if (rnd() < 0.45) {
        b.cyl('solid', '#6b5140', 0.16 * s, 0.24 * s, 7 * s, x, 3.5 * s, z, 6);
        b.cyl('solid', '#2f5a35', 0.2, 2.1 * s, 4.6 * s, x, 8.2 * s, z, 7);
      } else tree(b, x, z, s, rnd);
    }
    out.far = b.build();
  }

  // ---------------------------------------------------- flat outlines ----
  const add = (poly: Pt[], y: number, kind: string) => out.flats.push({ g: flat(poly, y), kind });
  add(POCKET_PARK, 0.012, 'lawn');
  for (const p of PONDS) { add(scalePoly(p, 1, 2.2), 0.02, 'bank'); add(p, 0.05, 'water'); }
  add(scalePoly(LAKE, 1, 2.6), 0.02, 'bank'); add(LAKE, 0.05, 'water');
  add(scalePoly(POCKET_POOL, 1, 4.5), 0.05, 'deck'); add(scalePoly(POCKET_POOL, 1, 0.5), 0.3, 'coping'); add(POCKET_POOL, 0.33, 'pool');
  const Pl = LAKEHOUSE_POOL;
  const prect: Pt[] = [[Pl.x0, Pl.z0], [Pl.x1, Pl.z0], [Pl.x1, Pl.z1], [Pl.x0, Pl.z1]];
  add(scalePoly(prect, 1, 0.6), 0.3, 'coping'); add(prect, 0.33, 'pool');
  return out;
}

const STREET_SIGNS: { x: number; z: number; ry: number; name: string }[] = [
  { x: 101.5, z: 3080, ry: 1.25, name: 'Chinaberry Bend' },
  { x: 86, z: 3068.5, ry: -0.3, name: 'Sam Houston Dr' },
  { x: 9, z: 3204.5, ry: 0.86, name: 'Chinaberry Bend' },
  { x: -51.5, z: 3127, ry: 1.2, name: 'Ironbark Bend' },
  { x: -43, z: 3181, ry: -0.6, name: 'Rosemary Ct' },
];

function Label({ x, y, z, ry, text, size, color = '#ffffff', width }: { x: number; y: number; z: number; ry: number; text: string; size: number; color?: string; width?: number }) {
  return (
    <Text position={[x, y, z]} rotation={[0, ry, 0]} fontSize={size} color={color} anchorX="center" anchorY="middle" letterSpacing={0.04} maxWidth={width} textAlign="center">
      {text}
    </Text>
  );
}

/** A plume of water in the lake and one in the big pond. */
function Fountains() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const spots = useMemo<[number, number, number][]>(() => [[LAKE_FOUNTAIN.x, LAKE_FOUNTAIN.z, 5.5], [308, 2982, 3.6]], []);
  useFrame(({ clock, camera }) => {
    const m = ref.current;
    if (!m || camera.position.z < 2500) return;
    spots.forEach(([x, z, hMax], i) => {
      const h = hMax * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 2.1 + i * 2));
      o.position.set(x, 0.05 + h / 2, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 2]} frustumCulled={false}>
      <cylinderGeometry args={[0.12, 0.7, 1, 10]} />
      <meshStandardMaterial color="#e8f6fb" transparent opacity={0.7} roughness={0.1} depthWrite={false} />
    </instancedMesh>
  );
}

export function Colony() {
  const geo = useMemo(() => buildColony(), []);
  const mats = useMemo(() => ({
    solid: paint(0.9),
    ground: paint(0.95),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.55 }),
    lit: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    glow: glowPaint(0.5),
  }), []);
  const flatMats = useMemo<Record<string, THREE.Material>>(() => ({
    lawn: new THREE.MeshStandardMaterial({ color: '#6fae52', roughness: 1 }),
    bank: new THREE.MeshStandardMaterial({ color: '#9a9469', roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: '#2c6a8c', roughness: 0.12, metalness: 0.25 }),
    deck: new THREE.MeshStandardMaterial({ color: '#e6e1d4', roughness: 0.9 }),
    coping: new THREE.MeshStandardMaterial({ color: '#f4f1e6', roughness: 0.8 }),
    pool: new THREE.MeshStandardMaterial({ color: '#49c3e8', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.72, depthWrite: false }),
  }), []);
  useFrame(() => {
    const sky = useSkyStore.getState();
    const on = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    mats.lit.opacity = on * 0.95;
    mats.lit.visible = on > 0.02;
    mats.glow.emissiveIntensity = 0.7 + 2.6 * on;
  });

  useEffect(() => {
    const zs = useZoneStore.getState();
    for (const t of COLONY_TREATS) zs.register({ id: t.id, kind: 'icecream', label: t.label, emoji: t.emoji, x: t.x, z: t.z, radius: 2.4 });
    return () => { for (const t of COLONY_TREATS) useZoneStore.getState().unregister(t.id); };
  }, []);

  const section = (g: Sec, key: string, shadow: boolean) => (
    <group key={key}>
      {g.solid && <mesh geometry={g.solid} material={mats.solid} castShadow={shadow} receiveShadow />}
      {g.ground && <mesh geometry={g.ground} material={mats.ground} receiveShadow />}
      {g.glass && <mesh geometry={g.glass} material={mats.glass} />}
      {g.lit && <mesh geometry={g.lit} material={mats.lit} renderOrder={2} />}
      {g.glow && <mesh geometry={g.glow} material={mats.glow} />}
    </group>
  );
  const S = SCHOOL, pcz = PLAZA.z1 - 6, tx = PLAZA.x0 + 5;
  return (
    <group>
      {section(geo.ground, 'ground', false)}
      {geo.houses.map((g, i) => section(g, `h${i}`, true))}
      {section(geo.east, 'east', true)}
      {section(geo.west, 'west', true)}
      {section(geo.far, 'far', false)}
      {geo.flats.map((f, i) => <mesh key={i} geometry={f.g} material={flatMats[f.kind]} receiveShadow renderOrder={f.kind === 'pool' ? 3 : 0} />)}
      <Fountains />
      {/* Big live oaks where people gather (it is Colony OAKS, after all). */}
      {([[-24, 3058, 1.5], [34, 3012, 1.7], [72, 3026, 1.3], [-52, 3018, 1.4], [-442, 3158, 1.5], [-534, 3160, 1.4], [-282, 3172, 1.5], [-322, 3222, 1.6], [-186, 3108, 1.2], [-250, 3040, 1.4]] as [number, number, number][])
        .map(([x, z, s], i) => <LiveOak key={i} position={[x, 0, z]} scale={s} seed={i + 70} />)}
      {([[6, 3051], [PARK_PLAY.x, PARK_PLAY.z], [S.play.x, S.play.z]] as [number, number][])
        .map(([x, z], i) => <GLBModel key={i} url={MODELS.playground.url} fitHeight={MODELS.playground.fitHeight} position={[x, 0, z]} rotationY={i * 1.3} />)}

      {/* Street-name blades. */}
      {STREET_SIGNS.map((sg) => [1, -1].map((f) => (
        <Label key={sg.name + sg.x + f} x={sg.x + f * Math.sin(sg.ry) * 0.03} y={2.86} z={sg.z + f * Math.cos(sg.ry) * 0.03} ry={sg.ry + (f > 0 ? 0 : Math.PI)} text={sg.name} size={0.19} />
      )))}
      {/* The station totem + the neighbourhood's stone sign, facing the road and the platform. */}
      {[1, -1].map((f) => (
        <group key={f} position={[tx, 0, pcz + f * 0.17]} rotation={[0, f > 0 ? 0 : Math.PI, 0]}>
          <Text position={[0, 2.35, 0]} fontSize={0.36} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.05}>MetroRail</Text>
          <Text position={[0, 1.8, 0]} fontSize={0.3} color="#ffd98a" anchorX="center" anchorY="middle" letterSpacing={0.06}>BASTROP</Text>
          <Text position={[0, 1.1, 0]} fontSize={0.17} color="#cfe0ff" anchorX="center" anchorY="middle" maxWidth={2.3} textAlign="center">Trains to Downtown Austin, The Domain + Avery Ranch</Text>
        </group>
      ))}
      <Label x={-174} y={0.85} z={PLAZA.z1 - 1.12} ry={0} text="THE COLONY" size={0.72} color="#4a4034" />
      <Label x={-174} y={0.85} z={PLAZA.z1 - 2.08} ry={Math.PI} text="THE COLONY" size={0.72} color="#4a4034" />
      <Label x={SNOW_CONE.x - 0.83} y={1.25} z={SNOW_CONE.z} ry={-Math.PI / 2} text="SNOW CONES" size={0.26} color="#c22d5e" />
      <Label x={LEMONADE.x} y={2.0} z={LEMONADE.z + 0.38} ry={0} text="LEMONADE 25¢" size={0.22} color="#7a4b12" />
      <Label x={(LAKEHOUSE.x0 + LAKEHOUSE.x1) / 2} y={4.3} z={LAKEHOUSE.z1 + 0.06} ry={0} text="THE LAKEHOUSE" size={0.6} color="#4a4034" />
      <Label x={PARK.x1 - 8} y={1.2} z={PARK.z0 + 1.86} ry={Math.PI} text="LAKEHOUSE PARK" size={0.3} color="#f4ead2" />
      {/* The school's name: over the doors and on the sign by the road. */}
      <Label x={S.entry.x - 27} y={6.9} z={S.bar.z0 - 0.34} ry={Math.PI} text="COLONY OAKS ELEMENTARY" size={1.55} color="#2f3a45" />
      <Label x={S.sign.x} y={1.78} z={S.sign.z - 0.26} ry={Math.PI} text="COLONY OAKS" size={0.5} color="#2f3a45" />
      <Label x={S.sign.x} y={1.32} z={S.sign.z - 0.26} ry={Math.PI} text="ELEMENTARY SCHOOL" size={0.26} color="#2f8f7a" />
    </group>
  );
}
