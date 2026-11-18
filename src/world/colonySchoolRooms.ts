import {
  X, Z, FLOOR2, CEIL1, WALLS, MASSES, ROOMS, UPPER_SLABS, HALL, SPINE, WCOR, STAIR, STAGE, LOBBY, LIBRARY, DINING, GYM, KITCHEN,
  wallPieces, bandFor, type Room,
} from './colonySchool';
import { rng32 } from './corridor';
import type { RectCollider } from '../types';

// Colony Oaks Elementary — everything you see once you are through the doors:
// wall linings, floors, ceilings and lights, the stairs, and the furniture in
// every room. Written once as a "drawing program" so the renderer and the
// collider builder walk the same layout (the renderer draws the boxes, the
// collider builder only listens for the solid things).

export interface Kit {
  box(group: string, color: string, w: number, h: number, d: number, x: number, y: number, z: number, ry?: number, rx?: number, rz?: number): unknown;
  cyl(group: string, color: string, rTop: number, rBot: number, h: number, x: number, y: number, z: number, seg?: number, rx?: number, rz?: number, ry?: number): unknown;
  blob(group: string, color: string, r: number, x: number, y: number, z: number, sy?: number): unknown;
}
export interface SchoolLabel { text: string; x: number; y: number; z: number; ry: number; size: number; color: string; width?: number }
type Solid = (u0: number, u1: number, v0: number, v1: number, lvl: 0 | 1) => void;

const NAVY = '#1f2a5c', GREEN = '#35a84a', LIME = '#8fd62a';
const WALLC = '#f4f0e7', TRIM = '#c9c2b2', CEIL = '#f1efe9', WOOD = '#c99f6a', STEEL = '#b9bec4', DARK = '#2a2f36';
const BOOKS = ['#d0453a', '#e8a322', '#3d8f4f', '#2f6fb5', '#8a4fa8', '#e06a8c', '#2aa3a0', '#f0d24a'];
const PAPER = ['#ffe27a', '#ff9d7a', '#9fe3a1', '#9cc9ff', '#f5b6e2', '#ffffff'];
const CARPET: Record<string, string> = {
  prek: '#c9b98f', kinder: '#c7a79b', class: '#9aa9b8', art: '#b9b4a8', music: '#a99bb8', computer: '#8e96a8', life: '#b5bca0', club: '#b8a58f',
  reading: '#9bb0c4', work: '#b0aca3', flex: '#b9b29a', books: '#a8a093', science: '#a9b7ab', lgi: '#8d93a6', principal: '#8e96a8',
  conference: '#9aa0a8', lounge: '#b5ab97', reception: '#a3a9b4', clinic: '#c2cfd2', restroom: '#cfd6d8', office: '#a9b5a2',
};

export function drawSchoolInterior(k: Kit, solid: Solid, labels: SchoolLabel[]) {
  const rnd = rng32(90210);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  /** A box given by its corners (school metres + heights). */
  const B = (color: string, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, group = 'in') =>
    k.box(group, color, Math.abs(u1 - u0), y1 - y0, Math.abs(v1 - v0), X((u0 + u1) / 2), (y0 + y1) / 2, Z((v0 + v1) / 2));
  const label = (text: string, u: number, y: number, v: number, ry: number, size: number, color = '#ffffff', width?: number) =>
    labels.push({ text, x: X(u), y, z: Z(v), ry, size, color, width });

  // ------------------------------------------------ walls, inside faces ----
  for (const w of WALLS) {
    if (w.skin === 'glass') continue;
    const pieces = wallPieces(w);
    for (const [a0, a1, y0, y1] of pieces) {
      // Inside walls are drawn whole; outside walls get a lining on their inner face.
      const c0 = w.skin ? w.c - (w.out ?? 1) * (w.t / 2 + 0.05) : w.c - w.t / 2;
      const c1 = w.skin ? w.c - (w.out ?? 1) * (w.t / 2 - 0.01) : w.c + w.t / 2;
      if (w.ax === 'u') B(WALLC, a0, a1, y0, y1, c0, c1); else B(WALLC, c0, c1, y0, y1, a0, a1);
    }
    // A painted frame round every inside doorway.
    if (!w.skin) for (const o of w.open) {
      if (!o.door) continue;
      const e = w.t / 2 + 0.03, col = o.y1 - o.y0 > 3 ? TRIM : NAVY;
      for (const a of [o.a0, o.a1]) { if (w.ax === 'u') B(col, a - 0.06, a + 0.06, o.y0, o.y1, w.c - e, w.c + e); else B(col, w.c - e, w.c + e, o.y0, o.y1, a - 0.06, a + 0.06); }
      if (w.ax === 'u') B(col, o.a0, o.a1, o.y1 - 0.1, o.y1 + 0.04, w.c - e, w.c + e); else B(col, w.c - e, w.c + e, o.y1 - 0.1, o.y1 + 0.04, o.a0, o.a1);
    }
  }

  // ---------------------------------------- floors, slabs, ceilings, lights ----
  const lights = (u0: number, u1: number, v0: number, v1: number, y: number, step = 5) => {
    const nu = Math.max(1, Math.round((u1 - u0) / step)), nv = Math.max(1, Math.round((v1 - v0) / step));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u = u0 + ((u1 - u0) * (i + 0.5)) / nu, v = v0 + ((v1 - v0) * (j + 0.5)) / nv;
      B('#fffdf2', u - 0.6, u + 0.6, y - 0.04, y, v - 0.3, v + 0.3, 'lamp');
    }
  };
  for (const s of UPPER_SLABS) B(CEIL, s.u0, s.u1, CEIL1, FLOOR2, s.v0, s.v1);
  for (const m of MASSES) B(CEIL, m.u0 + 0.2, m.u1 - 0.2, m.h - 0.16, m.h - 0.1, m.v0 + 0.2, m.v1 - 0.2);
  // Corridor floors: pale terrazzo with a navy and a green stripe; upstairs, carpet tile.
  const hallFloor = (u0: number, u1: number, v0: number, v1: number, lvl: 0 | 1, along: 'u' | 'v', lit = true) => {
    const y = lvl ? FLOOR2 : 0, top = lvl ? 0.025 : 0.05;
    B(lvl ? '#b9bcc0' : '#ddd8cb', u0, u1, y, y + top, v0, v1);
    const c = along === 'u' ? (v0 + v1) / 2 : (u0 + u1) / 2;
    for (const [off, col] of [[-0.9, NAVY], [0.9, GREEN]] as [number, string][]) {
      if (along === 'u') B(col, u0, u1, y + top, y + top + 0.006, c + off - 0.09, c + off + 0.09);
      else B(col, c + off - 0.09, c + off + 0.09, y + top, y + top + 0.006, v0, v1);
    }
    if (lit) lights(u0, u1, v0, v1, lvl ? 8.84 : CEIL1 - 0.01, 6);
  };
  hallFloor(LOBBY.u0, SPINE.u0, HALL.v0, HALL.v1, 0, 'u', false);   // open to the roof here: its lights hang up there
  hallFloor(SPINE.u0, 128.4, HALL.v0, HALL.v1, 0, 'u');
  hallFloor(SPINE.u0, SPINE.u1, HALL.v1, 68.5, 0, 'v');
  hallFloor(0, SPINE.u0, WCOR.v0, WCOR.v1, 0, 'u');
  hallFloor(66, 128.4, HALL.v0, HALL.v1, 1, 'u');
  hallFloor(SPINE.u0, SPINE.u1, HALL.v0, WCOR.v1, 1, 'v');
  hallFloor(0, SPINE.u0, WCOR.v0, WCOR.v1, 1, 'u');
  hallFloor(60, 66, 10, HALL.v0, 1, 'v');

  // ------------------------------------------------------------ stairs ----
  {
    const n = 26, rise = FLOOR2 / n, run = (STAIR.vBot - STAIR.vTop) / n;
    for (let i = 0; i < n; i++) {
      const v1 = STAIR.vBot - i * run;
      B(i % 2 ? '#c9c5ba' : '#d6d2c6', STAIR.u0 + 0.2, STAIR.u1 - 0.2, 0, (i + 1) * rise, v1 - run, v1);
      B(NAVY, STAIR.u0 + 0.2, STAIR.u1 - 0.2, (i + 1) * rise, (i + 1) * rise + 0.012, v1 - 0.07, v1);
    }
    B('#ddd8cb', STAIR.u0, STAIR.u1, 0, 0.05, STAIR.vBot, 46);
    // Handrails, and a green rail down the middle.
    const len = Math.hypot(STAIR.vBot - STAIR.vTop, FLOOR2), tilt = Math.atan2(FLOOR2, STAIR.vBot - STAIR.vTop);
    for (const [u, col] of [[STAIR.u0 + 0.32, STEEL], [STAIR.u1 - 0.32, STEEL], [(STAIR.u0 + STAIR.u1) / 2, GREEN]] as [number, string][]) {
      k.box('in', col, 0.07, 0.07, len, X(u), FLOOR2 / 2 + 1.0, Z((STAIR.vBot + STAIR.vTop) / 2), 0, tilt);
      for (let t = 0.5; t < 12; t += 1.5) B(col, u - 0.03, u + 0.03, (t / 12) * FLOOR2, (t / 12) * FLOOR2 + 1.0, STAIR.vBot - t - 0.03, STAIR.vBot - t + 0.03);
    }
    label('UPSTAIRS: 2nd - 5th Grade · Science', 66 - 0.14, 3.55, 45, -Math.PI / 2, 0.24, NAVY, 1.9);
    lights(STAIR.u0, STAIR.u1, STAIR.vTop, 46, 8.84, 6);
    // The bridge's railing, looking down into the library.
    for (let v = HALL.v0 + 0.1; v <= 41; v += 1.26) B(DARK, SPINE.u0 - 0.04, SPINE.u0 + 0.04, FLOOR2, FLOOR2 + 1.15, v - 0.04, v + 0.04);
    B(GREEN, SPINE.u0 - 0.06, SPINE.u0 + 0.06, FLOOR2 + 1.12, FLOOR2 + 1.2, HALL.v0, 41);
    B('#9fc4d8', SPINE.u0 - 0.015, SPINE.u0 + 0.015, FLOOR2 + 0.1, FLOOR2 + 1.1, HALL.v0, 41, 'pane');
    B(NAVY, SPINE.u0 - 0.1, SPINE.u0 + 0.02, CEIL1, FLOOR2 + 0.02, HALL.v0, 41);
  }

  // ------------------------------------------------------------- rooms ----
  for (const r of ROOMS) room(r);

  function room(r: Room) {
    const horiz = r.cor === 'n' || r.cor === 's';
    const W = horiz ? r.u1 - r.u0 : r.v1 - r.v0, D = horiz ? r.v1 - r.v0 : r.u1 - r.u0;
    const y0 = r.lvl ? FLOOR2 + 0.025 : 0.05;
    const pt = (a: number, d: number): [number, number] =>
      r.cor === 's' ? [r.u0 + a, r.v1 - d] : r.cor === 'n' ? [r.u0 + a, r.v0 + d] : r.cor === 'e' ? [r.u1 - d, r.v0 + a] : [r.u0 + d, r.v0 + a];
    /** A box: `wa` wide along the door wall, `wd` deep, centred at (a, d), sitting `y` above the floor. */
    const box = (color: string, wa: number, h: number, wd: number, a: number, y: number, d: number, group = 'in') => {
      const [u, v] = pt(a, d);
      k.box(group, color, horiz ? wa : wd, h, horiz ? wd : wa, X(u), y0 + y + h / 2, Z(v));
    };
    const cyl = (color: string, rad: number, h: number, a: number, y: number, d: number, seg = 10, rTop = rad) => {
      const [u, v] = pt(a, d);
      k.cyl('in', color, rTop, rad, h, X(u), y0 + y + h / 2, Z(v), seg);
    };
    const block = (wa: number, wd: number, a: number, d: number) => {
      const [u0, v0] = pt(a - wa / 2, d - wd / 2), [u1, v1] = pt(a + wa / 2, d + wd / 2);
      solid(u0, u1, v0, v1, r.lvl);
    };
    const tint = r.color;

    // Floor finish, ceiling lights, and the sign beside the door.
    B(CARPET[r.kind] ?? '#a9a9a9', r.u0, r.u1, y0 - (r.lvl ? 0.025 : 0.05), y0, r.v0, r.v1);
    lights(r.u0 + 0.5, r.u1 - 0.5, r.v0 + 0.5, r.v1 - 0.5, r.lvl ? 8.84 : CEIL1 - 0.01, 5.5);
    {
      const signAt = (horiz ? r.doorAt - r.u0 : r.doorAt - r.v0) + (r.kind === 'lgi' ? 2.3 : 1.75);
      const [u, v] = pt(signAt, -0.14);
      const ry = r.cor === 's' ? 0 : r.cor === 'n' ? Math.PI : r.cor === 'e' ? Math.PI / 2 : -Math.PI / 2;
      box(tint, 1.5, 0.5, 0.03, signAt, 1.55, -0.12);
      labels.push({ text: r.name, x: X(u), y: y0 + 1.8, z: Z(v), ry, size: r.name.length > 12 ? 0.15 : 0.21, color: '#ffffff', width: 1.4 });
    }

    // ---- shared pieces ----
    const chair = (a: number, d: number, color: string, h = 0.4) => { box(color, 0.36, h, 0.36, a, 0, d); };
    const pod = (a: number, d: number, color: string, th = 0.64) => {
      box('#e9e2d0', 1.5, 0.06, 1.0, a, th, d); box('#8d9297', 0.9, th, 0.4, a, 0, d);
      for (const sa of [-0.42, 0.42]) for (const sd of [-0.74, 0.74]) chair(a + sa, d + sd, color, th * 0.62);
      box(pick(PAPER), 0.3, 0.012, 0.22, a - 0.3, th + 0.06, d + 0.2); box(pick(BOOKS), 0.24, 0.04, 0.18, a + 0.35, th + 0.06, d - 0.2);
      block(1.5, 1.0, a, d);
    };
    /** Bookshelf against the wall at the far (a = W) or near (a = 0) end. */
    const shelfEnd = (far: boolean, d: number, len: number, h = 1.4) => {
      const a = far ? W - 0.32 : 0.32;
      box(WOOD, 0.4, h, len, a, 0, d);
      for (let y = 0.12; y < h - 0.25; y += 0.42) for (let t = -len / 2 + 0.2; t < len / 2 - 0.15; t += 0.36)
        box(pick(BOOKS), 0.06, 0.3, 0.3, a + (far ? -0.21 : 0.21), y, t + d);
      block(0.5, len, a, d);
    };
    /** Something long against the door wall or the window wall. */
    const along = (window: boolean, a: number, len: number, h: number, color: string, depth = 0.5) => {
      const d = window ? D - depth / 2 - 0.2 : depth / 2 + 0.16;
      box(color, len, h, depth, a, 0, d);
      block(len, depth, a, d);
      return d;
    };
    const board = (far: boolean, d: number, len = 4.2) => {
      const a = far ? W - 0.14 : 0.14;
      box('#8d9297', 0.05, 1.42, len + 0.14, a, 0.93, d); box('#fbfbf8', 0.07, 1.28, len, a, 1.0, d);
      box('#8d9297', 0.14, 0.04, len, a + (far ? -0.06 : 0.06), 0.93, d);
    };
    const paperWall = (far: boolean, d: number, len: number, y = 1.2) => {
      const a = far ? W - 0.13 : 0.13;
      box('#c8a97a', 0.04, 1.2, len, a, y, d);
      for (let t = -len / 2 + 0.3; t < len / 2 - 0.2; t += 0.52) for (const yy of [y + 0.12, y + 0.66]) box(pick(PAPER), 0.05, 0.4, 0.36, a, yy, d + t);
    };
    const cubbies = (a: number, len: number) => {
      const d = along(false, a, len, 1.25, '#dcc39a', 0.42);
      for (let t = -len / 2 + 0.25; t < len / 2 - 0.1; t += 0.5) for (const y of [0.15, 0.72]) box(pick(BOOKS), 0.36, 0.34, 0.1, a + t, y, d + 0.19);
    };
    const teacherDesk = (a: number, d: number) => {
      box(WOOD, 1.6, 0.05, 0.8, a, 0.74, d); box('#9c7a4e', 1.5, 0.74, 0.7, a, 0, d);
      box(DARK, 0.42, 0.28, 0.03, a - 0.3, 0.8, d); box('#e8e8e8', 0.3, 0.02, 0.22, a + 0.35, 0.8, d); box('#c23b2e', 0.1, 0.1, 0.1, a + 0.62, 0.8, d - 0.2);
      chair(a, d + 0.75, DARK, 0.5);
      block(1.6, 0.8, a, d);
    };
    const rug = (a: number, d: number, wa: number, wd: number, cols: string[]) => {
      cols.forEach((c, i) => box(c, wa - i * 0.5, 0.012 + i * 0.004, wd - i * 0.5, a, 0, d));
    };
    const plant = (a: number, d: number, h = 1.1) => { cyl('#b5633c', 0.2, 0.36, a, 0, d, 8, 0.25); const [u, v] = pt(a, d); k.blob('in', '#3f8f4a', h * 0.34, X(u), y0 + 0.36 + h * 0.34, Z(v), 1.25); };
    const sofa = (a: number, d: number, len: number, color: string, facingIn = true) => {
      box(color, len, 0.42, 0.85, a, 0, d); box(color, len, 0.5, 0.22, a, 0.42, d + (facingIn ? -0.32 : 0.32));
      block(len, 0.85, a, d);
    };
    const beanbag = (a: number, d: number, color: string) => { const [u, v] = pt(a, d); k.blob('in', color, 0.48, X(u), y0 + 0.3, Z(v), 0.66); };
    const tableWithChairs = (a: number, d: number, la: number, ld: number, color: string, seatCol: string, th = 0.72) => {
      box(color, la, 0.06, ld, a, th, d); box('#7c8188', la * 0.5, th, ld * 0.4, a, 0, d);
      const longA = la >= ld, n = Math.max(1, Math.round((longA ? la : ld) / 0.75));
      for (let i = 0; i < n; i++) {
        const t = -((longA ? la : ld) / 2) + ((longA ? la : ld) * (i + 0.5)) / n;
        for (const s of [-1, 1]) { if (longA) chair(a + t, d + s * (ld / 2 + 0.3), seatCol, 0.44); else chair(a + s * (la / 2 + 0.3), d + t, seatCol, 0.44); }
      }
      block(la, ld, a, d);
    };

    switch (r.kind) {
      case 'class': case 'prek': case 'kinder': {
        const little = r.kind !== 'class';
        const cols = little ? ['#e0533c', '#f2b632', '#35a84a', '#2f7fd1'] : [tint];
        // The board (and a smart screen) on the wall furthest from the door; the alphabet over it.
        board(true, D / 2);
        box(DARK, 0.06, 0.95, 1.6, W - 0.15, 1.1, D / 2 + 3.3); box('#3b6ea8', 0.05, 0.85, 1.5, W - 0.2, 1.15, D / 2 + 3.3);
        if (little || r.name.startsWith('1st') || r.name.startsWith('2nd'))
          for (let i = 0; i < 13; i++) box(BOOKS[i % BOOKS.length], 0.04, 0.28, 0.28, W - 0.13, 2.5, D / 2 - 2 + i * 0.33);
        rug(W - 2.0, D / 2, 2.4, 3.8, little ? ['#2f7fd1', '#f2b632', '#e0533c', '#35a84a'] : [tint, '#e9e2d0']);
        const das = W > 10.5 ? [3.1, 5.9] : [2.9, 5.3];   // (clear of the doorway)
        const dds = little ? [3.6, 7.0] : [3.4, 6.5, 9.6];
        for (const a of das) for (const d of dds) pod(a, d, pick(cols), little ? 0.5 : 0.64);
        teacherDesk(W - 1.7, D - 1.6);
        cubbies(W / 2 + 1.6, W - 4.6);
        const cd = along(true, W / 2 - 1.6, W - 5.5, 0.8, '#e6e0d2', 0.5);
        box(WOOD, W - 5.4, 0.05, 0.56, W / 2 - 1.6, 0.8, cd);
        plant(1.2, cd, 0.7); box('#2f7fd1', 0.3, 0.3, 0.3, W / 2 - 1, 0.85, cd); box(pick(BOOKS), 0.5, 0.2, 0.3, W / 2 - 3, 0.85, cd);
        shelfEnd(false, D / 2 + 2.6, 3.2);
        paperWall(false, D / 2 - 2.2, 2.6);
        if (little) {
          // Play corner: a toy kitchen, a block tower, a little tent.
          box('#f5b6e2', 1.2, 0.9, 0.5, 1.4, 0, D - 3.4); box('#ffffff', 0.5, 0.3, 0.06, 1.4, 0.9, D - 3.6); box('#9cc9ff', 0.9, 0.7, 0.5, 2.6, 0, D - 3.4);
          for (let i = 0; i < 5; i++) box(BOOKS[i], 0.34 - i * 0.03, 0.26, 0.34 - i * 0.03, 4.0, i * 0.26, D - 3.2);
          box('#e8a322', 1.3, 1.1, 0.06, 6.2, 0, D - 3.2, 'in'); box('#d0453a', 0.06, 1.1, 1.2, 5.55, 0, D - 2.6); box('#d0453a', 0.06, 1.1, 1.2, 6.85, 0, D - 2.6);
          beanbag(6.2, D - 2.6, '#2aa3a0');
        }
        break;
      }
      case 'art': {
        for (const a of [2.6, 6.2]) for (const d of [4, 8.6]) {
          tableWithChairs(a, d, 2.4, 1.3, '#efe8d8', pick(BOOKS), 0.7);
          for (let i = 0; i < 5; i++) box(pick(BOOKS), 0.25 + rnd() * 0.2, 0.012, 0.2 + rnd() * 0.2, a - 0.9 + rnd() * 1.8, 0.77, d - 0.45 + rnd() * 0.9);
          for (let i = 0; i < 3; i++) cyl(pick(BOOKS), 0.06, 0.14, a - 0.6 + i * 0.6, 0.76, d, 8);
        }
        // Easels by the window, a sink counter, the drying rack, a wall of art.
        for (let i = 0; i < 4; i++) { const a = 1.4 + i * 1.5; box('#b98a54', 0.08, 1.5, 0.08, a - 0.3, 0, D - 1.2); box('#b98a54', 0.08, 1.5, 0.08, a + 0.3, 0, D - 1.2); box('#ffffff', 0.7, 0.9, 0.04, a, 0.55, D - 1.3); box(pick(BOOKS), 0.4, 0.4, 0.05, a, 0.8, D - 1.33); }
        const cd = along(false, W / 2 + 1.8, W - 5, 0.9, '#e6e0d2', 0.6); box(STEEL, 0.9, 0.06, 0.5, W / 2 + 1.8, 0.9, cd);
        shelfEnd(true, D / 2, 4, 1.8); paperWall(false, D / 2, 6, 1.1); paperWall(false, D / 2, 6, 2.5);
        break;
      }
      case 'music': {
        // Risers along the window wall, a piano, drums, xylophones on the rug.
        for (let i = 0; i < 3; i++) { box('#6b7076', W - 2, 0.3 * (3 - i), 0.9, W / 2, 0, D - 0.7 - i * 0.9); }
        block(W - 2, 2.7, W / 2, D - 1.6);
        box('#2b2b2e', 1.5, 1.2, 0.6, W - 1.2, 0, 3.2); box('#f4f1e6', 1.3, 0.06, 0.22, W - 1.2, 0.72, 2.85); chair(W - 1.2, 2.3, DARK, 0.46); block(1.5, 0.6, W - 1.2, 3.2);
        cyl('#c8102e', 0.38, 0.5, 2, 0, 3, 14); cyl('#c8102e', 0.24, 0.3, 1.3, 0.5, 3.5, 12); cyl('#d9b24a', 0.3, 0.02, 2.7, 1.1, 3.3, 14); cyl('#2a2f36', 0.2, 0.36, 2.0, 0, 2.0, 10);
        rug(W / 2, 6.6, 5.4, 3.6, ['#8a5cc7', '#f2b632']);
        for (let i = 0; i < 6; i++) { const a = W / 2 - 2 + (i % 3) * 2, d = 6 + Math.floor(i / 3) * 1.4; box(WOOD, 0.9, 0.2, 0.36, a, 0, d); for (let j = 0; j < 6; j++) box(BOOKS[j], 0.11, 0.04, 0.34 - j * 0.03, a - 0.33 + j * 0.13, 0.2, d); }
        board(false, D / 2 + 1); for (let i = 0; i < 5; i++) box(DARK, 0.03, 0.02, 3.6, 0.2, 2.5 + i * 0.12, D / 2 + 1);
        cubbies(W / 2 + 1.5, W - 5);
        break;
      }
      case 'computer': {
        for (const d of [3.2, 6.4, 9.6]) {
          box('#e9e2d0', W - 3, 0.05, 0.8, W / 2, 0.72, d); box('#8d9297', W - 3.4, 0.72, 0.1, W / 2, 0, d + 0.3); block(W - 3, 0.8, W / 2, d);
          for (let a = 2.2; a < W - 1.8; a += 1.3) { box(DARK, 0.6, 0.4, 0.04, a, 0.86, d + 0.15); box('#5cc8ff', 0.52, 0.32, 0.02, a, 0.9, d + 0.12); box('#d9d9d9', 0.4, 0.02, 0.14, a, 0.78, d - 0.18); chair(a, d - 0.75, tint, 0.46); }
        }
        board(true, D / 2); teacherDesk(W - 1.8, D - 1.6); paperWall(false, D / 2, 5);
        break;
      }
      case 'life': {
        // A little kitchen, a laundry corner, a table to eat at, a sofa.
        const cd = along(true, 3.4, 5.6, 0.9, '#e6e0d2', 0.65); box(STEEL, 0.8, 0.04, 0.5, 2.2, 0.9, cd); box(DARK, 0.7, 0.03, 0.55, 4.4, 0.9, cd);
        box('#eef0f1', 0.9, 1.9, 0.75, 7.0, 0, D - 0.6); block(0.9, 0.75, 7.0, D - 0.6);
        for (const a of [W - 2.6, W - 1.6]) { box('#f4f4f2', 0.8, 0.95, 0.7, a, 0, D - 0.55); cyl('#9fc4d8', 0.24, 0.02, a, 0.4, D - 0.92, 12); }
        block(2, 0.7, W - 2.1, D - 0.55);
        tableWithChairs(3.6, 6.4, 2.2, 1.2, WOOD, GREEN);
        sofa(W - 2.6, 4.2, 2.6, '#5b7fa6'); rug(W - 2.6, 5.6, 3, 2.2, ['#e8a322', '#f4f1e6']);
        cubbies(W / 2 + 1.5, W - 5);
        break;
      }
      case 'club': {
        sofa(3, D - 1, 3, '#e0533c', false); sofa(7, D - 1, 3, '#2f7fd1', false); rug(5, D - 3.2, 6.5, 3, [NAVY, LIME]);
        box(DARK, 0.06, 0.9, 1.6, W - 0.18, 1.2, D - 3);
        // Foosball, a ping-pong table, bean bags, a game shelf.
        box('#3b6b45', 1.5, 0.3, 0.8, 3, 0.7, 5.2); box(WOOD, 1.6, 0.7, 0.9, 3, 0, 5.2); for (let i = 0; i < 4; i++) box(STEEL, 0.03, 0.03, 1.3, 2.4 + i * 0.4, 0.95, 5.2); block(1.6, 0.9, 3, 5.2);
        box('#2f6fb5', 2.7, 0.06, 1.5, 7.2, 0.76, 5.4); box('#f4f1e6', 0.03, 0.16, 1.5, 7.2, 0.82, 5.4); box(DARK, 0.2, 0.76, 0.2, 6.2, 0, 5.4); box(DARK, 0.2, 0.76, 0.2, 8.2, 0, 5.4); block(2.7, 1.5, 7.2, 5.4);
        for (const [a, c] of [[1.2, '#f2b632'], [2.2, '#8a5cc7'], [W - 1.3, '#2aa3a0']] as [number, string][]) beanbag(a, 9.5, c);
        shelfEnd(false, 3.5, 3, 1.5); cubbies(W / 2 + 1.5, W - 5); plant(W - 0.8, 1.2);
        break;
      }
      case 'reading': {
        rug(W / 2, D / 2 + 1, 6, 5, ['#2f7fd1', '#9cc9ff', '#f2b632']);
        for (const [a, d, c] of [[3, 6, '#e0533c'], [4.6, 8.4, '#f2b632'], [7, 6.4, '#35a84a'], [6, 9, '#8a5cc7'], [8.4, 8.2, '#2aa3a0']] as [number, number, string][]) beanbag(a, d, c);
        shelfEnd(true, D / 2, 8, 1.3); shelfEnd(false, D / 2 + 2.4, 5, 1.3);
        for (const a of [3.2, 6.4]) { const d = along(true, a, 2.6, 1.0, WOOD, 0.4); for (let t = -1.1; t < 1.2; t += 0.3) box(pick(BOOKS), 0.24, 0.3, 0.08, a + t, 1.0, d); }
        // A reading nook: a little green house to curl up in.
        box(GREEN, 2.2, 1.7, 0.08, W - 2, 0, 1.2); box(GREEN, 0.08, 1.7, 1.6, W - 3.1, 0, 2); box(GREEN, 0.08, 1.7, 1.6, W - 0.9, 0, 2); box(LIME, 2.4, 0.08, 1.8, W - 2, 1.7, 2);
        beanbag(W - 2, 2.2, '#f5b6e2'); cubbies(W / 2 - 0.5, 3);
        break;
      }
      case 'work': {
        tableWithChairs(W / 2, D / 2 + 1, 3, 1.4, WOOD, '#6b7076');
        box('#e8e8e6', 1.0, 1.1, 0.7, W - 0.9, 0, 3); box(DARK, 0.9, 0.06, 0.6, W - 0.9, 1.1, 3); block(1, 0.7, W - 0.9, 3);
        shelfEnd(false, D / 2 + 2, 6, 1.9);
        const cd = along(true, W / 2, W - 2, 0.9, '#e6e0d2', 0.6); for (let a = 1.6; a < W - 1.4; a += 0.9) box(pick(PAPER), 0.5, 0.2, 0.36, a, 0.9, cd);
        break;
      }
      case 'flex': {
        for (const a of [3, W - 3]) for (const d of D > 10 ? [4, 8.4] : [D / 2 + 0.6]) {
          box('#ffffff', 2.2, 0.06, 1.3, a, 0.86, d); box(tint, 1.9, 0.86, 1.0, a, 0, d); block(2.2, 1.3, a, d);
          for (const s of [-0.7, 0.7]) for (const e of [-0.95, 0.95]) cyl('#6b7076', 0.17, 0.6, a + s, 0, d + e, 8);
          for (let i = 0; i < 4; i++) box(pick(BOOKS), 0.2, 0.14 + rnd() * 0.2, 0.2, a - 0.7 + i * 0.46, 0.92, d + (rnd() - 0.5) * 0.6);
        }
        board(true, D / 2, Math.min(4.2, D - 3)); shelfEnd(false, D / 2 + 1, Math.min(5, D - 4), 1.8);
        const cd = along(true, W / 2 - 0.5, W - 4, 0.9, '#e6e0d2', 0.6); for (let a = 1.4; a < W - 3.6; a += 0.8) box(pick(BOOKS), 0.5, 0.3, 0.4, a, 0.9, cd);
        break;
      }
      case 'books': {
        const n = Math.floor((W - 3) / 2.2);
        for (let i = 0; i < n; i++) {
          const a = 2.2 + i * 2.2, len = D - 3.4, d = D / 2 + 0.9;
          box(WOOD, 0.5, 2.0, len, a, 0, d); block(0.5, len, a, d);
          for (let y = 0.15; y < 1.8; y += 0.44) for (let t = -len / 2 + 0.2; t < len / 2 - 0.15; t += 0.4) for (const s of [-1, 1]) box(pick(BOOKS), 0.06, 0.32, 0.34, a + s * 0.26, y, d + t);
        }
        box('#c9a56b', 1.2, 0.9, 0.7, W - 1, 0, 1.6); for (let i = 0; i < 4; i++) box(pick(BOOKS), 0.5, 0.08, 0.36, W - 1, 0.9 + i * 0.08, 1.6);
        break;
      }
      case 'science': {
        for (const a of [3, 6.4, 9.8]) for (const d of [3.4, 7]) {
          if (a > W - 2) continue;
          box('#2f3338', 2.0, 0.07, 1.1, a, 0.9, d); box('#d8d2c2', 1.8, 0.9, 0.9, a, 0, d); block(2, 1.1, a, d);
          for (const s of [-0.6, 0.6]) for (const e of [-0.85, 0.85]) cyl(GREEN, 0.17, 0.62, a + s, 0, d + e, 8);
          for (let i = 0; i < 3; i++) cyl(pick(['#5cc8ff', '#9fe3a1', '#f5b6e2', '#ffe27a']), 0.07, 0.2 + rnd() * 0.12, a - 0.5 + i * 0.5, 0.97, d + (rnd() - 0.5) * 0.4, 8, 0.05);
        }
        board(true, D / 2);
        // A skeleton, a globe, a row of plants in the window, the periodic table.
        { const a = 1.0, d = D - 1.2; cyl('#ecebe4', 0.05, 1.7, a, 0, d, 6); box('#ecebe4', 0.42, 0.5, 0.2, a, 1.0, d); cyl('#ecebe4', 0.14, 0.26, a, 1.55, d, 10); box('#ecebe4', 0.7, 0.06, 0.06, a, 1.42, d); cyl(DARK, 0.3, 0.06, a, 0, d, 10); }
        const cd = along(true, W / 2 + 1, W - 4.5, 0.9, '#d8d2c2', 0.55); for (let a = 3.2; a < W - 1.6; a += 1.3) plant(a, cd + 0.02, 0.5);
        cyl('#6b5140', 0.05, 0.3, 2.4, 0.9, cd, 6); { const [u, v] = pt(2.4, cd); k.blob('in', '#2f7fd1', 0.24, X(u), y0 + 1.42, Z(v), 1); }
        for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) box(BOOKS[(i + j) % BOOKS.length], 0.04, 0.24, 0.24, 0.13, 1.3 + j * 0.27, 3 + i * 0.27);
        break;
      }
      case 'lgi': {
        // A big screen, a low stage, and wide carpeted steps to sit on.
        box(DARK, 0.08, 2.6, 5.2, 0.16, 1.2, D / 2); box('#3b6ea8', 0.06, 2.4, 5.0, 0.22, 1.3, D / 2);
        box(WOOD, 3.2, 0.25, D - 2, 2.4, 0, D / 2);
        for (let i = 0; i < 5; i++) { const a = 8.5 + i * 2.6; box(i % 2 ? NAVY : GREEN, 2.6, 0.22 * (i + 1), D - 1.6, a, 0, D / 2 + 0.6); }
        block(13, D - 1.6, 13.7, D / 2 + 0.6);
        box(WOOD, 0.6, 1.1, 0.5, 4.6, 0, 2.2);
        label('GO COUGARS!', r.u0 + 0.3, FLOOR2 + 3.2, (r.v0 + r.v1) / 2, Math.PI / 2, 0.5, LIME);
        break;
      }
      case 'principal': {
        teacherDesk(W / 2, D - 3); for (const a of [W / 2 - 0.8, W / 2 + 0.8]) chair(a, D - 5, tint, 0.46);
        rug(W / 2, D - 4.4, 4.4, 3.6, [NAVY, '#e9e2d0']); shelfEnd(true, D - 3, 4, 1.9); plant(1, D - 1);
        // Flags, a round meeting table, framed certificates.
        cyl('#c9ccd1', 0.03, 2.2, 1.0, 0, D - 2.2, 6); box('#b22234', 0.7, 0.45, 0.03, 1.36, 1.7, D - 2.2); cyl('#c9ccd1', 0.03, 2.2, 1.0, 0, D - 3.2, 6); box('#002868', 0.7, 0.45, 0.03, 1.36, 1.7, D - 3.2);
        cyl(WOOD, 0.75, 0.06, 2.4, 0.7, 3.2, 16); cyl('#7c8188', 0.12, 0.7, 2.4, 0, 3.2, 8); for (const [sa, sd] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) chair(2.4 + sa, 3.2 + sd, DARK, 0.44);
        block(1.5, 1.5, 2.4, 3.2);
        for (let i = 0; i < 4; i++) box('#c9a227', 0.04, 0.4, 0.5, 0.13, 1.5, 9.5 + i * 0.75);
        break;
      }
      case 'conference': {
        tableWithChairs(W / 2, D / 2 + 1, 1.5, 6.5, WOOD, DARK); box(DARK, 2.4, 1.3, 0.06, W / 2, 1.2, D - 0.2); plant(1, 1.2); plant(W - 1, D - 1);
        break;
      }
      case 'lounge': {
        sofa(W - 2.2, 9.2, 2.4, '#5b7fa6'); tableWithChairs(W / 2 - 0.6, 5, 1.2, 2.4, WOOD, GREEN);
        const cd = along(true, W / 2 - 0.4, W - 3, 0.9, '#e6e0d2', 0.6); box(DARK, 0.3, 0.36, 0.3, 2, 0.9, cd); box(STEEL, 0.5, 0.3, 0.4, 3.2, 0.9, cd);
        box('#eef0f1', 0.9, 1.9, 0.75, W - 0.8, 0, D - 0.7); block(0.9, 0.75, W - 0.8, D - 0.7);
        box('#c8102e', 0.9, 1.9, 0.8, 0.8, 0, 2.6); box('#ffffff', 0.06, 1.2, 0.6, 1.26, 0.5, 2.6); block(0.9, 0.8, 0.8, 2.6);
        break;
      }
      case 'reception': {
        // The front desk looks out through the counter window at the lobby.
        box(WOOD, 0.8, 1.05, 3.6, 1.0, 0, 2.6); box('#e9e2d0', 0.9, 0.05, 3.7, 1.0, 1.05, 2.6); block(0.8, 3.6, 1.0, 2.6);
        for (const d of [1.8, 3.4]) { box(DARK, 0.03, 0.34, 0.5, 1.2, 1.1, d); chair(2.0, d, DARK, 0.5); }
        for (let i = 0; i < 3; i++) chair(6 + i * 0.6, 0.6, tint, 0.44);
        shelfEnd(true, 7.6, 2.6, 1.6); plant(4.2, D - 0.8);
        const cd = along(true, 8.0, 2.0, 1.3, '#9aa0a6', 0.5); for (let a = 7.3; a < 8.8; a += 0.62) box('#7c8188', 0.5, 0.02, 0.02, a, 0.95, cd - 0.26);
        label('WELCOME TO COLONY OAKS', r.u0 - 0.24, 3.0, 21, -Math.PI / 2, 0.2, NAVY, 2.8);
        break;
      }
      case 'clinic': {
        for (const d of [D - 1.4, D - 4.2]) { const a = W - 1.3; box('#f4f4f2', 0.95, 0.5, 2.0, a, 0, d); box('#9cc9ff', 0.9, 0.08, 1.5, a, 0.5, d + 0.2); box('#ffffff', 0.7, 0.12, 0.4, a, 0.5, d - 0.7); block(0.95, 2, a, d); box('#9fe3a1', 1.8, 1.9, 0.04, a - 0.1, 0, d - 1.3); }
        teacherDesk(3, D - 2.2);
        box('#ffffff', 0.9, 1.0, 0.3, 1.0, 1.1, D - 0.3); box('#d0453a', 0.5, 0.14, 0.04, 1.0, 1.55, D - 0.47); box('#d0453a', 0.14, 0.5, 0.04, 1.0, 1.37, D - 0.47);
        box(STEEL, 0.5, 0.08, 0.4, 5, 0, D - 3); box(STEEL, 0.06, 1.4, 0.06, 5, 0, D - 2.8);
        for (let i = 0; i < 3; i++) chair(4 + i * 0.6, 0.6, tint, 0.44);
        break;
      }
      case 'restroom': {
        for (let i = 0; i < 3; i++) {
          const a = 1.2 + i * 1.6;
          box('#8f9aa3', 0.05, 1.9, 1.6, a - 0.8, 0.15, D - 1.0); box(tint, 1.0, 1.7, 0.05, a - 0.2, 0.2, D - 1.8); cyl('#ffffff', 0.22, 0.42, a, 0, D - 0.6, 10);
        }
        box('#8f9aa3', 0.05, 1.9, 1.6, 1.2 + 2 * 1.6 + 0.8, 0.15, D - 1.0); block(5, 1.6, 2.9, D - 1.0);
        const cd = along(false, W - 1.5, 1.8, 0.85, '#e6e0d2', 0.55); for (const a of [W - 2.0, W - 1.0]) cyl('#ffffff', 0.2, 0.06, a, 0.85, cd, 12);
        box('#bfe3f0', 1.7, 0.9, 0.03, W - 1.5, 1.2, 0.14);
        break;
      }
      case 'office': {
        teacherDesk(W / 2 + 1, D - 2.4); sofa(1.8, D - 3.6, 2.2, '#8a5cc7'); rug(2.4, 3.4, 3, 2.6, ['#2aa3a0', '#f4f1e6']);
        beanbag(1.6, 3, '#f2b632'); beanbag(3, 3.6, '#e0533c'); shelfEnd(true, 3.4, 3, 1.5); plant(W - 0.8, D - 0.8);
        break;
      }
    }
  }

  // ------------------------------------------------------------- lobby ----
  {
    const L = LOBBY, mu = (L.u0 + L.u1) / 2;
    B('#ddd8cb', L.u0, L.u1, 0, 0.05, L.v0, HALL.v0);
    B(NAVY, mu - 2.2, mu + 2.2, 0.05, 0.062, L.v0 + 0.4, L.v0 + 2.4); B(GREEN, mu - 2.0, mu + 2.0, 0.062, 0.068, L.v0 + 0.6, L.v0 + 2.2);
    // The cougar paw set into the floor, and a trail of prints down the hall.
    k.cyl('in', NAVY, 2.0, 2.0, 0.014, X(mu), 0.058, Z(25.6), 28); k.cyl('in', '#ddd8cb', 1.8, 1.8, 0.016, X(mu), 0.06, Z(25.6), 28);
    k.cyl('in', GREEN, 0.75, 0.75, 0.02, X(mu), 0.064, Z(26.0), 16);
    for (const t of [-0.84, -0.3, 0.3, 0.84]) k.cyl('in', GREEN, 0.28, 0.28, 0.02, X(mu + t), 0.064, Z(24.95 + Math.abs(t) * 0.45), 10);
    for (let i = 0; i < 26; i++) {
      const u = 52 + i * 2.9, v = 25.8 + (i % 2 ? 0.5 : -0.5);
      k.cyl('in', i % 2 ? GREEN : NAVY, 0.2, 0.2, 0.012, X(u), 0.062, Z(v), 8);
      for (const t of [-0.17, 0, 0.17]) k.cyl('in', i % 2 ? GREEN : NAVY, 0.07, 0.07, 0.012, X(u + 0.26), 0.062, Z(v + t), 6);
    }
    // Trophy case on the west wall, benches, plants, a welcome banner.
    B(WOOD, L.u0 + 0.25, L.u0 + 0.85, 0, 0.9, 19.6, 22.4); B('#9fc4d8', L.u0 + 0.25, L.u0 + 0.85, 0.9, 2.3, 19.6, 22.4, 'pane'); B(WOOD, L.u0 + 0.25, L.u0 + 0.85, 2.3, 2.4, 19.6, 22.4);
    for (let i = 0; i < 5; i++) { const v = 19.95 + i * 0.52; k.cyl('in', '#d9b24a', 0.11, 0.05, 0.3, X(L.u0 + 0.55), 1.17, Z(v), 8); k.cyl('in', '#d9b24a', 0.09, 0.09, 0.05, X(L.u0 + 0.55), 0.93, Z(v), 8); k.blob('in', i % 2 ? '#d9b24a' : '#c9ccd1', 0.11, X(L.u0 + 0.55), 1.7, Z(v), 1); }
    solid(L.u0 + 0.2, L.u0 + 0.9, 19.6, 22.4, 0);
    for (const v of [24.4, 26.6]) { B(WOOD, L.u0 + 0.5, L.u0 + 1.0, 0.4, 0.48, v - 0.9, v + 0.9); B(DARK, L.u0 + 0.6, L.u0 + 0.9, 0, 0.4, v - 0.7, v + 0.7); solid(L.u0 + 0.5, L.u0 + 1.0, v - 0.9, v + 0.9, 0); }
    B(NAVY, 44.4 - 3.4, 44.4 + 3.4, 3.3, 4.3, L.v0 + 0.32, L.v0 + 0.38);
    label('WELCOME, COUGARS!', 44.4, 3.92, L.v0 + 0.42, 0, 0.5, '#ffffff');
    label('Colony Oaks Elementary  ·  Pre-K to 5th Grade', 44.4, 3.48, L.v0 + 0.42, 0, 0.19, LIME);
    lights(L.u0 + 1, SPINE.u0, L.v0 + 1, HALL.v1, 8.84, 6);
    // The way-finding sign at the top of the spine.
    B(NAVY, 60.2, 65.8, 3.3, 4.1, HALL.v0 + 0.12, HALL.v0 + 0.18);
    label('Library · 1st Grade · Art · Music this way      Cafeteria · Gym straight on      Pre-K · Kinder down the hall', 63, 3.7, HALL.v0 + 0.22, 0, 0.17, '#ffffff', 5.4);
  }

  // ----------------------------------------------------------- library ----
  {
    const L = LIBRARY;
    B('#7f93a8', L.u0, L.u1, 0, 0.05, L.v0, L.v1);
    for (let i = 0; i < 9; i++) B(i % 2 ? '#6f8499' : '#93a6b9', L.u0 + 1 + i * 2.2, L.u0 + 2.4 + i * 2.2, 0.05, 0.058, L.v0 + 0.6, L.v1 - 0.6);
    const shelf = (u0: number, u1: number, v0: number, v1: number, h: number) => {
      B(WOOD, u0, u1, 0, h, v0, v1); B('#b98a54', u0 - 0.03, u1 + 0.03, h, h + 0.05, v0 - 0.03, v1 + 0.03);
      const longU = u1 - u0 > v1 - v0;
      for (let y = 0.12; y < h - 0.3; y += 0.42) for (let t = 0.15; t < (longU ? u1 - u0 : v1 - v0) - 0.3; t += 0.34) for (const s of [0, 1]) {
        if (longU) B(pick(BOOKS), u0 + t, u0 + t + 0.28, y, y + 0.26 + rnd() * 0.08, s ? v1 - 0.02 : v0 - 0.05, s ? v1 + 0.05 : v0 + 0.02);
        else B(pick(BOOKS), s ? u1 - 0.02 : u0 - 0.05, s ? u1 + 0.05 : u0 + 0.02, y, y + 0.26 + rnd() * 0.08, v0 + t, v0 + t + 0.28);
      }
      solid(u0, u1, v0, v1, 0);
    };
    // Low shelves mark the library's edges (with gaps to walk through); taller stacks stand in the west half.
    for (const [a, b] of [[39.6, 43.5], [47, 52], [55.5, 59]]) shelf(a, b, L.v0 + 0.15, L.v0 + 0.6, 1.1);
    for (const [a, b] of [[29.4, 32.6], [35.6, 40.2]]) shelf(L.u1 - 0.6, L.u1 - 0.15, a, b, 1.1);
    for (const v of [31.2, 33.6, 36, 38.4]) shelf(40, 47, v - 0.25, v + 0.25, 1.6);
    shelf(L.u0 + 0.25, L.u0 + 0.7, 36.6, 40.6, 2.0);
    for (let u = 40.5; u < 59; u += 4.6) shelf(u, u + 3.6, L.v1 - 0.65, L.v1 - 0.2, 2.0);
    // The reading oak: a tree in the middle of the room with a round bench (it is Colony OAKS).
    const tu = 53.4, tv = 34.6;
    k.cyl('in', '#7a5a3c', 0.34, 0.5, 4.2, X(tu), 2.1, Z(tv), 9);
    for (const [du, dv, dy, rr] of [[0, 0, 5.2, 2.2], [1.5, 0.6, 4.6, 1.5], [-1.4, -0.5, 4.7, 1.6], [0.3, -1.5, 4.5, 1.4], [-0.5, 1.5, 4.6, 1.4]]) k.blob('in', pick(['#3f8f4a', '#4a9c52', '#57a85a']), rr, X(tu + du), dy, Z(tv + dv), 0.8);
    k.cyl('in', WOOD, 1.5, 1.5, 0.42, X(tu), 0.26, Z(tv), 18); k.cyl('in', GREEN, 1.55, 1.55, 0.06, X(tu), 0.5, Z(tv), 18);
    solid(tu - 1.3, tu + 1.3, tv - 1.3, tv + 1.3, 0);
    k.cyl('in', '#e0533c', 2.6, 2.6, 0.012, X(tu), 0.058, Z(tv), 24); k.cyl('in', '#f2b632', 2.1, 2.1, 0.014, X(tu), 0.06, Z(tv), 24);
    for (const [du, dv, c] of [[2.3, 1.2, '#2f7fd1'], [-2.2, 1.6, '#8a5cc7'], [2.0, -2.0, '#e06a8c'], [-2.4, -1.4, '#2aa3a0'], [0.2, 2.6, '#f2b632']] as [number, number, string][]) k.blob('in', c, 0.5, X(tu + du), 0.34, Z(tv + dv), 0.66);
    // Tables to read at, and the librarian's desk by the hall.
    for (const [u, v] of [[49.5, 38.4], [56.6, 38.6]]) {
      k.cyl('in', '#e9e2d0', 0.9, 0.9, 0.06, X(u), 0.67, Z(v), 16); k.cyl('in', '#7c8188', 0.12, 0.2, 0.62, X(u), 0.36, Z(v), 8);
      for (let i = 0; i < 4; i++) B(pick([GREEN, NAVY, '#f2b632']), u + Math.cos(i * 1.57) * 1.15 - 0.18, u + Math.cos(i * 1.57) * 1.15 + 0.18, 0.05, 0.45, v + Math.sin(i * 1.57) * 1.15 - 0.18, v + Math.sin(i * 1.57) * 1.15 + 0.18);
      solid(u - 0.8, u + 0.8, v - 0.8, v + 0.8, 0);
    }
    B(WOOD, 48, 51.4, 0, 1.0, 29.6, 30.3); B('#e9e2d0', 47.9, 51.5, 1.0, 1.05, 29.5, 30.4); B(DARK, 49.4, 49.9, 1.05, 1.4, 29.9, 29.94); solid(48, 51.4, 29.6, 30.3, 0);
    for (let i = 0; i < 3; i++) B(pick(BOOKS), 48.3 + i * 0.3, 48.6 + i * 0.3, 1.05, 1.09 + i * 0.04, 29.7, 30.0);
    // A cougar-green mural band and the sign on the south wall.
    B(GREEN, L.u0 + 0.3, L.u1 - 0.1, 5.2, 5.8, L.v1 - 0.16, L.v1 - 0.12); B(NAVY, L.u0 + 0.3, L.u1 - 0.1, 5.8, 6.0, L.v1 - 0.16, L.v1 - 0.12);
    label('LIBRARY', (L.u0 + L.u1) / 2, 4.4, L.v1 - 0.18, Math.PI, 0.9, NAVY);
    label('Readers are leaders', (L.u0 + L.u1) / 2, 3.55, L.v1 - 0.18, Math.PI, 0.3, GREEN);
    lights(L.u0 + 1, L.u1, L.v0 + 1, L.v1 - 1, 8.84, 5);
  }

  // ------------------------------------------------- corridors' dressing ----
  {
    // Notice boards between the classroom doors, coat hooks with backpacks, water fountains.
    const boardOn = (ax: 'u' | 'v', c: number, a: number, face: 1 | -1, y: number, len = 2.4) => {
      const f = c + face * 0.12;
      if (ax === 'u') { B('#c8a97a', a - len / 2, a + len / 2, y + 1.1, y + 2.2, Math.min(c + face * 0.1, f), Math.max(c + face * 0.1, f)); for (let t = -len / 2 + 0.25; t < len / 2 - 0.2; t += 0.5) for (const yy of [1.2, 1.7]) B(pick(PAPER), a + t, a + t + 0.36, y + yy, y + yy + 0.4, Math.min(f, f + face * 0.02), Math.max(f, f + face * 0.02)); }
      else { B('#c8a97a', Math.min(c + face * 0.1, f), Math.max(c + face * 0.1, f), y + 1.1, y + 2.2, a - len / 2, a + len / 2); for (let t = -len / 2 + 0.25; t < len / 2 - 0.2; t += 0.5) for (const yy of [1.2, 1.7]) B(pick(PAPER), Math.min(f, f + face * 0.02), Math.max(f, f + face * 0.02), y + yy, y + yy + 0.4, a + t, a + t + 0.36); }
    };
    const hooks = (c: number, a: number, face: 1 | -1, y: number) => {
      B(TRIM, a - 1.3, a + 1.3, y + 1.15, y + 1.25, Math.min(c + face * 0.1, c + face * 0.16), Math.max(c + face * 0.1, c + face * 0.16));
      for (let t = -1.1; t <= 1.11; t += 0.44) B(pick(BOOKS), a + t - 0.15, a + t + 0.15, y + 0.7, y + 1.14, Math.min(c + face * 0.1, c + face * 0.3), Math.max(c + face * 0.1, c + face * 0.3));
    };
    for (const r of ROOMS) {
      if (r.cor !== 'n' && r.cor !== 's') continue;
      if (r.u1 - r.u0 < 8) continue;
      const c = r.cor === 's' ? r.v1 : r.v0, face: 1 | -1 = r.cor === 's' ? 1 : -1, y = r.lvl ? FLOOR2 : 0;
      if (Math.abs(r.doorAt - r.u0 - 1.7) > 0.01) continue;   // (rooms in the two wings only)
      boardOn('u', c, r.u0 + 5.6, face, y);
      if (r.kind === 'class' || r.kind === 'prek' || r.kind === 'kinder') hooks(c, r.u0 + 8.6, face, y);
    }
    for (const [u, v, y] of [[70, HALL.v0 + 0.3, 0], [30, WCOR.v0 + 0.3, 0], [100, HALL.v1 - 0.3, 0], [100, HALL.v1 - 0.3, FLOOR2], [30, WCOR.v0 + 0.3, FLOOR2]]) {
      B(STEEL, u - 0.25, u + 0.25, y + 0.75, y + 1.0, v - 0.18, v + 0.18); B(STEEL, u + 0.45, u + 0.9, y + 0.55, y + 0.8, v - 0.18, v + 0.18);
    }
    // The spine: banners on the dining wall, class photos on the other side.
    for (const [v, text, col] of [[54, 'BE KIND', GREEN], [62.3, 'WORK HARD', NAVY], [66, 'GO COUGARS', GREEN]] as [number, string, string][]) {
      B(col, 65.84, 65.88, 1.3, 2.9, v - 1.3, v + 1.3);
      label(text, 65.82, 2.1, v, -Math.PI / 2, 0.32, '#ffffff', 2.4);
    }
    boardOn('v', 60, 45.2, 1, 0, 5); boardOn('v', 60, 57.6, 1, 0, 3.4); boardOn('v', 60, 64.8, 1, 0, 3.4);
    boardOn('v', 66, 38, -1, 0, 6);
    label('CAFETERIA', 65.86, 3.72, 50, -Math.PI / 2, 0.3, NAVY); label('CAFETERIA', 65.86, 3.72, 58, -Math.PI / 2, 0.3, NAVY);
    label('GYM', 63, 3.3, 68.36, Math.PI, 0.5, NAVY);
  }

  // ----------------------------------------------------- dining + stage ----
  {
    const Dn = DINING;
    B('#e3ded2', Dn.u0, Dn.u1, 0, 0.05, Dn.v0, Dn.v1);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) B('#cfd9cf', Dn.u0 + 0.6 + i * 2.75, Dn.u0 + 3.35 + i * 2.75, 0.05, 0.056, Dn.v0 + 0.3 + j * 2.65, Dn.v0 + 2.95 + j * 2.65);
    // Fold-out lunch tables with round stools, green and navy.
    for (const u of [69.6, 75.2, 80.8]) for (const [v0, v1] of [[47.6, 52.8], [54.6, 59.8]]) {
      B('#f4f1e6', u - 0.45, u + 0.45, 0.72, 0.78, v0, v1); B('#7c8188', u - 0.06, u + 0.06, 0.05, 0.72, v0 + 0.3, v1 - 0.3);
      for (let v = v0 + 0.45; v < v1; v += 0.86) for (const s of [-1, 1]) k.cyl('in', (Math.round(v * 3) + (s > 0 ? 1 : 0)) % 2 ? GREEN : NAVY, 0.19, 0.19, 0.07, X(u + s * 0.82), 0.47, Z(v), 10);
      for (let i = 0; i < 3; i++) { const v = v0 + 0.8 + rnd() * (v1 - v0 - 1.6); B(pick(['#c9b28f', '#9fb7c9', '#e9c0a0']), u - 0.3, u + 0.1, 0.78, 0.8, v, v + 0.3); k.cyl('in', '#ffffff', 0.05, 0.05, 0.12, X(u + 0.25), 0.84, Z(v + 0.1), 6); }
      solid(u - 1.0, u + 1.0, v0, v1, 0);
    }
    // The serving line by the kitchen hatch, a milk cooler, the bins.
    B(STEEL, 86.6, 87.4, 0.05, 0.95, 53.4, 58.6); B('#d9dde0', 86.2, 86.6, 0.86, 0.9, 53.4, 58.6); B('#9fc4d8', 86.95, 87.0, 0.95, 1.5, 53.4, 58.6, 'pane'); solid(86.2, 87.4, 53.4, 58.6, 0);
    for (let i = 0; i < 5; i++) B(pick(['#e8a322', '#d0453a', '#3d8f4f', '#f0d24a', '#c9783c']), 86.75, 87.25, 0.95, 1.02, 53.7 + i, 54.4 + i);
    B('#eef0f1', 87.7, 88.7, 0.05, 1.0, 47, 49); B('#2f7fd1', 87.68, 87.7, 0.3, 0.9, 47.2, 48.8); solid(87.7, 88.7, 47, 49, 0);
    for (const [u, c] of [[67, '#6b7076'], [67.9, '#2f7fd1'], [68.8, GREEN]] as [number, string][]) k.cyl('in', c, 0.3, 0.26, 0.9, X(u), 0.5, Z(46.7), 10);
    B(DARK, 88.74, 88.8, 2.6, 3.6, 53.6, 58.4); label('TODAY: PIZZA · APPLES · MILK', 88.72, 3.1, 56, -Math.PI / 2, 0.22, '#ffffff', 4.4);
    lights(Dn.u0 + 1, Dn.u1 - 1, Dn.v0 + 1, Dn.v1, 10.64, 5.5);
    // The stage ("platform"): boards, a navy back curtain, green side curtains, steps at both ends.
    const S = STAGE;
    B('#8a6238', S.u0, S.u1, 0, S.y, S.v0, S.v1); B('#6e4e2c', S.u0, S.u1, 0, S.y, S.v0 - 0.04, S.v0);
    for (const [a, b] of S.steps) for (let i = 0; i < 5; i++) B('#a67c4a', a, b, 0, ((i + 1) * S.y) / 5, S.stepV0 + i * 0.4, S.stepV0 + (i + 1) * 0.4);
    B(NAVY, S.u0 + 0.3, S.u1 - 0.3, S.y, 7.2, S.v1 - 0.34, S.v1 - 0.24);
    for (let u = S.u0 + 0.6; u < S.u1 - 0.5; u += 0.9) B('#18214a', u, u + 0.12, S.y, 7.2, S.v1 - 0.38, S.v1 - 0.34);
    for (const [a, b] of [[S.u0 + 0.2, S.u0 + 2.6], [S.u1 - 2.6, S.u1 - 0.2]]) { B(GREEN, a, b, S.y, 7.4, S.v0 + 0.1, S.v0 + 0.3); solid(a, b, S.v0 + 0.05, S.v0 + 0.35, 0); }
    B(GREEN, S.u0 + 0.2, S.u1 - 0.2, 6.6, 7.6, S.v0 + 0.05, S.v0 + 0.25);
    label('COLONY OAKS COUGARS', (S.u0 + S.u1) / 2, 7.1, S.v0 + 0.03, Math.PI, 0.62, '#ffffff');
    B(WOOD, 76.9, 77.7, S.y, S.y + 1.15, 63.4, 63.9); B(DARK, 79.2, 79.24, S.y, S.y + 1.4, 63.6, 63.64); k.cyl('in', DARK, 0.06, 0.06, 0.14, X(79.22), S.y + 1.46, Z(63.62), 6);
    B('#2b2b2e', 84.4, 86, S.y, S.y + 1.2, 66.6, 67.3); B('#f4f1e6', 84.5, 85.9, S.y + 0.72, S.y + 0.78, 66.35, 66.6);
    lights(S.u0 + 2, S.u1 - 2, S.v0 + 1, S.v1 - 1, 10.64, 6);
  }

  // --------------------------------------------------------------- gym ----
  {
    const g = GYM, mu = (g.u0 + g.u1) / 2, mv = (g.v0 + g.v1) / 2;
    B('#d7a868', g.u0, g.u1, 0, 0.05, g.v0, g.v1);
    for (let i = 0; i < 22; i++) if (i % 2) B('#cf9f5e', g.u0 + 0.3, g.u1 - 0.3, 0.05, 0.053, g.v0 + 0.3 + i * 0.62, g.v0 + 0.92 + i * 0.62);
    // Court lines (played end to end, east–west), the keys in navy, a green paw at centre court.
    const line = (u0: number, u1: number, v0: number, v1: number, c = '#ffffff') => B(c, u0, u1, 0.053, 0.06, v0, v1);
    const cu0 = g.u0 + 1.4, cu1 = g.u1 - 1.4, cv0 = g.v0 + 1.3, cv1 = g.v1 - 1.1;
    line(cu0, cu1, cv0, cv0 + 0.08); line(cu0, cu1, cv1 - 0.08, cv1); line(cu0, cu0 + 0.08, cv0, cv1); line(cu1 - 0.08, cu1, cv0, cv1); line(mu - 0.04, mu + 0.04, cv0, cv1);
    for (const s of [-1, 1]) { const e = s < 0 ? cu0 : cu1; B(NAVY, Math.min(e, e - s * 4.6), Math.max(e, e - s * 4.6), 0.052, 0.056, mv - 1.8, mv + 1.8); k.cyl('in', '#ffffff', 1.8, 1.8, 0.004, X(e - s * 4.6), 0.057, Z(mv), 22); k.cyl('in', '#d7a868', 1.72, 1.72, 0.005, X(e - s * 4.6), 0.058, Z(mv), 22); }
    k.cyl('in', NAVY, 1.9, 1.9, 0.006, X(mu), 0.058, Z(mv), 26); k.cyl('in', '#d7a868', 1.8, 1.8, 0.007, X(mu), 0.059, Z(mv), 26);
    k.cyl('in', GREEN, 0.7, 0.7, 0.008, X(mu), 0.062, Z(mv + 0.3), 16); for (const t of [-0.78, -0.28, 0.28, 0.78]) k.cyl('in', GREEN, 0.26, 0.26, 0.008, X(mu + t), 0.062, Z(mv - 0.7 + Math.abs(t) * 0.42), 10);
    // Wall pads behind the baskets, bleachers on the north wall, the scoreboard, pennants.
    for (const u of [g.u0 + 0.24, g.u1 - 0.2]) B(NAVY, u, u + 0.08, 0.1, 2.0, g.v0 + 2, g.v1 - 1);
    for (let j = 0; j < 3; j++) B(j % 2 ? NAVY : GREEN, 68, 87, 0.05, 0.42 * (3 - j), g.v0 + 0.22 + j * 0.5, g.v0 + 0.72 + j * 0.5);
    solid(68, 87, g.v0, g.v0 + 1.75, 0);
    B(DARK, 74.5, 80.5, 6.6, 8.6, g.v0 + 0.1, g.v0 + 0.22); B('#ff5a3c', 75.2, 76.6, 7.0, 8.0, g.v0 + 0.22, g.v0 + 0.24, 'lamp'); B('#ff5a3c', 78.4, 79.8, 7.0, 8.0, g.v0 + 0.22, g.v0 + 0.24, 'lamp');
    label('HOME            GUEST', 77.5, 8.3, g.v0 + 0.26, 0, 0.2, '#ffffff');
    for (let i = 0; i < 10; i++) { const u = 60 + i * 3; B(i % 2 ? GREEN : NAVY, u, u + 1.4, 6.5, 7.25, g.v1 - 0.3, g.v1 - 0.26); }
    label('HOME OF THE COUGARS', mu, 5.6, g.v1 - 0.3, Math.PI, 0.9, NAVY);
    B(GREEN, g.u0 + 2, g.u1 - 2, 4.9, 5.0, g.v1 - 0.3, g.v1 - 0.26); B(GREEN, g.u0 + 2, g.u1 - 2, 6.2, 6.3, g.v1 - 0.3, g.v1 - 0.26);
    // A ball cart and a stack of cones.
    B(STEEL, 59.4, 60.6, 0.05, 0.7, 81.2, 82); for (let i = 0; i < 3; i++) k.blob('in', pick(['#e8772a', '#c8102e', '#2f7fd1']), 0.2, X(59.6 + i * 0.4), 0.9, Z(81.6), 1); solid(59.4, 60.6, 81.2, 82, 0);
    for (let i = 0; i < 4; i++) k.cyl('in', '#ff7a1a', 0.04, 0.2, 0.4, X(86.6 + (i % 2) * 0.5), 0.25, Z(81.4 + Math.floor(i / 2) * 0.5), 8);
    lights(g.u0 + 2, g.u1 - 2, g.v0 + 2, g.v1 - 2, 10.64, 6);
  }

  // ----------------------------------------------------------- kitchen ----
  {
    const K = KITCHEN;
    B('#b0715a', K.u0, K.u1, 0, 0.05, K.v0, K.v1);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 13; j++) if ((i + j) % 2) B('#a3664f', K.u0 + 0.3 + i * 2.1, K.u0 + 2.4 + i * 2.1, 0.05, 0.055, K.v0 + 0.3 + j * 2.1, K.v0 + 2.4 + j * 2.1);
    const steel = (u0: number, u1: number, v0: number, v1: number, h = 0.92) => { B(STEEL, u0, u1, 0.05, h, v0, v1); B('#d9dde0', u0 - 0.03, u1 + 0.03, h, h + 0.04, v0 - 0.03, v1 + 0.03); solid(u0, u1, v0, v1, 0); };
    steel(89.5, 90.4, 53.4, 58.6); for (let i = 0; i < 5; i++) B(pick(['#e8a322', '#d0453a', '#3d8f4f', '#f0d24a']), 89.6, 90.3, 0.96, 1.04, 53.7 + i, 54.4 + i);
    steel(94, 99, 58, 59.6); steel(94, 99, 64, 65.6);
    for (let i = 0; i < 4; i++) { k.cyl('in', '#8d9297', 0.24, 0.24, 0.26, X(94.7 + i * 1.2), 1.1, Z(58.8), 12); B(pick(['#e8a322', '#d0453a', '#f4e3b0']), 94.3 + i * 1.2, 95.1 + i * 1.2, 0.96, 1.0, 64.3, 65.3); }
    steel(92, 103.4, 52.5, 53.3); for (let u = 93; u < 102; u += 2.2) { B(DARK, u, u + 1.6, 0.25, 0.8, 53.3, 53.34); B('#2a2f36', u + 0.1, u + 1.5, 0.96, 0.98, 52.6, 53.2); }
    steel(102.7, 103.5, 54.5, 63.5);
    // The walk-in cooler and freezer, dry-goods racks, the dish pit.
    B('#dfe3e6', 98.6, 103.6, 0.05, 2.7, 70, 79.6); B(STEEL, 98.5, 98.6, 0.05, 2.2, 71, 72.2); B(STEEL, 98.5, 98.6, 0.05, 2.2, 75.4, 76.6); solid(98.6, 103.6, 70, 79.6, 0);
    label('COOLER', 98.46, 2.4, 71.6, -Math.PI / 2, 0.16, NAVY); label('FREEZER', 98.46, 2.4, 76, -Math.PI / 2, 0.16, NAVY);
    for (const v of [70, 73, 76]) { B('#8d9297', 89.6, 90.4, 0.05, 2.0, v, v + 2.2); for (let y = 0.3; y < 1.9; y += 0.55) for (let t = 0.1; t < 2; t += 0.5) B(pick(['#c9783c', '#e8e2c9', '#d0453a', '#3d8f4f']), 89.7, 90.3, y, y + 0.36, v + t, v + t + 0.4); solid(89.6, 90.4, v, v + 2.2, 0); }
    steel(92, 97, 79, 79.7); for (const u of [93, 95.2]) B('#9fc4d8', u, u + 1, 0.93, 0.95, 79.1, 79.6);
    lights(K.u0 + 1, K.u1 - 1, K.v0 + 1, K.v1 - 1, 5.84, 5);
  }
}

/** The solid furniture, as colliders (walls come from buildColonySchoolColliders). */
export function buildColonySchoolFurnitureColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const noop = () => undefined;
  drawSchoolInterior({ box: noop, cyl: noop, blob: noop }, (u0, u1, v0, v1, lvl) => {
    const [minY, maxY] = bandFor(lvl);
    out.push({ minX: X(Math.min(u0, u1)), maxX: X(Math.max(u0, u1)), minZ: Z(Math.min(v0, v1)), maxZ: Z(Math.max(v0, v1)), minY, maxY, tag: 'colony-school-thing' });
  }, []);
  return out;
}
