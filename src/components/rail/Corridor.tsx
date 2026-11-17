import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { groundHeight } from '../../world/terrain';
import { RAIL_X, RAIL_X_B } from '../../world/westAvery';
import { LAKELINE_BLVD_Z, PARMER_Z, LAKELINE_Z, QUARRY_Z } from '../../world/redLine';
import { MID, CLEAR, LOTS, SH45, CREEK, MOPAC, QUARRY, SIDINGS, YARD, BACK_FENCE, rng32 } from '../../world/corridor';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { Batch, glowPaint, paint } from './batch';

// The view from the train window, Avery Ranch → the Domain, in the order the
// real Red Line passes it: back fences and pasture, the limestone cut,
// Lakeline Blvd + station, Parmer Lane, the bridge over SH-45, Austin White
// Lime's quarry and the McNeil freight yard, Howard station, Walnut Creek, and
// MoPac overhead. All static and baked into a few draw calls; only the highway
// traffic moves.

const CAR_COLORS = ['#c7ccd3', '#2f3b4f', '#8c1f24', '#e9e4d6', '#35567e', '#4a4f55', '#d7a23a', '#2d5f46', '#f2f2f0', '#6b7f95'];
const OAK = ['#3f6b3a', '#4a7a40', '#365f38', '#557f46'];
const CEDAR = ['#2f5137', '#294a33', '#33583a'];

function inRect(x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, m = 0): boolean {
  return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
}

function car(b: Batch, x: number, y: number, z: number, color: string, ry = 0) {
  b.box('solid', color, 1.85, 0.7, 4.2, x, y + 0.6, z, ry);
  b.box('solid', '#20262d', 1.6, 0.55, 2.1, x - Math.sin(ry) * 0.2, y + 1.2, z - Math.cos(ry) * 0.2, ry);
}

function buildCorridor() {
  const b = new Batch();
  const rnd = rng32(2027);

  // ------------------------------------------------------------- trees --
  const keepOut = (x: number, z: number): boolean => {
    if (Math.abs(x - MID) < CLEAR + 4) return true;
    for (const l of LOTS) if (inRect(x, z, l, 4)) return true;
    if (inRect(x, z, QUARRY, 16)) return true;
    if (x > MID + CLEAR && x < SIDINGS[1] + 6 && z > YARD.z0 - 4 && z < YARD.z1 + 4) return true;
    if (z > SH45.z0 - 9 && z < SH45.z1 + 9) return true;
    if (z > MOPAC.z0 - 3 && z < MOPAC.z1 + 3) return true;
    if (Math.abs(z - LAKELINE_BLVD_Z) < 8 || Math.abs(z - PARMER_Z) < 9) return true;
    if (z > 540 && x < MID + 40) return true;                          // the Domain plants its own
    if (z < 100 && (x < BACK_FENCE.x - 1 || x > MID + 60)) return true; // houses / the neighbourhood
    return false;
  };
  for (let i = 0; i < 620; i++) {
    const z = -70 + rnd() * 800;
    const side = rnd() < 0.5 ? -1 : 1;
    // Thick near the line, thinning with distance.
    const d = CLEAR + 5 + Math.pow(rnd(), 1.7) * 150;
    const x = MID + side * d;
    const s = 0.8 + rnd() * 0.9;
    const kind = rnd();
    if (keepOut(x, z)) continue;
    // Walnut Creek gets a ribbon of big bank trees; the rest is oak + cedar scrub.
    const y = groundHeight(x, z) - 0.04;
    if (y < -2) continue;
    if (kind < 0.42) {
      b.cyl('solid', '#4a3a2c', 0.16 * s, 0.24 * s, 2.2 * s, x, y + 1.1 * s, z, 6);
      b.blob('solid', OAK[i % OAK.length], 2.5 * s, x, y + 3.2 * s, z, 0.72);
    } else if (kind < 0.8) {
      b.cyl('solid', '#3d3026', 0.1 * s, 0.14 * s, 1.0 * s, x, y + 0.5 * s, z, 5);
      b.cyl('solid', CEDAR[i % CEDAR.length], 0.05, 1.5 * s, 4.2 * s, x, y + 2.8 * s, z, 7);
    } else {
      b.blob('solid', '#6e8a4e', 1.1 * s, x, y + 0.6 * s, z, 0.7); // scrub
    }
  }
  // Cypress along the creek banks.
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? -1 : 1;
    const x = MID + (i % 4 < 2 ? -1 : 1) * (CLEAR + 6 + rnd() * 90);
    const z = (side < 0 ? CREEK.z0 - 6.5 : CREEK.z1 + 6.5) + (rnd() - 0.5) * 2;
    const s = 1.1 + rnd() * 0.6;
    b.cyl('solid', '#4a3a2c', 0.2 * s, 0.3 * s, 3 * s, x, 1.5 * s, z, 6);
    b.blob('solid', '#3c6d43', 2.2 * s, x, 4.6 * s, z, 1.25);
  }

  // ------------------------------------------- leaving Avery Ranch (z<100) --
  // West: a long cedar fence with rooftops behind. East: pasture.
  const bf = BACK_FENCE;
  b.box('solid', '#9a7a55', 0.14, 1.9, bf.z1 - bf.z0, bf.x, 0.95, (bf.z0 + bf.z1) / 2);
  for (let z = bf.z0 + 9; z < bf.z1 - 6; z += 17) {
    const w = 11 + rnd() * 3, wall = ['#d9cdb8', '#c9b8a0', '#b9a58c', '#d4c4b0'][Math.floor(rnd() * 4)];
    const hx = bf.x - 11 - rnd() * 3;
    b.box('solid', wall, w, 5.4, 12, hx, 2.7, z);
    b.cyl('solid', ['#5a4a42', '#6b5446', '#4d4a48'][Math.floor(rnd() * 3)], 0, 10.4, 3.2, hx, 7, z, 4, 0, 0, Math.PI / 4);
    b.box('solid', '#e9e4d8', 1.1, 1.3, 0.1, hx + w / 2 + 0.03, 3.9, z - 2.5, Math.PI / 2);
    b.box('solid', '#e9e4d8', 1.1, 1.3, 0.1, hx + w / 2 + 0.03, 3.9, z + 2.5, Math.PI / 2);
  }
  // Pasture: wire fence, a windmill, cows.
  for (let z = -14; z < 96; z += 5.5) b.box('solid', '#7a6a55', 0.1, 1.2, 0.1, MID + 15, 0.6, z);
  for (const y of [0.5, 0.85, 1.15]) b.box('solid', '#8a8a86', 0.03, 0.03, 110, MID + 15, y, 41);
  const wx = MID + 34, wz = 30;
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    b.box('solid', '#8b9399', 0.09, 9.2, 0.09, wx + dx * 0.55, 4.5, wz + dz * 0.55, 0, dz * 0.1, -dx * 0.1);
  }
  b.box('solid', '#8b9399', 0.5, 0.5, 0.5, wx, 9.2, wz);
  for (let k = 0; k < 8; k++) b.box('solid', '#c9cfd4', 0.5, 2.3, 0.05, wx, 9.2, wz - 0.4, 0, 0, (k / 8) * Math.PI * 2);
  b.box('solid', '#b7b0a0', 3.4, 0.9, 3.4, wx + 3.4, 0.45, wz + 1);                    // stock tank
  b.box('solid', '#5f97b8', 3.0, 0.05, 3.0, wx + 3.4, 0.9, wz + 1);
  for (let k = 0; k < 7; k++) {
    const cx = MID + 22 + rnd() * 30, cz = 4 + rnd() * 80, ry = rnd() * Math.PI * 2;
    const hide = rnd() < 0.5 ? '#6b3e26' : '#e8e2d6';
    b.box('solid', hide, 0.75, 0.85, 1.9, cx, 1.05, cz, ry);
    b.box('solid', hide, 0.5, 0.5, 0.6, cx - Math.sin(ry) * 1.15, 1.2, cz - Math.cos(ry) * 1.15, ry);
    for (const [lx, lz] of [[-0.25, -0.7], [0.25, -0.7], [-0.25, 0.7], [0.25, 0.7]]) {
      b.box('solid', '#3a2a20', 0.16, 0.65, 0.16, cx + lx * Math.cos(ry) + lz * Math.sin(ry), 0.33, cz - lx * Math.sin(ry) + lz * Math.cos(ry));
    }
  }

  // ------------------------------------------------ lineside furniture --
  // Telegraph poles down the east side, and signals.
  for (let z = -30; z < 560; z += 28) {
    if ((z > SH45.z0 - 8 && z < SH45.z1 + 8) || (z > CREEK.z0 - 8 && z < CREEK.z1 + 8)) continue;
    if (Math.abs(z - LAKELINE_Z) < 22 || (z > MOPAC.z0 - 4 && z < MOPAC.z1 + 4)) continue;
    b.cyl('solid', '#5b4a3a', 0.1, 0.13, 8, MID + CLEAR + 0.6, 4, z, 6);
    b.box('solid', '#5b4a3a', 2.0, 0.12, 0.12, MID + CLEAR + 0.6, 7.5, z);
  }
  for (const [z, x] of [[-34, RAIL_X - 2.4], [118, RAIL_X_B + 2.4], [212, RAIL_X - 2.4], [420, RAIL_X_B + 2.4], [562, RAIL_X - 2.4]] as [number, number][]) {
    b.cyl('solid', '#3a3f45', 0.07, 0.09, 4.6, x, 2.3, z, 8);
    b.box('solid', '#16181b', 0.5, 1.2, 0.3, x, 4.4, z);
    b.box('glow', '#35e06a', 0.2, 0.2, 0.06, x, 4.7, z + 0.17);
    b.box('glow', '#35e06a', 0.2, 0.2, 0.06, x, 4.7, z - 0.17);
  }

  // ---------------------------------------- Lakeline Blvd + Parmer Lane --
  for (const [z, w] of [[LAKELINE_BLVD_Z, 11], [PARMER_Z, 13]] as [number, number][]) {
    for (const [x0, x1] of [[-236, RAIL_X - 4.6], [RAIL_X_B + 4.6, -104]]) {
      b.box('solid', '#4d525b', x1 - x0, 0.04, w, (x0 + x1) / 2, 0.02, z);
      b.box('solid', '#e2c23e', x1 - x0, 0.045, 0.22, (x0 + x1) / 2, 0.025, z);
      b.box('solid', '#cfc9bc', x1 - x0, 0.06, 1.4, (x0 + x1) / 2, 0.03, z - w / 2 - 0.7);
      b.box('solid', '#cfc9bc', x1 - x0, 0.06, 1.4, (x0 + x1) / 2, 0.03, z + w / 2 + 0.7);
    }
  }
  // A couple of cars waiting short of the gates (pulled well back).
  car(b, RAIL_X_B + 16, 0, LAKELINE_BLVD_Z - 2.6, CAR_COLORS[2], Math.PI / 2);
  car(b, RAIL_X - 15, 0, PARMER_Z + 3.2, CAR_COLORS[4], -Math.PI / 2);
  car(b, RAIL_X - 21.5, 0, PARMER_Z + 3.2, CAR_COLORS[0], -Math.PI / 2);

  // ------------------------------------------------- park & ride lots --
  for (const lot of LOTS) {
    const w = lot.x1 - lot.x0, d = lot.z1 - lot.z0, cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
    b.box('solid', '#4a4f57', w, 0.04, d, cx, 0.02, cz);
    // Rows of parking: two double rows, cars nose-in.
    for (const rowX of [lot.x0 + 9, lot.x0 + 15.5, lot.x0 + 31, lot.x0 + 37.5]) {
      for (let z = lot.z0 + 3; z < lot.z1 - 2; z += 2.9) {
        b.box('solid', '#e9e6dc', 5.2, 0.045, 0.1, rowX, 0.025, z - 1.45);
        if (rnd() < 0.62) car(b, rowX, 0, z, CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], Math.PI / 2);
      }
    }
    // A bus at the kerb by the platform, light poles, the sign.
    b.box('solid', '#f1f2f4', 2.6, 2.9, 11, lot.x0 + 3.2, 1.75, cz - 4);
    b.box('solid', '#1f5fae', 2.64, 0.5, 11.04, lot.x0 + 3.2, 0.9, cz - 4);
    b.box('solid', '#1c232c', 2.66, 0.9, 9.6, lot.x0 + 3.2, 2.35, cz - 4);
    for (const lz of [lot.z0 + 6, cz, lot.z1 - 6]) {
      b.cyl('solid', '#6b7078', 0.09, 0.12, 7.5, cx + 2, 3.75, lz, 8);
      b.box('glow', '#fff0c8', 1.4, 0.12, 0.4, cx + 2, 7.5, lz);
    }
    b.box('solid', '#16335c', 0.3, 1.5, 6.2, lot.x1 + 0.6, 2.4, cz);
    for (const pz of [-2.6, 2.6]) b.cyl('solid', '#6b7078', 0.08, 0.08, 1.8, lot.x1 + 0.6, 0.9, cz + pz, 6);
  }

  // --------------------------------------------- SH-45, down in its cut --
  const hy = SH45.y;
  for (const [x0, x1] of [[-700, 190]]) {
    b.box('solid', '#474c55', x1 - x0, 0.06, SH45.z1 - SH45.z0, (x0 + x1) / 2, hy + 0.03, (SH45.z0 + SH45.z1) / 2);
    b.box('solid', '#b8b4aa', x1 - x0, 0.8, 0.5, (x0 + x1) / 2, hy + 0.4, (SH45.z0 + SH45.z1) / 2);   // median barrier
    for (const lz of [SH45.z0 + 3.5, SH45.z1 - 3.5]) b.box('solid', '#e9e6dc', x1 - x0, 0.07, 0.14, (x0 + x1) / 2, hy + 0.04, lz);
  }
  // Rim fences (chain link reads as a pale rail at this distance).
  for (const cut of [SH45, CREEK]) {
    for (const z of [cut.z0 - 5.5, cut.z1 + 5.5]) {
      for (const [x0, x1] of [[MID - 150, MID - CLEAR], [MID + CLEAR, MID + 150]]) {
        b.box('solid', '#9aa3a8', x1 - x0, 0.05, 0.05, (x0 + x1) / 2, 1.3, z);
        b.box('solid', '#9aa3a8', x1 - x0, 0.05, 0.05, (x0 + x1) / 2, 0.7, z);
        for (let x = x0; x <= x1; x += 6) b.box('solid', '#8a9399', 0.07, 1.35, 0.07, x, 0.68, z);
      }
    }
  }
  // Walnut Creek water.
  b.box('water', '#5f97b8', 890, 0.05, CREEK.z1 - CREEK.z0 + 1.5, -255, CREEK.y + 0.25, (CREEK.z0 + CREEK.z1) / 2);

  // ------------------------------------------------------- the quarry --
  const q = QUARRY, qy = q.y - 0.04;
  // Turquoise quarry pond, stock piles, the crusher and its conveyor.
  b.box('water', '#3fb6b2', 46, 0.05, 26, q.x0 + 30, qy + 0.35, QUARRY_Z + 8);
  for (const [px, pz, r, h] of [[q.x1 - 22, QUARRY_Z - 12, 8, 6.5], [q.x1 - 38, QUARRY_Z - 6, 6.5, 5], [q.x1 - 16, QUARRY_Z + 12, 7, 5.6], [q.x1 - 46, QUARRY_Z + 16, 5, 4]]) {
    b.cyl('solid', '#ece6d6', 0.4, r, h, px, qy + h / 2, pz, 9);
  }
  const crx = q.x1 + 6, crz = QUARRY_Z - 16;
  b.box('solid', '#8e969c', 5, 9, 5, crx, 4.5, crz);
  b.box('solid', '#7c858b', 6, 1.2, 6, crx, 9.4, crz);
  b.box('solid', '#a9b0b5', 1.3, 0.5, 26, crx - 12, 1.0, crz + 9, Math.PI / 2 - 0.5, 0, 0);
  b.box('solid', '#a9b0b5', 1.3, 0.4, 24, crx - 10, -2.4, crz + 6, Math.PI / 2 + 0.25, 0.42, 0);
  b.cyl('solid', '#b5bcc1', 2.2, 2.2, 8, crx + 1, 4, crz + 9, 12);                        // lime silo
  b.cyl('solid', '#9aa1a6', 0.2, 2.2, 1.6, crx + 1, 8.8, crz + 9, 12);
  // Haul truck + loader on the pit floor.
  b.box('solid', '#e2a81e', 3.2, 2.2, 6.4, q.x1 - 30, qy + 2.0, QUARRY_Z + 2, 0.5);
  b.box('solid', '#e2a81e', 2.8, 1.5, 2.2, q.x1 - 32, qy + 3.2, QUARRY_Z - 1.6, 0.5);
  b.box('solid', '#1f2226', 3.4, 1.2, 5.6, q.x1 - 30, qy + 0.8, QUARRY_Z + 2, 0.5);
  b.box('solid', '#e2a81e', 2.6, 2.2, 4.2, q.x1 - 52, qy + 1.7, QUARRY_Z - 14, -0.8);
  b.box('solid', '#3a3d42', 3.0, 1.0, 1.6, q.x1 - 54.6, qy + 0.9, QUARRY_Z - 16.6, -0.8);
  // Rim fence.
  const m = 12;
  for (const z of [q.z0 - m, q.z1 + m]) b.box('solid', '#9aa3a8', q.x1 - q.x0 + 2 * m, 0.06, 0.06, (q.x0 + q.x1) / 2, 1.3, z);
  b.box('solid', '#9aa3a8', 0.06, 0.06, q.z1 - q.z0 + 2 * m, q.x1 + m, 1.3, (q.z0 + q.z1) / 2);
  for (let z = q.z0 - m; z <= q.z1 + m; z += 6) b.box('solid', '#8a9399', 0.08, 1.35, 0.08, q.x1 + m, 0.68, z);
  b.box('solid', '#f1ede2', 0.2, 1.5, 9, q.x1 + m + 0.2, 2.4, QUARRY_Z + 14);                 // company sign
  for (const pz of [-3.6, 3.6]) b.cyl('solid', '#6b7078', 0.08, 0.08, 1.8, q.x1 + m + 0.2, 0.9, QUARRY_Z + 14 + pz, 6);

  // ------------------------------------- McNeil junction freight sidings --
  for (const sx of SIDINGS) {
    b.box('solid', '#8d877c', 3.4, 0.05, YARD.z1 - YARD.z0 + 8, sx, 0.035, (YARD.z0 + YARD.z1) / 2);
    for (const dx of [-0.72, 0.72]) b.box('solid', '#8a8f96', 0.09, 0.14, YARD.z1 - YARD.z0 + 8, sx + dx, 0.2, (YARD.z0 + YARD.z1) / 2);
  }
  const wagon = (x: number, z: number, kind: number, color: string) => {
    b.box('solid', '#26292d', 2.5, 0.5, 11.4, x, 0.75, z);
    for (const bz of [-4, 4]) for (const wxo of [-0.72, 0.72]) b.cyl('solid', '#3a3d42', 0.42, 0.42, 0.12, x + wxo, 0.5, z + bz, 10, 0, Math.PI / 2);
    if (kind === 0) b.box('solid', color, 2.9, 3.0, 11.6, x, 2.5, z);                                   // boxcar
    else if (kind === 1) {                                                                             // tank car
      b.cyl('solid', color, 1.35, 1.35, 10.6, x, 2.4, z, 12, Math.PI / 2);
      b.cyl('solid', '#3a3d42', 0.4, 0.4, 0.6, x, 4.0, z, 8);
    } else if (kind === 2) {                                                                           // covered hopper
      b.box('solid', color, 2.9, 2.2, 11.2, x, 2.9, z);
      for (const hz of [-3.4, 0, 3.4]) b.cyl('solid', color, 1.9, 0.6, 1.2, x, 1.5, z + hz, 4, 0, 0, Math.PI / 4);
    } else {                                                                                           // locomotive
      b.box('solid', '#e7b622', 2.6, 2.0, 11.4, x, 2.0, z);
      b.box('solid', '#e7b622', 2.9, 1.5, 2.6, x, 3.5, z + 3.6);
      b.box('solid', '#565c63', 2.5, 0.4, 7.4, x, 3.2, z - 1.6);
      b.box('solid', '#1c232c', 2.92, 0.7, 1.9, x, 3.7, z + 3.6);
      b.box('solid', '#b12a22', 2.62, 0.3, 11.42, x, 1.2, z);
    }
  };
  const rake: [number, string][][] = [
    [[3, ''], [2, '#b9b3a4'], [2, '#a9a394'], [1, '#22262b'], [0, '#7c3a2a']],
    [[0, '#2f5f8f'], [1, '#e9e6dc'], [2, '#8d8577'], [0, '#c9a227']],
  ];
  SIDINGS.forEach((sx, si) => rake[si].forEach(([k, c], n) => wagon(sx, YARD.z1 - 8 - n * 12.3, k, c)));
  b.box('solid', '#16335c', 0.3, 1.3, 5.4, SIDINGS[1] + 4, 2.3, YARD.z0 + 4);
  for (const pz of [-2.2, 2.2]) b.cyl('solid', '#6b7078', 0.08, 0.08, 1.7, SIDINGS[1] + 4, 0.85, YARD.z0 + 4 + pz, 6);

  // ------------------------------------------------- MoPac, overhead --
  const my = MOPAC.y, mw = MOPAC.z1 - MOPAC.z0, mz = (MOPAC.z0 + MOPAC.z1) / 2;
  b.box('solid', '#b9b5aa', 760, 1.3, mw, -210, my - 0.65, mz);
  b.box('solid', '#474c55', 760, 0.06, mw - 1.2, -210, my + 0.03, mz);
  for (const pz of [MOPAC.z0 + 0.25, MOPAC.z1 - 0.25, mz]) b.box('solid', '#c9c5ba', 760, 0.9, 0.4, -210, my + 0.45, pz);
  for (let x = -560; x <= 140; x += 30) {
    if (Math.abs(x - MID) < CLEAR + 2) continue;
    for (const pz of [MOPAC.z0 + 3.5, MOPAC.z1 - 3.5]) b.cyl('solid', '#b5b0a4', 0.9, 0.9, my - 1.3, x, (my - 1.3) / 2, pz, 10);
    b.box('solid', '#b5b0a4', 1.8, 1.0, mw - 3, x, my - 1.8, mz);
  }
  // The big green sign riders see as they roll up to it.
  b.box('solid', '#1f6b45', 9, 2.6, 0.2, MID, my + 3.0, MOPAC.z0 - 0.4);
  for (const px of [-4.2, 4.2]) b.box('solid', '#7a8086', 0.2, 2.2, 0.2, MID + px, my + 1.1, MOPAC.z0 - 0.4);

  return b.build();
}

/** Cars on SH-45 (below) and MoPac (above): one instanced mesh, looped. */
const TRAFFIC = (() => {
  const r = rng32(77);
  const list: { road: 0 | 1; lane: number; dir: 1 | -1; speed: number; phase: number; color: string }[] = [];
  for (let i = 0; i < 26; i++) {
    const road = (i % 2) as 0 | 1;
    const dir = (i % 4 < 2 ? 1 : -1) as 1 | -1;
    list.push({ road, lane: r() < 0.5 ? 0 : 1, dir, speed: 17 + r() * 9, phase: r() * 700, color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] });
  }
  return list;
})();

function Traffic() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    TRAFFIC.forEach((t, i) => m.setColorAt(i, c.set(t.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const SPAN = 700, X0 = MID - 350;
    TRAFFIC.forEach((c, i) => {
      const u = (((c.phase + t * c.speed) % SPAN) + SPAN) % SPAN;
      const x = c.dir > 0 ? X0 + u : X0 + SPAN - u;
      const road = c.road === 0 ? SH45 : MOPAC;
      const mid = (road.z0 + road.z1) / 2;
      // Keep right: eastbound on the south side, westbound on the north.
      const z = mid + c.dir * (2.2 + c.lane * 3.4);
      o.position.set(x, road.y + 0.75, z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, TRAFFIC.length]} frustumCulled={false}>
      <boxGeometry args={[4.3, 1.35, 1.85]} />
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
}

function Sign({ x, y, z, ry, text, size = 0.5, color = '#ffffff', width }: { x: number; y: number; z: number; ry: number; text: string; size?: number; color?: string; width?: number }) {
  return (
    <Text position={[x, y, z]} rotation={[0, ry, 0]} fontSize={size} color={color} anchorX="center" anchorY="middle" letterSpacing={0.05} maxWidth={width} textAlign="center">
      {text}
    </Text>
  );
}

export function Corridor() {
  const geo = useMemo(() => buildCorridor(), []);
  const mats = useMemo(() => ({
    solid: paint(0.9),
    glow: glowPaint(0.5),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.3 }),
  }), []);
  useFrame(() => {
    const sky = useSkyStore.getState();
    const on = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    mats.glow.emissiveIntensity = 0.9 + 2.4 * on;
  });
  const q = QUARRY;
  return (
    <group>
      <mesh geometry={geo.solid} material={mats.solid} castShadow receiveShadow />
      <mesh geometry={geo.glow} material={mats.glow} />
      <mesh geometry={geo.water} material={mats.water} />
      <Traffic />
      {/* Signs facing the track (west of the line faces east, and vice versa). */}
      {LOTS.map((l) => (
        <Sign key={l.name} x={l.x1 + 0.44} y={2.4} z={(l.z0 + l.z1) / 2} ry={Math.PI / 2} text={l.name} size={0.4} width={5.8} />
      ))}
      {LOTS.map((l) => (
        <Sign key={`${l.name}w`} x={l.x1 + 0.76} y={2.4} z={(l.z0 + l.z1) / 2} ry={-Math.PI / 2} text={l.name} size={0.4} width={5.8} />
      ))}
      <Sign x={q.x1 + 12.32} y={2.4} z={QUARRY_Z + 14} ry={Math.PI / 2} text={'AUSTIN WHITE LIME\nMcNeil quarry · est. 1888'} size={0.5} color="#2a3b4f" width={8.6} />
      <Sign x={SIDINGS[1] + 3.84} y={2.3} z={YARD.z0 + 4} ry={-Math.PI / 2} text={'McNEIL\nJUNCTION'} size={0.48} width={5} />
      <Sign x={MID} y={MOPAC.y + 3.3} z={MOPAC.z0 - 0.52} ry={Math.PI} text="The Domain" size={0.95} />
      <Sign x={MID} y={MOPAC.y + 2.3} z={MOPAC.z0 - 0.52} ry={Math.PI} text="NEXT STOP  ·  MoPac Expressway" size={0.42} color="#e9f5ec" />
    </group>
  );
}
