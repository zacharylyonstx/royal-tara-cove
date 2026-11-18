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
const CEDAR = '#a3906f';   // weathered cedar privacy fence
const STEEL = '#5f7383';
const NAVY = '#16335c';
const RED = '#c8102e';
const STONE = '#cfc6b3';
const OAK = ['#3f6b3a', '#4a7a40', '#365f38', '#557f46'];

// House finishes, from the builder's published designs for this street and
// aerial imagery: painted and natural brick, a little stone at the base,
// taupe trim, charcoal shingles, weathered cedar fences.
const BRICK = ['#e4dfd4', '#cfc3ad', '#9a7b62', '#b9b2a8', '#a8674d', '#d9d2c4'];
const ROOF = ['#3b3c3f', '#44413e', '#35373b'];
const DOOR = ['#3a3d42', '#5a2e22', '#1f3d4d', '#6b5a48'];
const GARAGE = ['#8c867c', '#a39c90', '#6f6a62'];
const TRIM = '#8f877a';
// Colony Oaks Elementary, from a photo of the front.
const SCH = { brick: '#7a6050', band: '#6a5244', cream: '#e6e1d4', panel: '#8f6f4f', green: '#35a84a', lime: '#8fd62a', metal: '#a4a9ae', navy: '#1f2a5c' };

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
// The builder's look on this street: a narrow, deep single-storey brick house
// under a charcoal hip roof, with two steep gables to the street — one over a
// pair of single garage doors, one over a big arched front window — and the
// front door set back between them.
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
  /** A gable facing the street: brick triangle, framed by the roof edge. */
  const gable = (lx: number, w: number, rise: number, front: number, len: number) => {
    roof(wall, len, rise, w, lx, H1, front - len / 2, true, 0);
    roof(rf, len + 0.9, rise + 0.26, w + 0.8, lx, H1 - 0.07, front - 0.07 - (len + 0.9) / 2, true, 0);
  };
  const W = h.w, D = h.d, g = h.garage, H1 = 3.05;
  const GW = 6.1, GP = 1.5;                 // garage width, how far it stands forward
  const wall = BRICK[h.style], rf = ROOF[h.roof], gar = GARAGE[h.seed % 3];
  const zf = D / 2 - GP;                    // the main front wall
  const gx = g * (W / 2 - GW / 2);          // garage centre
  const Wn = W - GW, nx = -g * (GW / 2);    // the rest of the front: width, centre
  const bodyD = D - GP;

  // Body + garage block.
  box('solid', wall, W, H1, bodyD, 0, H1 / 2, -GP / 2);
  box('solid', wall, GW, H1, GP + 0.05, gx, H1 / 2, D / 2 - GP / 2);
  // Two single garage doors with a brick pier between, stone at the base.
  for (const k of [-1, 1]) {
    box('solid', gar, 2.45, 2.2, 0.07, gx + k * 1.42, 1.1, D / 2 + 0.03);
    for (const y of [0.55, 1.1, 1.65]) box('solid', '#6b665e', 2.45, 0.02, 0.075, gx + k * 1.42, y, D / 2 + 0.032);
    box('solid', '#2a2a2a', 0.1, 0.22, 0.08, gx + k * 1.42, 1.25, D / 2 + 0.04);
  }
  for (const k of [-1, 0, 1]) box('solid', STONE, 0.42, 0.95, 0.12, gx + k * 2.84, 0.475, D / 2 + 0.03);
  // The front room: its own little block, with the arched window.
  const fw = Wn - 1.7, fx = nx - g * 0.85, fz = zf + 0.9;
  box('solid', wall, fw, H1, 1.0, fx, H1 / 2, zf + 0.45);
  box('solid', TRIM, 2.3, 1.9, 0.06, fx, 1.55, fz + 0.03);
  box('glass', GLASS, 2.1, 1.7, 0.06, fx, 1.55, fz + 0.05);
  { const [ax, az] = P(fx, fz + 0.035); b.cyl('glass', GLASS, 1.05, 1.05, 0.06, ax, 2.4, az, 14, Math.PI / 2, 0, h.ry); }
  if (rnd() < 0.6) box('lit', LIT[Math.floor(rnd() * 4)], 2.0, 1.6, 0.03, fx, 1.55, fz + 0.09);
  for (const k of [-1, 0, 1]) box('solid', TRIM, 0.05, 1.7, 0.07, fx + k * 0.7, 1.55, fz + 0.06);
  box('solid', TRIM, 2.1, 0.05, 0.07, fx, 1.6, fz + 0.06);
  // The door, set back between the garage and the front room.
  const dx = nx + g * (Wn / 2 - 0.85);
  box('solid', TRIM, 1.25, 2.35, 0.05, dx, 1.17, zf + 0.03);
  box('solid', DOOR[h.door], 1.0, 2.2, 0.08, dx, 1.1, zf + 0.05);
  for (const y of [0.6, 1.05, 1.5, 1.95]) box('glass', GLASS, 0.5, 0.32, 0.09, dx, y, zf + 0.055);
  box('solid', DRIVE, 1.7, 0.14, GP + 0.9, dx, 0.07, zf + (GP + 0.9) / 2);
  // Side windows.
  for (const sx of [-1, 1]) for (const lz of [-D / 4, D / 10]) {
    box('glass', GLASS, 0.05, 1.3, 1.2, sx * (W / 2 + 0.02), 1.65, lz - GP / 2);
    if (rnd() < 0.3) box('lit', LIT[Math.floor(rnd() * 4)], 0.03, 1.2, 1.1, sx * (W / 2 + 0.05), 1.65, lz - GP / 2);
  }
  // Roofs: the long charcoal hip, then the gables to the street.
  if (h.storeys === 2) {
    // A few have rooms upstairs at the back, under a second hip.
    const uD = bodyD * 0.5, uz = -GP / 2 - bodyD * 0.2, H2 = 2.6;
    box('solid', wall, W - 0.4, H2, uD, 0, H1 + H2 / 2, uz);
    roof(rf, uD + 0.9, 2.6, W + 0.5, 0, H1 + H2, uz, true, (W + 0.5) / 2 * 0.8);
    for (const k of [-1, 1]) box('glass', GLASS, 1.3, 1.2, 0.05, k * (W / 2 - 2.4), H1 + 1.4, uz + uD / 2 + 0.04);
  }
  roof(rf, bodyD + 0.9, 3.3, W + 0.9, 0, H1, -GP / 2, true, (W + 0.9) / 2 * 0.9);
  gable(gx, GW + 0.1, 2.7, D / 2 + 0.02, 5.2);
  gable(fx, fw + 0.1, 2.3, zf + 0.97, 4.6);
  // Gable trim: a little window high in each, and (on some) a centre dormer.
  box('glass', GLASS, 0.55, 0.75, 0.05, gx, H1 + 1.0, D / 2 + 0.05);
  if (h.seed % 3 !== 0) {
    roof(wall, 3.2, 1.5, 2.3, dx, H1 + 1.3, zf - 1.6, true, 0);
    roof(rf, 3.8, 1.72, 2.9, dx, H1 + 1.25, zf - 1.95, true, 0);
    box('glass', GLASS, 0.5, 0.5, 0.05, dx, H1 + 1.75, zf + 0.02);
  }
  // Planting: clipped evergreens either side of the window, a flower bed.
  for (const k of [-1, 1]) { const [ex, ez] = P(fx + k * 1.55, fz + 0.7); b.cyl('solid', '#2f6b3a', 0.05, 0.42, 1.6, ex, 0.8, ez, 6); }
  box('solid', '#3f7a3d', fw + 0.6, 0.35, 0.9, fx, 0.18, fz + 1.5);
  box('solid', ['#d9508a', '#e8c23a', '#c8382e', '#8a5fc4'][h.seed % 4], fw - 0.4, 0.14, 0.5, fx, 0.42, fz + 1.6);
  // Driveway, a car on some, the fenced back yard, a young tree out front.
  box('ground', DRIVE, 5.9, 0.03, h.drive + 0.5, gx, 0.03, D / 2 + (h.drive + 0.5) / 2);
  const fwid = LOT_W - 0.3, back = -D / 2 - YARD_BACK + 0.3, sideLen = YARD_BACK + D * 0.55;
  box('solid', CEDAR, fwid, 1.85, 0.08, 0, 0.92, back);
  for (const sx of [-1, 1]) box('solid', CEDAR, 0.08, 1.85, sideLen, sx * fwid / 2, 0.92, back + sideLen / 2);
  const [tx, tz] = P(-g * (W / 2 - 1.2), D / 2 + 4.6);
  tree(b, tx, tz, 0.7 + rnd() * 0.3, rnd);
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
    // Lakehouse lot; the school's two lots, with grass islands and light poles.
    for (const lot of [LAKEHOUSE_LOT, SCHOOL.lot, SCHOOL.lot2]) {
      b.box('ground', ASPHALT, lot.x1 - lot.x0, 0.03, lot.z1 - lot.z0, (lot.x0 + lot.x1) / 2, 0.04, (lot.z0 + lot.z1) / 2);
      for (let x = lot.x0 + 3; x < lot.x1 - 2; x += 2.8) for (const z of [lot.z0 + 3, lot.z1 - 3]) b.box('ground', '#e8e4d8', 0.12, 0.031, 5, x, 0.042, z);
    }
    {
      const L = SCHOOL.lot, mz = (L.z0 + L.z1) / 2;
      b.box('ground', '#e8e4d8', L.x1 - L.x0 - 24, 0.031, 0.12, (L.x0 + L.x1) / 2, 0.042, mz);
      for (let x = L.x0 + 14; x < L.x1 - 12; x += 2.8) b.box('ground', '#e8e4d8', 0.12, 0.031, 9.6, x, 0.042, mz);
      for (const ix of [L.x0 + 6, (L.x0 + L.x1) / 2, L.x1 - 6]) {
        b.box('ground', KERB, 8, 0.1, 5, ix, 0.06, mz);
        b.box('ground', '#6fae52', 7.4, 0.11, 4.4, ix, 0.07, mz);
      }
      // The drop-off: a red fire-lane kerb and the paved forecourt up to the doors.
      b.box('ground', '#c8382e', L.x1 - L.x0 + 8, 0.12, 0.3, (L.x0 + L.x1) / 2, 0.06, L.z1 + 11.6);
      const E = SCHOOL.entry;
      b.box('ground', DRIVE, 96, 0.03, 4.6, (L.x0 + L.x1) / 2 + 4, 0.045, L.z1 + 14);
      b.box('ground', DRIVE, E.w + 6, 0.03, E.z - (L.z1 + 12), E.x, 0.046, (E.z + L.z1 + 12) / 2);
      const C = SCHOOL.court;
      b.box('ground', '#d2c6a8', C.x1 - C.x0, 0.03, C.z1 - C.z0, (C.x0 + C.x1) / 2, 0.04, (C.z0 + C.z1) / 2);
      // A painted cougar-paw trail from the kerb to the doors (navy + green).
      for (let k = 0; k < 6; k++) {
        const pz = L.z1 + 14 + k * 2.6, px = E.x + (k % 2 ? 0.7 : -0.7);
        b.cyl('ground', k % 2 ? SCH.green : SCH.navy, 0.34, 0.34, 0.012, px, 0.066, pz, 10);
        for (const t of [-0.34, -0.12, 0.12, 0.34]) b.cyl('ground', k % 2 ? SCH.green : SCH.navy, 0.12, 0.12, 0.012, px + t, 0.066, pz - 0.46 + Math.abs(t) * 0.5, 8);
      }
    }
    for (const c of PICKLEBALL) {
      b.box('ground', '#3f8f6a', 8.6, 0.03, 16, c.x, 0.04, c.z);
      b.box('ground', '#3a6fb5', 6.1, 0.031, 13.4, c.x, 0.045, c.z);
      for (const lz of [-6.7, -2.13, 2.13, 6.7]) b.box('ground', '#f4f1e6', 6.1, 0.032, 0.08, c.x, 0.05, c.z + lz);
      for (const lx of [-3.05, 0, 3.05]) b.box('ground', '#f4f1e6', 0.08, 0.032, lx === 0 ? 9.1 : 13.4, c.x + lx, 0.05, c.z);
    }
    // Playground mulch (the school's is a hexagon, as in the aerial).
    for (const p of [PARK_PLAY, { x: 6, z: 3051 }]) b.cyl('ground', '#9b7a55', 8.5, 8.5, 0.03, p.x, 0.035, p.z, 16);
    b.cyl('ground', '#9b7a55', 9, 9, 0.03, SCHOOL.play.x, 0.035, SCHOOL.play.z, 6);
    for (const sh of SCHOOL.shades) b.box('ground', '#a98a62', sh.s - 1, 0.03, sh.s - 1, sh.x, 0.035, sh.z);
    // The pump track: a looping ribbon of concrete with rollers, on a lawn.
    {
      const T = PUMP_TRACK, pts: Pt[] = [];
      for (let k = 0; k <= 72; k++) {
        const a = (k / 72) * Math.PI * 2, wob = 1 + 0.32 * Math.sin(a * 3);
        pts.push([T.x + Math.cos(a) * T.rx * wob * 0.8, T.z + Math.sin(a) * T.rz * (1 + 0.25 * Math.cos(a * 2))]);
      }
      ribbon(b, '#d8d5cb', pts, 2.2, 0.06);
      for (let k = 0; k < 72; k += 4) b.cyl('ground', '#cfccc2', 1.1, 1.3, 0.34, pts[k][0], 0.12, pts[k][1], 8);
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
    {
      const Pv = POCKET_PAVILION;
      b.box('solid', STONE, Pv.w, 3, Pv.d, Pv.x, 1.5, Pv.z);
      b.roof('solid', '#5d6f7a', Pv.d + 2.4, 1.9, Pv.w + 5, Pv.x, 3, Pv.z, Math.PI / 2, 0);
      for (const dz of [-3, 3]) b.box('solid', '#3a3d42', 0.08, 2.1, 1, Pv.x + Pv.w / 2 + 0.02, 1.05, Pv.z + dz);
      for (const dz of [-5.4, 0, 5.4]) b.box('solid', '#6b5a48', 0.24, 3, 0.24, Pv.x + Pv.w / 2 + 2.2, 1.5, Pv.z + dz);
    }
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
    // --- Lakehouse Park ---
    pavilion(b, PARK_PAVILION.x, PARK_PAVILION.z, PARK_PAVILION.w, PARK_PAVILION.d, '#5d6f7a');
    {
      const cx = (PICKLEBALL[0].x + PICKLEBALL[1].x) / 2, cz = PICKLEBALL[0].z;
      for (const c of PICKLEBALL) {
        b.box('solid', '#22262b', 6.3, 0.9, 0.04, c.x, 0.47, c.z);
        for (const sx of [-1, 1]) b.cyl('solid', '#22262b', 0.04, 0.04, 1, c.x + sx * 3.15, 0.5, c.z, 6);
      }
      // Black chain-link round the courts (see-through: rails + posts).
      for (const sz of [-1, 1]) for (const y of [0.1, 1.5, 3]) b.box('solid', '#22262b', 18, 0.05, 0.05, cx, y, cz + sz * 8.2);
      for (const sx of [-1, 1]) for (const y of [0.1, 1.5, 3]) b.box('solid', '#22262b', 0.05, 0.05, 16.4, cx + sx * 9, y, cz);
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) b.box('solid', '#22262b', 0.07, 3, 0.07, cx + sx * 9, 1.5, cz + sz * 8.2);
      bench(b, cx + 11, cz, Math.PI / 2);
    }
    bench(b, PARK_PLAY.x + 11, PARK_PLAY.z, Math.PI / 2); bench(b, PUMP_TRACK.x, PUMP_TRACK.z + 16, 0);
    b.box('solid', '#6b5a48', 3.2, 1.1, 0.25, PARK.x1 - 8, 1.2, PARK.z0 + 2);
    for (const sx of [-1, 1]) b.box('solid', '#6b5a48', 0.22, 1.7, 0.22, PARK.x1 - 8 + sx * 1.4, 0.85, PARK.z0 + 2);

    // --- Colony Oaks Elementary (see world/colony.ts for what it is drawn from) ---
    {
      const S = SCHOOL;
      for (const k of S.blocks) {
        const w = k.x1 - k.x0, d = k.z1 - k.z0, cx = (k.x0 + k.x1) / 2, cz = (k.z0 + k.z1) / 2;
        b.box('solid', k.kind === 'brick' ? SCH.brick : SCH.cream, w, k.h, d, cx, k.h / 2, cz);
        // Parapet cap, white roof, rooftop air handlers.
        b.box('solid', SCH.metal, w + 0.3, 0.22, d + 0.3, cx, k.h + 0.11, cz);
        b.box('solid', '#eeeeea', w - 0.6, 0.1, d - 0.6, cx, k.h + 0.2, cz);
        for (let x = k.x0 + 5; x < k.x1 - 4; x += 7.5) for (let z = k.z0 + 5; z < k.z1 - 4; z += 9) b.box('solid', '#c9cdd0', 2.2, 1.1, 1.5, x, k.h + 0.8, z);
        if (k.kind === 'brick') for (let y = 1.1; y < k.h; y += 1.15) {
          // Brick laid in bands, a darker course every metre or so.
          b.box('solid', SCH.band, w + 0.04, 0.16, d + 0.04, cx, y, cz);
        }
      }
      // Window bays. `face`: which way the wall looks (n/s/e/w); t along it.
      const bay = (kind: 'brick' | 'cream', x: number, z: number, face: 'n' | 's' | 'e' | 'w', wide: number) => {
        const ns = face === 'n' || face === 's', out = face === 'n' || face === 'w' ? -1 : 1;
        const put = (group: string, color: string, along: number, hh: number, y: number, off: number, shift = 0) => {
          const t = 0.08;
          if (ns) b.box(group, color, along, hh, t, x + shift, y, z + out * off);
          else b.box(group, color, t, hh, along, x + out * off, y, z + shift);
        };
        if (kind === 'cream') {
          // Cream wings: a tall brown strip per bay holding two stacked windows,
          // with a slim green fin beside it.
          put('solid', SCH.panel, wide + 0.5, 7.2, 4.4, 0.05);
          for (const y of [2.2, 6.2]) { put('glass', GLASS, wide, 1.9, y, 0.1); if (rnd() < 0.3) put('lit', LIT[Math.floor(rnd() * 4)], wide - 0.2, 1.7, y, 0.16); }
          put('solid', SCH.green, 0.22, 7.2, 4.4, 0.12, wide / 2 + 0.36);
        } else {
          for (const y of [2.1, 6.3]) {
            put('glass', GLASS, wide, 2.1, y, 0.1);
            put('solid', '#1d2126', wide + 0.16, 0.08, y + 1.05, 0.12); put('solid', '#1d2126', wide + 0.16, 0.08, y - 1.05, 0.12);
            put('solid', SCH.green, 0.3, 2.1, y, 0.12, wide / 2 + 0.2);
            if (rnd() < 0.3) put('lit', LIT[Math.floor(rnd() * 4)], wide - 0.2, 1.9, y, 0.16);
          }
        }
      };
      const run = (kind: 'brick' | 'cream', a0: number, a1: number, fixed: number, face: 'n' | 's' | 'e' | 'w', step: number, wide: number) => {
        const n = Math.max(1, Math.floor((a1 - a0 - 2) / step));
        for (let i = 0; i < n; i++) {
          const t = a0 + (a1 - a0) * ((i + 0.5) / n);
          if (face === 'n' || face === 's') bay(kind, t, fixed, face, wide); else bay(kind, fixed, t, face, wide);
        }
      };
      const [office, east, mid, west, gym] = S.blocks;
      run('brick', office.x0, office.x1, office.z0, 'n', 5.6, 3.2);
      run('brick', office.z0, office.z1, office.x0, 'w', 7, 3.2);
      run('brick', office.z0, east.z0, office.x1, 'e', 5, 2.6);
      run('cream', office.x1, east.x1, east.z0, 'n', 5.4, 1.7);
      run('cream', east.x0 + 16, east.x1, east.z1, 's', 5.4, 1.7);
      run('cream', east.z0, east.z1, east.x1, 'e', 9, 1.7);
      run('cream', west.x0, mid.x0, west.z0, 'n', 5.4, 1.7);
      run('cream', west.x0, gym.x0, west.z1, 's', 5.4, 1.7);
      run('cream', west.z0, west.z1, west.x0, 'w', 9, 1.7);
      run('cream', S.entry.x + S.entry.w / 2 + 1, office.x0, mid.z0, 'n', 4, 1.4);
      for (let x = gym.x0 + 5; x < gym.x1 - 3; x += 7) b.box('glass', GLASS, 3.4, 1.3, 0.08, x, 9, gym.z1 + 0.06);
      // The outside stair at the west end of the west wing.
      for (let k = 0; k < 9; k++) b.box('solid', SCH.metal, 1.5, 0.12, 0.9, west.x0 - 0.9, 0.45 + k * 0.5, west.z0 + 4 + k * 0.9);
      b.box('solid', SCH.metal, 1.6, 0.12, 2.4, west.x0 - 0.9, 4.6, west.z0 + 13.1);
      for (const dz of [4, 14.2]) b.box('solid', '#6b7076', 0.12, 4.6, 0.12, west.x0 - 1.6, 2.3, west.z0 + dz);

      // The entrance: a two-storey wall of glass under a deep grey canopy on
      // slim green columns, the school's name along the canopy's edge.
      const E = S.entry, ch = 6.2, cd = 9;
      b.box('glass', '#2b3d4d', E.w, 8, 0.3, E.x, 4.1, E.z + 0.1);
      b.box('lit', LIT[3], E.w - 0.6, 7.2, 0.05, E.x, 4.1, E.z - 0.1);
      for (let k = -2; k <= 2; k++) b.box('solid', '#1d2126', 0.12, 8, 0.36, E.x + (k * E.w) / 4.4, 4.1, E.z + 0.05);
      for (const y of [2.7, 5.4]) b.box('solid', '#1d2126', E.w, 0.12, 0.36, E.x, y, E.z + 0.05);
      b.box('solid', SCH.metal, E.w + 9, 1.25, cd, E.x + 1.5, ch + 0.62, E.z - cd / 2 + 0.2);
      b.box('solid', '#8d9297', E.w + 9.3, 0.14, cd + 0.3, E.x + 1.5, ch + 1.3, E.z - cd / 2 + 0.2);
      for (const k of [-1.5, -0.5, 0.5, 1.5]) for (const dz of [-1.4, -cd + 1]) b.cyl('solid', SCH.green, 0.11, 0.11, ch, E.x + 1.5 + k * ((E.w + 6) / 3), ch / 2, E.z + dz, 8);
      for (const sx of [-1, 1]) b.box('solid', '#1d2126', 1.05, 2.4, 0.1, E.x + sx * 0.56, 1.2, E.z - 0.12);
      // The covered walk along the brick block: a thin grey roof on green posts.
      const Wk = S.walk, wl = Wk.x1 - Wk.x0;
      b.box('solid', SCH.metal, wl, 0.16, Wk.z1 - Wk.z0, (Wk.x0 + Wk.x1) / 2, 3.25, (Wk.z0 + Wk.z1) / 2);
      for (let x = Wk.x0 + 0.6; x <= Wk.x1; x += 4.4) {
        b.cyl('solid', SCH.green, 0.08, 0.08, 3.2, x, 1.6, Wk.z0 + 0.5, 8);
        b.box('solid', SCH.green, 0.1, 0.1, Wk.z1 - Wk.z0 - 0.4, x, 3.12, (Wk.z0 + Wk.z1) / 2);
      }
      // Lime-green shade sails on steel posts.
      for (const sh of S.shades) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('solid', '#5f666c', 0.14, 0.14, 4.6, sh.x + sx * (sh.s / 2 - 0.5), 2.3, sh.z + sz * (sh.s / 2 - 0.5), 8);
        b.roof('solid', SCH.lime, sh.s, 2.4, sh.s, sh.x, 4.3, sh.z, 0, sh.s / 2 - 0.4);
      }
      // The sign by the road, in the school's navy and green.
      b.box('solid', STONE, 7, 0.9, 1.1, S.sign.x, 0.45, S.sign.z);
      b.box('solid', SCH.navy, 6.4, 1.5, 0.5, S.sign.x, 1.65, S.sign.z);
      b.box('solid', SCH.green, 6.6, 0.2, 0.6, S.sign.x, 2.5, S.sign.z);
      // Flags by the door.
      for (const [k, cols] of [[0, ['#b22234', '#ffffff', '#3c3b6e']], [1, ['#bf0a30', '#ffffff', '#002868']]] as [number, string[]][]) {
        const fx = S.flags.x - k * 3;
        b.cyl('solid', '#c9ccd1', 0.06, 0.08, 9, fx, 4.5, S.flags.z, 8);
        b.box('solid', cols[1], 2.2, 0.65, 0.04, fx + 1.15, 8.42, S.flags.z);
        b.box('solid', cols[0], 2.2, 0.65, 0.04, fx + 1.15, 7.77, S.flags.z);
        b.box('solid', cols[2], k ? 0.75 : 0.95, k ? 1.3 : 0.7, 0.05, fx + (k ? 0.4 : 0.5), k ? 8.1 : 8.4, S.flags.z);
      }
      // Cars in both lots, light poles, a basketball goal on the court.
      const L = S.lot;
      for (const lx of [L.x0 + 20, (L.x0 + L.x1) / 2, L.x1 - 20]) {
        b.cyl('solid', '#8d9297', 0.1, 0.13, 7.5, lx, 3.75, (L.z0 + L.z1) / 2, 8);
        b.box('solid', '#8d9297', 2.2, 0.12, 0.3, lx, 7.5, (L.z0 + L.z1) / 2);
        for (const sx of [-1, 1]) b.box('glow', '#fff1cf', 0.7, 0.06, 0.34, lx + sx * 0.9, 7.42, (L.z0 + L.z1) / 2);
      }
      const C = S.court;
      for (const sx of [-1, 1]) {
        const gx = sx < 0 ? C.x0 + 1 : C.x1 - 1;
        b.cyl('solid', '#c9ccd1', 0.07, 0.07, 3.3, gx, 1.65, (C.z0 + C.z1) / 2, 6);
        b.box('solid', '#f4f1e6', 0.05, 1.05, 1.8, gx - sx * 0.5, 3.3, (C.z0 + C.z1) / 2);
      }
      // School-zone signs on Sam Houston Drive.
      for (const x of [-405, -545]) { b.cyl('solid', '#7c838a', 0.045, 0.045, 2.6, x, 1.3, 3142, 6); b.box('solid', '#e8e337', 0.9, 0.9, 0.04, x, 2.5, 3142, 0, 0, Math.PI / 4); }
    }
    // Trees west of the line: round the lake, the park, the school grounds.
    const lake9 = scalePoly(LAKE, 1, 9);
    const near = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number, m: number) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
    const blocked = (x: number, z: number) => STREETS.some((s) => distToLine(x, z, s.pts) < s.w / 2 + 3.2) || inPoly(x, z, lake9)
      || [...SCHOOL.blocks, SCHOOL.lot, SCHOOL.lot2, SCHOOL.court, LAKEHOUSE, LAKEHOUSE_LOT, PLAZA].some((r) => near(r, x, z, 5))
      || near(LAKEHOUSE_POOL, x, z, 8) || (x > LAKEHOUSE.x0 - 3 && x < LAKEHOUSE.x1 + 3 && z > LAKEHOUSE.z1 && z < LAKEHOUSE.z1 + 16)
      || near({ x0: SCHOOL.lot.x0, x1: SCHOOL.lot.x1, z0: SCHOOL.lot.z1, z1: SCHOOL.entry.z }, x, z, 4)
      || SCHOOL.shades.some((sh) => Math.hypot(x - sh.x, z - sh.z) < sh.s) || Math.hypot(x - SCHOOL.play.x, z - SCHOOL.play.z) < 12
      || PICKLEBALL.some((c) => Math.abs(x - c.x) < 9 && Math.abs(z - c.z) < 11) || Math.hypot(x - PARK_PLAY.x, z - PARK_PLAY.z) < 11
      || Math.hypot((x - PUMP_TRACK.x) / (PUMP_TRACK.rx + 5), (z - PUMP_TRACK.z) / (PUMP_TRACK.rz + 6)) < 1
      || Math.hypot(x - PARK_PAVILION.x, z - PARK_PAVILION.z) < 9 || x > RAIL_MID_X - 15;
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
      {([[-24, 3058, 1.5], [34, 3012, 1.7], [72, 3026, 1.3], [-52, 3018, 1.4], [SCHOOL.lot.x0 - 9, 3160, 1.4], [SCHOOL.lot.x1 + 16, 3166, 1.5], [-296, 3170, 1.5], [-292, 3246, 1.6], [-236, 3214, 1.4], [-186, 3108, 1.2], [-250, 3040, 1.4]] as [number, number, number][])
        .map(([x, z, s], i) => <LiveOak key={i} position={[x, 0, z]} scale={s} seed={i + 70} />)}
      {([[6, 3051], [PARK_PLAY.x, PARK_PLAY.z], [S.play.x, S.play.z], [S.shades[1].x, S.shades[1].z]] as [number, number][])
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
      {/* The school's name along the canopy's edge, and on the navy sign by the road. */}
      <Label x={S.entry.x + 1.5} y={6.82} z={S.entry.z - 9 + 0.03} ry={Math.PI} text="COLONY OAKS ELEMENTARY SCHOOL" size={0.62} color="#2a2f36" />
      {[1, -1].map((f) => (
        <group key={f}>
          <Label x={S.sign.x} y={1.86} z={S.sign.z + f * 0.26} ry={f > 0 ? 0 : Math.PI} text="COLONY OAKS" size={0.56} color="#ffffff" />
          <Label x={S.sign.x} y={1.3} z={S.sign.z + f * 0.26} ry={f > 0 ? 0 : Math.PI} text="ELEMENTARY  ·  HOME OF THE COUGARS" size={0.21} color="#8fe08a" />
        </group>
      ))}
    </group>
  );
}
