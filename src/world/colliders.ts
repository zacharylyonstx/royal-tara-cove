import type { HouseConfig, Lot, RectCollider, Vec2 } from '../types';
import { houseTransform } from './streetLayout';

const FENCE_THICKNESS = 0.15;

/**
 * Build the static collider list for the whole world. Houses, fences, mailboxes,
 * and props all live here. Doors live here too but with `passable: true` initially
 * so the runtime can flip them on E-press.
 */
export function buildColliders(houses: HouseConfig[], lots: Lot[]): RectCollider[] {
  const out: RectCollider[] = [];

  // ---- House bodies (axis-aligned only when yaw is 0/90/180/270; otherwise we approximate with the body's bounding box) ----
  for (const h of houses) {
    // Hero house emits piecewise wall colliders (with door gaps) via
    // buildHeroExteriorColliders, so skip the solid body AABB here.
    if (h.isHero) continue;
    const tx = houseTransform(h.position, h.depth);
    // Compute the AABB of the rotated rectangle of size (width × depth).
    const cosY = Math.cos(tx.yaw);
    const sinY = Math.sin(tx.yaw);
    const halfW = h.width / 2;
    const halfD = h.depth / 2;
    // Four corner offsets in local (x, z) before rotation.
    const corners: Vec2[] = [
      [-halfW, -halfD],
      [halfW, -halfD],
      [halfW, halfD],
      [-halfW, halfD],
    ];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [lx, lz] of corners) {
      const wx = tx.worldX + lx * cosY + lz * sinY;
      const wz = tx.worldZ + (-lx) * sinY + lz * cosY;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }
    out.push({
      minX, maxX, minZ, maxZ,
      minY: 0, maxY: h.stories * 3 + 2,
      tag: `house-${h.address}`,
    });

    // Mailbox post in front (small)
    // Position derived in Yard.tsx: roughly at (garageOnLeft ? +halfW-1 : -halfW+1) in local at the curb.
    // We approximate by placing at the front of the house, offset toward the street by FRONT_YARD_DEPTH.
  }

  // ---- Fences along non-front lot edges ----
  for (const lot of lots) {
    const n = lot.polygon.length;
    for (let i = 0; i < n; i++) {
      if (!shouldFenceEdgeIndex(lot, i)) continue;
      const a = lot.polygon[i];
      const b = lot.polygon[(i + 1) % n];
      // Skip degenerate edges
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.05) continue;
      // AABB of the segment plus FENCE_THICKNESS
      const minX = Math.min(a[0], b[0]) - FENCE_THICKNESS;
      const maxX = Math.max(a[0], b[0]) + FENCE_THICKNESS;
      const minZ = Math.min(a[1], b[1]) - FENCE_THICKNESS;
      const maxZ = Math.max(a[1], b[1]) + FENCE_THICKNESS;
      out.push({
        minX, maxX, minZ, maxZ,
        minY: 0, maxY: 1.8,
        tag: `fence-${lot.address}-${i}`,
      });
    }
  }

  return out;
}

function shouldFenceEdgeIndex(lot: Lot, edgeIndex: number): boolean {
  if (!lot.isWedge) {
    return edgeIndex !== lot.frontEdgeIndex;
  }
  // Wedge polygon = [innerArcSamples, outerArcSamples]. Inner arc = first samples-1 edges.
  const samples = 9;
  if (edgeIndex < samples - 1) return false;
  return true;
}

/**
 * AABB collider helper for arbitrary props that supply a center + size.
 */
export function rectAt(cx: number, cz: number, sx: number, sz: number, opts?: Partial<RectCollider>): RectCollider {
  return {
    minX: cx - sx / 2,
    maxX: cx + sx / 2,
    minZ: cz - sz / 2,
    maxZ: cz + sz / 2,
    minY: opts?.minY ?? 0,
    maxY: opts?.maxY ?? 2,
    passable: opts?.passable,
    tag: opts?.tag,
  };
}
