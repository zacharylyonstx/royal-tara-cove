// One "best thing to interact with" picker for the E key / ✋ Use button.
//
// Before this, every interactable lived in its own proximity tier (dresser →
// pet/ice-cream → ball/bike/car → door) and the FIRST tier with anything in
// range ate the press — so Sparky heeling at your feet stole "open door"
// every time (the kids hit this constantly). Now every candidate in range is
// scored by how close it is AND how squarely you're facing it; the best one
// wins and is the ONLY prompt shown. Facing comes from the camera yaw, so
// "look at the door → open door, turn to Sparky → pet Sparky" just works on
// both mouse-look and iPad drag-look.

export type InteractKind =
  | 'dresser'   // id = owner characterId
  | 'zone'      // id = zoneStore interactable id (sparky, duck-0, icecream…)
  | 'ball'      // id = basketball id
  | 'bike'      // id = bike id
  | 'car'       // id = parked car id
  | 'seat'      // id = "driverId:seatIndex" (a free seat in a vehicle someone is driving)
  | 'door';     // id = door id

export interface InteractCandidate {
  kind: InteractKind;
  id: string;
  x: number;
  z: number;
  /** Max reach for this thing (metres). */
  radius: number;
}

/** Small per-kind nudges (in score units, ~0.1 = "a tenth of the reach"). Doors
 *  and vehicles beat the dog on a tie because he is always underfoot. */
const KIND_BIAS: Record<InteractKind, number> = {
  dresser: -0.15,
  ball: -0.1,
  bike: -0.05,
  car: 0,
  seat: -0.05,
  door: 0,
  zone: 0.12,
};

/** How much facing matters vs distance. 0.9 ⇒ something directly behind you
 *  (dot −1) pays +1.8, i.e. it must be far closer than a thing in front to win. */
const FACING_WEIGHT = 0.9;

/**
 * Pick the best candidate within reach.
 * @param px,pz   player position
 * @param fx,fz   unit facing vector (camera forward on XZ)
 */
export function selectInteractable(
  px: number,
  pz: number,
  fx: number,
  fz: number,
  cands: readonly InteractCandidate[],
): InteractCandidate | null {
  let best: InteractCandidate | null = null;
  let bestScore = Infinity;
  for (const c of cands) {
    const dx = c.x - px;
    const dz = c.z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= c.radius) continue;
    // Standing right on top of something: facing is meaningless, treat as "in front".
    const dot = d > 0.35 ? (dx / d) * fx + (dz / d) * fz : 1;
    const score = d / c.radius + (1 - dot) * FACING_WEIGHT + KIND_BIAS[c.kind];
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Camera-yaw → unit forward on XZ (same convention as the controller: yaw 0 looks −Z). */
export function facingFromYaw(yaw: number): { fx: number; fz: number } {
  return { fx: -Math.sin(yaw), fz: -Math.cos(yaw) };
}
