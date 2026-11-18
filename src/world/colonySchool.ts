import type { Floor, RectCollider } from '../types';

// Colony Oaks Elementary — the inside.
//
// Laid out from the district's own schematic floor plans for this building
// ("Bastrop ES at the Colony", Stantec, shown to the school board in 2021):
//   ground floor — admin by the front door, the library in the middle, Pre-K /
//     Kinder / ECSE in the east wing, 1st grade + art + music + computer lab +
//     life skills + the after-school room in the west wing, then dining with
//     its stage ("platform"), the gym and the kitchen;
//   upstairs — the big-group room (LGI) and science over admin, 5th and 4th
//     grade in the east wing, 3rd and 2nd in the west wing, joined by a bridge
//     that looks down into the library.
// The outline is the one traced from the aerial photo (world/colony.ts); the
// rooms are fitted into it in the plan's order. Room sizes, furniture and
// which wall each door is on are made up.
//
// Everything here is in "school metres": u east and v south of the building's
// north-west corner. X()/Z() turn them into world coordinates.

export const SX = -505, SZ = 3212;
export const X = (u: number) => SX + u;
export const Z = (v: number) => SZ + v;

/** Upstairs floor level, and the underside of its slab (the downstairs ceiling). */
export const FLOOR2 = 4.5;
export const CEIL1 = 4.2;
const EXT_T = 0.4, INT_T = 0.2;

// ------------------------------------------------------------------ masses --
/** The roofed blocks the building is made of (they do not overlap). */
export interface Mass { u0: number; u1: number; v0: number; v1: number; h: number; kind: 'brick' | 'cream' }
export const MASSES: Mass[] = [
  { u0: 49.9, u1: 73.6, v0: 0, v1: 23.3, h: 9.6, kind: 'brick' },     // admin, LGI + science over it
  { u0: 73.6, u1: 128.4, v0: 9, v1: 23.3, h: 9, kind: 'cream' },      // east wing, north rooms
  { u0: 72.4, u1: 128.4, v0: 23.3, v1: 41, h: 9, kind: 'cream' },     // east wing, hall + south rooms
  { u0: 38.8, u1: 49.9, v0: 18.6, v1: 23.3, h: 9, kind: 'cream' },    // the lobby
  { u0: 38.8, u1: 72.4, v0: 23.3, v1: 36.2, h: 9, kind: 'cream' },    // main hall + library
  { u0: 66, u1: 72.4, v0: 36.2, v1: 46, h: 9, kind: 'cream' },        // the stairs
  { u0: 0, u1: 66, v0: 36.2, v1: 68.5, h: 9, kind: 'cream' },         // west wing
  { u0: 66, u1: 89, v0: 46, v1: 68.5, h: 10.8, kind: 'cream' },       // dining + stage
  { u0: 58, u1: 89, v0: 68.5, v1: 82.7, h: 10.8, kind: 'cream' },     // gym
  { u0: 89, u1: 104, v0: 52, v1: 80, h: 6, kind: 'cream' },           // kitchen
];

// ------------------------------------------------------------------- walls --
export interface Opening { a0: number; a1: number; y0: number; y1: number; door?: boolean }
/**
 * A straight wall. `ax: 'u'` runs east–west at v = c; `ax: 'v'` runs
 * north–south at u = c. `skin` marks an outside wall (and what it is faced
 * with); `out` is which way its outside face looks along the other axis.
 */
export interface Wall {
  ax: 'u' | 'v'; c: number; a0: number; a1: number; y0: number; y1: number; t: number;
  skin?: 'brick' | 'cream' | 'glass'; out?: 1 | -1; open: Opening[];
  /** Outside walls only: this is the ground-floor half of a two-storey wall. */
  lower?: boolean;
}

const door = (c: number, w = 1.8, y = 0, h = 2.6): Opening => ({ a0: c - w / 2, a1: c + w / 2, y0: y, y1: y + h, door: true });
const win = (c: number, w: number, y0: number, y1: number): Opening => ({ a0: c - w / 2, a1: c + w / 2, y0, y1 });
/** Ground-floor and upstairs classroom windows. */
const gw = (c: number, w = 1.7) => win(c, w, 1.0, 3.1);
const uw = (c: number, w = 1.7) => win(c, w, 5.4, 7.4);
const spread = (a0: number, a1: number, n: number) => Array.from({ length: n }, (_, i) => a0 + ((a1 - a0) * (i + 0.5)) / n);

// Shared lines of the plan.
export const HALL = { v0: 23.3, v1: 28.3 };          // main hall, running east into the east wing
export const SPINE = { u0: 60, u1: 66 };             // the north–south corridor (and the bridge above it)
export const WCOR = { v0: 49.5, v1: 54.5 };          // west wing corridor
const E_N = [73.6, 84.56, 95.52, 106.48, 117.44, 128.4];   // east wing, north rooms
const E_S = [72.4, 83.6, 94.8, 106, 117.2, 128.4];         // east wing, south rooms
const W_N = [0, 9.7, 19.4, 29.1, 38.8];                    // west wing, north rooms
const W_S = [0, 10, 20, 30, 40, 50, 60];                   // west wing, south rooms
/** The staircase: a bottom landing, the flight climbing north, a top landing. */
export const STAIR = { u0: 66, u1: 72.4, vTop: 32, vBot: 44 };
/** The fire stair outside the west end: climbs south to a landing at the upstairs door. */
export const FIRE = { u0: -2.2, u1: -0.2, vBot: 37.5, vTop: 49.5, vEnd: 54.5 };
export const STAGE = { u0: 66, u1: 89, v0: 62.3, v1: 68.5, y: 0.9, steps: [[70, 72.4], [82.6, 85]] as [number, number][], stepV0: 60.3 };

function buildWalls(): Wall[] {
  const ws: Wall[] = [];
  /** An outside wall: two storeys stacked, or one tall piece. */
  const ext = (ax: 'u' | 'v', c: number, a0: number, a1: number, h: number, skin: 'brick' | 'cream' | 'glass', out: 1 | -1, o: { g?: Opening[]; u?: Opening[]; single?: boolean } = {}) => {
    if (o.single) ws.push({ ax, c, a0, a1, y0: 0, y1: h, t: EXT_T, skin, out, open: [...(o.g ?? []), ...(o.u ?? [])] });
    else {
      ws.push({ ax, c, a0, a1, y0: 0, y1: FLOOR2, t: EXT_T, skin, out, open: o.g ?? [], lower: true });
      ws.push({ ax, c, a0, a1, y0: FLOOR2, y1: h, t: EXT_T, skin, out, open: o.u ?? [] });
    }
  };
  /** An inside wall: lvl 0 = downstairs, 1 = upstairs, 2 = one tall wall. */
  const int = (ax: 'u' | 'v', c: number, a0: number, a1: number, lvl: 0 | 1 | 2, open: Opening[] = [], top = 9) => {
    ws.push({ ax, c, a0, a1, y0: lvl === 1 ? FLOOR2 : 0, y1: lvl === 0 ? CEIL1 : top, t: INT_T, open });
  };
  const two = (list: number[]) => list.slice(0, -1).flatMap((a, i) => spread(a, list[i + 1], 2));

  // ---- outside, clockwise from the admin block's north-west corner ----
  ext('u', 0, 49.9, 73.6, 9.6, 'brick', -1, { g: [54, 62, 69.8].map((c) => gw(c, 3.2)), u: [54, 62, 69.8].map((c) => uw(c, 3.2)) });
  ext('v', 73.6, 0, 9, 9.6, 'brick', 1, { g: [gw(4.5, 2.6)], u: [uw(4.5, 2.6)] });
  ext('u', 9, 73.6, 128.4, 9, 'cream', -1, { g: two(E_N).map((c) => gw(c)), u: two(E_N).map((c) => uw(c)) });
  ext('v', 128.4, 9, 41, 9, 'cream', 1, { g: [gw(16.2), door(25.8, 2.4), gw(34.6)], u: [uw(16.2), uw(25.8, 2.4), uw(34.6)] });
  ext('u', 41, 72.4, 128.4, 9, 'cream', 1, { g: two(E_S).map((c) => gw(c)), u: two(E_S).map((c) => uw(c)) });
  ext('v', 72.4, 41, 46, 9, 'cream', 1, { single: true });
  ext('u', 46, 72.4, 89, 10.8, 'cream', -1, { single: true, g: [door(80.5, 2.4)], u: [win(75.5, 3, 6.4, 8.6), win(85.5, 3, 6.4, 8.6)] });
  ext('v', 89, 46, 52, 10.8, 'cream', 1, { single: true, g: [win(49, 2.4, 1.0, 3.1)] });
  ext('u', 52, 89, 104, 6, 'cream', -1, { single: true, g: [win(96.5, 3, 1.2, 3)] });
  ext('v', 104, 52, 80, 6, 'cream', 1, { single: true, g: [win(58, 2.4, 1.2, 3), door(65.5, 2), win(73, 2.4, 1.2, 3)] });
  ext('u', 80, 89, 104, 6, 'cream', 1, { single: true });
  ext('v', 89, 80, 82.7, 10.8, 'cream', 1, { single: true });
  ext('u', 82.7, 58, 89, 10.8, 'cream', 1, { single: true, g: [door(73.5, 3.2, 0, 2.8)], u: spread(58, 89, 4).map((c) => win(c, 3.4, 7.4, 9.4)) });
  ext('v', 58, 68.5, 82.7, 10.8, 'cream', -1, { single: true, u: [win(75.6, 3.4, 7.4, 9.4)] });
  ext('u', 68.5, 0, 58, 9, 'cream', 1, {
    g: [...two(W_S.slice(0, 6)).map((c) => gw(c)), gw(54)], u: [...two(W_S.slice(0, 6)).map((c) => uw(c)), uw(54)],
  });
  ext('v', 0, 36.2, 68.5, 9, 'cream', -1, { g: [gw(42.8), door(52, 2.4), gw(61.5)], u: [uw(42.8), door(52, 1.8, FLOOR2), uw(61.5)] });
  ext('u', 36.2, 0, 38.8, 9, 'cream', -1, { g: two(W_N).map((c) => gw(c)), u: two(W_N).map((c) => uw(c)) });
  ext('v', 38.8, 18.6, 36.2, 9, 'cream', -1, { single: true, g: [gw(23.4, 2.6), gw(32.2, 2.6)], u: [uw(23.4, 2.6), uw(32.2, 2.6)] });
  ext('u', 18.6, 38.8, 49.9, 9, 'glass', -1, { single: true, g: [door(44.4, 3.6, 0, 2.7)] });
  ext('v', 49.9, 0, 18.6, 9.6, 'brick', -1, { g: [gw(7, 3.2), gw(16.3, 2.6)], u: [uw(5, 3.2), uw(15, 3.2)] });

  // ---- tall inside walls (where a taller block meets a lower one, the stairs, the library) ----
  int('u', 23.3, 49.9, 73.6, 2, [door(54), door(69), door(63, 3, FLOOR2)], 9.6);                    // admin | main hall
  int('v', 49.9, 18.6, 23.3, 2, [win(21, 2.9, 1.05, 2.5), win(21, 2.9, 5.4, 7.4)], 9.6);             // reception counter | lobby
  int('v', 73.6, 9, 23.3, 2, [], 9.6);                                                              // admin | east wing
  int('v', 72.4, 28.3, 41, 2);                                                                      // stairs | east wing
  int('v', 66, 32, 46, 2, [door(45, 1.7, 0, 3.2)]);                                                 // spine | stairs
  int('v', 66, 46, 68.5, 2, [door(50, 4, 0, 3.4), door(58, 4, 0, 3.4)], 10.8);                      // spine | dining (two archways)
  int('u', 46, 66, 72.4, 2, [], 10.8);                                                              // stairs | dining
  int('u', 68.5, 58, 66, 2, [door(63, 3, 0, 2.8)], 10.8);                                           // spine | gym
  int('u', 68.5, 66, 89, 2, [], 10.8);                                                              // stage | gym
  int('v', 89, 52, 80, 2, [win(56, 5, 1.0, 2.4), door(60.6, 1.6)], 10.8);                           // dining, gym | kitchen (serving hatch + door)
  int('u', 41, 38.8, 60, 2);                                                                        // library | restrooms
  int('v', 38.8, 36.2, 49.5, 2);                                                                    // computer lab | library, restrooms
  int('v', 60, 54.5, 68.5, 2, [door(61)]);                                                          // workroom | spine
  int('v', 66, 28.3, 32, 0);                                                                        // under the top landing
  int('u', 28.3, 66, 72.4, 0);
  int('v', 60, 41, 49.5, 0);                                                                        // restrooms | spine
  int('v', 60, 41, 49.5, 1, [door(45.2, 1.8, FLOOR2)]);                                             // book room | bridge
  int('u', 54.5, 60, 66, 1);                                                                        // the bridge's south end

  // ---- both wings, the same upstairs and down ----
  for (const lvl of [0, 1] as const) {
    const y = lvl ? FLOOR2 : 0;
    // East wing: hall walls with a door per room, then the room dividers.
    int('u', HALL.v0, 73.6, 128.4, lvl, E_N.slice(0, 5).map((a) => door(a + 1.7, 1.8, y)));
    int('u', HALL.v1, 72.4, 128.4, lvl, E_S.slice(0, 5).map((a) => door(a + 1.7, 1.8, y)));
    for (const a of E_N.slice(1, 5)) int('v', a, 9, HALL.v0, lvl);
    for (const a of E_S.slice(1, 5)) int('v', a, HALL.v1, 41, lvl);
    // West wing.
    const north = W_N.slice(0, 4).map((a) => door(a + 1.7, 1.8, y));
    int('u', WCOR.v0, 0, 60, lvl, lvl ? [...north, door(49.4, 1.8, y)] : [...north, door(42.4, 1.6), door(49.6, 1.6), door(56.6, 1.6)]);
    int('u', WCOR.v1, 0, 60, lvl, W_S.slice(0, 6).map((a) => door(a + 1.7, 1.8, y)));
    for (const a of W_N.slice(1, 4)) int('v', a, 36.2, WCOR.v0, lvl);
    for (const a of W_S.slice(1, 6)) int('v', a, WCOR.v1, 68.5, lvl);
  }
  // Restrooms + a small office, downstairs only.
  int('v', 46, 41, WCOR.v0, 0);
  int('v', 53.2, 41, WCOR.v0, 0);
  // Admin, downstairs: reception + clinic by the hall, three offices behind.
  int('u', 14, 49.9, 73.6, 0, [door(55.8, 1.6), door(60, 1.6), door(69, 1.6)]);
  int('v', 58, 0, 14, 0);
  int('v', 66, 0, 14, 0);
  int('v', 62, 14, 23.3, 0, [door(18.5, 1.6)]);
  // Over admin: the big-group room across the north, science and a flex lab either side of a short hall.
  int('u', 10, 49.9, 73.6, 1, [door(63, 3, FLOOR2)], 9.6);
  int('v', 60, 10, 23.3, 1, [door(16, 1.8, FLOOR2)], 9.6);
  int('v', 66, 10, 23.3, 1, [door(16, 1.8, FLOOR2)], 9.6);
  return ws;
}
export const WALLS: Wall[] = buildWalls();

/**
 * The solid pieces of a wall once its openings are cut out, as
 * (a0, a1, y0, y1). Openings that share a span along the wall (a window above
 * a door, two stacked windows) are cut from the same column.
 */
export function wallPieces(w: Wall): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const cols = new Map<string, Opening[]>();
  for (const o of w.open) { const k = `${o.a0.toFixed(3)}:${o.a1.toFixed(3)}`; cols.set(k, [...(cols.get(k) ?? []), o]); }
  const sorted = [...cols.values()].sort((p, q) => p[0].a0 - q[0].a0);
  let a = w.a0;
  for (const col of sorted) {
    const { a0, a1 } = col[0];
    if (a0 > a + 0.01) out.push([a, a0, w.y0, w.y1]);
    let y = w.y0;
    for (const o of col.sort((p, q) => p.y0 - q.y0)) {
      if (o.y0 > y + 0.01) out.push([a0, a1, y, o.y0]);
      y = o.y1;
    }
    if (w.y1 > y + 0.01) out.push([a0, a1, y, w.y1]);
    a = a1;
  }
  if (w.a1 > a + 0.01) out.push([a, w.a1, w.y0, w.y1]);
  return out;
}

// ------------------------------------------------------------------- rooms --
export type RoomKind = 'prek' | 'kinder' | 'class' | 'art' | 'music' | 'computer' | 'life' | 'club' | 'reading' | 'work' | 'flex' | 'books'
  | 'science' | 'lgi' | 'principal' | 'conference' | 'lounge' | 'reception' | 'clinic' | 'restroom' | 'office';
/**
 * A room. `cor` is the side its door wall is on; furniture is placed by
 * distance along that wall (from the room's west or north end) and distance
 * in from it, so the same layout works on both sides of a corridor.
 */
export interface Room { name: string; kind: RoomKind; u0: number; u1: number; v0: number; v1: number; lvl: 0 | 1; cor: 'n' | 's' | 'e' | 'w'; doorAt: number; color: string }

const GRADE = { prek: '#f2b632', kinder: '#e0533c', g1: '#f08a2c', g2: '#3fae5a', g3: '#2f7fd1', g4: '#8a5cc7', g5: '#1fa6a0' };

function buildRooms(): Room[] {
  const rs: Room[] = [];
  const row = (edges: number[], v0: number, v1: number, lvl: 0 | 1, cor: 'n' | 's', defs: [string, RoomKind, string][]) =>
    defs.forEach(([name, kind, color], i) => rs.push({ name, kind, color, u0: edges[i], u1: edges[i + 1], v0, v1, lvl, cor, doorAt: edges[i] + 1.7 }));
  const c = (name: string, color: string): [string, RoomKind, string] => [name, 'class', color];
  // East wing.
  row(E_N, 9, HALL.v0, 0, 's', [['Pre-K', 'prek', GRADE.prek], ['Pre-K', 'prek', GRADE.prek], ['Pre-K', 'prek', GRADE.prek], ['Pre-K', 'prek', GRADE.prek], ['Kindergarten', 'kinder', GRADE.kinder]]);
  row(E_S, HALL.v1, 41, 0, 'n', [['Reading Room', 'reading', '#2f7fd1'], ['ECSE', 'prek', '#35a84a'], ['Kindergarten', 'kinder', GRADE.kinder], ['Kindergarten', 'kinder', GRADE.kinder], ['Kindergarten', 'kinder', GRADE.kinder]]);
  row(E_N, 9, HALL.v0, 1, 's', [c('5th Grade', GRADE.g5), c('5th Grade', GRADE.g5), c('5th Grade', GRADE.g5), c('5th Grade', GRADE.g5), c('5th Grade', GRADE.g5)]);
  row(E_S, HALL.v1, 41, 1, 'n', [['Flex Lab', 'flex', '#e0533c'], c('4th Grade', GRADE.g4), c('4th Grade', GRADE.g4), c('4th Grade', GRADE.g4), c('4th Grade', GRADE.g4)]);
  // West wing.
  row(W_N, 36.2, WCOR.v0, 0, 's', [c('1st Grade', GRADE.g1), ['Art', 'art', '#c2459b'], ['Music', 'music', '#8a5cc7'], ['Computer Lab', 'computer', '#1f2a5c']]);
  row(W_S, WCOR.v1, 68.5, 0, 'n', [c('1st Grade', GRADE.g1), c('1st Grade', GRADE.g1), c('1st Grade', GRADE.g1), ['Life Skills', 'life', '#35a84a'], ['After-School Club', 'club', '#e0533c'], ['Workroom', 'work', '#6b7076']]);
  row(W_N, 36.2, WCOR.v0, 1, 's', [c('3rd Grade', GRADE.g3), c('3rd Grade', GRADE.g3), c('3rd Grade', GRADE.g3), c('3rd Grade', GRADE.g3)]);
  row(W_S, WCOR.v1, 68.5, 1, 'n', [c('2nd Grade', GRADE.g2), c('2nd Grade', GRADE.g2), c('2nd Grade', GRADE.g2), c('2nd Grade', GRADE.g2), ['Flex Room', 'flex', '#f2b632'], ['Book Storage', 'books', '#8f6f4f']]);
  // Between the library and the west corridor.
  rs.push({ name: 'Girls', kind: 'restroom', color: '#c2459b', u0: 38.8, u1: 46, v0: 41, v1: WCOR.v0, lvl: 0, cor: 's', doorAt: 42.4 });
  rs.push({ name: 'Boys', kind: 'restroom', color: '#2f7fd1', u0: 46, u1: 53.2, v0: 41, v1: WCOR.v0, lvl: 0, cor: 's', doorAt: 49.6 });
  rs.push({ name: 'Counselor', kind: 'office', color: '#35a84a', u0: 53.2, u1: 60, v0: 41, v1: WCOR.v0, lvl: 0, cor: 's', doorAt: 56.6 });
  rs.push({ name: 'Book Room', kind: 'books', color: '#8f6f4f', u0: 38.8, u1: 60, v0: 41, v1: WCOR.v0, lvl: 1, cor: 's', doorAt: 49.4 });
  // Admin.
  rs.push({ name: 'Front Office', kind: 'reception', color: '#1f2a5c', u0: 49.9, u1: 62, v0: 14, v1: 23.3, lvl: 0, cor: 's', doorAt: 54 });
  rs.push({ name: 'Nurse', kind: 'clinic', color: '#e0533c', u0: 62, u1: 73.6, v0: 14, v1: 23.3, lvl: 0, cor: 's', doorAt: 69 });
  rs.push({ name: 'Principal', kind: 'principal', color: '#1f2a5c', u0: 49.9, u1: 58, v0: 0, v1: 14, lvl: 0, cor: 's', doorAt: 55.8 });
  rs.push({ name: 'Conference', kind: 'conference', color: '#6b7076', u0: 58, u1: 66, v0: 0, v1: 14, lvl: 0, cor: 's', doorAt: 60 });
  rs.push({ name: "Teachers' Lounge", kind: 'lounge', color: '#35a84a', u0: 66, u1: 73.6, v0: 0, v1: 14, lvl: 0, cor: 's', doorAt: 69 });
  rs.push({ name: 'Big Group Room', kind: 'lgi', color: '#1f2a5c', u0: 49.9, u1: 73.6, v0: 0, v1: 10, lvl: 1, cor: 's', doorAt: 63 });
  rs.push({ name: 'Science Lab', kind: 'science', color: '#35a84a', u0: 49.9, u1: 60, v0: 10, v1: 23.3, lvl: 1, cor: 'e', doorAt: 16 });
  rs.push({ name: 'Maker Lab', kind: 'flex', color: '#f08a2c', u0: 66, u1: 73.6, v0: 10, v1: 23.3, lvl: 1, cor: 'w', doorAt: 16 });
  return rs;
}
export const ROOMS: Room[] = buildRooms();

/** The big shared spaces (for floors, signs and the furniture pass). */
export const LOBBY = { u0: 38.8, u1: 49.9, v0: 18.6, v1: HALL.v1 };
export const LIBRARY = { u0: 38.8, u1: SPINE.u0, v0: HALL.v1, v1: 41 };
export const DINING = { u0: 66, u1: 89, v0: 46, v1: STAGE.v0 };
export const GYM = { u0: 58, u1: 89, v0: 68.5, v1: 82.7 };
export const KITCHEN = { u0: 89, u1: 104, v0: 52, v1: 80 };

/** Where the upstairs floor is (everything else is open to the roof). */
export const UPPER_SLABS: { u0: number; u1: number; v0: number; v1: number }[] = [
  { u0: 49.9, u1: 73.6, v0: 0, v1: 23.3 },                 // over admin
  { u0: 72.4, u1: 128.4, v0: 9, v1: 41 },                  // east wing
  { u0: 0, u1: 38.8, v0: 36.2, v1: 68.5 },                 // west wing
  { u0: 38.8, u1: 60, v0: 41, v1: 68.5 },
  { u0: SPINE.u0, u1: SPINE.u1, v0: HALL.v0, v1: 68.5 },   // the bridge (and the ceiling of the spine's south end)
  { u0: 66, u1: 72.4, v0: HALL.v0, v1: STAIR.vTop },       // the top landing
];

// ------------------------------------------------------------------ floors --
export function buildColonySchoolFloors(): Floor[] {
  const out: Floor[] = [];
  for (const s of UPPER_SLABS) out.push({ minX: X(s.u0), maxX: X(s.u1), minZ: Z(s.v0), maxZ: Z(s.v1), baseY: FLOOR2, topY: FLOOR2 });
  // The main stairs climb north; the fire stair outside climbs south.
  out.push({ minX: X(STAIR.u0 + 0.2), maxX: X(STAIR.u1 - 0.2), minZ: Z(STAIR.vTop), maxZ: Z(STAIR.vBot), baseY: 0, topY: FLOOR2, axis: 'z', invert: true });
  out.push({ minX: X(FIRE.u0), maxX: X(FIRE.u1 + 0.4), minZ: Z(FIRE.vBot), maxZ: Z(FIRE.vTop), baseY: 0, topY: FLOOR2, axis: 'z' });
  out.push({ minX: X(FIRE.u0), maxX: X(FIRE.u1 + 0.4), minZ: Z(FIRE.vTop), maxZ: Z(FIRE.vEnd), baseY: FLOOR2, topY: FLOOR2 });
  // The stage, and the two little flights of steps up to it.
  out.push({ minX: X(STAGE.u0), maxX: X(STAGE.u1), minZ: Z(STAGE.v0), maxZ: Z(STAGE.v1), baseY: STAGE.y, topY: STAGE.y });
  for (const [a, b] of STAGE.steps) out.push({ minX: X(a), maxX: X(b), minZ: Z(STAGE.stepV0), maxZ: Z(STAGE.v0), baseY: 0, topY: STAGE.y, axis: 'z' });
  return out;
}

// --------------------------------------------------------------- colliders --
/** Collider height bands: downstairs things stop at the slab, upstairs things start there. */
const LOW: [number, number] = [0, CEIL1], HIGH: [number, number] = [CEIL1, 13];

export function buildColonySchoolColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const add = (u0: number, u1: number, v0: number, v1: number, [minY, maxY]: [number, number], tag = 'colony-school') =>
    out.push({ minX: X(Math.min(u0, u1)), maxX: X(Math.max(u0, u1)), minZ: Z(Math.min(v0, v1)), maxZ: Z(Math.max(v0, v1)), minY, maxY, tag });
  for (const w of WALLS) {
    const h = w.t / 2;
    const bands: [number, number][] = [];
    if (w.y0 < 4) bands.push(LOW);
    if (w.y1 > 5) bands.push(HIGH);
    for (const band of bands) {
      // Only doors on this band's level make a gap; windows stay solid.
      const doors = w.open.filter((o) => o.door && (band === LOW ? o.y0 < 1 : o.y0 >= 4)).sort((p, q) => p.a0 - q.a0);
      let a = w.a0;
      const seg = (a0: number, a1: number) => { if (a1 - a0 > 0.02) { if (w.ax === 'u') add(a0, a1, w.c - h, w.c + h, band); else add(w.c - h, w.c + h, a0, a1, band); } };
      for (const d of doors) { seg(a, d.a0); a = d.a1; }
      seg(a, w.a1);
    }
  }
  // The bridge's railing over the library and the lobby.
  add(SPINE.u0 - 0.1, SPINE.u0 + 0.1, HALL.v0, 41, HIGH);
  // Fire stair: a rail down its outer side, across its far end, and nothing to walk under but the landing.
  add(FIRE.u0 - 0.15, FIRE.u0, FIRE.vBot, FIRE.vTop, [0, 13]);
  add(FIRE.u0 - 0.15, FIRE.u0, FIRE.vTop, FIRE.vEnd, HIGH);
  add(FIRE.u0, 0, FIRE.vEnd, FIRE.vEnd + 0.15, HIGH);
  add(FIRE.u0, 0, FIRE.vTop - 0.1, FIRE.vTop + 0.1, LOW);
  // The stage front: you climb the steps, you don't walk through it.
  const front: [number, number][] = [[STAGE.u0, STAGE.steps[0][0]], [STAGE.steps[0][1], STAGE.steps[1][0]], [STAGE.steps[1][1], STAGE.u1]];
  for (const [a, b] of front) add(a, b, STAGE.v0 - 0.1, STAGE.v0 + 0.1, [0, 0.55]);
  for (const [a, b] of STAGE.steps) for (const e of [a, b]) add(e - 0.08, e + 0.08, STAGE.stepV0, STAGE.v0, [0, 0.3]);
  return out;
}

/** Furniture colliders are added by the furniture pass (world/colonySchoolRooms.ts). */
export const bandFor = (lvl: 0 | 1): [number, number] => (lvl ? HIGH : LOW);
