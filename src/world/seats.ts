import type { CharacterId } from '../types';

// Passenger seats per vehicle kind — "can other people go inside the car?"
// (Penny) and "make it so somebody can get in the bed of the truck" (Luke).
//
// Offsets are in the VEHICLE's local frame as drawn by RiddenBike: the model
// nose points down local −Z, +X is the driver's right, and the group is yawed
// by riding.heading. `y` is the rider's position height BEFORE Character.tsx's
// −0.45 m car-seat sink, so cab seats use 0 (same as the driver) and the truck
// bed uses ≈0.95 → the kid sits with their feet in the bed (floor ≈0.84) and
// their head above the rails. Measured from truck.glb through the GLBModel fit
// (4.92 × 2.19 × 1.90; bed interior local z +1.0..+2.15).

export type CarKind = 'sedan' | 'truck' | 'golfcart';

export interface Seat {
  x: number;
  y: number;
  z: number;
  /** Prompt label ("E hop in the back 🛻"). */
  label: string;
}

export const SEATS: Record<CarKind, Seat[]> = {
  truck: [
    { x: 0.62, y: 0, z: 0.0, label: 'ride along 🛻' },
    { x: -0.45, y: 0.95, z: 1.55, label: 'hop in the back 🛻' },
    { x: 0.45, y: 0.95, z: 1.55, label: 'hop in the back 🛻' },
  ],
  sedan: [
    { x: 0.55, y: 0, z: -0.1, label: 'ride along 🚗' },
    { x: -0.45, y: 0, z: 0.9, label: 'hop in the back 🚗' },
    { x: 0.45, y: 0, z: 0.9, label: 'hop in the back 🚗' },
  ],
  golfcart: [
    { x: 0.45, y: 0, z: 0.0, label: 'ride along ⛳' },
  ],
};

/** Where a pet rides (Sparky in the truck bed / on the golf cart's rack / the sedan's rear deck). */
export const PET_SEAT: Record<CarKind, { x: number; y: number; z: number }> = {
  truck: { x: 0, y: 0.84, z: 2.0 },
  sedan: { x: 0, y: 1.02, z: 1.55 },
  golfcart: { x: 0, y: 0.72, z: 1.0 },
};

/** Where an adopted PUP rides (tucked in front of Sparky's spot / beside him). */
export const PUP_SEAT: Record<CarKind, { x: number; y: number; z: number }> = {
  truck: { x: 0, y: 0.84, z: 1.15 },
  sedan: { x: -0.5, y: 1.02, z: 1.55 },
  golfcart: { x: -0.4, y: 0.72, z: 1.0 },
};

/** Vehicle-local offset → world, given the driver's position + heading. */
export function seatWorld(
  driverX: number,
  driverY: number,
  driverZ: number,
  heading: number,
  seat: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return {
    x: driverX + seat.x * c + seat.z * s,
    y: driverY + seat.y,
    z: driverZ - seat.x * s + seat.z * c,
  };
}

/** Encode/decode the interaction candidate id for a seat ("dad:1"). */
export function seatCandidateId(driver: CharacterId, seat: number): string {
  return `${driver}:${seat}`;
}
export function parseSeatCandidateId(id: string): { driver: CharacterId; seat: number } | null {
  const i = id.indexOf(':');
  if (i < 0) return null;
  const driver = id.slice(0, i) as CharacterId;
  const seat = Number(id.slice(i + 1));
  if (!Number.isFinite(seat)) return null;
  return { driver, seat };
}
