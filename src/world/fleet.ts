// Vehicles you can actually drive, down the Red Line: the same cars, trucks,
// golf carts and bikes as on Royal Tara Cove (state/playStore — hop in with E),
// parked at the Domain, Downtown and all over The Colony. Pure data: the
// <Fleet> component registers and draws them; colliders follow each car
// (systems/VehicleColliderSync) under the `prop-…-sedan|truck` tags built here.
import type { RectCollider } from '../types';
import type { CarReg, BikeReg } from '../state/playStore';
import type { DriveRegion } from './westAvery';
import { RAIL_X } from './westAvery';
import { BOUNDS, HOUSES, LAKEHOUSE, LAKEHOUSE_LOT, PLAZA, SCHOOL, PARK, PUMP_TRACK, POCKET_PAVILION } from './colony';
import { BURNET, PLAZA as DOMAIN_PLAZA, WALK_Z } from './domain';
import { CITY_PLAZA, CITY_WALK_Z, SQUARE } from './cityLine';

const COLORS = ['#c7ccd3', '#2f3b4f', '#8c1f24', '#e9e4d6', '#35567e', '#4a4f55', '#d7a23a', '#2d5f46', '#f2f2f0', '#6b7f95', '#b8432e', '#3f72c4'];

/** Where bikes, cars and carts may go down the line (added to the home regions). */
export const FLEET_DRIVE_REGIONS: DriveRegion[] = [
  // The Domain: Burnet Road, the plaza, Rock Rose and the Lawn.
  { kind: 'rect', minX: -352, maxX: RAIL_X - 3.2, minZ: 544, maxZ: 714 },
  // Downtown: the plaza, 4th Street, the square, and up the avenue to the Capitol.
  { kind: 'rect', minX: -322, maxX: RAIL_X - 3.2, minZ: 1470, maxZ: 1625 },
  // The Colony — everywhere inside the ranch fence.
  { kind: 'rect', minX: BOUNDS.x0 + 1.5, maxX: BOUNDS.x1 - 1.5, minZ: BOUNDS.z0 + 1.5, maxZ: BOUNDS.z1 - 1.5 },
];

export const FLEET_CARS: CarReg[] = (() => {
  const out: CarReg[] = [];
  const add = (x: number, z: number, yaw: number, kind: CarReg['kind'] = 'sedan') => {
    const n = out.length;
    out.push({ id: kind === 'golfcart' ? `fleet-${n}-cart` : `fleet-${n}-car`, x, z, yaw, kind, color: kind === 'golfcart' ? '#f2f0e8' : COLORS[(n * 5 + 3) % COLORS.length] });
  };
  // --- The Colony: a car on about one driveway in four, nose to the garage.
  for (const h of HOUSES) {
    if (h.car < 0 || h.seed % 2) continue;
    const c = Math.cos(h.ry), s = Math.sin(h.ry);
    const lx = h.garage * (h.w / 2 - 3.05) + (h.seed % 4 === 0 ? -1.4 : 1.4), lz = h.d / 2 + 3.6;
    add(h.x + lx * c + lz * s, h.z - lx * s + lz * c, h.ry, h.seed % 5 === 0 ? 'truck' : 'sedan');
  }
  // The Lakehouse lot, the school's two lots.
  for (let k = 0; k < 4; k++) add(LAKEHOUSE_LOT.x0 + 8 + k * 22, LAKEHOUSE_LOT.z0 + 3.6, 0, k === 2 ? 'truck' : 'sedan');
  const L = SCHOOL.lot;
  for (let k = 0; k < 8; k++) add(L.x0 + 9.4 + k * 11.2, k % 2 ? L.z1 - 3.4 : L.z0 + 3.4, k % 2 ? Math.PI : 0, k === 5 ? 'truck' : 'sedan');
  for (let k = 0; k < 3; k++) add(SCHOOL.lot2.x0 + 6 + k * 11.2, SCHOOL.lot2.z0 + 3.4, 0);
  // Golf carts: one waiting at the station, one at the Lakehouse.
  add(PLAZA.x1 - 5, PLAZA.z0 + 13, 0, 'golfcart');
  add(LAKEHOUSE.x1 + 7, LAKEHOUSE.z1 + 7, Math.PI / 2, 'golfcart');
  // --- The Domain: parked along Burnet Road, a golf cart on the plaza.
  for (const z of [556, 572, 640, 664, 700]) add(BURNET.x1 - 2.2, z, 0, z === 640 ? 'truck' : 'sedan');
  add(DOMAIN_PLAZA.x0 + 3, WALK_Z + 10, 0, 'golfcart');
  // --- Downtown: at the kerb beside the station, a cart on the plaza.
  for (const z of [1504, 1517.2, 1530.4, 1543.6, 1556.8]) add(CITY_PLAZA.x1 - 6.3, z, 0, z > 1540 && z < 1550 ? 'truck' : 'sedan');
  add(CITY_PLAZA.x0 + 3, CITY_WALK_Z + 10.5, 0, 'golfcart');
  return out;
})();

/** Bikes: a grown-up one and two kid-sized ones wherever you get off a train,
 *  and at the places worth riding to. */
export const FLEET_BIKES: BikeReg[] = (() => {
  const out: BikeReg[] = [];
  const trio = (x: number, z: number, yaw: number, dx: number, dz: number) => {
    const n = out.length;
    out.push({ id: `fleet-bike-${n}`, x, z, color: '#3a6db0', parked: { yaw } });
    out.push({ id: `fleet-bike-${n + 1}`, x: x + dx, z: z + dz, color: '#e26aa1', scale: 0.78, parked: { yaw } });
    out.push({ id: `fleet-bike-${n + 2}`, x: x + dx * 2, z: z + dz * 2, color: '#5cb85c', scale: 0.7, parked: { yaw } });
  };
  trio(PLAZA.x0 + 9.4, PLAZA.z0 + 6.2, 0, 0.9, 0);                       // Bastrop station rack
  trio(SCHOOL.entry.x - 14, SCHOOL.entry.z - 6, 0, 1, 0);                // the school
  trio(PUMP_TRACK.x - 4, PARK.z0 + 8, Math.PI / 2, 1.1, 0);              // by the pump track
  trio(POCKET_PAVILION.x - 8, POCKET_PAVILION.z + 12, 0, 1, 0);          // the pocket park
  trio(60, 3151, 0.6, 0.9, 0.5);                                         // on Chinaberry Bend
  trio(DOMAIN_PLAZA.x0 + 2.4, WALK_Z - 9, 0, 0, 1);                      // the Domain plaza
  trio(CITY_PLAZA.x0 + 2.4, CITY_WALK_Z - 9.5, 0, 0, 1);                 // Downtown plaza
  trio(SQUARE.x1 - 4, CITY_WALK_Z - 12, Math.PI / 2, 0, 1);              // the square
  return out;
})();

/** A box under each parked car (VehicleColliderSync keeps it with the car). */
export function buildFleetColliders(): RectCollider[] {
  return FLEET_CARS.filter((c) => c.kind !== 'golfcart').map((c) => ({
    minX: c.x - 1, maxX: c.x + 1, minZ: c.z - 2.3, maxZ: c.z + 2.3, minY: 0, maxY: 1.8,
    yaw: -c.yaw || 0, tag: `prop-${c.id.slice(0, -4)}-${c.kind === 'truck' ? 'truck' : 'sedan'}`,
  }));
}
