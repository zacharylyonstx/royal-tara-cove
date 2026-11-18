import { useEffect } from 'react';
import { usePlayStore } from '../../state/playStore';
import { FLEET_BIKES, FLEET_CARS } from '../../world/fleet';
import { ParkedCar } from '../HouseProps';

/** The drivable cars, golf carts and bikes down the Red Line (world/fleet.ts).
 *  Bikes are drawn by the shared <ParkedBikes>; cars by <ParkedCar>. */
function registerFleet() {
  for (const c of FLEET_CARS) if (!usePlayStore.getState().cars[c.id]) usePlayStore.getState().registerCar({ ...c });
  for (const b of FLEET_BIKES) if (!usePlayStore.getState().bikes[b.id]) usePlayStore.getState().registerBike({ ...b, parked: b.parked ? { ...b.parked } : undefined });
}
// Registered as soon as the game loads — NOT when Free Play mounts — because the
// host's "here is where every car is parked" message arrives while a joining
// player is still on the menu, and it is ignored for cars that don't exist yet.
registerFleet();

export function Fleet() {
  useEffect(() => { registerFleet(); }, []);
  return <>{FLEET_CARS.map((c) => <ParkedCar key={c.id} carId={c.id} />)}</>;
}
