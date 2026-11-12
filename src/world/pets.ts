// Woof Gang adoption center — "what if we make a pet shop? …and we can adopt"
// (Penny). Puppies wait in two pens out front; adopt one and it's YOUR dog: it
// follows you everywhere (and hops in the truck), you can pet it, feed it treats
// for tricks, and friends see it trotting behind you.
import { PENS } from './acrossBlvd';
export { PENS, TREAT_X, TREAT_Z } from './acrossBlvd';

export type PupBreed = 'retriever' | 'pomeranian';
/** Pomeranian coat varieties (each has its own palette in zone/Pomeranian.tsx). */
export type PomCoat = 'orange' | 'white' | 'blacktan';

export interface PupDef {
  id: string;
  name: string;
  breed: PupBreed;
  /** Retrievers: tint over the shared dog GLB. */
  tint: string;
  /** Pomeranians: which coat. */
  coat?: PomCoat;
  /** Size multiplier so the pups read as different dogs. */
  scale: number;
  /** One-liner on the name tag in the pen. */
  blurb: string;
  /** Which pen it waits in, and where (offset from the pen centre). */
  pen: 'pups' | 'poms';
  spot: [dx: number, dz: number];
}

export const PUPS: PupDef[] = [
  { id: 'biscuit', name: 'Biscuit', breed: 'retriever', tint: '#f1e2bf', scale: 0.62, blurb: 'golden pup', pen: 'pups', spot: [-0.7, -0.8] },
  { id: 'pepper', name: 'Pepper', breed: 'retriever', tint: '#5b4636', scale: 0.56, blurb: 'chocolate pup', pen: 'pups', spot: [0.6, 0.0] },
  { id: 'maple', name: 'Maple', breed: 'retriever', tint: '#c4824e', scale: 0.66, blurb: 'red pup', pen: 'pups', spot: [-0.5, 0.85] },
  // The Pomeranians — three coat varieties, all fluff.
  { id: 'peaches', name: 'Peaches', breed: 'pomeranian', coat: 'orange', tint: '#e8943a', scale: 1.0, blurb: 'orange Pomeranian', pen: 'poms', spot: [-0.7, -0.8] },
  { id: 'snowball', name: 'Snowball', breed: 'pomeranian', coat: 'white', tint: '#fbf7ee', scale: 0.92, blurb: 'white Pomeranian', pen: 'poms', spot: [0.6, 0.0] },
  { id: 'bear', name: 'Bear', breed: 'pomeranian', coat: 'blacktan', tint: '#26211f', scale: 1.06, blurb: 'black & tan Pomeranian', pen: 'poms', spot: [-0.5, 0.85] },
];

export function pupById(id: string | null | undefined): PupDef | null {
  if (!id) return null;
  return PUPS.find((p) => p.id === id) ?? null;
}

/** Where a pup waits inside its pen (world). */
export function penSpot(p: PupDef): { x: number; z: number } {
  const pen = PENS.find((q) => q.id === p.pen) ?? PENS[0];
  return { x: pen.x + p.spot[0], z: pen.z + p.spot[1] };
}

// ------------------------------------------------------------------ tricks --

export type DogTrick = 'spin' | 'flip' | 'beg' | 'roll' | 'zoomies' | 'dance';
export const TRICKS: Record<DogTrick, { label: string; duration: number }> = {
  spin:    { label: 'Spin!',        duration: 1.0 },
  flip:    { label: 'Backflip!',    duration: 1.0 },
  beg:     { label: 'Sit pretty!',  duration: 1.7 },
  roll:    { label: 'Roll over!',   duration: 1.2 },
  zoomies: { label: 'ZOOMIES!',     duration: 2.0 },
  dance:   { label: 'Dance!',       duration: 1.9 },
};
/** What each kind of dog knows. Poms are the show-offs. */
export const TRICKS_BY_BREED: Record<PupBreed, DogTrick[]> = {
  retriever: ['spin', 'flip', 'beg', 'roll'],
  pomeranian: ['spin', 'beg', 'zoomies', 'dance', 'flip'],
};
export const ALL_TRICKS = Object.keys(TRICKS) as DogTrick[];

/** Which tricks the dog behind a zone id (`sparky`, `pup-peaches`…) can do. */
export function tricksFor(zoneId: string): DogTrick[] {
  const pup = zoneId.startsWith('pup-') ? pupById(zoneId.slice(4)) : null;
  return TRICKS_BY_BREED[pup?.breed ?? 'retriever'];
}

/** Display name of the dog behind a zone id. */
export function dogName(zoneId: string): string {
  if (zoneId === 'sparky') return 'Sparky';
  return pupById(zoneId.replace(/^pup-/, ''))?.name ?? 'the pup';
}

/** Is this zone interactable a dog (so a treat can be given)? */
export function isDogZone(zoneId: string): boolean {
  return zoneId === 'sparky' || (zoneId.startsWith('pup-') && !!pupById(zoneId.slice(4)));
}
