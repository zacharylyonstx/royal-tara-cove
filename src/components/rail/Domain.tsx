import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  BURNET, PLAZA, STREET, LAWN, FOUNTAIN, SHOPS, SHOP_DEPTH, TOWERS, LAWN_OAKS, STAGE, STAGE_Y, PLAY, TACO_TRUCK, PLANTERS,
  TREATS, WALK_Z, shopFront, type Shop,
} from '../../world/domain';
import { rng32 } from '../../world/corridor';
import { useZoneStore } from '../../state/zoneStore';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { LiveOak } from '../vegetation/LiveOak';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';
import { Batch, glowPaint, paint } from './batch';

// The Domain (layout + the real-world notes: world/domain.ts). Everything
// static is baked into four meshes: painted surfaces, dark window glass,
// windows that light up after dark, and the always-on glow (string lights).

const PAVER = '#cdbfa6';
const PAVER_DARK = '#b7a78c';
const ASPHALT = '#4a4f57';
const WALK = '#cfc9bc';
const GLASS = '#26323d';
const LIT = ['#ffd89a', '#ffe7b8', '#ffc978', '#fff1d0'];

function shopBuilding(b: Batch, s: Shop, rnd: () => number) {
  const f = shopFront(s.side);
  const w = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2;
  const H = 4.4 + s.floors * 3.1;
  const cz = f.z - f.face * SHOP_DEPTH / 2;
  const fz = (d: number) => f.z + f.face * d; // d metres out from the front wall
  b.box('solid', s.wall, w, H, SHOP_DEPTH, cx, H / 2, cz);
  b.box('solid', s.trim, w + 0.3, 0.5, SHOP_DEPTH + 0.3, cx, H + 0.25, cz);           // parapet
  b.box('solid', '#8e959b', 2.4, 1.2, 2.4, cx + 2, H + 1.1, cz);                       // rooftop unit
  // ---- shopfront: plate glass, a door, a fabric awning, the sign band ----
  b.box('solid', '#2a2f36', w - 0.6, 3.5, 0.16, cx, 1.85, fz(0.05));
  b.box('glass', GLASS, w - 1.4, 2.5, 0.1, cx, 1.75, fz(0.13));
  b.box('lit', LIT[Math.floor(rnd() * 4)], w - 1.6, 2.3, 0.04, cx, 1.75, fz(0.2));
  b.box('solid', s.trim, 1.5, 2.6, 0.12, cx, 1.35, fz(0.2));                           // door frame
  b.box('glass', GLASS, 1.2, 2.3, 0.1, cx, 1.3, fz(0.26));
  b.box('solid', s.awning, w - 0.8, 0.12, 2.0, cx, 3.55, fz(1.0), 0, f.face * 0.28);
  b.box('solid', s.awning, w - 0.8, 0.5, 0.08, cx, 3.02, fz(1.95));
  b.box('solid', s.trim, w - 1.2, 1.0, 0.14, cx, 4.35, fz(0.1));                       // sign band
  // ---- an end-of-row building shows its side: windows up there too ----
  const endX = s.x1 > -211 ? s.x1 : s.x0 < -290 ? s.x0 : null;
  if (endX !== null) {
    const out = endX === s.x1 ? 1 : -1;
    for (let fl = 0; fl < s.floors; fl++) {
      for (let c = 0; c < 5; c++) {
        const z = f.z - f.face * (c + 0.5) * (SHOP_DEPTH / 5), y = 6.3 + fl * 3.1;
        b.box('solid', s.trim, 0.1, 1.9, 2.0, endX + out * 0.04, y, z);
        b.box('glass', GLASS, 0.08, 1.6, 1.7, endX + out * 0.1, y, z);
        if (rnd() < 0.5) b.box('lit', LIT[Math.floor(rnd() * 4)], 0.03, 1.5, 1.6, endX + out * 0.16, y, z);
      }
    }
  }
  // ---- flats above: a grid of windows, some with balconies ----
  const cols = 4;
  for (let fl = 0; fl < s.floors; fl++) {
    const y = 6.3 + fl * 3.1;
    for (let c = 0; c < cols; c++) {
      const x = s.x0 + (c + 0.5) * (w / cols);
      b.box('solid', s.trim, 2.0, 1.9, 0.1, x, y, fz(0.04));
      b.box('glass', GLASS, 1.7, 1.6, 0.08, x, y, fz(0.1));
      if (rnd() < 0.55) b.box('lit', LIT[Math.floor(rnd() * 4)], 1.6, 1.5, 0.03, x, y, fz(0.16));
      if ((c + fl) % 3 === 0) {
        b.box('solid', '#3b4652', 2.3, 0.1, 1.0, x, y - 1.0, fz(0.5));
        b.box('solid', '#3b4652', 2.3, 0.9, 0.05, x, y - 0.5, fz(1.0));
      }
    }
  }
}

function tower(b: Batch, t: (typeof TOWERS)[number], rnd: () => number) {
  const w = t.x1 - t.x0, d = t.z1 - t.z0, cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
  if (t.garage) {
    // Parking garage: open decks stacked on columns.
    for (let y = 0; y <= t.h; y += 3) b.box('solid', t.frame, w, 0.9, d, cx, y + 0.45, cz);
    for (const x of [t.x0 + 0.5, cx, t.x1 - 0.5]) for (const z of [t.z0 + 0.5, t.z1 - 0.5]) b.box('solid', '#b3aea2', 0.9, t.h, 0.9, x, t.h / 2, z);
    b.box('solid', '#3a3f45', w - 2, t.h - 1, d - 2, cx, t.h / 2, cz);
    return;
  }
  b.box('solid', t.frame, w, t.h, d, cx, t.h / 2, cz);
  b.box('solid', '#8e959b', w * 0.4, 2.2, d * 0.4, cx, t.h + 1.1, cz);
  // Ribbon windows on all four faces, floor by floor.
  for (let y = 2.4; y < t.h - 1.2; y += 3.4) {
    b.box('glass', t.glass, w + 0.12, 2.1, d - 1.2, cx, y + 0.6, cz);
    b.box('glass', t.glass, w - 1.2, 2.1, d + 0.12, cx, y + 0.6, cz);
    // After dark some offices are still lit.
    for (const [fx, fz, lw, ld] of [[cx, t.z0 - 0.09, w, 0], [cx, t.z1 + 0.09, w, 0], [t.x0 - 0.09, cz, 0, d], [t.x1 + 0.09, cz, 0, d]] as [number, number, number, number][]) {
      const span = (lw || ld) - 2, n = Math.max(2, Math.floor(span / 4.5));
      for (let k = 0; k < n; k++) {
        if (rnd() > 0.34) continue;
        const o = -span / 2 + (k + 0.5) * (span / n);
        b.box('lit', LIT[Math.floor(rnd() * 4)], lw ? span / n - 0.4 : 0.04, 1.9, ld ? span / n - 0.4 : 0.04, fx + (lw ? o : 0), y + 0.6, fz + (ld ? o : 0));
      }
    }
  }
}

function buildDomain() {
  const b = new Batch();
  const rnd = rng32(512);
  const sz = STREET.z;

  // ------------------------------------------------------ ground planes --
  // Station plaza + the path from the crossing boards.
  b.box('solid', PAVER, PLAZA.x1 - PLAZA.x0, 0.05, PLAZA.z1 - PLAZA.z0, (PLAZA.x0 + PLAZA.x1) / 2, 0.025, (PLAZA.z0 + PLAZA.z1) / 2);
  b.box('solid', PAVER_DARK, PLAZA.x1 - PLAZA.x0, 0.055, 3.6, (PLAZA.x0 + PLAZA.x1) / 2, 0.028, WALK_Z);
  // Burnet Road: asphalt, kerb-side walks, lane lines, and the zebra crossing.
  const bw = BURNET.x1 - BURNET.x0, bl = BURNET.z1 - BURNET.z0, bcx = (BURNET.x0 + BURNET.x1) / 2, bcz = (BURNET.z0 + BURNET.z1) / 2;
  b.box('solid', ASPHALT, bw, 0.04, bl, bcx, 0.02, bcz);
  b.box('solid', WALK, 2, 0.07, bl, BURNET.x0 - 1, 0.035, bcz);
  b.box('solid', WALK, 2, 0.07, bl, BURNET.x1 + 1, 0.035, bcz);
  b.box('solid', '#e2c23e', 0.2, 0.045, bl, bcx - 0.2, 0.025, bcz);
  b.box('solid', '#e2c23e', 0.2, 0.045, bl, bcx + 0.2, 0.025, bcz);
  for (let x = BURNET.x0 + 0.9; x < BURNET.x1; x += 1.5) b.box('solid', '#f3f1e8', 0.8, 0.05, 4.2, x, 0.03, WALK_Z);
  for (const z of [WALK_Z - 3.4, WALK_Z + 3.4]) b.box('solid', '#f3f1e8', bw, 0.05, 0.4, bcx, 0.03, z);
  // Signals holding the traffic for the crosswalk (red for cars, WALK for you).
  for (const [x, z, s] of [[BURNET.x0 - 0.6, WALK_Z - 4.6, 1], [BURNET.x1 + 0.6, WALK_Z + 4.6, -1]] as [number, number, number][]) {
    b.cyl('solid', '#3a3f45', 0.1, 0.13, 6, x, 3, z, 8);
    b.box('solid', '#3a3f45', 0.14, 0.14, 5.4, x, 5.8, z + s * 2.6);
    b.box('solid', '#16181b', 0.45, 1.3, 0.4, x, 5.2, z + s * 5.0);
    b.box('glow', '#ff3b30', 0.3, 0.3, 0.06, x, 5.6, z + s * 5.0 + 0.22);
    b.box('glow', '#ff3b30', 0.3, 0.3, 0.06, x, 5.6, z + s * 5.0 - 0.22);
    b.box('solid', '#16181b', 0.5, 0.5, 0.2, x, 2.6, z);
    b.box('glow', '#f4f4f0', 0.06, 0.34, 0.3, x - s * 0.13 * (x < bcx ? -1 : 1), 2.6, z);
  }
  // Cars waiting at the stop line, parked ones, and a bus at its stop.
  const carAt = (x: number, z: number, color: string) => {
    b.box('solid', color, 1.85, 0.7, 4.2, x, 0.62, z);
    b.box('solid', '#20262d', 1.6, 0.55, 2.1, x, 1.22, z + 0.2);
  };
  carAt(bcx - 3, WALK_Z - 8.5, '#8c1f24'); carAt(bcx - 3, WALK_Z - 14.5, '#e9e4d6'); carAt(bcx + 3, WALK_Z + 8.5, '#35567e'); carAt(bcx + 3, WALK_Z + 15, '#4a4f55');
  b.box('solid', '#f1f2f4', 2.6, 2.9, 11, bcx + 3.6, 1.75, WALK_Z + 48);
  b.box('solid', '#1f5fae', 2.64, 0.5, 11.04, bcx + 3.6, 0.9, WALK_Z + 48);
  b.box('solid', '#1c232c', 2.66, 0.9, 9.6, bcx + 3.6, 2.35, WALK_Z + 48);
  // Street trees along Burnet.
  for (let z = BURNET.z0 + 8; z < BURNET.z1 - 4; z += 15) {
    if (Math.abs(z - WALK_Z) < 10) continue;
    for (const x of [BURNET.x0 - 3.2, BURNET.x1 + 3.2]) {
      b.cyl('solid', '#4a3a2c', 0.14, 0.2, 2.6, x, 1.3, z, 6);
      b.blob('solid', '#4a7a40', 2.1, x, 3.8, z, 0.85);
    }
  }
  // Rock Rose: pavers, a darker band down the middle.
  const sl = STREET.x1 - STREET.x0, scx = (STREET.x0 + STREET.x1) / 2;
  b.box('solid', PAVER, sl + 6, 0.05, STREET.half * 2, scx - 3, 0.025, sz);
  b.box('solid', PAVER_DARK, sl + 6, 0.055, 2.6, scx - 3, 0.028, sz);
  for (let x = STREET.x0 + 4; x < STREET.x1; x += 9) b.box('solid', PAVER_DARK, 0.3, 0.055, STREET.half * 2, x, 0.027, sz);

  // -------------------------------------------------------- the blocks --
  for (const s of SHOPS) shopBuilding(b, s, rnd);
  for (const t of TOWERS) tower(b, t, rnd);
  // The cinema's marquee and the burger place's little play fort.
  const cin = SHOPS.find((s) => s.id === 'cinema')!, cf = shopFront(cin.side), ccx = (cin.x0 + cin.x1) / 2;
  b.box('solid', '#b3262e', 9, 1.6, 3.0, ccx, 5.3, cf.z + cf.face * 1.5);
  for (let x = -4; x <= 4; x += 0.8) b.box('glow', '#ffe08a', 0.22, 0.22, 0.1, ccx + x, 4.62, cf.z + cf.face * 3.02);
  const bur = SHOPS.find((s) => s.id === 'burger')!, bf = shopFront(bur.side), bx = bur.x0 + 2.4, bzz = bf.z + bf.face * 3.4;
  b.box('solid', '#d9534f', 2.0, 0.14, 2.0, bx, 1.4, bzz);
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) b.box('solid', '#f0b429', 0.14, 2.6, 0.14, bx + dx, 1.3, bzz + dz);
  b.cyl('solid', '#3fae6a', 0, 1.7, 1.0, bx, 3.1, bzz, 4, 0, 0, Math.PI / 4);
  b.box('solid', '#4fc3c8', 0.8, 0.08, 2.6, bx + 1.5, 0.75, bzz, 0, 0, -0.5);            // slide

  // Murals on the two walls that face you as you cross Burnet Road.
  const sc = SHOPS.find((s) => s.id === 'scoops')!, ko = SHOPS.find((s) => s.id === 'kolache')!;
  b.box('solid', '#3fb6b2', 0.08, 3.4, 13, sc.x1 + 0.05, 2.3, sz - STREET.half - 9);
  for (let k = 0; k < 6; k++) b.box('solid', ['#f0b429', '#e86a92', '#f4efe6'][k % 3], 0.09, 0.3, 13, sc.x1 + 0.06, 0.85 + k * 0.58, sz - STREET.half - 9, 0, 0.0, 0);
  b.box('solid', '#3fb6b2', 0.1, 2.3, 10.6, sc.x1 + 0.07, 2.35, sz - STREET.half - 9);
  b.box('solid', '#f4efe6', 0.08, 3.6, 12.4, ko.x1 + 0.05, 2.4, sz + STREET.half + 9);

  // ---------------------------------------- street furniture + lights --
  for (const [x, dz] of PLANTERS) {
    const pz = sz + dz;
    b.box('solid', '#8a8378', 2, 0.9, 2, x, 0.45, pz);
    b.box('solid', '#5a4636', 1.7, 0.1, 1.7, x, 0.92, pz);
    b.cyl('solid', '#4a3a2c', 0.12, 0.16, 2.6, x, 2.2, pz, 6);
    b.blob('solid', '#4f8a45', 1.9, x, 4.3, pz, 0.9);
    for (const dx of [-3.2, 3.2]) {                                                    // benches either side
      b.box('solid', '#8a6a48', 1.8, 0.08, 0.5, x + dx, 0.46, pz);
      b.box('solid', '#5b6068', 0.08, 0.45, 0.45, x + dx - 0.7, 0.23, pz);
      b.box('solid', '#5b6068', 0.08, 0.45, 0.45, x + dx + 0.7, 0.23, pz);
    }
  }
  // String lights zig-zagging between poles down the length of the street.
  const poles: [number, number][] = [];
  for (let x = STREET.x1 - 3, k = 0; x > STREET.x0 + 2; x -= 10, k++) poles.push([x, sz + (k % 2 ? 1 : -1) * (STREET.half - 0.8)]);
  for (const [x, z] of poles) b.cyl('solid', '#2f343a', 0.07, 0.1, 6.4, x, 3.2, z, 8);
  for (let i = 0; i < poles.length - 1; i++) {
    const [ax, az] = poles[i], [cx2, cz2] = poles[i + 1];
    const len = Math.hypot(cx2 - ax, cz2 - az), ry = Math.atan2(cx2 - ax, cz2 - az);
    b.box('solid', '#1c1f23', 0.03, 0.03, len, (ax + cx2) / 2, 6.0, (az + cz2) / 2, ry);
    for (let k = 1; k < 12; k++) {
      const t = k / 12, sag = Math.sin(t * Math.PI) * 0.55;
      b.box('glow', LIT[k % 4], 0.16, 0.2, 0.16, ax + (cx2 - ax) * t, 5.92 - sag, az + (cz2 - az) * t);
    }
  }
  // Gateway arch where Rock Rose meets Burnet.
  for (const z of [sz - STREET.half + 0.6, sz + STREET.half - 0.6]) b.box('solid', '#3b4652', 0.5, 6.4, 0.5, STREET.x1 + 0.6, 3.2, z);
  b.box('solid', '#3b4652', 0.5, 1.5, STREET.half * 2 - 0.7, STREET.x1 + 0.6, 6.4, sz);

  // ------------------------------------------------------- station plaza --
  b.box('solid', '#16335c', 0.3, 2.6, 3.4, PLAZA.x1 - 0.4, 2.0, WALK_Z + 5.2);
  b.box('solid', '#c8102e', 0.32, 0.3, 3.4, PLAZA.x1 - 0.4, 3.45, WALK_Z + 5.2);
  for (const k of [0, 1, 2]) b.box('solid', '#5f7383', 0.06, 0.8, 0.9, PLAZA.x0 + 2.2 + k * 0.9, 0.4, WALK_Z + 9);
  b.box('solid', '#8a6a48', 0.5, 0.08, 1.9, PLAZA.x0 + 5.5, 0.46, WALK_Z + 9.5);
  // The taco truck.
  const tt = TACO_TRUCK;
  b.box('solid', '#f2a51e', 2.4, 2.5, 5.0, tt.x, 1.95, tt.z + 0.6);
  b.box('solid', '#e9e4d6', 2.3, 1.9, 1.7, tt.x, 1.55, tt.z - 2.6);
  b.box('solid', '#20262d', 2.32, 0.8, 1.2, tt.x, 2.0, tt.z - 2.9);
  b.box('solid', '#1c1f23', 2.2, 0.6, 6.6, tt.x, 0.5, tt.z);
  b.box('glass', GLASS, 0.1, 1.0, 2.6, tt.x - 1.21, 2.2, tt.z + 0.7);
  b.box('lit', LIT[0], 0.04, 0.9, 2.5, tt.x - 1.27, 2.2, tt.z + 0.7);
  b.box('solid', '#c8102e', 1.1, 0.08, 3.0, tt.x - 1.75, 3.0, tt.z + 0.7, 0, 0, 0.3);     // serving awning
  b.box('solid', '#8a8378', 0.7, 0.06, 2.8, tt.x - 1.5, 1.6, tt.z + 0.7);                // counter

  // --------------------------------------------------------- the Lawn --
  const lw = LAWN.x1 - LAWN.x0, ld = LAWN.z1 - LAWN.z0, lcx = (LAWN.x0 + LAWN.x1) / 2, lcz = (LAWN.z0 + LAWN.z1) / 2;
  b.box('solid', PAVER, lw + 6, 0.04, ld + 6, lcx, 0.02, lcz);
  b.box('solid', '#62a64c', lw, 0.07, ld, lcx, 0.035, lcz);
  b.box('solid', PAVER, 10, 0.075, 10, FOUNTAIN.x, 0.038, FOUNTAIN.z);                  // fountain court
  // Splash-pad fountain: a flush ring you can run straight through.
  b.cyl('solid', '#9fb7c2', FOUNTAIN.r, FOUNTAIN.r, 0.06, FOUNTAIN.x, 0.075, FOUNTAIN.z, 24);
  b.cyl('solid', '#6aa9c4', FOUNTAIN.r - 0.5, FOUNTAIN.r - 0.5, 0.07, FOUNTAIN.x, 0.08, FOUNTAIN.z, 24);
  // Stage with a timber shell (the deck is a real floor you can stand on).
  const st = STAGE;
  b.box('solid', '#a0764d', st.w, STAGE_Y, st.d, st.x, STAGE_Y / 2, st.z);
  b.box('solid', '#7a5636', 0.4, 5, st.d, st.x - st.w / 2 + 0.2, 2.5 + STAGE_Y, st.z);
  b.box('solid', '#e9e2d2', st.w + 1.2, 0.2, st.d + 1, st.x + 0.3, 5.3 + STAGE_Y, st.z, 0, 0, 0.16);
  for (const dz of [-st.d / 2 + 0.3, st.d / 2 - 0.3]) b.box('solid', '#7a5636', 0.3, 5.6, 0.3, st.x + st.w / 2 - 0.3, 2.8 + STAGE_Y, st.z + dz);
  for (let k = -4; k <= 4; k++) b.box('glow', LIT[(k + 4) % 4], 0.18, 0.18, 0.18, st.x + st.w / 2 - 0.3, 5.0 + STAGE_Y, st.z + k * 1.1);
  // The "flying carpet": a rippling red canopy on slim posts (after the real
  // sculpture at the end of Rock Rose).
  for (let k = 0; k < 9; k++) {
    const x = LAWN.x1 - 4 - k * 1.7, y = 4.6 + Math.sin(k * 0.9) * 0.7;
    b.box('solid', k % 2 ? '#d7372f' : '#f08a24', 1.75, 0.08, 7, x, y, lcz - 16, 0, 0, Math.cos(k * 0.9) * 0.34);
    if (k % 4 === 0) for (const dz of [-3.2, 3.2]) b.cyl('solid', '#5f7383', 0.06, 0.08, y, x, y / 2, lcz - 16 + dz, 6);
  }
  // Play mounds + stepping pods + spinning chairs (Century Oaks' play corner).
  for (const [dx, dz, r, c] of [[-6, 4, 2.2, '#3fb6b2'], [-9.5, 0.5, 1.7, '#f0b429'], [-5.5, -2, 1.4, '#e86a92']] as [number, number, number, string][]) {
    b.blob('solid', c, r, PLAY.x + dx, 0, PLAY.z + dz, 0.5);
  }
  for (let k = 0; k < 6; k++) b.cyl('solid', ['#e86a92', '#3fb6b2', '#f0b429'][k % 3], 0.45, 0.5, 0.25 + (k % 3) * 0.14, PLAY.x + 4 + k * 1.1, 0.13 + (k % 3) * 0.07, PLAY.z + 5 + Math.sin(k) * 0.8, 10);
  for (let k = 0; k < 4; k++) {
    const x = PLAY.x + 6 + (k % 2) * 2.2, z = PLAY.z - 4 - Math.floor(k / 2) * 2.2;
    b.cyl('solid', ['#d7372f', '#2e7fd0', '#3fae6a', '#f0b429'][k], 0.62, 0.16, 0.85, x, 0.5, z, 12, 0.32 * (k % 2 ? 1 : -1), 0.24);
  }
  // Picnic tables under the oaks + a stone fireplace.
  for (const [x, z] of [[-316, WALK_Z - 14], [-330, WALK_Z - 15], [-326, WALK_Z + 20]]) {
    b.box('solid', '#9b7a55', 1.9, 0.08, 0.8, x, 0.78, z);
    for (const dz of [-0.75, 0.75]) b.box('solid', '#9b7a55', 1.9, 0.07, 0.3, x, 0.46, z + dz);
    for (const dx of [-0.7, 0.7]) b.box('solid', '#6b5a48', 0.1, 0.78, 1.6, x + dx, 0.39, z);
  }
  b.box('solid', '#a39a8a', 2.6, 1.3, 1.1, LAWN.x0 + 6, 0.65, LAWN.z1 - 5);
  b.box('solid', '#8f8676', 1.2, 3.4, 0.9, LAWN.x0 + 6, 2.9, LAWN.z1 - 5);
  b.box('glow', '#ff8a2a', 1.3, 0.55, 0.1, LAWN.x0 + 6, 0.7, LAWN.z1 - 5.56);
  return b.build();
}

/** Splash-pad jets: a ring of water spouts that rise and fall in a wave. */
function FountainJets() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const N = 9;
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const a = (i / (N - 1)) * Math.PI * 2, r = i === N - 1 ? 0 : FOUNTAIN.r - 1.6;
      const h = (i === N - 1 ? 2.6 : 1.5) * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i * 0.7)));
      o.position.set(FOUNTAIN.x + Math.cos(a) * r, 0.1 + h / 2, FOUNTAIN.z + Math.sin(a) * r);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <cylinderGeometry args={[0.05, 0.13, 1, 8]} />
      <meshStandardMaterial color="#dff3fb" transparent opacity={0.72} roughness={0.1} depthWrite={false} />
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

export function Domain() {
  const geo = useMemo(() => buildDomain(), []);
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

  // Treat spots at the shop doors (same "E" + bubble as the ice-cream cart).
  useEffect(() => {
    const zs = useZoneStore.getState();
    for (const t of TREATS) zs.register({ id: t.id, kind: 'icecream', label: t.label, emoji: t.emoji, x: t.x, z: t.z, radius: 2.4 });
    return () => { for (const t of TREATS) useZoneStore.getState().unregister(t.id); };
  }, []);

  return (
    <group>
      <mesh geometry={geo.solid} material={mats.solid} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={mats.glass} />
      <mesh geometry={geo.lit} material={mats.lit} renderOrder={2} />
      <mesh geometry={geo.glow} material={mats.glow} />
      <FountainJets />
      {LAWN_OAKS.map(([x, z, s], i) => <LiveOak key={i} position={[x, 0, z]} scale={s} seed={i + 40} />)}
      <GLBModel url={MODELS.playground.url} fitHeight={MODELS.playground.fitHeight} position={[PLAY.x, 0, PLAY.z]} rotationY={0} />
      {/* Shop signs. */}
      {SHOPS.map((s) => {
        const f = shopFront(s.side), cx = (s.x0 + s.x1) / 2, ry = f.face > 0 ? 0 : Math.PI, ink = inkFor(s.trim);
        return (
          <group key={s.id}>
            <Label x={cx} y={4.48} z={f.z + f.face * 0.19} ry={ry} text={s.name} size={0.62} color={ink} width={11} />
            <Label x={cx} y={3.02} z={f.z + f.face * 2.0} ry={ry} text={s.sub} size={0.24} color={inkFor(s.awning)} width={11} />
          </group>
        );
      })}
      {/* The murals. */}
      <Label x={SHOPS[0].x1 + 0.14} y={2.75} z={STREET.z - STREET.half - 9} ry={Math.PI / 2} text="greetings from" size={0.62} color="#fffdf2" />
      <Label x={SHOPS[0].x1 + 0.14} y={1.85} z={STREET.z - STREET.half - 9} ry={Math.PI / 2} text="AUSTIN, TEXAS" size={1.05} color="#fffdf2" />
      <Label x={SHOPS[6].x1 + 0.11} y={2.5} z={STREET.z + STREET.half + 9} ry={Math.PI / 2} text={'i love you\nso much'} size={1.15} color="#c8102e" width={12} />
      {/* Gateway, station totem, stage, truck. */}
      <Label x={STREET.x1 + 0.87} y={6.45} z={STREET.z} ry={Math.PI / 2} text="ROCK ROSE" size={0.95} />
      <Label x={STREET.x1 + 0.33} y={6.45} z={STREET.z} ry={-Math.PI / 2} text="THE DOMAIN" size={0.9} />
      {[1, -1].map((sx) => (
        <group key={sx}>
          <Label x={PLAZA.x1 - 0.4 + sx * 0.17} y={2.75} z={WALK_Z + 5.2} ry={sx * Math.PI / 2} text="MetroRail" size={0.36} />
          <Label x={PLAZA.x1 - 0.4 + sx * 0.17} y={2.2} z={WALK_Z + 5.2} ry={sx * Math.PI / 2} text="THE DOMAIN" size={0.3} color="#ffd98a" />
          <Label x={PLAZA.x1 - 0.4 + sx * 0.17} y={1.55} z={WALK_Z + 5.2} ry={sx * Math.PI / 2} text={sx < 0 ? 'Shops + the Lawn\nacross Burnet Road  ➜' : 'Trains to Avery Ranch,\nDowntown + Bastrop'} size={0.2} width={3} />
        </group>
      ))}
      <Label x={STAGE.x - STAGE.w / 2 + 0.42} y={3.6 + STAGE_Y} z={STAGE.z} ry={Math.PI / 2} text="THE LAWN" size={0.9} color="#f4ead2" />
      <Label x={TACO_TRUCK.x - 1.22} y={3.0} z={TACO_TRUCK.z + 0.7} ry={-Math.PI / 2} text="TACOS" size={0.5} color="#7a1f12" />
      <Label x={(SHOPS[8].x0 + SHOPS[8].x1) / 2} y={5.3} z={STREET.z + STREET.half - 3.02} ry={Math.PI} text={'STARLIGHT\nNOW SHOWING · THE RED LINE'} size={0.42} color="#fff3c8" width={8.6} />
    </group>
  );
}
