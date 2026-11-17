// The MetroRail Red Line you can ride: Avery Ranch ⇄ The Domain.
//
// Real geography, compressed (the ride is ≈19:1, the rest of the map ≈5:1):
//   • The Red Line really does cross Avery Ranch Blvd at grade, north of
//     Lakeline station. There is no "Avery Ranch" stop in real life — the
//     game adds a small island platform just north of the crossing.
//   • Heading south the real line crosses Lakeline Blvd at grade, passes
//     Lakeline station (park & ride), crosses Parmer Lane at grade, bridges
//     OVER the SH-45 toll road, runs past the Austin White Lime quarry and the
//     Union Pacific junction at McNeil, reaches Howard station — an island
//     platform between two tracks — then crosses Walnut Creek and ducks under
//     the MoPac main lanes. (It never crosses US-183.)
//   • The Domain's own stop, North Burnet/Uptown, is still being built in real
//     life (Kramer, a mile's walk away, serves it today). The game opens it
//     early. It sits east of Burnet Road; the Domain is across the road.
//   • The trains are Stadler GTW 2/6 diesel railcars: two passenger cars with a
//     short power module in the middle that you can walk through.
//
// TWO trains shuttle on their own tracks in opposite phase, so one leaves each
// station every HALF_S seconds and they pass each other mid-route. Everything
// here is a pure function of the rail clock `rail.T` (host-owned, see
// systems/RailController) — positions are never sent over the network.
import type { Floor, RectCollider } from '../types';
import { RAIL_X, RAIL_X_B, WEST_BLVD_Z } from './westAvery';

export const TRACK_X: readonly [number, number] = [RAIL_X, RAIL_X_B];
export const TRAIN_LEN = 30;
export const TRAIN_HALF_W = 1.45;
/** Low-floor cars: the platform and the car floor are one level (roll-on). */
export const TRAIN_FLOOR_Y = 0.8;
export const PLATFORM_Y = TRAIN_FLOOR_Y;
export const TRAIN_ROOF_Y = 3.3;

// ---------------------------------------------------------------- stations --
export const STN_AVERY_Z = -222;
export const ROUTE_LEN = 820;
export const STN_DOMAIN_Z = STN_AVERY_Z + ROUTE_LEN; // 598
export const PLATFORM_HALF_LEN = 18;
/** Island platform edges (a hand's width from the car sides). */
export const PLATFORM_X0 = RAIL_X + TRAIN_HALF_W + 0.1;
export const PLATFORM_X1 = RAIL_X_B - TRAIN_HALF_W - 0.1;
export const RAMP_LEN = 6.5;

export type StationId = 'avery' | 'domain';
export interface Station {
  id: StationId; name: string; short: string; z: number;
  /** Which end the access ramp is on (+1 = south end, −1 = north end). */
  rampDir: 1 | -1;
}
export const STATIONS: Record<StationId, Station> = {
  avery: { id: 'avery', name: 'Avery Ranch', short: 'Avery Ranch', z: STN_AVERY_Z, rampDir: 1 },
  domain: { id: 'domain', name: 'The Domain', short: 'The Domain', z: STN_DOMAIN_Z, rampDir: 1 },
};

/** Where the tracks stop being drawn (they carry on "to Downtown" in the haze). */
export const TRACK_Z_S = STN_DOMAIN_Z + 190;

/** Real places the train rolls past without stopping (z of their centre). */
export const LAKELINE_Z = 262;
export const HOWARD_Z = 452;
/** At-grade road crossings down the line (gates + bells as the train passes). */
export const LAKELINE_BLVD_Z = 228;
export const PARMER_Z = 302;
/** The rail bridge over the SH-45 toll road, the creek bridge, MoPac overhead. */
export const SH45_Z = 326;
export const QUARRY_Z = 380;
export const CREEK_Z = 506;
export const MOPAC_Z = 528;
export interface Sight { z: number; label: string }
/** What the on-board display says as you pass (north → south). */
export const SIGHTS: Sight[] = [
  { z: WEST_BLVD_Z, label: 'Avery Ranch Blvd' },
  { z: -92, label: 'the Red Line Trail' },
  { z: 150, label: 'the limestone cut' },
  { z: LAKELINE_BLVD_Z + 6, label: 'Lakeline Blvd' },
  { z: LAKELINE_Z + 6, label: 'Lakeline Station' },
  { z: PARMER_Z, label: 'Parmer Lane' },
  { z: SH45_Z + 4, label: 'the bridge over SH-45' },
  { z: QUARRY_Z, label: 'the McNeil quarry + freight yard' },
  { z: HOWARD_Z, label: 'Howard Station' },
  { z: CREEK_Z, label: 'Walnut Creek' },
  { z: MOPAC_Z + 8, label: 'under MoPac' },
];

// ---------------------------------------------------------------- timetable --
export const RUN_S = 72;     // station to station
export const DWELL_S = 24;   // doors-open stop
export const HALF_S = RUN_S + DWELL_S;
export const PERIOD_S = HALF_S * 2;
const ACC_S = 11;            // seconds to reach line speed (and to brake)
export const LINE_SPEED = ROUTE_LEN / (RUN_S - ACC_S); // ≈13.4 m/s
const DOOR_OPEN_AT = 0.9, DOOR_OPEN_S = 1.3;
/** Doors start closing this long before departure (the chime plays then). */
export const DOOR_CLOSE_LEAD = 4.2;
const DOOR_CLOSE_S = 1.4;

/** Distance run after t seconds of a station-to-station trip (0..RUN_S). */
function runDist(t: number): number {
  const a = LINE_SPEED / ACC_S;
  if (t <= 0) return 0;
  if (t >= RUN_S) return ROUTE_LEN;
  if (t < ACC_S) return 0.5 * a * t * t;
  if (t > RUN_S - ACC_S) { const r = RUN_S - t; return ROUTE_LEN - 0.5 * a * r * r; }
  return 0.5 * a * ACC_S * ACC_S + LINE_SPEED * (t - ACC_S);
}
function runSpeed(t: number): number {
  const a = LINE_SPEED / ACC_S;
  if (t <= 0 || t >= RUN_S) return 0;
  if (t < ACC_S) return a * t;
  if (t > RUN_S - ACC_S) return a * (RUN_S - t);
  return LINE_SPEED;
}

export interface TrainPlan {
  z: number;
  /** Signed speed along +Z (south). */
  v: number;
  /** Direction of the current / next run: +1 = southbound (to the Domain). */
  dir: 1 | -1;
  /** Station it is standing at (null while running). */
  at: StationId | null;
  /** The station it is heading for (or will head for when it leaves). */
  next: StationId;
  /** 0 = shut, 1 = fully open. */
  door: number;
  /** Seconds until it leaves the station it is at (0 while running). */
  departsIn: number;
  /** Seconds until it stops at `next` (includes the rest of a dwell). */
  arrivesIn: number;
  /** 0..1 along the current run (0 while standing). */
  progress: number;
}

/** Where train `i` (0 = west track, 1 = east track) is at rail-clock time T. */
export function trainPlan(i: number, T: number): TrainPlan {
  const p = ((((T + i * HALF_S) % PERIOD_S) + PERIOD_S) % PERIOD_S);
  const leg = p < HALF_S ? 0 : 1;          // 0: Avery → Domain, 1: Domain → Avery
  const q = p - leg * HALF_S;              // 0..HALF_S within the leg
  const from: StationId = leg === 0 ? 'avery' : 'domain';
  const to: StationId = leg === 0 ? 'domain' : 'avery';
  const dir: 1 | -1 = leg === 0 ? 1 : -1;
  const z0 = leg === 0 ? STN_AVERY_Z : STN_DOMAIN_Z;
  if (q < DWELL_S) {
    let door = 0;
    if (q > DOOR_OPEN_AT) door = Math.min(1, (q - DOOR_OPEN_AT) / DOOR_OPEN_S);
    const closeAt = DWELL_S - DOOR_CLOSE_LEAD;
    if (q > closeAt) door = Math.max(0, 1 - (q - closeAt) / DOOR_CLOSE_S);
    return { z: z0, v: 0, dir, at: from, next: to, door, departsIn: DWELL_S - q, arrivesIn: DWELL_S - q + RUN_S, progress: 0 };
  }
  const t = q - DWELL_S;
  return {
    z: z0 + dir * runDist(t), v: dir * runSpeed(t), dir, at: null, next: to, door: 0,
    departsIn: 0, arrivesIn: RUN_S - t, progress: t / RUN_S,
  };
}

/** Seconds until the next train DEPARTS from a station (0 = one is boarding
 *  right now), which train it is, and how long its doors stay open. */
export function nextDeparture(stn: StationId, T: number): { train: number; boarding: boolean; inS: number; doorsFor: number } {
  let best = { train: 0, boarding: false, inS: Infinity, doorsFor: 0 };
  for (let i = 0; i < 2; i++) {
    const pl = trainPlan(i, T);
    if (pl.at === stn) {
      // Standing here: boarding until the doors start to close.
      const doorsFor = pl.departsIn - DOOR_CLOSE_LEAD;
      if (doorsFor > 0.5) return { train: i, boarding: true, inS: 0, doorsFor };
      // Doors already closing — the next chance is the OTHER train.
      continue;
    }
    if (pl.next === stn && pl.arrivesIn < best.inS) best = { train: i, boarding: false, inS: pl.arrivesIn, doorsFor: DWELL_S - DOOR_CLOSE_LEAD };
  }
  return best;
}

// ------------------------------------------------------------------ runtime --
export interface TrainRT extends TrainPlan {
  x: number;
  /** Position last frame, and how far it moved this frame. */
  prevZ: number;
  dz: number;
}
function mkTrain(i: number): TrainRT {
  return { ...trainPlan(i, 0), x: TRACK_X[i], prevZ: trainPlan(i, 0).z, dz: 0 };
}
/** Live rail state. Stepped once a frame by systems/RailController. */
export const rail = {
  /** Rail clock (seconds). Host/solo: real time. Guests ease toward the host's. */
  T: 6,
  /** Trains only run in Free Play. */
  live: false,
  trains: [mkTrain(0), mkTrain(1)] as [TrainRT, TrainRT],
  /** Crossing gates down at the boulevard. */
  gateWarning: false,
  /** Latest clock phase heard from the host (guests only), and when. */
  netT: null as number | null,
};

const PARKED_Z = 6000; // where the trains "are" when they aren't running

/** Advance the trains to rail.T and move their colliders + floors with them. */
export function railSync(live: boolean) {
  rail.live = live;
  let warn = false;
  for (let i = 0; i < 2; i++) {
    const tr = rail.trains[i];
    const plan = trainPlan(i, rail.T);
    const prev = tr.z;
    Object.assign(tr, plan);
    if (!live) tr.z = PARKED_Z + i * 100;
    tr.prevZ = prev;
    tr.dz = tr.z - prev;
    if (live) {
      // Gates: is the train on (or about to be on) the boulevard crossing?
      for (const look of [0, 2.5, 5, 7.5]) {
        const zz = look === 0 ? tr.z : trainPlan(i, rail.T + look).z;
        if (Math.abs(zz - WEST_BLVD_Z) < TRAIN_LEN / 2 + 9) { warn = true; break; }
      }
    }
    syncTrainBodies(i, tr);
  }
  rail.gateWarning = warn;
}

/** Which train (0/1) a point is riding in, or −1. Uses THIS frame's position. */
export function trainAboard(x: number, y: number, z: number): number {
  if (!rail.live) return -1;
  for (let i = 0; i < 2; i++) {
    const tr = rail.trains[i];
    if (Math.abs(x - tr.x) <= TRAIN_HALF_W + 0.02 && Math.abs(z - tr.z) <= TRAIN_LEN / 2
      && y > TRAIN_FLOOR_Y - 0.3 && y < TRAIN_ROOF_Y) return i;
  }
  return -1;
}
/** Same test against where the train was LAST frame (for carrying riders). */
export function trainAboardPrev(x: number, y: number, z: number): number {
  if (!rail.live) return -1;
  for (let i = 0; i < 2; i++) {
    const tr = rail.trains[i];
    if (Math.abs(x - tr.x) <= TRAIN_HALF_W + 0.02 && Math.abs(z - tr.prevZ) <= TRAIN_LEN / 2
      && y > TRAIN_FLOOR_Y - 0.3 && y < TRAIN_ROOF_Y) return i;
  }
  return -1;
}

// ------------------------------------------------------------ car interior --
// Train-local frame = the world frame, just slid along Z (the trains shuttle
// without ever turning round, so local +Z is always south). Layout along Z:
//   −15 … −12.6  north cab          12.6 … 15   south cab
//   −12.6 … −2.2 north saloon        2.2 … 12.6 south saloon
//   −2.2 … 2.2   power module (a 1 m corridor between the engine rooms)
export const CAB_Z = 12.6;
export const MODULE_HALF = 2.2;
export const MODULE_AISLE_HALF = 0.55;
export const DOOR_Z = 7.4;          // centre of each saloon's doorway (±)
export const DOOR_HALF = 0.95;
export const WALL_T = 0.1;
export const INNER_HALF_W = TRAIN_HALF_W - WALL_T;

export interface SeatDef {
  /** Local centre + size of the seat block (x across, z along). */
  x: number; z: number; w: number; d: number;
  /** Which way the sitter faces: 'n' / 's' along the car, 'e' / 'w' across. */
  face: 'n' | 's' | 'e' | 'w';
}
/** Seats: facing pairs by the windows on one side, a long bench on the other. */
export const SEATS_LOCAL: SeatDef[] = (() => {
  const out: SeatDef[] = [];
  const pairW = 0.92, pairD = 0.52;
  // Each saloon has two seating bays, one either side of the doorway.
  for (const s of [-1, 1]) {
    // Bay centres measured from the middle of the train.
    for (const bz of [4.15, 10.65]) {
      const zc = s * bz;
      const sideX = s < 0 ? -1 : 1; // facing pairs: west side up north, east side down south
      const x = sideX * (INNER_HALF_W - pairW / 2);
      out.push({ x, z: zc - 1.05, w: pairW, d: pairD, face: 's' });
      out.push({ x, z: zc + 1.05, w: pairW, d: pairD, face: 'n' });
      // Long bench against the opposite wall.
      out.push({ x: -sideX * (INNER_HALF_W - 0.26), z: zc, w: 0.52, d: 2.5, face: sideX > 0 ? 'e' : 'w' });
    }
  }
  return out;
})();

interface LocalBox { c: RectCollider; z0: number; z1: number; door?: -1 | 1 }
const TRAIN_BOXES: LocalBox[][] = [[], []];
const TRAIN_FLOORS: Floor[] = [];

function buildTrainBoxes(i: number): LocalBox[] {
  const out: LocalBox[] = [];
  const x = TRACK_X[i];
  const lo = TRAIN_FLOOR_Y - 0.12, hi = TRAIN_ROOF_Y + 0.4;
  const add = (x0: number, x1: number, z0: number, z1: number, tag: string, minY = lo, maxY = hi, door?: -1 | 1) => {
    out.push({ c: { minX: x + x0, maxX: x + x1, minZ: z0, maxZ: z1, minY, maxY, tag }, z0, z1, door });
  };
  const H = TRAIN_HALF_W, L = TRAIN_LEN / 2;
  // Underframe: stops anyone at track level walking through a standing train.
  add(-H, H, -L, L, 'train-under', 0, TRAIN_FLOOR_Y - 0.18);
  // Side walls with a doorway per saloon. Door leaves are separate colliders.
  for (const sx of [-1, 1] as const) {
    const x0 = sx < 0 ? -H : H - WALL_T, x1 = sx < 0 ? -H + WALL_T : H;
    add(x0, x1, -L, -DOOR_Z - DOOR_HALF, 'train-wall');
    add(x0, x1, -DOOR_Z + DOOR_HALF, DOOR_Z - DOOR_HALF, 'train-wall');
    add(x0, x1, DOOR_Z + DOOR_HALF, L, 'train-wall');
    add(x0, x1, -DOOR_Z - DOOR_HALF, -DOOR_Z + DOOR_HALF, 'train-door', lo, hi, sx);
    add(x0, x1, DOOR_Z - DOOR_HALF, DOOR_Z + DOOR_HALF, 'train-door', lo, hi, sx);
  }
  // Ends + the glass partitions behind each cab.
  add(-H, H, -L, -L + WALL_T, 'train-wall');
  add(-H, H, L - WALL_T, L, 'train-wall');
  add(-H, H, -CAB_Z - 0.06, -CAB_Z + 0.06, 'train-cab');
  add(-H, H, CAB_Z - 0.06, CAB_Z + 0.06, 'train-cab');
  // Power module: engine rooms either side of the walk-through corridor.
  add(-H, -MODULE_AISLE_HALF, -MODULE_HALF, MODULE_HALF, 'train-engine');
  add(MODULE_AISLE_HALF, H, -MODULE_HALF, MODULE_HALF, 'train-engine');
  // Seats (you stand at the window between a facing pair).
  for (const s of SEATS_LOCAL) {
    add(s.x - s.w / 2, s.x + s.w / 2, s.z - s.d / 2, s.z + s.d / 2, 'train-seat', lo, TRAIN_FLOOR_Y + 1.15);
  }
  return out;
}

function syncTrainBodies(i: number, tr: TrainRT) {
  const boxes = TRAIN_BOXES[i];
  // Platform side: the island is EAST of the west track, WEST of the east track.
  const platformSide = i === 0 ? 1 : -1;
  const open = tr.at !== null && tr.door > 0.55;
  for (const b of boxes) {
    b.c.minZ = tr.z + b.z0;
    b.c.maxZ = tr.z + b.z1;
    if (b.door) b.c.passable = open && b.door === platformSide;
  }
  const f = TRAIN_FLOORS[i];
  if (f) { f.minZ = tr.z - TRAIN_LEN / 2; f.maxZ = tr.z + TRAIN_LEN / 2; }
}

/** The trains' colliders. The SAME objects every call — RailController slides
 *  them along with the trains, so they must stay in the store's list as-is. */
export function buildRailColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  for (let i = 0; i < 2; i++) {
    if (!TRAIN_BOXES[i].length) TRAIN_BOXES[i] = buildTrainBoxes(i);
    for (const b of TRAIN_BOXES[i]) out.push(b.c);
  }
  out.push(...buildStationColliders());
  railSync(rail.live);
  return out;
}

/** Car floors (dynamic) + platforms and ramps (static). Same objects each call. */
export function buildRailFloors(): Floor[] {
  if (!TRAIN_FLOORS.length) {
    for (let i = 0; i < 2; i++) {
      TRAIN_FLOORS.push({
        // Overlaps the platform edge a touch so there is no crack to fall into.
        minX: TRACK_X[i] - TRAIN_HALF_W - 0.12, maxX: TRACK_X[i] + TRAIN_HALF_W + 0.12,
        minZ: 0, maxZ: 0, baseY: TRAIN_FLOOR_Y, topY: TRAIN_FLOOR_Y,
      });
    }
  }
  railSync(rail.live);
  return [...TRAIN_FLOORS, ...STATION_FLOORS];
}

// ------------------------------------------------------ platforms + ramps --
/** Ramp footprint of a station (the end the island is reached from). */
export function rampSpan(s: Station): { z0: number; z1: number } {
  const edge = s.z + s.rampDir * PLATFORM_HALF_LEN;
  return s.rampDir > 0 ? { z0: edge, z1: edge + RAMP_LEN } : { z0: edge - RAMP_LEN, z1: edge };
}

const STATION_FLOORS: Floor[] = (() => {
  const out: Floor[] = [];
  for (const s of Object.values(STATIONS)) {
    out.push({ minX: PLATFORM_X0 - 0.12, maxX: PLATFORM_X1 + 0.12, minZ: s.z - PLATFORM_HALF_LEN, maxZ: s.z + PLATFORM_HALF_LEN, baseY: PLATFORM_Y, topY: PLATFORM_Y });
    const r = rampSpan(s);
    // Climbs toward the platform: going north (−Z) for a south-end ramp.
    out.push({ minX: PLATFORM_X0 + 0.5, maxX: PLATFORM_X1 - 0.5, minZ: r.z0, maxZ: r.z1, baseY: 0, topY: PLATFORM_Y, axis: 'z', invert: s.rampDir > 0 });
  }
  return out;
})();

function buildStationColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const under = PLATFORM_Y - 0.14;
  for (const s of Object.values(STATIONS)) {
    const zN = s.z - PLATFORM_HALF_LEN, zS = s.z + PLATFORM_HALF_LEN;
    // The platform is a solid block to anyone down at track level…
    out.push({ minX: PLATFORM_X0, maxX: PLATFORM_X1, minZ: zN, maxZ: zS, minY: 0, maxY: under, tag: 'platform' });
    // …with a railing across the end that has no ramp.
    const endZ = s.rampDir > 0 ? zN : zS;
    out.push({ minX: PLATFORM_X0, maxX: PLATFORM_X1, minZ: endZ - 0.08, maxZ: endZ + 0.08, minY: 0, maxY: PLATFORM_Y + 1.2, tag: 'platform-rail' });
    // Ramp: handrails both sides, and short returns beside the ramp mouth so
    // you can only step onto the island from the ramp (never off its corners).
    const r = rampSpan(s);
    for (const x of [PLATFORM_X0 + 0.5, PLATFORM_X1 - 0.5]) {
      out.push({ minX: x - 0.06, maxX: x + 0.06, minZ: r.z0, maxZ: r.z1, minY: 0, maxY: PLATFORM_Y + 1.1, tag: 'platform-rail' });
    }
    const mouthZ = s.rampDir > 0 ? zS : zN;
    out.push({ minX: PLATFORM_X0, maxX: PLATFORM_X0 + 0.5, minZ: mouthZ - 0.08, maxZ: mouthZ + 0.08, minY: 0, maxY: PLATFORM_Y + 1.1, tag: 'platform-rail' });
    out.push({ minX: PLATFORM_X1 - 0.5, maxX: PLATFORM_X1, minZ: mouthZ - 0.08, maxZ: mouthZ + 0.08, minY: 0, maxY: PLATFORM_Y + 1.1, tag: 'platform-rail' });
    // (The slim canopy columns down the middle are deliberately NOT solid: a
    // kid running straight up the ramp for a train shouldn't be stopped dead.)
  }
  // The stations the train only passes: solid, so nobody ends up inside them.
  out.push({ minX: PLATFORM_X0, maxX: PLATFORM_X1, minZ: HOWARD_Z - PLATFORM_HALF_LEN, maxZ: HOWARD_Z + PLATFORM_HALF_LEN, minY: 0, maxY: 3.4, tag: 'platform-solid' });
  out.push({ minX: LAKELINE_PLAT.x0, maxX: LAKELINE_PLAT.x1, minZ: LAKELINE_Z - LAKELINE_PLAT.half, maxZ: LAKELINE_Z + LAKELINE_PLAT.half, minY: 0, maxY: 3.4, tag: 'platform-solid' });
  return out;
}
/** Lakeline's side platform (east of the east track) — passed, not served. */
export const LAKELINE_PLAT = { x0: RAIL_X_B + TRAIN_HALF_W + 0.1, x1: RAIL_X_B + TRAIN_HALF_W + 4.4, half: 15 };
/** Canopy column offsets along the platform (from the station centre). */
export const CANOPY_POSTS = [-12, -4, 4, 12];

/** Height of the rail floor under (x, z) if there is one a pet could stand on
 *  (a platform or a car floor), else 0. */
export function railFloorAt(x: number, z: number): number {
  for (let i = 0; i < 2; i++) {
    const tr = rail.trains[i];
    if (rail.live && Math.abs(x - tr.x) <= TRAIN_HALF_W && Math.abs(z - tr.z) <= TRAIN_LEN / 2) return TRAIN_FLOOR_Y;
  }
  if (x > PLATFORM_X0 && x < PLATFORM_X1) {
    for (const s of Object.values(STATIONS)) if (Math.abs(z - s.z) <= PLATFORM_HALF_LEN) return PLATFORM_Y;
  }
  return 0;
}

/** "Waiting for a train" counts as safe from Siren Head, and so does the ride
 *  and everything down the line (he never leaves the neighbourhood). */
export function railSafe(x: number, y: number, z: number): boolean {
  if (z > 60) return true;
  if (trainAboard(x, y, z) >= 0) return true;
  return x > RAIL_X - 3 && x < RAIL_X_B + 3 && Math.abs(z - STN_AVERY_Z) < PLATFORM_HALF_LEN + RAMP_LEN + 2;
}

/** Nearest station to a point within `range` metres of its platform, or null. */
export function stationNear(x: number, z: number, range: number): StationId | null {
  for (const s of Object.values(STATIONS)) {
    const dx = Math.max(0, Math.abs(x - (PLATFORM_X0 + PLATFORM_X1) / 2) - 2.6);
    const dzv = Math.max(0, Math.abs(z - s.z) - PLATFORM_HALF_LEN);
    if (Math.hypot(dx, dzv) < range) return s.id;
  }
  return null;
}

/** The sight the train at `z` is passing right now (within 34 m), if any. */
export function sightAt(z: number): Sight | null {
  let best: Sight | null = null, bd = 22;
  for (const s of SIGHTS) { const d = Math.abs(s.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
}

// -------------------------------------------------------------------- pets --
const petCache = new WeakMap<RectCollider[], RectCollider[]>();
/** The collider list a PET walks against: platforms and trains don't stop a
 *  dog (pets move in 2-D, so a platform would otherwise be a wall to them). */
export function collidersForPets(all: RectCollider[]): RectCollider[] {
  let c = petCache.get(all);
  if (!c) {
    c = all.filter((x) => !(x.tag && (x.tag.startsWith('train-') || x.tag.startsWith('platform'))));
    petCache.set(all, c);
  }
  return c;
}

/** Where a pet sits when its person (at px,py,pz) is riding a train: at their
 *  heel, inside the car. null when they aren't aboard. `side` spreads pets out. */
export function petRideSpot(px: number, py: number, pz: number, side = 1): { x: number; y: number; z: number; train: number } | null {
  const i = trainAboard(px, py, pz);
  if (i < 0) return null;
  const tr = rail.trains[i];
  const limX = INNER_HALF_W - 0.4, limZ = TRAIN_LEN / 2 - 0.6;
  return {
    x: Math.max(tr.x - limX, Math.min(tr.x + limX, px + 0.55 * side)),
    y: TRAIN_FLOOR_Y,
    z: Math.max(tr.z - limZ, Math.min(tr.z + limZ, pz + 0.5)),
    train: i,
  };
}
