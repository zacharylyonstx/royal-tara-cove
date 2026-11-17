// The Domain — phase one. A walkable slice of north Austin's "second downtown",
// reached from the Red Line station across Burnet Road:
//
//   station (island platform) → crossing boards → station plaza → the Burnet
//   Road crosswalk → Rock Rose, a shop-lined street strung with lights → the
//   Lawn: big oaks, a stage, a play area and a fountain to run through.
//
// True to the real place in spirit, not in plan: the real Domain station (North
// Burnet/Uptown) is east of Burnet Road and the Domain west of it; the buildings
// are "five-over-one" blocks — shops under apartments — with glass office
// towers behind; Rock Rose and its lawn with a stage are the heart of Domain
// NORTHSIDE; Century Oaks Park keeps the old IBM-era live oaks. Shop names here
// are made up. +X east, +Z south.
import type { RectCollider } from '../types';
import { RAIL_X } from './westAvery';
import { STATIONS, rampSpan } from './redLine';

const dFoot = rampSpan(STATIONS.domain).z1;          // foot of the platform ramp
/** Centreline of the walk from the station to the shops. */
export const WALK_Z = dFoot + 2.6;

export const BURNET = { x0: -207, x1: -195, z0: 540, z1: 716 };
export const PLAZA = { x0: -193, x1: RAIL_X - 2.6, z0: WALK_Z - 14, z1: WALK_Z + 14 };
export const STREET = { x0: -292, x1: -209, z: WALK_Z, half: 7 };
export const LAWN = { x0: -350, x1: -297, z0: WALK_Z - 28, z1: WALK_Z + 28 };
export const FOUNTAIN = { x: -303.5, z: WALK_Z, r: 4.2 };

export interface Shop {
  id: string; name: string; sub: string;
  side: 'n' | 's';
  x0: number; x1: number;
  floors: number;
  wall: string; trim: string; awning: string;
  /** A treat you can get at the door. */
  treat?: { label: string; emoji: string };
}
const LOT_W = 13, LOT_GAP = 0.5;
const lot = (k: number) => { const x1 = -210.5 - k * (LOT_W + LOT_GAP); return { x0: x1 - LOT_W, x1 }; };
export const SHOP_DEPTH = 18;
export const SHOPS: Shop[] = [
  { id: 'scoops', name: 'Sweet Scoops', sub: 'ICE CREAM', side: 'n', ...lot(0), floors: 3, wall: '#e8dcc8', trim: '#f4efe6', awning: '#e86a92', treat: { label: 'get ice cream 🍦', emoji: '🍦' } },
  { id: 'books', name: 'Rock Rose Books', sub: 'STORIES + COMICS', side: 'n', ...lot(1), floors: 4, wall: '#a8553f', trim: '#e9dfcf', awning: '#2f5d50', treat: { label: 'pick out a book 📚', emoji: '📚' } },
  { id: 'tacos', name: 'Taco Garage', sub: 'BREAKFAST TACOS ALL DAY', side: 'n', ...lot(2), floors: 3, wall: '#d9d4c7', trim: '#3b4652', awning: '#e9a020', treat: { label: 'get a taco 🌮', emoji: '🌮' } },
  { id: 'golf', name: 'Tiny Tee', sub: 'INDOOR MINI GOLF', side: 'n', ...lot(3), floors: 4, wall: '#5b6f7c', trim: '#dfe6ea', awning: '#3fae6a', treat: { label: 'grab a putter ⛳', emoji: '⛳' } },
  { id: 'pizza', name: 'Pie Town Pizza', sub: 'BY THE SLICE', side: 'n', ...lot(4), floors: 3, wall: '#c9b08a', trim: '#f1e9d8', awning: '#c8102e', treat: { label: 'get a slice 🍕', emoji: '🍕' } },
  { id: 'toys', name: 'The Toy Chest', sub: 'TOYS · GAMES · KITES', side: 'n', ...lot(5), floors: 4, wall: '#e6c15a', trim: '#fbf5e2', awning: '#2e7fd0', treat: { label: 'pick a toy 🧸', emoji: '🧸' } },
  { id: 'kolache', name: 'Kolache + Coffee', sub: 'WARM FROM THE OVEN', side: 's', ...lot(0), floors: 4, wall: '#8c9a8a', trim: '#eef0e6', awning: '#7a4b2a', treat: { label: 'get a kolache 🥐', emoji: '🥐' } },
  { id: 'burger', name: 'Burger Yard', sub: 'BURGERS + A PLAYGROUND', side: 's', ...lot(1), floors: 3, wall: '#e4d9c6', trim: '#3b4652', awning: '#f0b429', treat: { label: 'get a burger 🍔', emoji: '🍔' } },
  { id: 'cinema', name: 'Starlight Cinema', sub: 'NOW SHOWING', side: 's', ...lot(2), floors: 4, wall: '#3a3550', trim: '#f2d27a', awning: '#b3262e', treat: { label: 'get popcorn 🍿', emoji: '🍿' } },
  { id: 'candy', name: 'Candy Lab', sub: 'SWEETS BY THE SCOOP', side: 's', ...lot(3), floors: 3, wall: '#f0c4d4', trim: '#ffffff', awning: '#4fc3c8', treat: { label: 'get candy 🍭', emoji: '🍭' } },
  { id: 'boots', name: 'Hill Country Boots', sub: 'HATS + BOOTS', side: 's', ...lot(4), floors: 4, wall: '#9b6b43', trim: '#ead9bd', awning: '#3d2a1c', treat: { label: 'try on a hat 🤠', emoji: '🤠' } },
  { id: 'guitar', name: 'Sixth String', sub: 'GUITARS + UKULELES', side: 's', ...lot(5), floors: 3, wall: '#c8cdd2', trim: '#20262d', awning: '#6a4fc3', treat: { label: 'strum a guitar 🎸', emoji: '🎸' } },
];
/** Front wall z of a shop row, and which way it faces (+1 = toward +Z). */
export function shopFront(side: 'n' | 's'): { z: number; face: 1 | -1 } {
  return side === 'n' ? { z: STREET.z - STREET.half, face: 1 } : { z: STREET.z + STREET.half, face: -1 };
}

export interface Tower { x0: number; x1: number; z0: number; z1: number; h: number; glass: string; frame: string; garage?: boolean }
/** The skyline behind the shops (and the old IBM / Uptown campus east of the line). */
export const TOWERS: Tower[] = [
  { x0: -250, x1: -214, z0: 566, z1: 597, h: 15, glass: '#8e959b', frame: '#c9c5ba', garage: true },
  { x0: -291, x1: -256, z0: 560, z1: 596, h: 48, glass: '#5f88a8', frame: '#dfe5ea' },
  { x0: -262, x1: -212, z0: 655, z1: 690, h: 24, glass: '#6b7f8f', frame: '#d9c9ae' },
  { x0: -296, x1: -268, z0: 656, z1: 690, h: 40, glass: '#4f7f9a', frame: '#e8e2d6' },
  { x0: -394, x1: -362, z0: 590, z1: 622, h: 60, glass: '#5a8fb0', frame: '#cfd8de' },
  { x0: -392, x1: -360, z0: 634, z1: 668, h: 44, glass: '#7a9bb0', frame: '#e3dccb' },
  { x0: -340, x1: -306, z0: 556, z1: 586, h: 34, glass: '#6f97ad', frame: '#d7dde0' },
  { x0: -150, x1: -118, z0: 566, z1: 606, h: 14, glass: '#5f7f96', frame: '#cfc8ba' },
  { x0: -150, x1: -116, z0: 624, z1: 682, h: 19, glass: '#6b8ca3', frame: '#d9d2c2' },
];

/** Live oaks on the Lawn (x, z, scale). */
export const LAWN_OAKS: [number, number, number][] = [
  [-312, WALK_Z - 19, 1.5], [-334, WALK_Z - 21, 1.35], [-343, WALK_Z + 3, 1.6], [-318, WALK_Z + 20, 1.45], [-338, WALK_Z + 22, 1.3],
];
export const STAGE = { x: -344.5, z: WALK_Z - 9, w: 7, d: 11 };
export const PLAY = { x: -322, z: WALK_Z + 8 };
export const TACO_TRUCK = { x: -186.5, z: WALK_Z - 10 };
/** Planters along Rock Rose: x, and which side of the centre line (the middle
 *  stays clear so you can walk straight from the crosswalk to the Lawn). */
export const PLANTERS: [number, number][] = [[-222, -3], [-236, 3], [-250, -3], [-264, 3], [-278, -3]];

export interface Treat { id: string; label: string; emoji: string; x: number; z: number }
export const TREATS: Treat[] = [
  ...SHOPS.filter((s) => s.treat).map((s) => {
    const f = shopFront(s.side);
    return { id: `domain-${s.id}`, label: s.treat!.label, emoji: s.treat!.emoji, x: (s.x0 + s.x1) / 2, z: f.z + f.face * 1.3 };
  }),
  { id: 'domain-truck', label: 'get street tacos 🌮', emoji: '🌮', x: TACO_TRUCK.x - 2.2, z: TACO_TRUCK.z },
];

/** Acorn lamp posts (world x, z, yaw) — rendered by the shared StreetLamps rig. */
export const DOMAIN_LAMPS: [number, number, number][] = [
  ...[-216, -243, -270].flatMap((x) => [[x, STREET.z - STREET.half + 1.1, 0], [x - 13.5, STREET.z + STREET.half - 1.1, Math.PI]] as [number, number, number][]),
  [PLAZA.x0 + 1.5, WALK_Z - 5, 0], [PLAZA.x1 - 1.5, WALK_Z + 6, 0],
  [LAWN.x1 - 2, LAWN.z0 + 8, 0], [LAWN.x1 - 2, LAWN.z1 - 8, 0], [LAWN.x0 + 16, WALK_Z, 0],
];

export function buildDomainColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const box = (minX: number, maxX: number, minZ: number, maxZ: number, tag: string, maxY = 6) =>
    out.push({ minX, maxX, minZ, maxZ, minY: 0, maxY, tag });
  for (const s of SHOPS) {
    const f = shopFront(s.side);
    const back = f.z - f.face * SHOP_DEPTH;
    box(s.x0, s.x1, Math.min(f.z, back), Math.max(f.z, back), 'domain-shop', 30);
  }
  for (const t of TOWERS) box(t.x0, t.x1, t.z0, t.z1, 'domain-tower', 60);
  for (const [x, z] of LAWN_OAKS) box(x - 0.55, x + 0.55, z - 0.55, z + 0.55, 'domain-oak');
  for (const [x, dz] of PLANTERS) box(x - 1, x + 1, STREET.z + dz - 1, STREET.z + dz + 1, 'domain-planter', 1.2);
  // Stage: you can't walk through its back wall, but you CAN hop up on it.
  box(STAGE.x - STAGE.w / 2, STAGE.x - STAGE.w / 2 + 0.4, STAGE.z - STAGE.d / 2, STAGE.z + STAGE.d / 2, 'domain-stage');
  box(TACO_TRUCK.x - 1.3, TACO_TRUCK.x + 1.3, TACO_TRUCK.z - 3.4, TACO_TRUCK.z + 3.4, 'domain-truck', 3.4);
  box(PLAY.x - 2.2, PLAY.x + 2.2, PLAY.z - 1.6, PLAY.z + 1.6, 'domain-playset', 3.2);
  return out;
}

/** The stage deck is a real floor (a little step up from the lawn). */
export const STAGE_Y = 0.55;
export function buildDomainFloors() {
  return [{ minX: STAGE.x - STAGE.w / 2, maxX: STAGE.x + STAGE.w / 2, minZ: STAGE.z - STAGE.d / 2, maxZ: STAGE.z + STAGE.d / 2, baseY: STAGE_Y, topY: STAGE_Y }];
}
