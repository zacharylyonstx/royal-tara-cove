import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundHeight } from '../../world/terrain';
import { MID, CLEAR, rng32 } from '../../world/corridor';
import {
  SECTIONS, LAKE, RIVER, CONGRESS, OLD_BRIDGE, LAKE_BOATS, RIVER_BOATS, TX71, tx71X, tx71Y, AIRPORT, JET_PERIOD_S, SH130,
  FM_ROAD, PRAIRIE, FARM, PINES, RIVER_SIGN, BLOCKS, TAQUERIAS, BUNGALOWS, clearOf, footing,
  type Rect, type Boat, type Block, type Taqueria,
} from '../../world/bastropLine';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { Batch, glowPaint, paint } from './batch';

// The view from the train window on the made-up run from Downtown Austin to
// Bastrop (layout + notes: world/bastropLine.ts). Baked a SECTION at a time —
// each ≤ 320 m of line with its own few meshes, so the far ones are culled.
// Only the highway traffic, one jet and a windmill move.

const G = groundHeight;
type V3 = [number, number, number];

const CAR_COLORS = ['#c7ccd3', '#2f3b4f', '#8c1f24', '#e9e4d6', '#35567e', '#4a4f55', '#d7a23a', '#2d5f46', '#f2f2f0', '#6b7f95'];
const OAK = ['#3f6b3a', '#4a7a40', '#365f38', '#557f46'];
const PECAN = ['#5d8f45', '#6a9a4c', '#52853f'];
const CYPRESS = ['#4f8146', '#5b8c4c', '#467a44'];
const MESQUITE = ['#7f9a58', '#8aa35f'];
const HIDES = ['#a4572f', '#e8e2d6', '#5a3a28', '#c98f5a', '#8c4a2c', '#d9c7a8'];
const GLASS = '#26323d';
const LIT = ['#ffd89a', '#ffe7b8', '#ffc978', '#fff1d0'];
const WOOD = '#7a5536';
const TRUSS_RED = '#8c4a35';
const TRUSS_SILVER = '#c3c8cc';

// ------------------------------------------------------------- primitives --

/** A little local frame: forward (where `ry` points; +Z at 0), up, sideways. */
function frame(x: number, y: number, z: number, ry: number) {
  const s = Math.sin(ry), c = Math.cos(ry);
  return (f: number, u: number, r = 0): V3 => [x + f * s + r * c, y + u, z + f * c - r * s];
}

/** A rectangular bar from p to q (truss members, ramps, necks, horns). */
function beam(b: Batch, group: string, color: string, w: number, h: number, p: V3, q: V3) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
  const run = Math.hypot(dx, dz);
  b.box(group, color, w, h, Math.hypot(run, dy), (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, Math.atan2(dx, dz), -Math.atan2(dy, run));
}

/** A round limb from p (radius r0) to q (radius r1). */
function limb(b: Batch, group: string, color: string, r0: number, r1: number, p: V3, q: V3, seg = 7) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
  const len = Math.hypot(dx, dy, dz);
  b.cyl(group, color, r1, r0, len, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, seg, Math.acos(dy / len), 0, Math.atan2(dx, dz));
}

/** A strip laid on the rolling ground from (x0, z0) to (x1, z1). */
function ribbon(b: Batch, group: string, color: string, x0: number, z0: number, x1: number, z1: number, w: number, lift: number, t = 0.1, step = 8) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / step)), ry = Math.atan2(x1 - x0, z1 - z0), run = len / n;
  for (let i = 0; i < n; i++) {
    const ax = x0 + (x1 - x0) * (i / n), az = z0 + (z1 - z0) * (i / n);
    const cx = x0 + (x1 - x0) * ((i + 1) / n), cz = z0 + (z1 - z0) * ((i + 1) / n);
    const ay = G(ax, az) + lift, cy = G(cx, cz) + lift;
    b.box(group, color, w, t, Math.hypot(run, cy - ay) + 0.04, (ax + cx) / 2, (ay + cy) / 2, (az + cz) / 2, ry, -Math.atan2(cy - ay, run));
  }
}

/** Posts and rails following the ground. */
function fence(b: Batch, x0: number, z0: number, x1: number, z1: number, post: string, rail: string, h: number, rails: number[], step = 6, railT = 0.05) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (i / n), z = z0 + (z1 - z0) * (i / n);
    b.box('solid', post, 0.11, h + 0.4, 0.11, x, G(x, z) + h / 2 - 0.2, z);
  }
  for (const y of rails) ribbon(b, 'solid', rail, x0, z0, x1, z1, railT, y, railT, step * 2);
}

function car(b: Batch, x: number, z: number, color: string, ry = 0, y = G(x, z)) {
  b.box('solid', color, 1.85, 0.7, 4.2, x, y + 0.62, z, ry);
  b.box('solid', '#20262d', 1.6, 0.55, 2.1, x - Math.sin(ry) * 0.2, y + 1.22, z - Math.cos(ry) * 0.2, ry);
}

function pickup(b: Batch, x: number, z: number, color: string, ry = 0, y = G(x, z)) {
  const P = frame(x, y, z, ry);
  b.box('solid', color, 1.95, 0.75, 5.3, ...P(0, 0.8), ry);
  b.box('solid', color, 1.85, 0.75, 1.9, ...P(0.5, 1.5), ry);
  b.box('solid', '#20262d', 1.9, 0.42, 1.6, ...P(0.5, 1.56), ry);
  b.box('solid', '#2a2d31', 1.6, 0.06, 2.0, ...P(-1.55, 1.19), ry);
}

/** Two roof slabs meeting at a ridge that runs along Z, plus the gable fill. */
function gableRoofZ(b: Batch, color: string, fill: string, cx: number, y: number, cz: number, w: number, len: number, rise: number, over = 0.5) {
  const phi = Math.atan2(rise, w / 2), slope = Math.hypot(rise, w / 2) + over;
  for (const s of [-1, 1]) {
    const mx = cx + s * (w / 4 + Math.cos(phi) * over / 2), my = y + rise / 2 - Math.sin(phi) * over / 2;
    b.box('solid', color, slope, 0.16, len + 2 * over, mx, my + 0.08, cz, 0, 0, -s * phi);
  }
  for (let k = 0; k < 2; k++) b.box('solid', fill, w * (0.64 - k * 0.32), rise / 3, len, cx, y + rise * (k + 0.5) / 3, cz);
}

// ------------------------------------------------------------------ trees --
type Plant = (b: Batch, x: number, z: number, s: number, i: number) => void;

const oak: Plant = (b, x, z, s, i) => {
  const y = G(x, z) - 0.15;
  b.cyl('solid', '#4a3a2c', 0.26 * s, 0.4 * s, 2.6 * s, x, y + 1.3 * s, z, 6);
  b.blob('solid', OAK[i % 4], 3.2 * s, x, y + 3.9 * s, z, 0.62);
  if (Math.abs(x - MID) < 70) b.blob('solid', OAK[(i + 1) % 4], 2.2 * s, x + Math.cos(i * 2.4) * 1.9 * s, y + 3.5 * s, z + Math.sin(i * 2.4) * 1.9 * s, 0.6);
};
const pecan: Plant = (b, x, z, s, i) => {
  const y = G(x, z) - 0.15;
  b.cyl('solid', '#54463a', 0.2 * s, 0.32 * s, 3.6 * s, x, y + 1.8 * s, z, 6);
  b.blob('solid', PECAN[i % 3], 2.9 * s, x, y + 5.4 * s, z, 0.95);
};
const cypress: Plant = (b, x, z, s, i) => {
  const y = G(x, z) - 0.2;
  b.cyl('solid', '#5a4636', 0.18 * s, 0.42 * s, 3.2 * s, x, y + 1.6 * s, z, 6);
  b.cyl('solid', CYPRESS[i % 3], 1.5 * s, 2.3 * s, 3.4 * s, x, y + 4.5 * s, z, 7);
  b.cyl('solid', CYPRESS[(i + 1) % 3], 0.5 * s, 1.9 * s, 3.8 * s, x, y + 7.9 * s, z, 7);
};
const mesquite: Plant = (b, x, z, s, i) => {
  const y = G(x, z) - 0.1;
  b.cyl('solid', '#4d3f33', 0.08 * s, 0.14 * s, 2.0 * s, x, y + 0.95 * s, z, 5, 0.25, 0.2);
  b.blob('solid', MESQUITE[i % 2], 1.8 * s, x + 0.3 * s, y + 2.4 * s, z + 0.4 * s, 0.55);
};
const shrub: Plant = (b, x, z, s, i) => {
  b.cyl('solid', i % 2 ? '#5f8448' : '#6e8a4e', 0.3 * s, 1.0 * s, 1.0 * s, x, G(x, z) + 0.4 * s, z, 6);
};
const youngPine: Plant = (b, x, z, s, i) => {
  const y = G(x, z) - 0.1;
  b.cyl('solid', '#6b5140', 0.07 * s, 0.1 * s, 1.2 * s, x, y + 0.6 * s, z, 5);
  b.cyl('solid', i % 2 ? '#3a6a3e' : '#2f5a34', 0.05, 1.15 * s, 3.4 * s, x, y + 2.6 * s, z, 6);
};

/** How far a plant's crown spreads at scale 1 (nothing may overhang the line). */
const REACH = new Map<Plant, number>([[oak, 4.4], [pecan, 3.0], [cypress, 2.4], [mesquite, 2.5], [shrub, 1.1], [youngPine, 1.3]]);

/** Random planting either side of the line, thick near it and thinning out. */
function scatter(b: Batch, rnd: () => number, z0: number, z1: number, n: number, plants: Plant[], dMin = 14, dMax = 150, pow = 1.6) {
  for (let i = 0; i < n; i++) {
    const z = z0 + rnd() * (z1 - z0), side = rnd() < 0.5 ? -1 : 1, d = dMin + Math.pow(rnd(), pow) * (dMax - dMin);
    const s = 0.8 + rnd() * 0.7, pick = plants[Math.floor(rnd() * plants.length)];
    const x = MID + side * Math.max(d, CLEAR + 0.5 + (REACH.get(pick) ?? 3) * s);
    if (x < -690 || x > 185 || !clearOf(x, z, 2)) continue;
    pick(b, x, z, s, i);
  }
}

/** Bluebonnets: low blue mounds right beside the track. */
function bluebonnets(b: Batch, rnd: () => number, z0: number, z1: number, n: number) {
  const BLUE = ['#5a6fd8', '#6f83e6', '#4d5fc8', '#8090ec'];
  for (let i = 0; i < n; i++) {
    const z = z0 + rnd() * (z1 - z0), side = rnd() < 0.5 ? -1 : 1, r = 0.35 + rnd() * 0.45, x = MID + side * (CLEAR + 0.2 + r + rnd() * 3.4);
    if (Math.abs(z - FM_ROAD.z) < 8) continue;
    b.cyl('solid', BLUE[i % 4], 0, r, 0.16, x, G(x, z) + 0.07, z, 6);
  }
}

// ---------------------------------------------------------------- animals --
function longhorn(b: Batch, rnd: () => number, x: number, z: number) {
  const ry = rnd() * Math.PI * 2, P = frame(x, G(x, z), z, ry);
  const hide = HIDES[Math.floor(rnd() * HIDES.length)], graze = rnd() < 0.4;
  b.box('solid', hide, 0.85, 0.9, 2.1, ...P(0, 1.25), ry);
  for (const [f, r] of [[0.75, 0.3], [0.75, -0.3], [-0.75, 0.3], [-0.75, -0.3]]) b.box('solid', '#3a2a20', 0.17, 0.85, 0.17, ...P(f, 0.42, r), ry);
  const hy = graze ? 0.55 : 1.6, hf = graze ? 1.6 : 1.5;
  beam(b, 'solid', hide, 0.4, 0.45, P(0.85, 1.4), P(hf - 0.15, hy));
  b.box('solid', hide, 0.44, 0.46, 0.7, ...P(hf, hy), ry);
  // The horns: out sideways, then up at the tips — three metres across.
  for (const s of [-1, 1]) {
    beam(b, 'solid', '#efe6d0', 0.1, 0.1, P(hf - 0.1, hy + 0.2, s * 0.2), P(hf - 0.05, hy + 0.36, s * 1.15));
    beam(b, 'solid', '#efe6d0', 0.07, 0.07, P(hf - 0.05, hy + 0.36, s * 1.15), P(hf + 0.05, hy + 0.78, s * 1.5));
  }
  b.box('solid', '#3a2a20', 0.07, 0.8, 0.07, ...P(-1.1, 1.2), ry);
}

function herd(b: Batch, rnd: () => number, cx: number, cz: number, n: number, spread = 16) {
  for (let i = 0; i < n; i++) {
    const x = cx + (rnd() - 0.5) * spread, z = cz + (rnd() - 0.5) * spread * 1.8;
    if (!clearOf(x, z, 1)) continue;
    longhorn(b, rnd, x, z);
  }
}

function deer(b: Batch, x: number, z: number, ry: number, buck: boolean) {
  const P = frame(x, G(x, z), z, ry), C = '#a9754a';
  b.box('solid', C, 0.4, 0.48, 1.15, ...P(0, 0.98), ry);
  for (const [f, r] of [[0.42, 0.13], [0.42, -0.13], [-0.42, 0.13], [-0.42, -0.13]]) b.box('solid', '#8a5f3c', 0.09, 0.78, 0.09, ...P(f, 0.39, r), ry);
  beam(b, 'solid', C, 0.2, 0.22, P(0.48, 1.08), P(0.8, 1.6));
  b.box('solid', C, 0.2, 0.22, 0.38, ...P(0.92, 1.66), ry);
  for (const s of [-1, 1]) b.box('solid', '#8a5f3c', 0.06, 0.2, 0.1, ...P(0.78, 1.86, s * 0.15), ry);
  b.box('solid', '#f4f1e6', 0.13, 0.22, 0.08, ...P(-0.6, 1.12), ry);
  if (buck) {
    for (const s of [-1, 1]) {
      beam(b, 'solid', '#d9cdb0', 0.045, 0.045, P(0.82, 1.78, s * 0.08), P(0.72, 2.2, s * 0.32));
      beam(b, 'solid', '#d9cdb0', 0.04, 0.04, P(0.76, 2.0, s * 0.2), P(0.98, 2.24, s * 0.36));
    }
  }
}

// ------------------------------------------------------------------ boats --
function boat(b: Batch, k: Boat, y: number) {
  const P = frame(k.x, y, k.z, k.ry), ry = k.ry;
  if (k.kind === 'kayak') {
    b.box('solid', k.color, 0.62, 0.3, 2.6, ...P(0, 0.12), ry);
    b.cyl('solid', k.color, 0, 0.4, 1.1, ...P(1.83, 0.12), 4, Math.PI / 2, 0, ry);
    b.cyl('solid', k.color, 0, 0.4, 1.1, ...P(-1.83, 0.12), 4, -Math.PI / 2, 0, ry);
    b.box('solid', '#22262b', 0.42, 0.06, 0.9, ...P(-0.1, 0.29), ry);
    b.box('solid', '#f1ede2', 2.2, 0.04, 0.08, ...P(0.55, 0.34), ry);            // the paddle, laid across
    for (const s of [-1, 1]) b.box('solid', '#2f3b4f', 0.4, 0.05, 0.2, ...P(0.55, 0.34, s * 1.2), ry);
  } else if (k.kind === 'sup') {
    b.box('solid', k.color, 0.82, 0.12, 2.8, ...P(0, 0.06), ry);
    b.cyl('solid', k.color, 0, 0.52, 0.9, ...P(1.82, 0.06), 4, Math.PI / 2, 0, ry);
    b.box('solid', '#2aa5a0', 0.2, 0.125, 2.6, ...P(0, 0.062), ry);
    b.box('solid', '#3a3d42', 0.07, 0.05, 1.9, ...P(-0.2, 0.15, 0.2), ry);
  } else if (k.kind === 'shell') {
    b.box('solid', k.color, 0.56, 0.26, 14, ...P(0, 0.1), ry);
    b.cyl('solid', k.color, 0, 0.36, 2.0, ...P(8, 0.1), 4, Math.PI / 2, 0, ry);
    b.cyl('solid', k.color, 0, 0.36, 2.0, ...P(-8, 0.1), 4, -Math.PI / 2, 0, ry);
    b.box('solid', '#c8102e', 0.57, 0.08, 14, ...P(0, 0.2), ry);
    for (let i = 0; i < 8; i++) {                                                // eight oars, feathered flat
      const s = i % 2 ? 1 : -1;
      b.box('solid', '#f1ede2', 3.3, 0.05, 0.1, ...P(-5 + i * 1.45, 0.3, s * 1.9), ry);
      b.box('solid', '#c8102e', 0.6, 0.06, 0.22, ...P(-5 + i * 1.45, 0.3, s * 3.5), ry);
    }
  } else {
    b.box('solid', k.color, 1.7, 0.5, 4.0, ...P(0, 0.2), ry);
    beam(b, 'solid', k.color, 1.7, 0.1, P(2.0, 0.0), P(2.75, 0.44));               // the punt bow
    b.box('solid', '#3d4532', 1.44, 0.04, 3.7, ...P(0, 0.46), ry);
    for (const f of [-0.9, 0.7]) b.box('solid', '#c9c2b0', 1.5, 0.07, 0.38, ...P(f, 0.5), ry);
    b.box('solid', '#2a2d31', 0.4, 0.75, 0.42, ...P(-2.15, 0.55), ry);            // outboard
    b.box('solid', '#d7372f', 0.5, 0.36, 0.7, ...P(0.1, 0.66, 0.3), ry);          // cooler
    beam(b, 'solid', '#22262b', 0.03, 0.03, P(-0.9, 0.55, -0.5), P(-0.2, 2.6, -1.6));
    beam(b, 'solid', '#22262b', 0.03, 0.03, P(0.6, 0.55, 0.55), P(1.4, 2.4, 1.8));
  }
}

// ---------------------------------------------------------------- bridges --
/**
 * A through truss (Parker: the top chord rises toward mid-span) between the
 * planes x = xa and x = xb, from z0 to z1. The train — or the road — runs
 * THROUGH it; `portal` is how deep the portal bracing hangs at each end.
 */
function throughTruss(b: Batch, color: string, xa: number, xb: number, z0: number, z1: number, panels: number, yBot: number, hEnd: number, hMid: number, m: number, portal: number) {
  const dz = (z1 - z0) / panels, half = panels / 2;
  const zAt = (i: number) => z0 + i * dz;
  const top = (i: number) => yBot + hEnd + (hMid - hEnd) * (1 - Math.pow((i - half) / (half - 1), 2));
  for (const x of [xa, xb]) {
    b.box('solid', color, m, m, z1 - z0, x, yBot, (z0 + z1) / 2);
    beam(b, 'solid', color, m, m, [x, yBot, z0], [x, top(1), zAt(1)]);                         // inclined end posts
    beam(b, 'solid', color, m, m, [x, yBot, z1], [x, top(panels - 1), zAt(panels - 1)]);
    for (let i = 1; i < panels; i++) {
      b.box('solid', color, m * 0.7, top(i) - yBot, m * 0.7, x, (top(i) + yBot) / 2, zAt(i));    // verticals
      if (i < panels - 1) {
        beam(b, 'solid', color, m, m, [x, top(i), zAt(i)], [x, top(i + 1), zAt(i + 1)]);       // top chord
        // Pratt diagonals: every one leans down toward mid-span.
        if (i < half) beam(b, 'solid', color, m * 0.55, m * 0.55, [x, top(i), zAt(i)], [x, yBot, zAt(i + 1)]);
        else beam(b, 'solid', color, m * 0.55, m * 0.55, [x, yBot, zAt(i)], [x, top(i + 1), zAt(i + 1)]);
      }
    }
  }
  // Top laterals: a strut at every panel point and crossed bracing between.
  const w = Math.abs(xb - xa), cx = (xa + xb) / 2;
  for (let i = 1; i < panels; i++) {
    b.box('solid', color, w, m * 0.7, m * 0.7, cx, top(i), zAt(i));
    if (i < panels - 1) {
      beam(b, 'solid', color, m * 0.4, m * 0.4, [xa, top(i), zAt(i)], [xb, top(i + 1), zAt(i + 1)]);
      beam(b, 'solid', color, m * 0.4, m * 0.4, [xb, top(i), zAt(i)], [xa, top(i + 1), zAt(i + 1)]);
    }
  }
  // Portal frames at both ends.
  for (const i of [1, panels - 1]) b.box('solid', color, w, portal, m * 0.6, cx, top(i) - portal / 2, zAt(i));
}

/** The Congress Avenue bridge: low concrete arches, 150 m off to the west. */
function congressBridge(b: Batch) {
  const { x, half, y } = CONGRESS, z0 = LAKE.z0, z1 = LAKE.z1, n = 4, span = (z1 - z0) / n;
  const C = '#cfc8b8', D = '#bdb6a6';
  b.box('solid', C, half * 2, 0.8, z1 - z0 + 2, x, y - 0.4, (z0 + z1) / 2);
  for (const s of [-1, 1]) b.box('solid', D, 0.3, 0.9, z1 - z0 + 2, x + s * (half - 0.15), y + 0.45, (z0 + z1) / 2);
  const arch = (t: number) => LAKE.y + (y - 1.0 - LAKE.y) * 4 * t * (1 - t);
  for (let k = 0; k <= n; k++) {
    const z = z0 + k * span;
    b.box('solid', D, half * 2 - 1, y + 5.2, 2.6, x, (y - 0.8 - 6) / 2, z);
    for (const s of [-1, 1]) {                                                                   // lamps
      b.cyl('solid', '#5b6068', 0.07, 0.09, 3.2, x + s * (half - 0.15), y + 2.4, z, 6);
      b.box('glow', '#fff0c8', 0.4, 0.4, 0.4, x + s * (half - 0.15), y + 4.1, z);
    }
    if (k === n) break;
    for (let j = 0; j < 6; j++) {
      const ta = j / 6, tb = (j + 1) / 6;
      beam(b, 'solid', C, half * 2 - 1.6, 0.6, [x, arch(ta), z + ta * span], [x, arch(tb), z + tb * span]);
    }
    for (const t of [0.17, 0.83]) b.box('solid', D, half * 2 - 2.4, y - 0.8 - arch(t), 0.5, x, (y - 0.8 + arch(t)) / 2, z + t * span);
  }
  // Ramps down to the banks.
  beam(b, 'solid', C, half * 2, 0.6, [x, y - 0.3, z0 - 1], [x, G(x, z0 - 10) - 0.2, z0 - 10]);
  beam(b, 'solid', C, half * 2, 0.6, [x, y - 0.3, z1 + 1], [x, G(x, z1 + 24) - 0.2, z1 + 24]);
}

/** Bastrop's old iron bridge: three silver truss spans on stone piers. */
function oldIronBridge(b: Batch) {
  const { x, half, y } = OLD_BRIDGE, z0 = RIVER.z0, z1 = RIVER.z1, span = (z1 - z0) / 3;
  b.box('solid', '#8f8a80', half * 2 + 0.4, 0.4, z1 - z0, x, y - 0.2, (z0 + z1) / 2);
  for (let k = 0; k <= 3; k++) {
    const z = z0 + k * span;
    b.box('solid', '#a39a88', half * 2 + 1.6, y + 7.3, k % 3 ? 2.4 : 3.2, x, (y - 0.4 - 7.7) / 2, z);
    b.box('solid', '#8f8676', half * 2 + 2.2, 0.5, k % 3 ? 3.0 : 3.8, x, y - 0.65, z);
    if (k < 3) throughTruss(b, TRUSS_SILVER, x - half, x + half, z + 0.3, z + span - 0.3, 6, y + 0.25, 4.4, 6.2, 0.24, 0.7);
  }
  beam(b, 'solid', '#8f8a80', half * 2 + 0.4, 0.4, [x, y - 0.2, z0], [x, G(x, z0 - 18) - 0.1, z0 - 18]);
  beam(b, 'solid', '#8f8a80', half * 2 + 0.4, 0.4, [x, y - 0.2, z1], [x, G(x, z1 + 16) - 0.1, z1 + 16]);
}

// ----------------------------------------------------------------- TX-71 --
function highway(b: Batch, z0: number, z1: number) {
  let z = Math.max(z0, TX71.z0);
  const end = Math.min(z1, TX71.z1);
  while (z < end - 0.01) {
    const bend = z < TX71.bendN || z >= TX71.bendS;
    const zn = Math.min(end, z + (bend ? 7 : 14));
    const xa = tx71X(z), xb = tx71X(zn), ya = tx71Y(z), yb = tx71Y(zn);
    const run = Math.hypot(xb - xa, zn - z), ry = Math.atan2(xb - xa, zn - z), rx = -Math.atan2(yb - ya, run);
    const len = Math.hypot(run, yb - ya) + (bend ? 0.5 : 0.06);
    const mx = (xa + xb) / 2, my = (ya + yb) / 2, mz = (z + zn) / 2, nx = Math.cos(ry), nz = -Math.sin(ry);
    // A grassed embankment with the two carriageways on top, median between.
    b.box('solid', mz < 2430 ? '#7f9c52' : '#5f8a48', 30, 3.8, len, mx, my - 1.94, mz, ry, rx);
    for (const s of [-1, 1]) {
      const ox = s * TX71.carriage * nx, oz = s * TX71.carriage * nz;
      b.box('solid', '#484d56', 8.6, 0.1, len, mx + ox, my, mz + oz, ry, rx);
      b.box('solid', '#e9e6dc', 0.18, 0.2, len * 0.45, mx + ox, my, mz + oz, ry, rx);
    }
    z = zn;
  }
}

/** Telegraph poles down the east side of the formation. */
function poles(b: Batch, z0: number, z1: number) {
  for (let z = Math.ceil(z0 / 30) * 30; z < z1; z += 30) {
    if ((z > LAKE.z0 - 8 && z < LAKE.z1 + 8) || (z > RIVER.z0 - 8 && z < RIVER.z1 + 8)) continue;
    if ((z > SH130.z0 - 4 && z < SH130.z1 + 4) || Math.abs(z - FM_ROAD.z) < 9) continue;
    const x = MID + CLEAR + 0.7, y = G(x, z) - 0.2;
    b.cyl('solid', '#5b4a3a', 0.1, 0.13, 8.4, x, y + 4.2, z, 6);
    b.box('solid', '#5b4a3a', 2.0, 0.12, 0.12, x, y + 7.8, z);
  }
}

// ------------------------------------------------------ 1 · Lady Bird Lake --
function buildLake(b: Batch, rnd: () => number) {
  const L = LAKE;
  b.box('water', '#3f8f86', L.x1 - L.x0, 0.05, L.z1 - L.z0 - 2, (L.x0 + L.x1) / 2, L.y, (L.z0 + L.z1) / 2);
  // The hike-and-bike trail: crushed granite along the north shore (the south
  // shore's is laid with south Austin), a rail fence at the water's edge.
  for (const [x0, x1] of [[-430, MID - 21], [MID + CLEAR + 0.5, 60]]) {
    ribbon(b, 'solid', '#d9c8a4', x0, L.z0 - 5.5, x1, L.z0 - 5.5, 3.4, 0.1, 0.1, 10);
  }
  for (const z of [L.z0 - L.rim, L.z1 + L.rim]) {
    fence(b, CONGRESS.x + CONGRESS.half + 1.5, z, MID - CLEAR - 0.3, z, '#8a6a48', '#9b7a55', 1.1, [0.55, 1.0], 8, 0.08);
    fence(b, MID + CLEAR + 0.3, z, MID + 160, z, '#8a6a48', '#9b7a55', 1.1, [0.55, 1.0], 8, 0.08);
  }
  // Trail lamps.
  for (let x = MID - 148; x <= MID + 150; x += 27) {
    if (Math.abs(x - MID) < CLEAR + 3) continue;
    const z = L.z0 - 7.6, y = G(x, z);
    b.cyl('solid', '#3a3f45', 0.06, 0.08, 3.4, x, y + 1.7, z, 6);
    b.box('glow', '#fff0c8', 0.36, 0.36, 0.36, x, y + 3.5, z);
  }
  // Cypress with their feet in the water, pecans and oaks back from the bank.
  for (let i = 0; i < 42; i++) {
    const south = i % 2 === 1, side = i % 4 < 2 ? -1 : 1;
    const x = MID + side * (CLEAR + 4 + rnd() * 170), z = south ? L.z1 - 0.6 + rnd() * 1.6 : L.z0 + 0.4 - rnd() * 1.4;
    if (Math.abs(x - CONGRESS.x) < 10) continue;
    cypress(b, x, z, 0.95 + rnd() * 0.6, i);
  }
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? -1 : 1, x = MID + side * (CLEAR + 6 + rnd() * 150), z = L.z0 - 8.6 - rnd() * 1.2;
    if (Math.abs(x - CONGRESS.x) < 10 || Math.abs(x - (MID - 14.5)) < 7) continue;
    (i % 3 ? pecan : oak)(b, x, z, 0.85 + rnd() * 0.5, i);
  }
  // A little dock and a rack of rental kayaks on the north bank.
  const dx = MID + 34;
  b.box('solid', '#9b7a55', 2.4, 0.16, 15, dx, L.y + 0.5, L.z0 + 6.5);
  for (const z of [L.z0 + 2, L.z0 + 8, L.z0 + 13.6]) for (const s of [-1, 1]) b.cyl('solid', '#6b5a48', 0.1, 0.1, 2.4, dx + s * 1.1, L.y - 0.4, z, 5);
  for (let k = 0; k < 4; k++) {
    const x = MID + 41 + k * 0.9, z = L.z0 - 3.4;
    b.box('solid', ['#d7372f', '#f0b429', '#2aa5a0', '#f08a24'][k], 0.6, 0.34, 3.0, x, G(x, z) + 0.75, z, 0, 0, 0.5);
  }
  b.box('solid', '#6b5a48', 4.2, 0.1, 0.1, MID + 42.4, G(MID + 42, L.z0 - 3.4) + 0.5, L.z0 - 4.4);
  b.box('solid', '#6b5a48', 4.2, 0.1, 0.1, MID + 42.4, G(MID + 42, L.z0 - 3.4) + 0.5, L.z0 - 2.4);
  for (const k of LAKE_BOATS) boat(b, k, L.y + 0.03);
  congressBridge(b);
  // The sign riders pass as they roll onto the bridge.
  woodSign(b, MID - 14.5, L.z0 - 6.8, 2.1, 6.6, 1.5, 2.2);
}

/** A rustic board on two log posts; `ry` is the way its face points. */
function woodSign(b: Batch, x: number, z: number, ry: number, w: number, h: number, yMid: number) {
  const y = G(x, z), P = frame(x, y, z, ry);
  for (const s of [-1, 1]) b.cyl('solid', '#5a4030', 0.16, 0.2, yMid + h / 2 + 0.9, ...P(-0.12, (yMid + h / 2 + 0.3) / 2 - 0.3, s * (w / 2 - 0.3)), 6);
  b.box('solid', WOOD, w, h, 0.16, ...P(0, yMid), ry);
  b.box('solid', '#5f4129', w + 0.3, 0.14, 0.2, ...P(0, yMid + h / 2 + 0.07), ry);
  b.box('solid', '#5f4129', w + 0.3, 0.14, 0.2, ...P(0, yMid - h / 2 - 0.07), ry);
}

// --------------------------------------------------- 2 · south-east Austin --
function block(b: Batch, rnd: () => number, k: Block) {
  const r = k.r, w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const [lo, hi] = footing(r), H = k.floors * 3.1 + 0.9, f = k.face, fx = f > 0 ? r.x1 : r.x0;
  b.box('solid', k.wall, w, H + hi - lo + 0.5, d, cx, (hi + H + lo - 0.5) / 2, cz);
  b.box('solid', k.trim, w + 0.4, 0.5, d + 0.4, cx, hi + H + 0.25, cz);
  b.box('solid', '#8e959b', 3, 1.4, 3, cx, hi + H + 1.2, cz + d * 0.2);
  const cols = Math.max(2, Math.floor(d / 4.4));
  for (let fl = 0; fl < k.floors; fl++) {
    const y = hi + 2.2 + fl * 3.1;
    for (let c = 0; c < cols; c++) {
      const z = r.z0 + (c + 0.5) * (d / cols);
      b.box('glass', GLASS, 0.1, 1.7, 2.5, fx + f * 0.04, y, z);
      if (rnd() < 0.5) b.box('lit', LIT[Math.floor(rnd() * 4)], 0.04, 1.5, 2.3, fx + f * 0.11, y, z);
      if ((c + fl) % 3 === 0) b.box('solid', k.trim, 1.1, 1.0, 2.9, fx + f * 0.6, y - 1.0, z);     // balcony
    }
    for (const [ez, s] of [[r.z0, -1], [r.z1, 1]]) {                                               // end walls
      b.box('glass', GLASS, w - 4, 1.6, 0.1, cx, y, ez + s * 0.04);
      if (rnd() < 0.45) b.box('lit', LIT[Math.floor(rnd() * 4)], w * 0.3, 1.4, 0.04, cx + (rnd() - 0.5) * w * 0.35, y, ez + s * 0.11);
    }
  }
}

function taqueria(b: Batch, rnd: () => number, t: Taqueria) {
  const r = t.r, w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const [lo, hi] = footing(r), f = t.face, fx = f > 0 ? r.x1 : r.x0;
  b.box('solid', t.wall, w, 3.6 + hi - lo + 0.4, d, cx, (hi + 3.6 + lo - 0.4) / 2, cz);
  b.box('solid', t.accent, w + 0.3, 0.45, d + 0.3, cx, hi + 3.8, cz);
  // The sign board on the roof faces the railway.
  b.box('solid', '#2a2320', 0.25, 2.4, d - 1, fx - f * 0.3, hi + 5.3, cz);
  for (const s of [-1, 1]) b.box('solid', '#5b6068', 0.14, 1.2, 0.14, fx - f * 0.3, hi + 4.5, cz + s * (d / 2 - 1.2));
  b.box('glass', GLASS, 0.1, 1.5, d * 0.45, fx + f * 0.04, hi + 1.8, cz - d * 0.18);
  b.box('lit', LIT[0], 0.04, 1.3, d * 0.42, fx + f * 0.11, hi + 1.8, cz - d * 0.18);
  b.box('solid', '#5a3a28', 0.1, 2.2, 1.1, fx + f * 0.04, hi + 1.1, cz + d * 0.32);
  for (let k = 0; k < 6; k++) b.box('solid', k % 2 ? t.accent : '#d7372f', 1.9, 0.1, d / 6, fx + f * 0.9, hi + 2.9, r.z0 + (k + 0.5) * (d / 6), 0, 0, -f * 0.3);
  for (let k = 0; k <= 8; k++) {                                                                   // string lights
    const z = r.z0 - 1 + k * ((d + 2) / 8);
    b.box('glow', LIT[k % 4], 0.18, 0.2, 0.18, fx + f * 4.4, hi + 3.1 - Math.sin((k / 8) * Math.PI) * 0.4, z);
  }
  for (const s of [-1, 1]) b.cyl('solid', '#3a3f45', 0.06, 0.08, 3.4, fx + f * 4.4, hi + 1.5, cz + s * (d / 2 + 1), 5);
  for (const s of [-1, 1]) {                                                                       // picnic tables
    const x = fx + f * 2.9, z = cz + s * 3, y = G(x, z);
    b.box('solid', '#9b7a55', 0.8, 0.08, 1.9, x, y + 0.78, z);
    b.box('solid', '#6b5a48', 1.5, 0.74, 0.1, x, y + 0.37, z);
  }
  for (let k = 0; k < 3; k++) {
    const x = fx + f * 7.6, z = r.z0 + 1 + k * 4.4;
    if (rnd() < 0.8) car(b, x, z, CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], Math.PI / 2);
  }
}

function bungalow(b: Batch, rnd: () => number, x: number, z: number, f: 1 | -1) {
  const r: Rect = { x0: x - 4.5, x1: x + 4.5, z0: z - 4, z1: z + 4 }, [lo, hi] = footing(r);
  const wall = ['#e3d6bd', '#c9d8d0', '#e6c9a8', '#d6c0c8', '#bfd0dd'][Math.floor(rnd() * 5)];
  b.box('solid', wall, 9, 3.1 + hi - lo + 0.4, 8, x, (hi + 3.1 + lo - 0.4) / 2, z);
  b.cyl('solid', ['#5a4a42', '#6b5446', '#4d4a48'][Math.floor(rnd() * 3)], 0, 7.4, 2.4, x, hi + 4.3, z, 4, 0, 0, Math.PI / 4);
  const fx = x + f * 4.5;
  b.box('solid', '#f4f1e6', 0.1, 1.4, 1.5, fx + f * 0.03, hi + 1.7, z - 2);
  b.box('glass', GLASS, 0.08, 1.2, 1.3, fx + f * 0.07, hi + 1.7, z - 2);
  if (rnd() < 0.7) b.box('lit', LIT[Math.floor(rnd() * 4)], 0.03, 1.1, 1.2, fx + f * 0.12, hi + 1.7, z - 2);
  b.box('solid', '#7a4f38', 0.1, 2.1, 1.0, fx + f * 0.03, hi + 1.05, z + 1.8);
}

function buildSouthAustin(b: Batch, rnd: () => number, z0: number, z1: number) {
  for (const [x0, x1] of [[-430, MID - CLEAR - 0.5], [MID + CLEAR + 0.5, 60]]) {
    ribbon(b, 'solid', '#d9c8a4', x0, LAKE.z1 + 5.5, x1, LAKE.z1 + 5.5, 3.4, 0.14, 0.1, 9);
  }
  for (const k of BLOCKS) block(b, rnd, k);
  for (const t of TAQUERIAS) taqueria(b, rnd, t);
  for (const [x, z, f] of BUNGALOWS) bungalow(b, rnd, x, z, f);
  // Chain-link beside the line (you can see through it), in runs with gaps.
  for (const s of [-1, 1]) {
    for (const [za, zb] of [[1730, 1764], [1772, 1806], [1814, 1844]]) {
      fence(b, MID + s * 12.6, za, MID + s * 12.6, zb, '#8a9399', '#9aa3a8', 1.5, [0.8, 1.5], 5.6);
    }
  }
  // Parked cars on the cross streets, pecans everywhere.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? -1 : 1, x = MID + side * (18 + rnd() * 26), z = z0 + 12 + rnd() * (z1 - z0 - 20);
    if (clearOf(x, z, 3)) car(b, x, z, CAR_COLORS[i % CAR_COLORS.length], rnd() < 0.5 ? 0 : Math.PI / 2);
  }
  scatter(b, rnd, z0 + 8, z1, 46, [pecan, pecan, oak], 14, 140);
  scatter(b, rnd, z0 + 8, z1, 14, [shrub], 13, 40);
}

// ------------------------------------------------------------ 3 · airport --
/** A twin-jet airliner heading `ry` (+Z at 0), fuselage centre at (x, y, z). */
function airliner(b: Batch, x: number, y: number, z: number, ry: number, tail: string) {
  const W = '#eef0f2', E = '#c9ced3', P = frame(x, y, z, ry), LIE = Math.PI / 2;
  b.cyl('solid', W, 1.8, 1.8, 17, ...P(0, 0), 12, LIE, 0, ry);
  b.cyl('solid', W, 0.7, 1.8, 3.2, ...P(10.1, -0.15), 12, LIE, 0, ry);                    // nose
  b.blob('solid', W, 0.74, ...P(11.6, -0.3));
  b.cyl('solid', W, 0.45, 1.8, 6.5, ...P(-11.7, 0.33), 12, -(LIE - 0.1), 0, ry);          // tail cone
  b.box('solid', '#27323d', 3.56, 0.3, 14.5, ...P(0.6, 0.45), ry);                       // cabin windows
  b.box('solid', '#1c232c', 2.7, 0.45, 1.0, ...P(9.6, 0.72), ry);                        // flight deck
  for (const s of [-1, 1]) {
    b.box('solid', W, 11.6, 0.28, 4.6, ...P(-2.6, -0.75, s * 6.6), ry + s * 0.32);       // wings, swept
    b.cyl('solid', E, 0.85, 0.85, 3.4, ...P(-0.9, -1.75, s * 4.7), 9, LIE, 0, ry);        // engines
    b.box('solid', W, 4.4, 0.2, 2.4, ...P(-13.6, 0.95, s * 2.6), ry + s * 0.3);
    b.box('solid', '#3a3d42', 0.3, 1.7, 0.3, ...P(-1.4, -2.55, s * 2.3), ry);            // main gear
    b.box('solid', '#1c1f23', 0.5, 0.8, 1.2, ...P(-1.4, -3.0, s * 2.3), ry);
    b.box('glow', s > 0 ? '#ff3b30' : '#35e06a', 0.3, 0.2, 0.3, ...P(-4.6, -0.75, s * 12.2));
  }
  b.box('solid', tail, 0.32, 5.6, 4.2, ...P(-12.8, 3.7), ry, -0.42);                      // the fin
  b.box('solid', '#3a3d42', 0.3, 1.7, 0.3, ...P(7.4, -2.55), ry);                        // nose gear
  b.box('solid', '#1c1f23', 0.5, 0.7, 0.7, ...P(7.4, -3.05), ry);
  b.box('glow', '#ff3b30', 0.3, 0.3, 0.3, ...P(0, 1.95));                                // beacon
  b.box('glow', '#fff6dc', 0.3, 0.3, 0.4, ...P(7.4, -1.9), ry);                          // landing light
}

function shed(b: Batch, rnd: () => number, r: Rect, wall: string, roof: string) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, [lo, hi] = footing(r);
  b.box('solid', wall, w, 7.6 + hi - lo + 0.4, d, cx, (hi + 7.6 + lo - 0.4) / 2, cz);
  b.box('solid', roof, w + 0.6, 0.5, d + 0.6, cx, hi + 7.85, cz);
  // Loading doors along the side that faces the line, a trailer at some.
  const n = Math.floor(d / 8);
  for (let k = 0; k < n; k++) {
    const z = r.z0 + (k + 0.5) * (d / n);
    b.box('solid', '#3b4652', 0.12, 3.6, 4.2, r.x1 + 0.03, hi + 2.2, z);
    b.box('glow', '#fff0c8', 0.1, 0.25, 1.4, r.x1 + 0.1, hi + 5.0, z);
    if (rnd() < 0.55) {
      const x = r.x1 + 7.4, y = G(x, z);
      b.box('solid', '#eef0f2', 12, 2.9, 2.5, x, y + 2.6, z);
      b.box('solid', '#22262b', 12, 0.9, 2.2, x, y + 0.7, z);
    }
  }
}

function buildAirport(b: Batch, rnd: () => number, z0: number, z1: number) {
  const A = AIRPORT;
  // ---- airfield: apron, runway with its markings and lights ----
  const ap = A.apron, rw = A.runway;
  b.box('solid', '#b9b6ad', ap.x1 - ap.x0, 0.06, ap.z1 - ap.z0, (ap.x0 + ap.x1) / 2, 0.03, (ap.z0 + ap.z1) / 2);
  b.box('solid', '#b9b6ad', 15, 0.06, rw.z - rw.half - ap.z1, ap.x0 + 9.5, 0.03, (ap.z1 + rw.z - rw.half) / 2);    // taxiway
  b.box('solid', '#e2c23e', 0.3, 0.1, rw.z - ap.z1 + 30, ap.x0 + 9.5, 0.07, (ap.z1 + rw.z) / 2 - 15);
  b.box('solid', '#3d4147', rw.x1 - rw.x0, 0.06, rw.half * 2, (rw.x0 + rw.x1) / 2, 0.035, rw.z);
  for (let x = rw.x0 + 26; x < rw.x1 - 6; x += 18) b.box('solid', '#f1ede2', 9, 0.1, 0.5, x, 0.07, rw.z);
  for (let k = 0; k < 8; k++) b.box('solid', '#f1ede2', 9, 0.1, 1.1, rw.x0 + 7.5, 0.07, rw.z - 7.9 + k * 2.26);        // piano keys
  for (const s of [-1, 1]) {
    b.box('solid', '#f1ede2', rw.x1 - rw.x0 - 4, 0.1, 0.3, (rw.x0 + rw.x1) / 2, 0.07, rw.z + s * (rw.half - 0.8));
    for (let x = rw.x0 + 4; x <= rw.x1; x += 13) b.box('glow', '#fff3cf', 0.4, 0.3, 0.4, x, 0.2, rw.z + s * (rw.half + 0.9));
  }
  for (let k = 0; k < 7; k++) b.box('glow', '#35e06a', 0.4, 0.3, 0.4, rw.x0 - 1.2, 0.2, rw.z - 7.5 + k * 2.5);          // threshold
  for (let k = 0; k < 4; k++) b.box('glow', '#ffd98a', 0.35, 0.25, 0.35, ap.x0 + 2, 0.18, ap.z1 + 3 + k * 4);
  // Windsock.
  b.cyl('solid', '#c9ccd1', 0.06, 0.08, 6, rw.x0 + 2, 3, rw.z + rw.half + 5, 6);
  b.cyl('solid', '#f08a24', 0.16, 0.42, 2.4, rw.x0 + 3.3, 5.8, rw.z + rw.half + 5, 6, 0, -Math.PI / 2 + 0.2);
  // Perimeter fence along the highway.
  fence(b, -104.5, z0 + 4, -104.5, 2010, '#8a9399', '#9aa3a8', 1.7, [0.9, 1.7], 10);

  // ---- control tower ----
  const T = A.tower;
  b.box('solid', '#cfd3d6', T.half * 2, 4.5, T.half * 2, T.x, 2.25, T.z);
  b.box('glass', GLASS, T.half * 2 + 0.1, 1.4, T.half * 2 - 2, T.x, 2.6, T.z);
  b.cyl('solid', '#d9d5cb', 2.0, 2.5, 26, T.x, 17.5, T.z, 10);
  b.cyl('solid', '#c9c5bb', 4.4, 2.0, 3.0, T.x, 32, T.z, 12);
  b.cyl('glass', '#2c4a5e', 4.9, 4.3, 3.2, T.x, 35.1, T.z, 12);
  b.cyl('lit', '#bfe6ff', 4.96, 4.36, 2.6, T.x, 35.1, T.z, 12);
  b.cyl('solid', '#e9ecef', 5.3, 5.3, 0.4, T.x, 36.9, T.z, 12);
  b.cyl('solid', '#c9ccd1', 0.1, 0.14, 4, T.x, 39.1, T.z, 5);
  b.box('glow', '#ff3b30', 0.5, 0.5, 0.5, T.x, 41.3, T.z);

  // ---- terminal: a long hall under a barrel roof, glass toward the apron ----
  const t = A.terminal, tw = t.x1 - t.x0, tl = t.z1 - t.z0, tcx = (t.x0 + t.x1) / 2, tcz = (t.z0 + t.z1) / 2;
  b.box('solid', '#d9dcdf', tw, 6.3, tl, tcx, 3.15, tcz);
  b.box('solid', '#c2c7cc', tw + 1.2, 0.4, tl + 1.2, tcx, 6.5, tcz);
  b.cyl('solid', '#e6e9ec', tw / 2, tw / 2, tl - 1, tcx, -2.5, tcz, 28, Math.PI / 2);
  b.box('glass', '#3d5f78', 0.3, 4.6, tl - 4, t.x0 - 0.1, 3.0, tcz);
  for (let z = t.z0 + 2; z <= t.z1 - 2; z += 7.6) b.box('solid', '#eef0f2', 0.36, 4.8, 0.3, t.x0 - 0.14, 3.0, z);
  for (let k = 0; k < 9; k++) {
    if (rnd() < 0.2) continue;
    b.box('lit', LIT[k % 4], 0.05, 4.0, 6.6, t.x0 - 0.3, 3.0, t.z0 + 6.2 + k * 7.6);
  }
  for (const [ez, s] of [[t.z0, -1], [t.z1, 1]]) b.box('glass', '#3d5f78', tw - 6, 3.6, 0.2, tcx, 2.6, ez + s * 0.06);
  // Stands: three airliners side-on to the railway (so you see the whole
  // profile and the coloured fin), each with a jet bridge and a few carts.
  const tails = ['#c8372d', '#1f7a8c', '#f0a030'];
  A.gates.forEach((gz, i) => {
    airliner(b, A.gateX, 3.4, gz, 0, tails[i]);
    b.box('solid', '#d9dcdf', t.x0 - A.gateX - 1.6, 2.3, 2.2, (t.x0 + A.gateX + 1.6) / 2, 4.3, gz + 6.2);
    b.box('solid', '#5b6068', 0.4, 3.2, 0.4, A.gateX + 3.4, 1.6, gz + 6.2);
    b.box('solid', '#f0b429', 1.4, 1.0, 2.4, A.gateX - 7 - rnd() * 3, 0.55, gz + 3 + rnd() * 4);
    b.box('solid', '#e9e4d6', 1.3, 0.9, 3.2, A.gateX - 6 - rnd() * 4, 0.5, gz - 9 + rnd() * 3);
  });
  b.box('solid', '#f2f2f0', 2.4, 2.4, 7.5, ap.x0 + 5, 1.5, ap.z0 + 9);                                 // fuel truck
  b.box('solid', '#d7372f', 2.3, 1.6, 2.0, ap.x0 + 5, 1.1, ap.z0 + 14.2);
  // ---- parking garage, hangar, fuel farm ----
  const g = A.garage, gw = g.x1 - g.x0, gd = g.z1 - g.z0, gcx = (g.x0 + g.x1) / 2, gcz = (g.z0 + g.z1) / 2;
  for (let y = 0; y <= 12; y += 3) b.box('solid', '#c9c5ba', gw, 0.9, gd, gcx, y + 0.45, gcz);
  b.box('solid', '#3a3f45', gw - 1.6, 11.5, gd - 1.6, gcx, 6, gcz);
  const h = A.hangar, hw = h.x1 - h.x0, hd = h.z1 - h.z0, hcx = (h.x0 + h.x1) / 2, hcz = (h.z0 + h.z1) / 2;
  b.box('solid', '#b9c0c6', hw, 7, hd, hcx, 3.5, hcz);
  b.cyl('solid', '#d3d8dc', hw / 2, hw / 2, hd - 0.6, hcx, -10, hcz, 20, Math.PI / 2);
  b.box('solid', '#4a5560', 0.3, 6, hd - 10, h.x0 - 0.1, 3, hcz);
  for (let k = 0; k < 3; k++) b.cyl('solid', '#eef0f2', 4, 4, 6, -8 + k * 11, 3, g.z0 + 6, 12);

  // ---- west of the line: the air-cargo sheds ----
  shed(b, rnd, A.cargo[0], '#c7ccd1', '#35567e');
  shed(b, rnd, A.cargo[1], '#d9d2c2', '#8c1f24');
  fence(b, MID - 13.5, z0 + 2, MID - 13.5, 2068, '#8a9399', '#9aa3a8', 1.5, [0.8, 1.5], 8);
  fence(b, MID + 13.5, 2018, MID + 13.5, 2068, '#7a6a55', '#8a8a86', 1.2, [0.6, 1.1], 6, 0.03);

  sh130(b);
  scatter(b, rnd, z0, 2070, 34, [oak, mesquite, mesquite, shrub], 14, 150);
  scatter(b, rnd, 2014, z1, 14, [oak, mesquite], 15, 120);
  herd(b, rnd, MID - 40, 2042, 4, 18);
  bluebonnets(b, rnd, 2010, z1, 16);
}

/** The SH-130 toll road, carried high over the highway and the railway. */
function sh130(b: Batch) {
  const y = SH130.y, w = SH130.z1 - SH130.z0, mz = (SH130.z0 + SH130.z1) / 2, under = y - SH130.slab;
  // (The deck is in the 'far' group: same paint, but a mesh of its own, so a
  // 890 m slab does not stretch the whole section's bounding sphere.)
  b.box('far', '#b9b5aa', 890, SH130.slab, w, -255, y - SH130.slab / 2, mz);
  b.box('far', '#474c55', 890, 0.06, w - 1.2, -255, y + 0.03, mz);
  for (const pz of [SH130.z0 + 0.25, SH130.z1 - 0.25, mz]) b.box('far', '#c9c5ba', 890, 0.9, 0.4, -255, y + 0.45, pz);
  // Piers: a regular row, re-spaced to straddle the tracks and the highway.
  const xs = [MID - 13, MID + 13, TX71.x - 16.5, TX71.x, TX71.x + 16.5];
  for (let x = -560; x <= 170; x += 30) if (x < MID - 26 || x > TX71.x + 30) xs.push(x);
  for (const x of xs) {
    const grp = Math.abs(x - MID) > 190 ? 'far' : 'solid';
    for (const pz of [SH130.z0 + 3.5, SH130.z1 - 3.5]) {
      const gy = Math.abs(x - TX71.x) < 1 ? tx71Y(pz) - 0.5 : G(x, pz) - 0.6;
      b.cyl(grp, '#b5b0a4', 0.9, 0.9, under - 1 - gy, x, (under - 1 + gy) / 2, pz, 10);
    }
    b.box(grp, '#b5b0a4', 1.8, 1.0, w - 3, x, under - 0.5, mz);
  }
  // Green signs over the tracks, one on each face.
  for (const [z, s] of [[SH130.z0 - 0.4, -1], [SH130.z1 + 0.4, 1]]) {
    b.box('solid', '#1f6b45', 12, 2.6, 0.2, MID, y + 2.6, z);
    b.box('solid', '#f4f1e6', 12.3, 0.12, 0.22, MID, y + 3.96, z + s * 0.001);
    b.box('solid', '#f4f1e6', 12.3, 0.12, 0.22, MID, y + 1.24, z + s * 0.001);
    for (const px of [-5.4, 5.4]) b.box('solid', '#7a8086', 0.2, 1.4, 0.2, MID + px, y + 0.7, z);
  }
}

// ------------------------------------------------------------ 4 · prairie --
function barbedWire(b: Batch, x: number, za: number, zb: number) {
  fence(b, x, za, x, zb, '#7a6a55', '#8a8a86', 1.2, [0.6, 1.1], 6, 0.03);
}

function hayBale(b: Batch, x: number, z: number, ry: number) {
  b.cyl('solid', '#c9b05a', 0.95, 0.95, 1.5, x, G(x, z) + 0.92, z, 10, Math.PI / 2, 0, ry);
}

function stockTank(b: Batch, x: number, z: number, r: number) {
  const y = G(x, z) - 0.15;
  b.cyl('solid', '#aab1b5', r, r, 0.9, x, y + 0.45, z, 14);
  b.cyl('water', '#5f97b8', r - 0.15, r - 0.15, 0.06, x, y + 0.9, z, 14);
}

function buildPrairie(b: Batch, rnd: () => number, z0: number, z1: number) {
  const P = PRAIRIE, fz = FM_ROAD.z;
  for (const s of [-1, 1]) {
    barbedWire(b, MID + s * 13.5, z0, fz - 7);
    barbedWire(b, MID + s * 13.5, fz + 7, z1);
  }
  // The farm road, crossed at grade (the gates are Track.tsx's).
  for (const [x0, x1] of [[-700, MID - 6.4], [MID + 6.4, 190]]) {
    const n0 = Math.max(x0, MID - 170), n1 = Math.min(x1, MID + 170);
    ribbon(b, 'solid', '#5a5750', n0, fz, n1, fz, FM_ROAD.w, 0.12, 0.12, 9);
    ribbon(b, 'solid', '#e2c23e', n0, fz, n1, fz, 0.2, 0.17, 0.1, 9);
    if (x0 < n0) ribbon(b, 'far', '#5a5750', x0, fz, n0, fz, FM_ROAD.w, 0.3, 0.12, 30);          // out in the haze
    if (x1 > n1) ribbon(b, 'far', '#5a5750', n1, fz, x1, fz, FM_ROAD.w, 0.3, 0.12, 30);
  }
  pickup(b, MID + 17, fz - 2.2, '#8c1f24', -Math.PI / 2, G(MID + 17, fz) + 0.18);
  car(b, MID - 18.5, fz + 2.2, '#e9e4d6', Math.PI / 2, G(MID - 18.5, fz) + 0.18);
  for (const s of [-1, 1]) {                                                    // the fences turn up the road
    for (const dz of [-7, 7]) fence(b, MID + s * 13.5, fz + dz, MID + s * 35, fz + dz, '#7a6a55', '#8a8a86', 1.2, [0.6, 1.1], 5.4, 0.03);
  }

  // ---- the red barn, its silo and a tractor ----
  const r = P.barn, w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, [lo, hi] = footing(r);
  b.box('solid', '#a12a22', w, 6 + hi - lo + 0.4, d, cx, (hi + 6 + lo - 0.4) / 2, cz);
  gableRoofZ(b, '#c9ced3', '#a12a22', cx, hi + 6, cz, w, d, 3.6, 0.7);
  b.box('solid', '#f4f1e6', 0.12, 4.2, 5, r.x1 + 0.04, hi + 2.1, cz);                                       // big doors, white X
  b.box('solid', '#a12a22', 0.13, 3.8, 4.6, r.x1 + 0.06, hi + 2.1, cz);
  for (const s of [-1, 1]) b.box('solid', '#f4f1e6', 0.14, 0.25, 6.1, r.x1 + 0.08, hi + 2.1, cz, 0, s * 0.69);
  for (const s of [-1, 1]) b.box('solid', '#f4f1e6', 0.34, 6, 0.34, r.x1, hi + 3, cz + s * (d / 2));          // corner trim
  const S = P.silo, sy = G(S.x, S.z) - 0.3;
  b.cyl('solid', '#b5bcc1', S.r, S.r, 11, S.x, sy + 5.5, S.z, 12);
  b.blob('solid', '#9aa1a6', S.r, S.x, sy + 11, S.z, 0.6);
  const tx = r.x1 + 9, tz = cz + 6, ty = G(tx, tz);
  b.box('solid', '#2f7a3a', 1.4, 1.1, 3.0, tx, ty + 1.3, tz);
  b.box('solid', '#2f7a3a', 1.5, 1.5, 1.4, tx, ty + 2.2, tz - 0.9);
  for (const s of [-1, 1]) {
    b.cyl('solid', '#1c1f23', 0.85, 0.85, 0.5, tx + s * 0.95, ty + 0.85, tz - 0.8, 10, 0, Math.PI / 2);
    b.cyl('solid', '#1c1f23', 0.5, 0.5, 0.35, tx + s * 0.85, ty + 0.5, tz + 1.2, 8, 0, Math.PI / 2);
  }
  for (let k = 0; k < 6; k++) hayBale(b, r.x1 + 6 + (k % 3) * 2.2, r.z0 - 5 - Math.floor(k / 3) * 1.8, Math.PI / 2);

  // ---- windmill tower (the wheel turns: see <WindmillRotor>) and tanks ----
  const wm = P.windmill, wy = G(wm.x, wm.z) - 0.2, top = wy + 0.2 + wm.hub;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    beam(b, 'solid', '#8b9399', 0.1, 0.1, [wm.x + dx * 1.3, wy, wm.z + dz * 1.3], [wm.x + dx * 0.22, top - 0.4, wm.z + dz * 0.22]);
  }
  for (const f of [0.3, 0.62]) {
    const hw = 1.3 - (1.3 - 0.22) * f, y = wy + (top - 0.4 - wy) * f;
    for (const s of [-1, 1]) {
      b.box('solid', '#8b9399', hw * 2, 0.07, 0.07, wm.x, y, wm.z + s * hw);
      b.box('solid', '#8b9399', 0.07, 0.07, hw * 2, wm.x + s * hw, y, wm.z);
    }
  }
  b.box('solid', '#6b7078', 1.5, 0.08, 1.5, wm.x, top - 1.5, wm.z);
  b.box('solid', '#6b7078', 1.0, 0.45, 0.45, wm.x + 0.1, top, wm.z);
  b.box('solid', '#8b9399', 1.9, 0.06, 0.06, wm.x - 1.2, top, wm.z);
  b.box('solid', '#c9cfd4', 1.5, 1.0, 0.05, wm.x - 2.3, top, wm.z);                                         // tail vane
  for (const t of P.tanks) stockTank(b, t.x, t.z, t.r);

  // ---- the factory: huge, plain, low and silver, far off to the east ----
  const f = P.factory, [flo, fhi] = footing(f), fcx = (f.x0 + f.x1) / 2, fcz = (f.z0 + f.z1) / 2;
  b.box('far', '#cfd4d8', f.x1 - f.x0, 13 + fhi - flo + 0.5, f.z1 - f.z0, fcx, (fhi + 13 + flo - 0.5) / 2, fcz);
  b.box('far', '#b3bac0', f.x1 - f.x0 + 0.4, 1.2, f.z1 - f.z0 + 0.4, fcx, fhi + 13.2, fcz);
  for (let k = 0; k < 6; k++) b.box('far', '#a9b0b6', 8, 2.2, 8, f.x0 + 14 + k * 28, fhi + 14.8, fcz + (k % 2 ? 18 : -18));

  // ---- longhorns, hay, oaks and mesquite ----
  herd(b, rnd, MID - 30, 2132, 6, 16);
  herd(b, rnd, MID - 46, 2254, 5, 20);
  herd(b, rnd, MID + 25, 2146, 4, 10);
  herd(b, rnd, -88, 2256, 4, 18);
  for (let k = 0; k < 9; k++) {
    const x = MID - 26 - rnd() * 40, z = 2194 + rnd() * 24;
    if (clearOf(x, z, 2)) hayBale(b, x, z, rnd() * 3);
  }
  for (let k = 0; k < 6; k++) {
    const x = -96 + rnd() * 34, z = 2136 + rnd() * 60;
    if (clearOf(x, z, 2)) hayBale(b, x, z, rnd() * 3);
  }
  // Live oaks stand in clumps (mottes); mesquite is scattered.
  for (const [mx, mz] of [[MID - 58, 2112], [MID - 24, 2212], [MID - 70, 2274], [MID + 24, 2108], [-84, 2176], [MID + 27, 2268], [-70, 2282]]) {
    for (let k = 0; k < 3; k++) {
      const x = mx + (rnd() - 0.5) * 12, z = mz + (rnd() - 0.5) * 12;
      if (clearOf(x, z, 2)) oak(b, x, z, 0.9 + rnd() * 0.5, k + Math.floor(mz));
    }
  }
  scatter(b, rnd, z0, z1, 34, [mesquite, mesquite, shrub], 15, 130);
  bluebonnets(b, rnd, z0, z1, 56);
}

// --------------------------------------------------------- 5 · pecan farm --
/** The giant squirrel: sitting up, facing the track, a pecan in its paws. */
function squirrel(b: Batch) {
  const S = FARM.squirrel, k = S.height / 4.3, top = S.plinth.h;
  // (f = toward the track, u = up from the deck, s = sideways; all × k.)
  const P = (f: number, u: number, s = 0): V3 => [S.x + f * k, top + u * k, S.z + s * k];
  const blob = (color: string, r: number, f: number, u: number, s = 0, sy = 1) => b.blob('solid', color, r * k, ...P(f, u, s), sy);
  const FUR = '#8a4b22', DARK = '#6f3c1b', TAN = '#d9a86c', CREAM = '#ecd2a4', INK = '#16120f';
  // The deck it sits on.
  b.box('solid', '#5a4030', S.plinth.w, top, S.plinth.d, S.x, top / 2, S.z);
  b.box('solid', '#7a5a40', S.plinth.w + 0.3, 0.1, S.plinth.d + 0.3, S.x, top + 0.02, S.z);
  b.box('solid', '#c9a23a', 0.06, 0.3, 1.2, S.x + S.plinth.w / 2 + 0.02, top * 0.55, S.z);
  // Tail first (it is behind everything): a fat S that curls back at the tip,
  // with a paler fringe showing round its edge.
  const tail: [number, number, number, number][] = [
    [-0.8, 0.5, 0.5, 0], [-1.3, 1.05, 0.66, 0], [-1.6, 1.8, 0.8, 0.04], [-1.7, 2.6, 0.88, 0.1],
    [-1.62, 3.4, 0.86, 0.18], [-1.46, 4.08, 0.76, 0.26], [-1.52, 4.62, 0.62, 0.32], [-1.86, 4.9, 0.44, 0.36],
  ];
  for (const [f, u, r, s] of tail) {
    blob('#b98a55', r * 1.06, f - 0.17, u, s);
    blob(FUR, r, f, u, s);
  }
  // Haunches and big feet.
  for (const s of [-1, 1]) {
    blob(FUR, 0.78, 0.1, 0.72, s * 0.6, 0.95);
    blob(DARK, 0.36, 0.98, 0.17, s * 0.56, 0.5);
    blob(DARK, 0.22, 1.3, 0.14, s * 0.56, 0.5);
  }
  // Body, chest, and the pale front.
  blob(FUR, 0.98, 0, 1.62, 0, 1.3);
  blob(FUR, 0.76, 0.2, 2.5);
  blob(CREAM, 0.72, 0.4, 1.7, 0, 1.3);
  blob(TAN, 0.5, 0.52, 2.5);
  // Head: cheeks, muzzle, nose, two front teeth, bright eyes, ears.
  blob(FUR, 0.66, 0.38, 3.42, 0, 0.92);
  blob(CREAM, 0.33, 0.9, 3.3, 0, 0.82);
  blob(INK, 0.1, 1.2, 3.4);
  b.box('solid', '#fbf8ee', 0.06 * k, 0.16 * k, 0.18 * k, ...P(1.11, 3.07));
  for (const s of [-1, 1]) {
    blob(TAN, 0.3, 0.74, 3.22, s * 0.3, 0.9);
    blob(INK, 0.13, 0.84, 3.6, s * 0.36);
    blob('#ffffff', 0.045, 0.95, 3.66, s * 0.33);
    b.cyl('solid', FUR, 0, 0.21 * k, 0.52 * k, ...P(0.22, 4.04, s * 0.4), 6);
    b.cyl('solid', TAN, 0, 0.11 * k, 0.36 * k, ...P(0.31, 4.0, s * 0.4), 5);
    // Arms reach round to hold the pecan against its chest.
    limb(b, 'solid', FUR, 0.21 * k, 0.15 * k, P(0.45, 2.78, s * 0.74), P(1.14, 2.44, s * 0.3));
    blob(DARK, 0.19, 1.18, 2.44, s * 0.27);
  }
  blob('#c08a4e', 0.3, 1.26, 2.52, 0, 1.45);
  blob('#6b4526', 0.13, 1.26, 2.9);
  blob('#6b4526', 0.11, 1.26, 2.13);
}

function buildFarm(b: Batch, rnd: () => number, z0: number, z1: number) {
  const F = FARM;
  // ---- the red metal barn shop, white trim, a porch along the front ----
  const r = F.barn, w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, RED = '#b3261e', WHITE = '#f4f1e6';
  b.box('solid', RED, w, 6.8, d, cx, 3.4, cz);
  gableRoofZ(b, '#b9bec2', RED, cx, 6.8, cz, w, d, 3.4, 0.8);
  for (const s of [-1, 1]) b.box('solid', WHITE, 0.3, 6.8, 0.3, r.x1 + 0.02, 3.4, cz + s * (d / 2 - 0.1));    // corner trim
  b.box('solid', WHITE, 0.16, 0.3, d, r.x1 + 0.03, 6.65, cz);
  b.box('solid', WHITE, 0.16, 0.24, d, r.x1 + 0.03, 3.32, cz);
  for (let z = r.z0 + 1.5; z < r.z1 - 1; z += 1.5) b.box('solid', '#a1221b', 0.1, 6.4, 0.12, r.x1 + 0.01, 3.3, z); // metal ribs
  b.box('solid', '#8f959a', 3.4, 0.14, d + 1, r.x1 + 1.6, 3.12, cz, 0, 0, -0.1);                               // porch roof
  for (let z = r.z0; z <= r.z1 + 0.1; z += d / 4) b.box('solid', WHITE, 0.2, 2.95, 0.2, r.x1 + 3.0, 1.48, z);
  b.box('solid', '#a39a8a', 3.4, 0.16, d + 1, r.x1 + 1.7, 0.08, cz);
  b.box('solid', WHITE, 0.12, 2.5, 2.4, r.x1 + 0.05, 1.3, cz);                                                 // doors
  b.box('glass', GLASS, 0.1, 2.1, 2.0, r.x1 + 0.09, 1.3, cz);
  for (const s of [-1, 1]) {
    b.box('solid', WHITE, 0.12, 1.7, 4.6, r.x1 + 0.05, 1.75, cz + s * 7.2);
    b.box('glass', GLASS, 0.1, 1.4, 4.3, r.x1 + 0.09, 1.75, cz + s * 7.2);
    b.box('lit', LIT[1], 0.04, 1.3, 4.1, r.x1 + 0.15, 1.75, cz + s * 7.2);
  }
  b.box('lit', LIT[0], 0.04, 1.9, 1.8, r.x1 + 0.15, 1.3, cz);
  for (let k = 0; k < 4; k++) {                                                                               // pecan sacks + barrels
    b.cyl('solid', '#7a5536', 0.42, 0.42, 0.95, r.x1 + 2.3, 0.63, r.z0 + 3 + k * 1.1, 8);
    b.box('solid', '#d9c7a8', 0.7, 0.5, 0.9, r.x1 + 2.2, 0.4, r.z1 - 3 - k * 1.0);
  }
  // ---- gravel lot, a few cars, the pie kiosk ----
  const lot = F.lot;
  b.box('solid', '#cfc5ad', lot.x1 - lot.x0, 0.06, lot.z1 - lot.z0, (lot.x0 + lot.x1) / 2, 0.03, (lot.z0 + lot.z1) / 2);
  car(b, lot.x0 + 5, lot.z0 + 5, '#35567e', Math.PI / 2, 0.04);
  pickup(b, lot.x0 + 5.4, lot.z0 + 10.5, '#e9e4d6', Math.PI / 2, 0.04);
  car(b, lot.x0 + 5, lot.z0 + 20, '#d7a23a', Math.PI / 2, 0.04);
  const kx = (F.kiosk.x0 + F.kiosk.x1) / 2, kz = (F.kiosk.z0 + F.kiosk.z1) / 2, kw = F.kiosk.x1 - F.kiosk.x0, kd = F.kiosk.z1 - F.kiosk.z0;
  b.box('solid', WHITE, kw, 2.5, kd, kx, 1.25, kz);
  b.box('solid', RED, kw + 1.2, 0.16, kd + 0.6, kx + 0.3, 2.62, kz, 0, 0, -0.1);
  b.box('solid', RED, 0.14, 0.8, kd, F.kiosk.x1 + 0.3, 3.1, kz);                                                // the sign on its roof
  b.box('glass', '#1c232c', 0.08, 1.5, kd - 0.8, F.kiosk.x1 + 0.03, 1.5, kz);
  b.box('glow', '#ffe7b8', 0.05, 1.3, kd - 1.0, F.kiosk.x1 + 0.08, 1.5, kz);                                    // the pies, lit
  for (let k = 0; k < 3; k++) b.box('solid', '#a86a32', 0.06, 0.08, 0.5, F.kiosk.x1 + 0.11, 1.1 + k * 0.4, kz - 0.7 + k * 0.7);

  // ---- the statue, its sign, a picnic table or two ----
  squirrel(b);
  const sg = F.sign;                                                                                          // low, so it never hides the statue
  b.box('solid', WHITE, 0.14, 0.92, sg.w, sg.x, 0.62, sg.z);
  b.box('solid', RED, 0.16, 0.1, sg.w + 0.2, sg.x, 1.13, sg.z);
  b.box('solid', RED, 0.16, 0.1, sg.w + 0.2, sg.x, 0.11, sg.z);
  for (const s of [-1, 1]) b.box('solid', '#7a5536', 0.16, 1.24, 0.16, sg.x - 0.05, 0.62, sg.z + s * (sg.w / 2 + 0.1));
  for (const pz of [F.squirrel.z + 6.5, F.squirrel.z - 12]) {
    const px = F.squirrel.x - 5;
    b.box('solid', '#9b7a55', 0.8, 0.08, 1.9, px, 0.78, pz);
    for (const s of [-1, 1]) b.box('solid', '#9b7a55', 0.3, 0.07, 1.9, px + s * 0.75, 0.46, pz);
    b.box('solid', '#6b5a48', 1.6, 0.74, 0.1, px, 0.37, pz);
  }
  // White rail fence along the front (low: it never hides the squirrel).
  fence(b, MID - 12.6, 2297, MID - 12.6, 2383, WHITE, WHITE, 1.0, [0.5, 0.95], 4, 0.09);
  // ---- the orchard, in neat rows ----
  F.orchard.forEach(([x, z], i) => pecan(b, x, z, 0.92 + rnd() * 0.22, i));
  // East of the highway and south of the farm: pasture running up to the pines.
  for (const s of [-1, 1]) barbedWire(b, MID + s * 13.5, 2386, z1);
  barbedWire(b, MID + 13.5, z0 + 4, 2384);
  herd(b, rnd, -92, 2330, 5, 18);
  herd(b, rnd, MID - 34, 2408, 4, 16);
  scatter(b, rnd, z0, z1, 26, [oak, mesquite, mesquite, shrub], 15, 150);
  scatter(b, rnd, 2390, z1, 22, [youngPine, youngPine, mesquite], 14, 110);
  bluebonnets(b, rnd, z0, z1, 40);
  for (let i = 0; i < 14; i++) {                                                                              // a drift of blue by the statue
    const x = F.squirrel.x + 4.4 + rnd() * 4.4, z = F.squirrel.z - 5 + rnd() * 10;
    b.cyl('solid', i % 2 ? '#5a6fd8' : '#6f83e6', 0, 0.35 + rnd() * 0.4, 0.16, x, 0.08, z, 6);
  }
}

// ------------------------------------------------------- 6 · the Lost Pines --
function cabin(b: Batch, c: { x: number; z: number; w: number; d: number }) {
  const r: Rect = { x0: c.x - c.w / 2, x1: c.x + c.w / 2, z0: c.z - c.d / 2, z1: c.z + c.d / 2 }, [lo, hi] = footing(r);
  b.box('solid', '#8f8676', c.w + 0.2, hi - lo + 0.6, c.d + 0.2, c.x, (hi + lo) / 2 - 0.1, c.z);              // stone footing
  b.box('solid', WOOD, c.w, 3, c.d, c.x, hi + 1.7, c.z);
  for (let k = 0; k < 5; k++) b.box('solid', '#62432a', c.w + 0.14, 0.08, c.d + 0.14, c.x, hi + 0.7 + k * 0.6, c.z);  // log courses
  gableRoofZ(b, '#3f5a44', WOOD, c.x, hi + 3.2, c.z, c.w, c.d, 2.2, 0.7);
  b.box('solid', '#8f8676', 1.1, 6.6, 1.1, c.x - c.w / 2 + 1, hi + 3.3, c.z - c.d / 2 + 0.2);                 // chimney
  // Porch toward the line, a door and a warm window.
  b.box('solid', '#62432a', 2.2, 0.16, c.d, r.x1 + 1.1, hi + 0.3, c.z);
  b.box('solid', '#3f5a44', 2.6, 0.12, c.d + 0.6, r.x1 + 1.2, hi + 2.9, c.z, 0, 0, -0.16);
  for (const s of [-1, 1]) b.cyl('solid', '#62432a', 0.1, 0.1, 2.5 + hi - lo, r.x1 + 2.1, (hi + 2.7 + lo) / 2, c.z + s * (c.d / 2 - 0.2), 5);
  b.box('solid', '#4a3020', 0.1, 2.0, 0.95, r.x1 + 0.04, hi + 1.3, c.z - 1.2);
  b.box('glass', GLASS, 0.1, 1.0, 1.3, r.x1 + 0.04, hi + 1.9, c.z + 1.2);
  b.box('lit', LIT[2], 0.04, 0.9, 1.2, r.x1 + 0.1, hi + 1.9, c.z + 1.2);
}

function lookout(b: Batch) {
  const L = PINES.lookout, gy = G(L.x, L.z) - 0.4, top = gy + 0.4 + L.h, C = '#7d858b';
  const at = (f: number) => L.half - (L.half - 1.5) * f;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beam(b, 'solid', C, 0.2, 0.2, [L.x + dx * L.half, gy, L.z + dz * L.half], [L.x + dx * 1.5, top, L.z + dz * 1.5]);
  for (let k = 0; k < 4; k++) {
    const f0 = k / 4, f1 = (k + 1) / 4, y0 = gy + (top - gy) * f0, y1 = gy + (top - gy) * f1, a = at(f0), c = at(f1);
    for (const s of [-1, 1]) {
      b.box('solid', C, c * 2, 0.12, 0.12, L.x, y1, L.z + s * c);
      b.box('solid', C, 0.12, 0.12, c * 2, L.x + s * c, y1, L.z);
    }
    // Cross-bracing on the two faces riders see.
    beam(b, 'solid', C, 0.08, 0.08, [L.x + a, y0, L.z - a], [L.x + c, y1, L.z + c]);
    beam(b, 'solid', C, 0.08, 0.08, [L.x + a, y0, L.z + a], [L.x + c, y1, L.z - c]);
    beam(b, 'solid', C, 0.08, 0.08, [L.x - a, y0, L.z - a], [L.x + c, y1, L.z - c]);
    beam(b, 'solid', C, 0.08, 0.08, [L.x + a, y0, L.z - a], [L.x - c, y1, L.z - c]);
  }
  b.box('solid', '#62432a', 5.6, 0.14, 5.6, L.x, top + 0.07, L.z);
  b.box('solid', '#e6e2d6', 4.2, 2.5, 4.2, L.x, top + 1.4, L.z);
  b.box('glass', GLASS, 4.3, 1.0, 4.3, L.x, top + 1.75, L.z);
  b.box('lit', LIT[1], 4.36, 0.9, 4.36, L.x, top + 1.75, L.z);
  b.cyl('solid', '#3f5a44', 0, 3.7, 1.7, L.x, top + 3.5, L.z, 4, 0, 0, Math.PI / 4);
}

function buildPines(b: Batch, rnd: () => number, z0: number, z1: number) {
  const within = (z: number) => z >= z0 && z < z1;
  if (within(PINES.sign.z)) {
    woodSign(b, PINES.sign.x, PINES.sign.z, PINES.sign.ry, PINES.sign.w, 2.3, 3.0);
    // The highway's last look at open country: a welcome committee of deer.
    deer(b, MID - 15.5, 2478, 1.2, true);
    deer(b, MID - 17, 2482, 0.4, false);
    deer(b, MID + 14.6, 2508, -1.9, false);
  }
  for (const c of PINES.cabins) if (within(c.z)) cabin(b, c);
  if (within(PINES.lookout.z)) {
    lookout(b);
    deer(b, MID + 15, 2590, -1.2, true);
    deer(b, MID - 16, 2566, 2.0, false);
  }
  if (within(PINES.camp.z)) {
    // A camp in a clearing: a tent, a fire, logs to sit on.
    const c = PINES.camp, y = G(c.x, c.z);
    for (const s of [-1, 1]) b.box('solid', '#f08a24', 1.9, 0.06, 3.0, c.x + s * 0.75, y + 0.72, c.z - 2, 0, 0, -s * 0.84);
    b.box('solid', '#b3611a', 0.5, 1.0, 0.06, c.x, y + 0.5, c.z - 0.5);
    b.cyl('glow', '#ff8a2a', 0, 0.42, 0.8, c.x + 1.2, y + 0.45, c.z + 1.8, 5);
    b.cyl('solid', '#5a5750', 0.7, 0.75, 0.2, c.x + 1.2, y + 0.08, c.z + 1.8, 8);
    for (const a of [0.4, 2.2, 4.0]) b.cyl('solid', '#6b5140', 0.22, 0.22, 1.5, c.x + 1.2 + Math.cos(a) * 1.9, y + 0.22, c.z + 1.8 + Math.sin(a) * 1.9, 6, Math.PI / 2, 0, -a);
    deer(b, MID - 16.5, 2716, 0.7, false);
    deer(b, MID + 15.2, 2736, -2.4, true);
    deer(b, MID + 16.4, 2739, -1.1, false);
  }
  // Under the big trees: yaupon, saplings, the odd fallen log.
  scatter(b, rnd, z0, z1, 90, [youngPine, youngPine, shrub], 13, 90, 1.3);
  for (let i = 0; i < 6; i++) {
    const side = rnd() < 0.5 ? -1 : 1, x = MID + side * (14 + rnd() * 22), z = z0 + rnd() * (z1 - z0), ry = rnd() * 3;
    if (clearOf(x, z, 2)) b.cyl('solid', '#6b5140', 0.26, 0.3, 5 + rnd() * 3, x, G(x, z) + 0.2, z, 6, Math.PI / 2, 0, ry);
  }
}

// ----------------------------------------------------- 7 · Colorado River --
function buildRiver(b: Batch, rnd: () => number, z0: number, z1: number) {
  const R = RIVER;
  b.box('water', '#4d7f72', R.x1 - R.x0, 0.05, R.z1 - R.z0 - 2, (R.x0 + R.x1) / 2, R.y, (R.z0 + R.z1) / 2);
  // Sandbars.
  for (const [x, z, r] of [[MID - 44, R.z0 + 15, 13], [MID - 62, R.z0 + 19, 9], [MID + 58, R.z1 - 17, 14], [MID + 36, R.z1 - 13, 8], [MID - 150, R.z1 - 16, 16], [MID + 150, R.z0 + 16, 15]]) {
    b.cyl('solid', '#dccfa6', r * 0.8, r, 0.5, x, R.y + 0.08, z, 11);
    b.cyl('solid', '#cdbf94', r * 0.45, r * 0.6, 0.3, x + r * 0.15, R.y + 0.42, z - r * 0.1, 9);
  }
  for (const k of RIVER_BOATS) boat(b, k, R.y + 0.03);
  // The through truss the train rides through, rust red.
  throughTruss(b, TRUSS_RED, MID - 6.7, MID + 6.7, R.z0, R.z1, 10, 1.2, 6.65, 8.6, 0.42, 0.9);
  oldIronBridge(b);
  for (const z of [R.z0 - R.rim, R.z1 + R.rim]) {
    fence(b, MID - 150, z, MID - CLEAR - 0.3, z, '#8a6a48', '#9b7a55', 1.1, [0.55, 1.0], 8, 0.08);
    fence(b, MID + CLEAR + 0.3, z, OLD_BRIDGE.x - 5.6, z, '#8a6a48', '#9b7a55', 1.1, [0.55, 1.0], 8, 0.08);
    fence(b, OLD_BRIDGE.x + 5.6, z, MID + 150, z, '#8a6a48', '#9b7a55', 1.1, [0.55, 1.0], 8, 0.08);
  }
  woodSign(b, RIVER_SIGN.x, RIVER_SIGN.z, RIVER_SIGN.ry, RIVER_SIGN.w, 1.6, 2.6);
  // Bald cypress and pecans crowd both banks.
  for (let i = 0; i < 44; i++) {
    const south = i % 2 === 1, side = i % 4 < 2 ? -1 : 1;
    const x = MID + side * (CLEAR + 6 + rnd() * 190), z = south ? R.z1 + 0.5 + rnd() * 3 : R.z0 - 0.5 - rnd() * 3;
    if (Math.abs(x - OLD_BRIDGE.x) < 7) continue;
    (i % 5 === 4 ? pecan : cypress)(b, x, z, 1.0 + rnd() * 0.6, i);
  }
  scatter(b, rnd, R.z1 + 4, z1, 26, [pecan, oak, youngPine, shrub], 14, 150);
  scatter(b, rnd, z0, R.z0 - 5, 6, [youngPine, shrub], 14, 80);
}

// --------------------------------------------------------------- sections --
type Geo = Record<string, THREE.BufferGeometry>;
type Builder = (b: Batch, rnd: () => number, z0: number, z1: number) => void;
const BUILDERS: Record<string, Builder> = {
  'lake': buildLake,
  'south-austin': buildSouthAustin,
  'airport': buildAirport,
  'prairie': buildPrairie,
  'pecan-farm': buildFarm,
  'pines-north': buildPines,
  'pines-south': buildPines,
  'river': buildRiver,
};

function buildSections(): Geo[] {
  return SECTIONS.map(([name, z0, z1], i) => {
    const b = new Batch();
    BUILDERS[name](b, rng32(7100 + i * 17), z0, z1);
    highway(b, z0, z1);
    poles(b, z0, z1);
    const geo = b.build();
    for (const g of Object.values(geo)) g.computeBoundingSphere();
    return geo;
  });
}

// ---------------------------------------------------------- loblolly pines --
/** One pine, 1 unit tall: bare trunk, a ragged crown in the top third. */
function pineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: string) => {
    const flat = g.index ? g.toNonIndexed() : g;
    const n = flat.getAttribute('position').count, c = new THREE.Color(color), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(flat);
  };
  const trunk = new THREE.CylinderGeometry(0.19, 0.33, 0.76, 5, 1, true);
  trunk.translate(0, 0.38, 0);
  add(trunk, '#7b5b47');
  const crown = new THREE.IcosahedronGeometry(1, 0);
  crown.scale(2.7, 0.15, 2.5);
  crown.translate(0.3, 0.8, -0.2);
  add(crown, '#35633a');
  const tip = new THREE.ConeGeometry(1.7, 0.2, 5, 1, true);
  tip.rotateY(0.5);
  tip.translate(-0.25, 0.9, 0.15);
  add(tip, '#2d5632');
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}

interface Pine { x: number; y: number; z: number; h: number; s: number; ry: number; tint: number }
const PINE_COUNT = 864;
const PINE_STANDS = 3;

function pineStand(k: number): Pine[] {
  const span = (PINES.z1 - PINES.z0) / PINE_STANDS, z0 = PINES.z0 + k * span, n = Math.round(PINE_COUNT / PINE_STANDS);
  const rnd = rng32(9001 + k * 31), out: Pine[] = [];
  for (let guard = 0; out.length < n && guard < n * 8; guard++) {
    const z = z0 + rnd() * span, side = rnd() < 0.5 ? -1 : 1;
    const x = MID + side * (CLEAR + 3.2 + Math.pow(rnd(), 1.35) * 160);
    const h = 14 + rnd() * 10, s = 0.8 + rnd() * 0.5, ry = rnd() * Math.PI * 2, tint = rnd(), keep = rnd();
    // The forest thins out where it meets the prairie and the river bank.
    const edge = Math.min(1, (z - PINES.z0) / 24, (PINES.z1 - z) / 20);
    if (keep > 0.2 + 0.8 * edge || !clearOf(x, z)) continue;
    out.push({ x, y: G(x, z) - 0.4, z, h, s, ry, tint });
  }
  return out;
}

function PineStand({ k, geometry, material }: { k: number; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => pineStand(k), [k]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D(), c = new THREE.Color(), box = new THREE.Box3();
    trees.forEach((t, i) => {
      o.position.set(t.x, t.y, t.z);
      o.rotation.set(0, t.ry, 0);
      o.scale.set(t.s, t.h, t.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      const v = 0.8 + t.tint * 0.3;
      m.setColorAt(i, c.setRGB(v * (1.04 - t.tint * 0.08), v, v * (0.9 + t.tint * 0.12)));
      box.expandByPoint(o.position);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.radius += 27;
    m.boundingSphere = sphere;
  }, [trees]);
  return <instancedMesh ref={ref} args={[geometry, material, trees.length]} />;
}

// ---------------------------------------------------------------- traffic --
/** Cars, pickups and big rigs share ONE instanced mesh: every vertex knows
 *  which kind it belongs to (aPart) and each instance says which kind it is
 *  (aKind); the vertex shader folds the others away. Lamps glow at night. */
const KIND_CAR = 0, KIND_PICKUP = 1, KIND_RIG = 2;

function vehicleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const c = new THREE.Color(), gl = new THREE.Color();
  const add = (kind: number, color: string, w: number, h: number, d: number, x: number, y: number, z: number, glow?: string) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3), part = new Float32Array(n), glo = new Float32Array(n * 3);
    c.set(color);
    gl.set(glow ?? '#000000');
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      glo[i * 3] = gl.r; glo[i * 3 + 1] = gl.g; glo[i * 3 + 2] = gl.b;
      part[i] = kind;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    g.setAttribute('aGlow', new THREE.BufferAttribute(glo, 3));
    parts.push(g);
  };
  const lamps = (kind: number, halfW: number, y: number, zFront: number, zBack: number) => {
    add(kind, '#fff4d6', halfW * 2 + 0.4, 0.2, 0.08, 0, y, zFront, '#fff4d6');
    add(kind, '#ff2a1a', halfW * 2 + 0.4, 0.18, 0.08, 0, y, zBack, '#ff2a1a');
  };
  const DARK = '#22272e', TYRE = '#17191c';
  // Car (forward = +Z). White paint takes the instance colour.
  add(KIND_CAR, '#ffffff', 1.85, 0.66, 4.3, 0, 0.66, 0);
  add(KIND_CAR, DARK, 1.62, 0.5, 2.2, 0, 1.22, -0.25);
  add(KIND_CAR, '#ffffff', 1.5, 0.06, 1.9, 0, 1.49, -0.25);
  add(KIND_CAR, TYRE, 1.9, 0.5, 3.6, 0, 0.27, 0);
  lamps(KIND_CAR, 0.62, 0.74, 2.16, -2.16);
  // Pickup: tall cab forward, open bed behind.
  add(KIND_PICKUP, '#ffffff', 1.98, 0.78, 5.4, 0, 0.84, 0);
  add(KIND_PICKUP, '#ffffff', 1.88, 0.78, 1.9, 0, 1.56, 0.55);
  add(KIND_PICKUP, DARK, 1.92, 0.44, 1.6, 0, 1.6, 0.55);
  add(KIND_PICKUP, DARK, 1.6, 0.05, 2.0, 0, 1.25, -1.6);
  add(KIND_PICKUP, TYRE, 2.02, 0.6, 4.5, 0, 0.32, 0);
  lamps(KIND_PICKUP, 0.7, 0.98, 2.71, -2.71);
  // Big rig: a cab and a long box trailer.
  add(KIND_RIG, '#ffffff', 2.4, 2.5, 2.6, 0, 1.95, 6.3);
  add(KIND_RIG, DARK, 2.42, 0.8, 0.6, 0, 2.5, 7.35);
  add(KIND_RIG, '#ffffff', 2.5, 2.9, 12.2, 0, 2.6, -1.3);
  add(KIND_RIG, TYRE, 2.46, 1.0, 4.6, 0, 0.5, 4.9);
  add(KIND_RIG, TYRE, 2.46, 1.0, 2.2, 0, 0.5, -5.6);
  lamps(KIND_RIG, 0.85, 1.1, 7.61, -7.41);
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}

function vehicleMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.3 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aPart;\nattribute float aKind;\nattribute vec3 aGlow;\nvarying vec3 vGlow;\n' + shader.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vGlow = aGlow;\n  if (aGlow.r + aGlow.g + aGlow.b > 0.004) vColor.rgb = aGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed *= step(abs(aPart - aKind), 0.5);');
    shader.fragmentShader = 'varying vec3 vGlow;\n' + shader.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vGlow;');
  };
  return m;
}

interface Vehicle { road: 0 | 1; dir: 1 | -1; lane: number; speed: number; phase: number; kind: number; color: string }
/** TX-71: the slow lane (outside) does 16 m/s, the fast lane 24.5 — the train
 *  does 20, so it overtakes one lane and is overtaken by the other. Everyone
 *  in a lane keeps the same speed, so nobody drives through anybody. */
const TX71_SPAN = TX71.z1 - TX71.z0;
const SH130_X0 = -520, SH130_SPAN = 700;
const VEHICLES: Vehicle[] = (() => {
  const r = rng32(4071), out: Vehicle[] = [];
  const RIG_COLORS = ['#f2f2f0', '#c7ccd3', '#dfe6ee', '#e9e4d6'];
  for (const dir of [1, -1] as const) {
    for (const lane of [0, 1]) {
      const n = 9, slot = TX71_SPAN / n;
      for (let i = 0; i < n; i++) {
        const k = r(), kind = lane === 1 && k < 0.24 ? KIND_RIG : k < 0.6 ? KIND_CAR : KIND_PICKUP;
        const color = kind === KIND_RIG ? RIG_COLORS[Math.floor(r() * RIG_COLORS.length)] : CAR_COLORS[Math.floor(r() * CAR_COLORS.length)];
        out.push({ road: 0, dir, lane, speed: lane === 0 ? 24.5 : 16, phase: i * slot + r() * (slot - 34), kind, color });
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    out.push({ road: 1, dir: i % 2 ? 1 : -1, lane: 0, speed: 23, phase: i * (SH130_SPAN / 2) * 0.5 + r() * 120, kind: i === 0 ? KIND_RIG : KIND_CAR, color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] });
  }
  return out;
})();

function ss(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Put `o` where vehicle `v` is at time `t` (seconds). */
function placeVehicle(v: Vehicle, t: number, o: THREE.Object3D) {
  if (v.road === 0) {
    const u = (v.phase + t * v.speed) % TX71_SPAN;
    const z = v.dir > 0 ? TX71.z0 + u : TX71.z1 - u;
    const x = tx71X(z), yaw = Math.atan2((tx71X(z + 1) - tx71X(z - 1)) / 2, 1);
    // Keep right: southbound on the west carriageway, northbound on the east.
    const off = -v.dir * TX71.lanes[v.lane];
    o.position.set(x + off * Math.cos(yaw), tx71Y(z) + 0.05, z - off * Math.sin(yaw));
    o.rotation.set(-Math.atan2(tx71Y(z + 2) - tx71Y(z - 2), 4) * v.dir, v.dir > 0 ? yaw : yaw + Math.PI, 0, 'YXZ');
    // They grow out of nothing at the two ends, where the road is out of sight.
    o.scale.setScalar(Math.max(0.001, ss(0, 16, u) * ss(0, 16, TX71_SPAN - u)));
  } else {
    const u = (v.phase + t * v.speed) % SH130_SPAN;
    // Eastbound keeps to the south side of the deck, westbound the north.
    o.position.set(v.dir > 0 ? SH130_X0 + u : SH130_X0 + SH130_SPAN - u, SH130.y + 0.06, (SH130.z0 + SH130.z1) / 2 + v.dir * 4.2);
    o.rotation.set(0, v.dir * Math.PI / 2, 0, 'YXZ');
    o.scale.setScalar(1);
  }
  o.updateMatrix();
}

function Traffic() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = vehicleGeometry();
    g.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(VEHICLES.map((v) => v.kind)), 1));
    return g;
  }, []);
  const material = useMemo(() => vehicleMaterial(), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    VEHICLES.forEach((v, i) => m.setColorAt(i, c.set(v.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  useFrame(({ clock, camera }) => {
    const m = ref.current;
    if (!m) return;
    // Nobody can see the highway from further off than this.
    const near = camera.position.z > TX71.z0 - 500 && camera.position.z < TX71.z1 + 500;
    m.visible = near;
    if (!near) return;
    const sky = useSkyStore.getState();
    const on = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    material.emissiveIntensity = 0.25 + 2.6 * on;
    const t = clock.elapsedTime;
    VEHICLES.forEach((v, i) => {
      placeVehicle(v, t, o);
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, VEHICLES.length]} frustumCulled={false} />;
}

// -------------------------------------------------------------------- jet --
/** Where the jet is `t` seconds into its cycle — [x, height above the runway,
 *  nose-up pitch] — or null once it has climbed away into the haze. It lines
 *  up at the far (east) end, rolls west toward the railway, lifts off about
 *  two-thirds of the way down and climbs out over the highway and the tracks. */
function jetPose(t: number): [number, number, number] | null {
  const ROLL_S = 11, ACC = 2.9, HOLD_S = 1.5;
  const r = Math.max(0, t - HOLD_S);
  let d = 0.5 * ACC * Math.min(r, ROLL_S) ** 2, h = 0, pitch = 0.16 * ss(ROLL_S - 1.6, ROLL_S, r);
  if (r > ROLL_S) {
    const a = r - ROLL_S, air = ACC * ROLL_S * a + 0.6 * a * a;
    d += air;
    h = 0.27 * air * ss(0, 70, air);
    pitch = 0.16 + 0.12 * ss(0, 70, air);
  }
  const x = AIRPORT.runway.x1 - 30 - d;
  return x > MID - 345 ? [x, h, pitch] : null;
}

/** One airliner that takes off toward the railway every JET_PERIOD_S seconds. */
function Jet({ solid, glow }: { solid: THREE.Material; glow: THREE.Material }) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const b = new Batch();
    airliner(b, 0, 0, 0, -Math.PI / 2, '#2f56a8');
    const out = b.build();
    for (const g of Object.values(out)) g.computeBoundingSphere();
    return out;
  }, []);
  useFrame(({ clock, camera }) => {
    const g = ref.current;
    if (!g) return;
    const rw = AIRPORT.runway;
    if (Math.abs(camera.position.z - rw.z) > 500) { g.visible = false; return; }
    const pose = jetPose(clock.elapsedTime % JET_PERIOD_S);
    g.visible = pose !== null;
    if (!pose) return;
    g.position.set(pose[0], 3.4 + pose[1], rw.z);
    g.rotation.z = -pose[2];   // nose (−X) up
  });
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={geo.solid} material={solid} />
      <mesh geometry={geo.glow} material={glow} />
    </group>
  );
}

// --------------------------------------------------------------- windmill --
function WindmillRotor({ material }: { material: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null);
  const wm = PRAIRIE.windmill;
  const geometry = useMemo(() => {
    // The wheel faces the railway: blades fan out in the Y–Z plane.
    const b = new Batch(), N = 14;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      b.box('solid', k % 2 ? '#c9cfd4' : '#b3bac0', 0.05, 1.5, 0.46, 0, Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0, a);
    }
    for (let k = 0; k < N; k++) {                                              // the rim
      const a = ((k + 0.5) / N) * Math.PI * 2;
      b.box('solid', '#8b9399', 0.04, 0.05, 0.86, 0, Math.cos(a) * 1.88, Math.sin(a) * 1.88, 0, a);
    }
    b.cyl('solid', '#6b7078', 0.3, 0.3, 0.3, 0, 0, 0, 8, 0, Math.PI / 2);
    const g = b.build().solid;
    g.computeBoundingSphere();
    return g;
  }, []);
  useFrame(({ camera }, dt) => {
    const m = ref.current;
    if (!m || Math.abs(camera.position.z - wm.z) > 500) return;
    m.rotation.x += Math.min(dt, 0.1) * 0.9;
  });
  return <mesh ref={ref} geometry={geometry} material={material} position={[wm.x + 0.75, G(wm.x, wm.z) + wm.hub, wm.z]} />;
}

// ------------------------------------------------------------------ labels --
function Label({ x, y, z, ry, text, size, color = '#ffffff', width }: { x: number; y: number; z: number; ry: number; text: string; size: number; color?: string; width?: number }) {
  return (
    <Text position={[x, y, z]} rotation={[0, ry, 0]} fontSize={size} color={color} anchorX="center" anchorY="middle" letterSpacing={0.04} lineHeight={1.08} maxWidth={width} textAlign="center">
      {text}
    </Text>
  );
}

/** Text on a wooden sign built by woodSign() (same x, z, ry, mid height). */
function SignText({ x, z, ry, y, text, size }: { x: number; z: number; ry: number; y: number; text: string; size: number }) {
  return <Label x={x + Math.sin(ry) * 0.1} y={G(x, z) + y} z={z + Math.cos(ry) * 0.1} ry={ry} text={text} size={size} color="#f6ecd2" />;
}

const EAST = Math.PI / 2, WEST = -Math.PI / 2;   // which way a label faces

export function BastropLine() {
  const sections = useMemo(() => buildSections(), []);
  const pine = useMemo(() => pineGeometry(), []);
  const mats = useMemo(() => ({
    solid: paint(0.9),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.55 }),
    lit: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    glow: glowPaint(0.5),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.35 }),
    pine: paint(0.95, 0),
  }), []);
  useFrame(() => {
    const sky = useSkyStore.getState();
    const on = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    mats.lit.opacity = on * 0.95;
    mats.lit.visible = on > 0.02;
    mats.glow.emissiveIntensity = 0.7 + 2.6 * on;
  });
  const matFor: Record<string, THREE.Material> = { ...mats, far: mats.solid };
  const barn = FARM.barn, barnZ = (barn.z0 + barn.z1) / 2, kiosk = FARM.kiosk, term = AIRPORT.terminal;
  return (
    <group>
      {sections.map((geo, i) => (
        <group key={SECTIONS[i][0]}>
          {Object.entries(geo).map(([k, g]) => <mesh key={k} geometry={g} material={matFor[k]} renderOrder={k === 'lit' ? 2 : 0} />)}
        </group>
      ))}
      {Array.from({ length: PINE_STANDS }, (_, k) => <PineStand key={k} k={k} geometry={pine} material={mats.pine} />)}
      <Traffic />
      <Jet solid={mats.solid} glow={mats.glow} />
      <WindmillRotor material={mats.solid} />

      {/* Signs (twelve in all). West of the line they face east, and vice versa. */}
      <SignText x={MID - 14.5} z={LAKE.z0 - 6.8} ry={2.1} y={2.2} text="LADY BIRD LAKE" size={0.66} />
      {TAQUERIAS.map((t) => {
        const fx = t.face > 0 ? t.r.x1 : t.r.x0;
        return (
          <Label key={t.name} x={fx - t.face * 0.16} y={footing(t.r)[1] + 5.3} z={(t.r.z0 + t.r.z1) / 2} ry={t.face > 0 ? EAST : WEST}
            text={t.name} size={t.name.includes('\n') ? 0.9 : 1.05} color="#ffe9b0" width={t.r.z1 - t.r.z0 - 1.6} />
        );
      })}
      <Label x={term.x0 - 0.7} y={8.3} z={(term.z0 + term.z1) / 2} ry={WEST} text="AUSTIN AIRPORT" size={3.0} color="#1d3a5c" />
      <Label x={MID} y={SH130.y + 2.6} z={SH130.z0 - 0.52} ry={Math.PI} text="SH 130  TOLL" size={1.35} />
      <Label x={MID} y={SH130.y + 2.6} z={SH130.z1 + 0.52} ry={0} text="SH 130  TOLL" size={1.35} />
      <Label x={barn.x1 + 0.12} y={5.25} z={barnZ} ry={EAST} text="PECAN FARM" size={2.0} />
      <Label x={barn.x1 + 0.12} y={3.9} z={barnZ} ry={EAST} text="PECANS · PIE · CANDY" size={0.78} color="#fff3d0" />
      <Label x={kiosk.x1 + 0.39} y={3.1} z={(kiosk.z0 + kiosk.z1) / 2} ry={EAST} text="FRESH PIE" size={0.46} />
      <Label x={FARM.sign.x + 0.08} y={0.62} z={FARM.sign.z} ry={EAST} text={'say hi to the\ngiant squirrel!'} size={0.37} color="#8a2a1c" width={FARM.sign.w - 0.3} />
      <SignText x={PINES.sign.x} z={PINES.sign.z} ry={PINES.sign.ry} y={3.0} text="LOST PINES" size={1.25} />
      <SignText x={RIVER_SIGN.x} z={RIVER_SIGN.z} ry={RIVER_SIGN.ry} y={2.6} text="COLORADO RIVER" size={0.8} />
    </group>
  );
}
