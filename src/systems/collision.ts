import type { Floor, RectCollider } from '../types';

const PLAYER_RADIUS = 0.32;

/**
 * The floor surface the player is standing on at (x, z). Returns the highest
 * floor whose surface is REACHABLE from the player's current Y — i.e. a step
 * up no greater than STEP_UP_TOLERANCE. This way the player only snaps up
 * onto a ramp/loft if they're already at its level (or stepping onto it),
 * never if it's a ceiling above them.
 */
const STEP_UP_TOLERANCE = 0.6;

export function floorAt(x: number, z: number, currentY: number, floors: Floor[]): number {
  let best = 0;
  for (const f of floors) {
    if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
    let y: number;
    if (f.axis === 'x') {
      const t = (x - f.minX) / Math.max(0.001, f.maxX - f.minX);
      const k = f.invert ? 1 - t : t;
      y = f.baseY + (f.topY - f.baseY) * k;
    } else if (f.axis === 'z') {
      const t = (z - f.minZ) / Math.max(0.001, f.maxZ - f.minZ);
      const k = f.invert ? 1 - t : t;
      y = f.baseY + (f.topY - f.baseY) * k;
    } else {
      y = f.baseY;
    }
    // Only count floors we can reach: at or below current Y + step tolerance.
    if (y <= currentY + STEP_UP_TOLERANCE && y > best) best = y;
  }
  return best;
}

/**
 * Push a circle (player) out of an OBB collider (rect rotated by `c.yaw`).
 * Returns the new (x, z) so the circle is just touching the OBB edge, plus
 * a `hit` flag. Math: transform the circle into the box's local frame
 * (axis-aligned there), compute the closest point on the box, push along
 * the outward normal, transform back.
 */
function pushOutOfOBB(c: RectCollider, px: number, pz: number): { x: number; z: number; hit: boolean } {
  const cx = (c.minX + c.maxX) / 2;
  const cz = (c.minZ + c.maxZ) / 2;
  const halfX = (c.maxX - c.minX) / 2;
  const halfZ = (c.maxZ - c.minZ) / 2;
  const yaw = c.yaw ?? 0;
  // World → box-local: translate by -center, rotate by -yaw
  const cosNeg = Math.cos(-yaw);
  const sinNeg = Math.sin(-yaw);
  const lx = (px - cx) * cosNeg - (pz - cz) * sinNeg;
  const lz = (px - cx) * sinNeg + (pz - cz) * cosNeg;
  // Closest point on the centered box [-halfX..halfX, -halfZ..halfZ]
  const closestX = Math.max(-halfX, Math.min(halfX, lx));
  const closestZ = Math.max(-halfZ, Math.min(halfZ, lz));
  const dx = lx - closestX;
  const dz = lz - closestZ;
  const distSq = dx * dx + dz * dz;
  if (distSq > PLAYER_RADIUS * PLAYER_RADIUS) return { x: px, z: pz, hit: false };
  const dist = Math.sqrt(distSq);
  let nx: number, nz: number;
  if (dist > 0.001) {
    nx = dx / dist;
    nz = dz / dist;
  } else {
    // Player center is inside the box — push out along the nearest face normal.
    const dRight = halfX - lx;
    const dLeft = lx + halfX;
    const dFar = halfZ - lz;
    const dNear = lz + halfZ;
    const m = Math.min(dRight, dLeft, dFar, dNear);
    if (m === dRight) { nx = 1; nz = 0; }
    else if (m === dLeft) { nx = -1; nz = 0; }
    else if (m === dFar) { nx = 0; nz = 1; }
    else { nx = 0; nz = -1; }
  }
  const newLx = closestX + nx * (PLAYER_RADIUS + 0.001);
  const newLz = closestZ + nz * (PLAYER_RADIUS + 0.001);
  // Box-local → world: rotate by +yaw, translate by +center
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  return {
    x: cx + newLx * cosY - newLz * sinY,
    z: cz + newLx * sinY + newLz * cosY,
    hit: true,
  };
}

/**
 * Resolve a desired horizontal motion against the static collider list.
 * Axis-aligned colliders use the existing two-axis slide (snap along world X
 * then Z, sliding along walls). Oriented colliders (yaw != 0) are handled
 * after with a few iterations of "push circle out of box."
 */
export function resolveMotion(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  colliders: RectCollider[],
  /** Player feet Y. When provided, colliders outside [minY,maxY] are ignored, so
   *  upstairs walls (minY=3) don't block downstairs and vice-versa. Omit for the
   *  old 2D behavior (NPCs, etc.). */
  py?: number,
): { x: number; z: number; collidedX: boolean; collidedZ: boolean } {
  let x = startX;
  let z = startZ;
  let collidedX = false;
  let collidedZ = false;
  const outOfY = (c: RectCollider) =>
    py !== undefined && (py < (c.minY ?? 0) || py > (c.maxY ?? 6));

  // X first (axis-aligned colliders only)
  if (endX !== startX) {
    const tryX = endX;
    let allowed = tryX;
    for (const c of colliders) {
      if (c.passable) continue;
      if (c.yaw) continue;
      if (outOfY(c)) continue;
      if (
        allowed + PLAYER_RADIUS > c.minX &&
        allowed - PLAYER_RADIUS < c.maxX &&
        z + PLAYER_RADIUS > c.minZ &&
        z - PLAYER_RADIUS < c.maxZ
      ) {
        if (tryX > startX) {
          if (c.minX - PLAYER_RADIUS < allowed && c.minX - PLAYER_RADIUS >= startX - 0.001) {
            allowed = Math.min(allowed, c.minX - PLAYER_RADIUS);
            collidedX = true;
          }
        } else {
          if (c.maxX + PLAYER_RADIUS > allowed && c.maxX + PLAYER_RADIUS <= startX + 0.001) {
            allowed = Math.max(allowed, c.maxX + PLAYER_RADIUS);
            collidedX = true;
          }
        }
      }
    }
    x = allowed;
  }

  // Z second (axis-aligned colliders only), using new x
  if (endZ !== startZ) {
    const tryZ = endZ;
    let allowed = tryZ;
    for (const c of colliders) {
      if (c.passable) continue;
      if (c.yaw) continue;
      if (outOfY(c)) continue;
      if (
        x + PLAYER_RADIUS > c.minX &&
        x - PLAYER_RADIUS < c.maxX &&
        allowed + PLAYER_RADIUS > c.minZ &&
        allowed - PLAYER_RADIUS < c.maxZ
      ) {
        if (tryZ > startZ) {
          if (c.minZ - PLAYER_RADIUS < allowed && c.minZ - PLAYER_RADIUS >= startZ - 0.001) {
            allowed = Math.min(allowed, c.minZ - PLAYER_RADIUS);
            collidedZ = true;
          }
        } else {
          if (c.maxZ + PLAYER_RADIUS > allowed && c.maxZ + PLAYER_RADIUS <= startZ + 0.001) {
            allowed = Math.max(allowed, c.maxZ + PLAYER_RADIUS);
            collidedZ = true;
          }
        }
      }
    }
    z = allowed;
  }

  // OBB pass: iterate a few times because pushing out of one box can put
  // the player into another. Three iterations is enough for non-pathological
  // layouts (a corner of two OBBs).
  for (let iter = 0; iter < 3; iter++) {
    let pushed = false;
    for (const c of colliders) {
      if (c.passable || !c.yaw) continue;
      if (outOfY(c)) continue;
      const result = pushOutOfOBB(c, x, z);
      if (result.hit) {
        // Capture the pre-push position so we can attribute the collision to
        // the axis that actually moved more. (Reading after the assignment
        // would always compare result.x against itself → delta 0.)
        const prevX = x;
        const prevZ = z;
        x = result.x;
        z = result.z;
        pushed = true;
        // Treat the OBB push as a collision on whichever axis moved more.
        if (Math.abs(result.x - prevX) >= Math.abs(result.z - prevZ)) collidedX = true;
        else collidedZ = true;
      }
    }
    if (!pushed) break;
  }

  return { x, z, collidedX, collidedZ };
}

const MIN_CAM_DIST = 2.5;

/**
 * Camera unclip raycast: from player chest toward desired camera pos, find the
 * first collider hit and return the safe position. We sample steps along the
 * ray; if blocked we return a position pulled back from the hit. We never
 * collapse the camera all the way to the chest — minimum distance enforced.
 */
export function unclipCamera(
  fromX: number, fromY: number, fromZ: number,
  toX: number, toY: number, toZ: number,
  colliders: RectCollider[],
): { x: number; y: number; z: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dz = toZ - fromZ;
  const totalLen = Math.hypot(dx, dy, dz);
  if (totalLen < 0.0001) return { x: toX, y: toY, z: toZ };

  // Find the smallest t in (0,1] at which the ray enters any collider.
  let blockT = 1;
  const steps = 32;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = fromX + dx * t;
    const py = fromY + dy * t;
    const pz = fromZ + dz * t;
    for (const c of colliders) {
      if (c.passable) continue;
      const minY = c.minY ?? 0;
      const maxY = c.maxY ?? 6;
      if (py < minY || py > maxY) continue;
      let inside: boolean;
      if (c.yaw) {
        const cx = (c.minX + c.maxX) / 2;
        const cz = (c.minZ + c.maxZ) / 2;
        const halfX = (c.maxX - c.minX) / 2;
        const halfZ = (c.maxZ - c.minZ) / 2;
        const cosNeg = Math.cos(-c.yaw);
        const sinNeg = Math.sin(-c.yaw);
        const lx = (px - cx) * cosNeg - (pz - cz) * sinNeg;
        const lz = (px - cx) * sinNeg + (pz - cz) * cosNeg;
        inside = lx > -halfX - 0.05 && lx < halfX + 0.05 && lz > -halfZ - 0.05 && lz < halfZ + 0.05;
      } else {
        inside = px > c.minX - 0.05 && px < c.maxX + 0.05 && pz > c.minZ - 0.05 && pz < c.maxZ + 0.05;
      }
      if (inside) {
        blockT = Math.min(blockT, t);
        break;
      }
    }
    if (blockT < 1) break;
  }

  // Pull back a bit before the hit point so the camera isn't kissing the wall.
  const safeT = Math.max(MIN_CAM_DIST / totalLen, blockT - 0.1 / totalLen);
  // Cap at 1 (full requested distance is fine if no hit).
  const useT = Math.min(1, safeT);
  return {
    x: fromX + dx * useT,
    y: fromY + dy * useT,
    z: fromZ + dz * useT,
  };
}
