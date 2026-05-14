import type { RectCollider } from '../types';

const PLAYER_RADIUS = 0.32;

/**
 * Resolve a desired horizontal motion against the static collider list.
 * Two-axis decomposition: try X first, then Z, sliding along walls.
 */
export function resolveMotion(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  colliders: RectCollider[],
): { x: number; z: number; collidedX: boolean; collidedZ: boolean } {
  let x = startX;
  let z = startZ;
  let collidedX = false;
  let collidedZ = false;

  // X first
  if (endX !== startX) {
    const tryX = endX;
    let allowed = tryX;
    for (const c of colliders) {
      if (c.passable) continue;
      // Player circle at (allowed, z) overlaps rectangle?
      if (
        allowed + PLAYER_RADIUS > c.minX &&
        allowed - PLAYER_RADIUS < c.maxX &&
        z + PLAYER_RADIUS > c.minZ &&
        z - PLAYER_RADIUS < c.maxZ
      ) {
        // Snap to nearer edge
        if (tryX > startX) {
          // moving +X, snap to c.minX - radius
          if (c.minX - PLAYER_RADIUS < allowed && c.minX - PLAYER_RADIUS >= startX - 0.001) {
            allowed = Math.min(allowed, c.minX - PLAYER_RADIUS);
            collidedX = true;
          } else if (startX - PLAYER_RADIUS < c.maxX) {
            // already inside? leave as is
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

  // Z second, using new x
  if (endZ !== startZ) {
    const tryZ = endZ;
    let allowed = tryZ;
    for (const c of colliders) {
      if (c.passable) continue;
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
      if (
        px > c.minX - 0.05 && px < c.maxX + 0.05 &&
        pz > c.minZ - 0.05 && pz < c.maxZ + 0.05 &&
        py > minY && py < maxY
      ) {
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
