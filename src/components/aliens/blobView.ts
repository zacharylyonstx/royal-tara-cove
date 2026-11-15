import type { Blob } from '../../state/combatStore';

/**
 * What a blob LOOKS like on this screen, separate from the simulated blob.
 *
 * The sim stamps spawn/death/hit times with the HOST's clock, and guests get
 * positions in 10 Hz snapshots. Reading those raw made the kids' screens (the
 * guests) wrong in every way that matters: a clock that's ahead meant the
 * "erupt" scale-in never finished (blobs invisible), death pops fired late or
 * never, and the blobs teleported in steps. So each renderer keeps this little
 * local view: its own first-seen / died / got-hit times, an eased position,
 * and a facing that turns toward where the blob is going.
 */
export interface BlobView {
  ready: boolean;
  seenAt: number;
  deadAt: number;
  hitAt: number;
  lastHp: number;
  wasAlive: boolean;
  x: number; y: number; z: number;
  yaw: number;
}

export function newBlobView(): BlobView {
  return { ready: false, seenAt: 0, deadAt: -999, hitAt: -999, lastHp: 0, wasAlive: true, x: 0, y: 0, z: 0, yaw: 0 };
}

/** Advance the view. (faceX, faceZ) = who it glares at when it isn't moving. */
export function updateBlobView(v: BlobView, blob: Blob, now: number, dt: number, faceX: number, faceZ: number): void {
  if (!v.ready) {
    v.ready = true;
    v.seenAt = now;
    v.lastHp = blob.hp;
    v.wasAlive = blob.alive;
    // First seen already dead (late join): skip the pop.
    v.deadAt = blob.alive ? -999 : now - 10;
    v.x = blob.x; v.y = blob.y; v.z = blob.z;
    v.yaw = Math.atan2(faceX - blob.x, faceZ - blob.z);
    return;
  }
  if (blob.hp < v.lastHp) v.hitAt = now;
  v.lastHp = blob.hp;
  if (v.wasAlive && !blob.alive) v.deadAt = now;
  v.wasAlive = blob.alive;

  const ex = blob.x - v.x, ey = blob.y - v.y, ez = blob.z - v.z;
  const gap = Math.hypot(ex, ez);
  if (gap > 8) {
    v.x = blob.x; v.y = blob.y; v.z = blob.z;
  } else {
    // Quick ease: invisible on the host (the sim already moves smoothly) and
    // turns a guest's 10 Hz steps into motion.
    const k = 1 - Math.exp(-dt * 16);
    v.x += ex * k; v.y += ey * k; v.z += ez * k;
  }
  if (!blob.alive) return;
  // Face the way it's heading; when (nearly) still, face its prey.
  let tx = ex, tz = ez;
  if (gap < 0.04) { tx = faceX - v.x; tz = faceZ - v.z; }
  if (Math.abs(tx) + Math.abs(tz) > 0.001) {
    let d = Math.atan2(tx, tz) - v.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.yaw += d * Math.min(1, dt * 7);
  }
}

/** World-space direction → the blob's local frame (for pupils that track you). */
export function toBlobLocal(v: BlobView, ux: number, uz: number): [number, number] {
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  return [ux * c - uz * s, ux * s + uz * c];
}
