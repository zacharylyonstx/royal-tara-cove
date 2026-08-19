// Woof Gang adoption center — "what if we make a pet shop? …and we can adopt"
// (Penny). Three puppies in a pen out front; adopt one and it's YOUR dog: it
// follows you everywhere (and hops in the truck), you can pet it, and friends
// see it trotting behind you.
import { PEN_X, PEN_Z } from './acrossBlvd';
export { PEN_X, PEN_Z, PEN_W, PEN_D } from './acrossBlvd';

export interface PupDef {
  id: string;
  name: string;
  /** Tint over the shared dog GLB + a size so the three read as different pups. */
  tint: string;
  scale: number;
}

export const PUPS: PupDef[] = [
  { id: 'biscuit', name: 'Biscuit', tint: '#f1e2bf', scale: 0.62 },
  { id: 'pepper', name: 'Pepper', tint: '#5b4636', scale: 0.56 },
  { id: 'maple', name: 'Maple', tint: '#c4824e', scale: 0.66 },
];

export function pupById(id: string | null | undefined): PupDef | null {
  if (!id) return null;
  return PUPS.find((p) => p.id === id) ?? null;
}

/** The pen sits on the Wing B walkway in front of WOOF GANG (south unit, faces west). */
/** Where each pup waits inside the pen. */
export const PEN_SPOTS: { x: number; z: number }[] = [
  { x: PEN_X - 0.8, z: PEN_Z - 0.9 },
  { x: PEN_X + 0.7, z: PEN_Z + 0.1 },
  { x: PEN_X - 0.5, z: PEN_Z + 1.0 },
];
