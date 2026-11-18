// The MetroRail Red Line you can ride: Avery Ranch → The Domain → Downtown
// Austin → Bastrop (The Colony).
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
//     the MoPac main lanes. (It never crosses US-183 up here.)
//   • The Domain's own stop, North Burnet/Uptown, is still being built in real
//     life (Kramer, a mile's walk away, serves it today). The game opens it
//     early. It sits east of Burnet Road; the Domain is across the road.
//   • On into town the real stops are Kramer, McKalla (Q2 Stadium), Crestview,
//     Highland, MLK Jr., Plaza Saltillo and Downtown (by the Convention Center,
//     the end of the real line). Every road is crossed at grade; only the
//     freeways go over the top — US-183 once and I-35 twice.
//   • Downtown → Bastrop is MADE UP: there is no railway to The Colony. The
//     game's extension leaves Downtown over Lady Bird Lake, passes the airport
//     and the SH-130 toll road, follows the TX-71 country past the pecan farm
//     with the giant squirrel and into the Lost Pines, then crosses the
//     Colorado River to end beside Sam Houston Drive.
//   • The trains are Stadler GTW 2/6 diesel railcars: two passenger cars with a
//     short power module in the middle that you can walk through.
//
// SIX trains run a loop: southbound on the WEST track, northbound on the EAST
// track, and at each end of the line the train reverses out over a crossover
// to the other track (it has a cab at both ends, so it never turns round).
// One leaves every HEADWAY_S seconds in each direction. Everything here is a
// pure function of the rail clock `rail.T` (host-owned, see
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
export const STN_DOMAIN_Z = STN_AVERY_Z + 820;      // 598
export const STN_DOWNTOWN_Z = STN_DOMAIN_Z + 960;   // 1558
export const STN_BASTROP_Z = STN_DOWNTOWN_Z + 1500; // 3058
/** Avery Ranch → Bastrop, platform centre to platform centre. */
export const ROUTE_LEN = STN_BASTROP_Z - STN_AVERY_Z;
export const PLATFORM_HALF_LEN = 18;
/** Island platform edges (a hand's width from the car sides). */
export const PLATFORM_X0 = RAIL_X + TRAIN_HALF_W + 0.1;
export const PLATFORM_X1 = RAIL_X_B - TRAIN_HALF_W - 0.1;
export const RAMP_LEN = 6.5;

export type StationId = 'avery' | 'domain' | 'downtown' | 'bastrop';
export interface Station {
  id: StationId; name: string; short: string; z: number;
  /** Which end the access ramp is on (+1 = south end, −1 = north end). */
  rampDir: 1 | -1;
}
export const STATIONS: Record<StationId, Station> = {
  avery: { id: 'avery', name: 'Avery Ranch', short: 'Avery Ranch', z: STN_AVERY_Z, rampDir: 1 },
  domain: { id: 'domain', name: 'The Domain', short: 'The Domain', z: STN_DOMAIN_Z, rampDir: 1 },
  downtown: { id: 'downtown', name: 'Downtown Austin', short: 'Downtown', z: STN_DOWNTOWN_Z, rampDir: 1 },
  bastrop: { id: 'bastrop', name: 'Bastrop · The Colony', short: 'Bastrop', z: STN_BASTROP_Z, rampDir: 1 },
};
/** North → south. */
export const STATION_ORDER: StationId[] = ['avery', 'domain', 'downtown', 'bastrop'];

/** The buffer stops at Bastrop: the rails end here. */
export const TRACK_Z_S = STN_BASTROP_Z + PLATFORM_HALF_LEN + 0.6;

/** Where a reversing train changes track (z span, north → south). At Avery it
 *  leaves the EAST platform face and slides over to the west track; at Bastrop
 *  it leaves the WEST face and slides over to the east track. */
export const XOVER_AVERY: [number, number] = [STN_AVERY_Z + 56, STN_AVERY_Z + 126];
export const XOVER_BASTROP: [number, number] = [STN_BASTROP_Z - 132, STN_BASTROP_Z - 52];

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
// ---- The Domain → Downtown (the real stops, passed without stopping) ----
export const KRAMER_Z = 772;
export const Q2_Z = 880;          // McKalla station + the soccer stadium
export const US183_Z = 968;       // Research Blvd, overhead
export const LAMAR_Z = 1028;      // North Lamar, at grade
export const CRESTVIEW_Z = 1052;
export const HIGHLAND_Z = 1150;
export const I35_N_Z = 1232;      // I-35 overhead (first time)
export const MLK_BLVD_Z = 1292;   // E MLK Jr. Blvd, at grade
export const MLK_Z = 1318;
export const SALTILLO_Z = 1404;
export const I35_S_Z = 1476;      // I-35 overhead (second time)
// ---- Downtown → Bastrop (the made-up extension) ----
export const CHAVEZ_Z = 1612;     // Cesar Chavez St, at grade
export const LAKE_Z: [number, number] = [1636, 1720];   // Lady Bird Lake
export const AIRPORT_Z = 1930;
export const SH130_Z = 2082;      // toll road, overhead
export const FM_ROAD_Z = 2228;    // a farm road, at grade
export const SQUIRREL_Z = 2340;   // the pecan farm
export const PINES_Z: [number, number] = [2450, 2760];  // the Lost Pines
export const RIVER_Z: [number, number] = [2796, 2870];  // Colorado River
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
  { z: KRAMER_Z, label: 'Kramer Station' },
  { z: Q2_Z - 20, label: 'Q2 Stadium' },
  { z: Q2_Z + 16, label: 'Q2 Stadium' },
  { z: US183_Z, label: 'under US-183' },
  { z: LAMAR_Z + 12, label: 'Crestview Station' },
  { z: HIGHLAND_Z, label: 'Highland Station' },
  { z: I35_N_Z, label: 'under I-35' },
  { z: MLK_Z, label: 'MLK Jr. Station' },
  { z: SALTILLO_Z, label: 'Plaza Saltillo' },
  { z: I35_S_Z, label: 'under I-35 again' },
  { z: LAKE_Z[0] + 22, label: 'Lady Bird Lake' },
  { z: LAKE_Z[1] - 22, label: 'Lady Bird Lake' },
  { z: AIRPORT_Z - 40, label: 'the airport' },
  { z: AIRPORT_Z, label: 'the airport' },
  { z: AIRPORT_Z + 40, label: 'the airport' },
  { z: SH130_Z, label: 'under the SH-130 toll road' },
  { z: SQUIRREL_Z - 30, label: 'the pecan farm' },
  { z: SQUIRREL_Z + 8, label: 'the giant squirrel!' },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ z: PINES_Z[0] + 20 + k * 40, label: 'the Lost Pines' })),
  { z: RIVER_Z[0] + 18, label: 'the Colorado River' },
  { z: RIVER_Z[1] - 18, label: 'the Colorado River' },
  { z: XOVER_BASTROP[0] + 20, label: 'The Colony' },
];

/** Roads the line crosses at grade: z, and how wide the road is. Only the
 *  boulevard at home has real gate colliders (the others are far from anyone). */
export const ROAD_CROSSINGS: { z: number; w: number; colliders: boolean }[] = [
  { z: WEST_BLVD_Z, w: 14.4, colliders: true },
  { z: LAKELINE_BLVD_Z, w: 11, colliders: false },
  { z: PARMER_Z, w: 13, colliders: false },
  { z: LAMAR_Z, w: 12, colliders: false },
  { z: MLK_BLVD_Z, w: 11, colliders: false },
  { z: CHAVEZ_Z, w: 12, colliders: false },
  { z: FM_ROAD_Z, w: 9, colliders: false },
];

// ---------------------------------------------------------------- timetable --
export const DWELL_S = 24;   // doors-open stop
const ACC_S = 11;            // seconds to reach line speed (and to brake)
const DOOR_OPEN_AT = 0.9, DOOR_OPEN_S = 1.3;
/** Doors start closing this long before departure (the chime plays then). */
export const DOOR_CLOSE_LEAD = 4.2;
const DOOR_CLOSE_S = 1.4;
/** Seconds each station-to-station run takes (north → south). The Bastrop
 *  run is an express: half as far again, at 20 m/s. */
const RUN_S = [72, 82, 86];

/** One leg of the loop: stand at `stn`, then run to `to`. */
export interface Leg {
  stn: StationId; to: StationId; dir: 1 | -1;
  z0: number; len: number; run: number; vmax: number;
  /** Loop time at which the train stops at `stn`. */
  t0: number;
}
export const LEGS: Leg[] = (() => {
  const out: Leg[] = [];
  let t = 0;
  const add = (a: number, b: number) => {
    const from = STATIONS[STATION_ORDER[a]], to = STATIONS[STATION_ORDER[b]];
    const len = Math.abs(to.z - from.z), run = RUN_S[Math.min(a, b)];
    out.push({ stn: from.id, to: to.id, dir: b > a ? 1 : -1, z0: from.z, len, run, vmax: len / (run - ACC_S), t0: t });
    t += DWELL_S + run;
  };
  add(0, 1); add(1, 2); add(2, 3); add(3, 2); add(2, 1); add(1, 0);
  return out;
})();
/** One whole loop, Avery Ranch → Bastrop → Avery Ranch. (The rail clock is
 *  only ever sent over the network modulo this.) */
export const PERIOD_S = LEGS.reduce((s, l) => s + DWELL_S + l.run, 0);
export const N_TRAINS = 6;
/** A train leaves each platform face this often. */
export const HEADWAY_S = PERIOD_S / N_TRAINS;
/** Line speed north of Downtown (the Bastrop express runs faster). */
export const LINE_SPEED = LEGS[0].vmax;

/** Distance run after t seconds of a station-to-station trip (0..run). */
function runDist(l: Leg, t: number): number {
  const a = l.vmax / ACC_S;
  if (t <= 0) return 0;
  if (t >= l.run) return l.len;
  if (t < ACC_S) return 0.5 * a * t * t;
  if (t > l.run - ACC_S) { const r = l.run - t; return l.len - 0.5 * a * r * r; }
  return 0.5 * a * ACC_S * ACC_S + l.vmax * (t - ACC_S);
}
function runSpeed(l: Leg, t: number): number {
  const a = l.vmax / ACC_S;
  if (t <= 0 || t >= l.run) return 0;
  if (t < ACC_S) return a * t;
  if (t > l.run - ACC_S) return a * (l.run - t);
  return l.vmax;
}
function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/** Which track centreline a train heading `dir` is on at `z`: southbound runs
 *  on the west track, northbound on the east — except just out of a terminus,
 *  where it is still sliding across from the face it reversed out of. */
export function trackXAt(dir: 1 | -1, z: number): number {
  const k = dir > 0 ? smooth(XOVER_AVERY[0], XOVER_AVERY[1], z) : smooth(XOVER_BASTROP[0], XOVER_BASTROP[1], z);
  return RAIL_X_B + (RAIL_X - RAIL_X_B) * k;
}
const MID_X = (RAIL_X + RAIL_X_B) / 2;

export interface TrainPlan {
  z: number;
  /** Track centreline it is on (changes only on a crossover). */
  x: number;
  /** Signed speed along +Z (south). */
  v: number;
  /** Direction of the current / next run: +1 = southbound (toward Bastrop). */
  dir: 1 | -1;
  /** Station it is standing at (null while running). */
  at: StationId | null;
  /** The station it is heading for (or will head for when it leaves). */
  next: StationId;
  /** The end of the line it is heading for (what the front sign says). */
  dest: StationId;
  /** Which side its doors open on at an island platform: +1 = east. */
  side: 1 | -1;
  /** 0 = shut, 1 = fully open. */
  door: number;
  /** Seconds until it leaves the station it is at (0 while running). */
  departsIn: number;
  /** Seconds until it stops at `next` (includes the rest of a dwell). */
  arrivesIn: number;
  /** 0..1 along the current run (0 while standing). */
  progress: number;
}

function loopPhase(i: number, T: number): number {
  return ((((T + i * HEADWAY_S) % PERIOD_S) + PERIOD_S) % PERIOD_S);
}

/** Where train `i` is at rail-clock time T. */
export function trainPlan(i: number, T: number): TrainPlan {
  const p = loopPhase(i, T);
  let k = LEGS.length - 1;
  while (k > 0 && LEGS[k].t0 > p) k--;
  const l = LEGS[k];
  const q = p - l.t0;
  const dest: StationId = l.dir > 0 ? 'bastrop' : 'avery';
  if (q < DWELL_S) {
    let door = 0;
    if (q > DOOR_OPEN_AT) door = Math.min(1, (q - DOOR_OPEN_AT) / DOOR_OPEN_S);
    const closeAt = DWELL_S - DOOR_CLOSE_LEAD;
    if (q > closeAt) door = Math.max(0, 1 - (q - closeAt) / DOOR_CLOSE_S);
    const x = trackXAt(l.dir, l.z0);
    return { z: l.z0, x, v: 0, dir: l.dir, at: l.stn, next: l.to, dest, side: x < MID_X ? 1 : -1, door, departsIn: DWELL_S - q, arrivesIn: DWELL_S - q + l.run, progress: 0 };
  }
  const t = q - DWELL_S;
  const z = l.z0 + l.dir * runDist(l, t);
  const x = trackXAt(l.dir, z);
  return {
    z, x, v: l.dir * runSpeed(l, t), dir: l.dir, at: null, next: l.to, dest, side: x < MID_X ? 1 : -1, door: 0,
    departsIn: 0, arrivesIn: l.run - t, progress: t / l.run,
  };
}

export interface Departure {
  /** The end of the line this train is going to, and its next stop. */
  dest: StationId; next: StationId; dir: 1 | -1;
  train: number;
  /** True while its doors are open here (inS is then 0). */
  boarding: boolean;
  /** Seconds until it pulls in. */
  inS: number;
  /** How long the doors stay open (from now if boarding, else once it stops). */
  doorsFor: number;
}
/** The next train from a station in each direction it is served (one entry at
 *  the two ends of the line, two in between; southbound first). */
export function departures(stn: StationId, T: number): Departure[] {
  const out: Departure[] = [];
  for (const l of LEGS) {
    if (l.stn !== stn) continue;
    let best: Departure = { dest: l.dir > 0 ? 'bastrop' : 'avery', next: l.to, dir: l.dir, train: 0, boarding: false, inS: Infinity, doorsFor: DWELL_S - DOOR_CLOSE_LEAD };
    for (let i = 0; i < N_TRAINS; i++) {
      // Seconds until train i next STOPS here on this leg.
      const w = (((l.t0 - loopPhase(i, T)) % PERIOD_S) + PERIOD_S) % PERIOD_S;
      const into = PERIOD_S - w; // …or how long ago it did
      if (into < DWELL_S) {
        const doorsFor = DWELL_S - into - DOOR_CLOSE_LEAD;
        if (doorsFor > 0.5) { best = { ...best, train: i, boarding: true, inS: 0, doorsFor }; break; }
        continue; // doors already closing — the next chance is another train
      }
      if (w < best.inS) best = { ...best, train: i, inS: w };
    }
    out.push(best);
  }
  return out.sort((a, b) => b.dir - a.dir);
}

// ------------------------------------------------------------------ runtime --
export interface TrainRT extends TrainPlan {
  /** Position last frame, and how far it moved this frame. */
  prevZ: number; prevX: number;
  dz: number; dx: number;
}
function mkTrain(i: number): TrainRT {
  const pl = trainPlan(i, 0);
  return { ...pl, prevZ: pl.z, prevX: pl.x, dz: 0, dx: 0 };
}
/** Live rail state. Stepped once a frame by systems/RailController. */
export const rail = {
  /** Rail clock (seconds). Host/solo: real time. Guests ease toward the host's. */
  T: 6,
  /** Trains only run in Free Play. */
  live: false,
  trains: Array.from({ length: N_TRAINS }, (_, i) => mkTrain(i)),
  /** Crossing gates down at the boulevard. */
  gateWarning: false,
  /** Latest clock phase heard from the host (guests only), and when. */
  netT: null as number | null,
};

const PARKED_Z = 9000; // where the trains "are" when they aren't running

/** Advance the trains to rail.T and move their colliders + floors with them. */
export function railSync(live: boolean) {
  rail.live = live;
  let warn = false;
  for (let i = 0; i < N_TRAINS; i++) {
    const tr = rail.trains[i];
    const plan = trainPlan(i, rail.T);
    const prevZ = tr.z, prevX = tr.x;
    Object.assign(tr, plan);
    if (!live) tr.z = PARKED_Z + i * 100;
    tr.prevZ = prevZ; tr.prevX = prevX;
    tr.dz = tr.z - prevZ; tr.dx = tr.x - prevX;
    if (live && Math.abs(tr.z - WEST_BLVD_Z) < 160) {
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

/** Which train a point is riding in, or −1. Uses THIS frame's position. */
export function trainAboard(x: number, y: number, z: number): number {
  if (!rail.live || y <= TRAIN_FLOOR_Y - 0.3 || y >= TRAIN_ROOF_Y) return -1;
  for (let i = 0; i < N_TRAINS; i++) {
    const tr = rail.trains[i];
    if (Math.abs(z - tr.z) <= TRAIN_LEN / 2 && Math.abs(x - tr.x) <= TRAIN_HALF_W + 0.02) return i;
  }
  return -1;
}
/** Same test against where the train was LAST frame (for carrying riders). */
export function trainAboardPrev(x: number, y: number, z: number): number {
  if (!rail.live || y <= TRAIN_FLOOR_Y - 0.3 || y >= TRAIN_ROOF_Y) return -1;
  for (let i = 0; i < N_TRAINS; i++) {
    const tr = rail.trains[i];
    if (Math.abs(z - tr.prevZ) <= TRAIN_LEN / 2 && Math.abs(x - tr.prevX) <= TRAIN_HALF_W + 0.02) return i;
  }
  return -1;
}

// ------------------------------------------------------------ car interior --
// Train-local frame = the world frame, just slid along Z — and sideways while
// it changes track (the trains never turn round, so local +Z is always south).
// Layout along Z:
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

interface LocalBox { c: RectCollider; x0: number; x1: number; z0: number; z1: number; door?: -1 | 1 }
const TRAIN_BOXES: LocalBox[][] = Array.from({ length: N_TRAINS }, () => []);
const TRAIN_FLOORS: Floor[] = [];

function buildTrainBoxes(): LocalBox[] {
  const out: LocalBox[] = [];
  const lo = TRAIN_FLOOR_Y - 0.12, hi = TRAIN_ROOF_Y + 0.4;
  const add = (x0: number, x1: number, z0: number, z1: number, tag: string, minY = lo, maxY = hi, door?: -1 | 1) => {
    out.push({ c: { minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY, maxY, tag }, x0, x1, z0, z1, door });
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
  // Only the doors facing the island platform ever open.
  const open = tr.at !== null && tr.door > 0.55;
  for (const b of boxes) {
    b.c.minX = tr.x + b.x0;
    b.c.maxX = tr.x + b.x1;
    b.c.minZ = tr.z + b.z0;
    b.c.maxZ = tr.z + b.z1;
    if (b.door) b.c.passable = open && b.door === tr.side;
  }
  const f = TRAIN_FLOORS[i];
  if (f) {
    // Overlaps the platform edge a touch so there is no crack to fall into.
    f.minX = tr.x - TRAIN_HALF_W - 0.12; f.maxX = tr.x + TRAIN_HALF_W + 0.12;
    f.minZ = tr.z - TRAIN_LEN / 2; f.maxZ = tr.z + TRAIN_LEN / 2;
  }
}

/** The trains' colliders. The SAME objects every call — RailController slides
 *  them along with the trains, so they must stay in the store's list as-is. */
export function buildRailColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  for (let i = 0; i < N_TRAINS; i++) {
    if (!TRAIN_BOXES[i].length) TRAIN_BOXES[i] = buildTrainBoxes();
    for (const b of TRAIN_BOXES[i]) out.push(b.c);
  }
  out.push(...buildStationColliders());
  railSync(rail.live);
  return out;
}

/** Car floors (dynamic) + platforms and ramps (static). Same objects each call. */
export function buildRailFloors(): Floor[] {
  if (!TRAIN_FLOORS.length) {
    for (let i = 0; i < N_TRAINS; i++) {
      TRAIN_FLOORS.push({ minX: 0, maxX: 0, minZ: 0, maxZ: 0, baseY: TRAIN_FLOOR_Y, topY: TRAIN_FLOOR_Y });
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
  for (const c of CITY_STOPS) {
    if (c.kind === 'island') out.push({ minX: PLATFORM_X0, maxX: PLATFORM_X1, minZ: c.z - PLATFORM_HALF_LEN, maxZ: c.z + PLATFORM_HALF_LEN, minY: 0, maxY: 3.4, tag: 'platform-solid' });
    for (const side of [1, -1] as const) {
      if (c.kind !== 'both' && c.kind !== (side > 0 ? 'east' : 'west')) continue;
      const sx = sidePlatX(side);
      out.push({ minX: sx.x0, maxX: sx.x1, minZ: c.z - SIDE_PLAT_HALF, maxZ: c.z + SIDE_PLAT_HALF, minY: 0, maxY: 3.4, tag: 'platform-solid' });
    }
  }
  return out;
}
/** The real stops between the Domain and Downtown — passed, not served.
 *  `kind`: an island between the tracks, or side platforms east / west / both. */
export interface PassedStop { z: number; name: string; kind: 'island' | 'east' | 'west' | 'both'; accent: string }
export const CITY_STOPS: PassedStop[] = [
  { z: KRAMER_Z, name: 'KRAMER', kind: 'both', accent: '#2e7fd0' },
  { z: Q2_Z, name: 'McKALLA', kind: 'both', accent: '#00b140' },
  { z: CRESTVIEW_Z + 22, name: 'CRESTVIEW', kind: 'east', accent: '#e08a2a' },
  { z: HIGHLAND_Z, name: 'HIGHLAND', kind: 'east', accent: '#c8102e' },
  { z: MLK_Z + 14, name: 'MLK JR.', kind: 'island', accent: '#7a4fc3' },
  { z: SALTILLO_Z, name: 'PLAZA SALTILLO', kind: 'west', accent: '#1f5d46' },
];
export const SIDE_PLAT_W = 4.3;
export const SIDE_PLAT_HALF = 15;
/** x-span of a side platform on the given side (+1 = east of the east track). */
export function sidePlatX(side: 1 | -1): { x0: number; x1: number } {
  return side > 0
    ? { x0: RAIL_X_B + TRAIN_HALF_W + 0.1, x1: RAIL_X_B + TRAIN_HALF_W + 0.1 + SIDE_PLAT_W }
    : { x0: RAIL_X - TRAIN_HALF_W - 0.1 - SIDE_PLAT_W, x1: RAIL_X - TRAIN_HALF_W - 0.1 };
}
/** Lakeline's side platform (east of the east track) — passed, not served. */
export const LAKELINE_PLAT = { x0: RAIL_X_B + TRAIN_HALF_W + 0.1, x1: RAIL_X_B + TRAIN_HALF_W + 4.4, half: 15 };
/** Canopy column offsets along the platform (from the station centre). */
export const CANOPY_POSTS = [-12, -4, 4, 12];

/** Height of the rail floor under (x, z) if there is one a pet could stand on
 *  (a platform or a car floor), else 0. */
export function railFloorAt(x: number, z: number): number {
  if (rail.live) for (const tr of rail.trains) {
    if (Math.abs(z - tr.z) <= TRAIN_LEN / 2 && Math.abs(x - tr.x) <= TRAIN_HALF_W) return TRAIN_FLOOR_Y;
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
