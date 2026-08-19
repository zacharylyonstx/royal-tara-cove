// Sparky over the network. The HOST's dog is authoritative: FamilyDog writes
// `dogNetOut` every frame on the host, NetSync ships it in the 10 Hz world
// snapshot, room.ts writes `dogNetIn` on guests, and guests' FamilyDog lerps to
// it instead of running the brain — so everyone sees the SAME dog ("where's
// Sparky?" used to have a different answer on every screen). Plain mutable
// objects (hot path, no React).

export interface DogNetState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  petting: boolean;
  /** Host: the kid he's riding with (null on foot) — guests use it for the seat height. */
  rideWith: string | null;
}

export const dogNetOut: DogNetState = { x: 4, y: 0, z: 24, yaw: Math.PI, petting: false, rideWith: null };
export const dogNetIn: DogNetState & { receivedAt: number } = { x: 4, y: 0, z: 24, yaw: Math.PI, petting: false, rideWith: null, receivedAt: 0 };

declare global {
  interface Window { __dog?: { out: DogNetState; in: DogNetState & { receivedAt: number } }; }
}
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__dog = { out: dogNetOut, in: dogNetIn };
}
