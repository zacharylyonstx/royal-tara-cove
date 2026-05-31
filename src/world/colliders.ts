import type { HouseConfig, Lot, RectCollider } from '../types';
import { FRONT_YARD_DEPTH, houseTransform } from './streetLayout';
import type { HouseProps } from './props';

const GARAGE_W = 5.6; // mirror of HouseProps.tsx

const FENCE_THICKNESS = 0.15;

/**
 * Build the static collider list for the whole world. Houses, fences, and
 * fixed-prop colliders. Doors live here too but with `passable: true`
 * initially so the runtime can flip them on E-press.
 *
 * House bodies use OBBs (RectCollider.yaw) so the collider matches the
 * rotated house exactly — no invisible-wall padding around the visible
 * footprint. Fences emit thin OBBs along the actual segment line.
 */
export function buildColliders(houses: HouseConfig[], lots: Lot[]): RectCollider[] {
  const out: RectCollider[] = [];

  // ---- House bodies: piecewise wall OBBs with a front-door GAP so every
  // house is enterable (walk in through the open door). Hero house emits its
  // own walls via buildHeroExteriorColliders, so skip it here. ----
  const WALL_T = 0.3;
  // Gap slightly NARROWER than the door collider (1.05 m wide) so a closed door
  // fully seals it; opening the door lets you walk in.
  const DOOR_GAP_HALF = 0.5;
  const pushWall = (
    pivotX: number, pivotZ: number, yaw: number,
    lcx: number, lcz: number, sx: number, sz: number, maxY: number, tag: string,
  ) => {
    if (sx <= 0.02 || sz <= 0.02) return;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const wx = pivotX + lcx * cy + lcz * sy;
    const wz = pivotZ - lcx * sy + lcz * cy;
    out.push({ minX: wx - sx / 2, maxX: wx + sx / 2, minZ: wz - sz / 2, maxZ: wz + sz / 2, minY: 0, maxY, yaw, tag });
  };
  for (const h of houses) {
    if (h.isHero) continue;
    const tx = houseTransform(h.position, h.depth);
    const halfW = h.width / 2;
    const halfD = h.depth / 2;
    const maxY = h.stories * 3 + 0.5;
    const doorCenterX = h.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;
    const dl = doorCenterX - DOOR_GAP_HALF;
    const dr = doorCenterX + DOOR_GAP_HALF;
    const p = (lcx: number, lcz: number, sx: number, sz: number, tag: string) =>
      pushWall(tx.worldX, tx.worldZ, tx.yaw, lcx, lcz, sx, sz, maxY, `house-${h.address}-${tag}`);
    // Front wall split around the front-door gap.
    p((-halfW + dl) / 2, -halfD, dl - -halfW, WALL_T, 'front-l');
    p((dr + halfW) / 2, -halfD, halfW - dr, WALL_T, 'front-r');
    // Back + side walls (solid).
    p(0, halfD, 2 * halfW, WALL_T, 'back');
    p(-halfW, 0, WALL_T, 2 * halfD, 'side-l');
    p(halfW, 0, WALL_T, 2 * halfD, 'side-r');
  }

  // ---- Fence segments as thin OBBs along the actual segment line ----
  for (const lot of lots) {
    const n = lot.polygon.length;
    for (let i = 0; i < n; i++) {
      if (!shouldFenceEdgeIndex(lot, i)) continue;
      const a = lot.polygon[i];
      const b = lot.polygon[(i + 1) % n];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const cx = (a[0] + b[0]) / 2;
      const cz = (a[1] + b[1]) / 2;
      const yaw = Math.atan2(dz, dx); // segment runs along local +X
      out.push({
        minX: cx - len / 2, maxX: cx + len / 2,
        minZ: cz - FENCE_THICKNESS, maxZ: cz + FENCE_THICKNESS,
        minY: 0, maxY: 1.8,
        yaw,
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
 * Emit collision boxes for the visible decorative props (vehicles, hoops,
 * trash bins, BBQ, garden beds, bikes, flagpoles). Each prop is placed in
 * HOUSE-LOCAL coordinates that match HouseProps.tsx, then rotated into
 * world space as an OBB with `yaw = lot.houseYaw` so the collider lines up
 * exactly with the rendered mesh.
 */
export function buildPropColliders(
  houses: HouseConfig[],
  lots: Map<string, Lot>,
  propsByAddress: Map<string, HouseProps>,
): RectCollider[] {
  const out: RectCollider[] = [];

  const addLocal = (
    pivotX: number, pivotZ: number, yaw: number,
    localCx: number, localCz: number,
    sizeX: number, sizeZ: number,
    minY: number, maxY: number,
    tag: string,
  ) => {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const wx = pivotX + localCx * cy + localCz * sy;
    const wz = pivotZ - localCx * sy + localCz * cy;
    out.push({
      minX: wx - sizeX / 2, maxX: wx + sizeX / 2,
      minZ: wz - sizeZ / 2, maxZ: wz + sizeZ / 2,
      minY, maxY,
      yaw,
      tag,
    });
  };

  for (const h of houses) {
    const data = propsByAddress.get(h.address);
    if (!data) continue;
    const lot = lots.get(h.address);
    if (!lot) continue;
    const halfW = h.width / 2;
    const halfD = h.depth / 2;
    const sidewalkZ = -halfD - FRONT_YARD_DEPTH;
    const garageCenterX = h.garageOnLeft
      ? -halfW + 0.6 + GARAGE_W / 2
      : halfW - 0.6 - GARAGE_W / 2;
    const driveZCenter = (sidewalkZ + -halfD) / 2 + 0.6;
    const backyardZ = halfD + 6;
    const ballSide = h.garageOnLeft ? 1 : -1;
    const px = lot.housePivot[0];
    const pz = lot.housePivot[1];
    const yaw = lot.houseYaw;
    const add = (cx: number, cz: number, sx: number, sz: number, minY: number, maxY: number, tag: string) =>
      addLocal(px, pz, yaw, cx, cz, sx, sz, minY, maxY, `prop-${h.address}-${tag}`);

    if (data.tags.has('truck')) {
      add(garageCenterX, driveZCenter, 2.0, 4.8, 0, 1.9, 'truck');
    } else if (data.tags.has('sedan')) {
      add(garageCenterX, driveZCenter, 1.7, 4.4, 0, 1.5, 'sedan');
    }

    if (data.tags.has('hoop')) {
      // Post collider only (small) — backboard is up high, irrelevant
      const postX = garageCenterX + ballSide * (GARAGE_W / 2 + 0.6);
      add(postX, sidewalkZ - 0.4, 0.4, 0.4, 0, 3.5, 'hoop');
    }

    if (data.tags.has('bins')) {
      const cx = (h.garageOnLeft ? halfW - 1.8 : -halfW + 1.8) * 0.7;
      add(cx, sidewalkZ - 0.5, 1.4, 0.7, 0, 1.2, 'bins');
    }

    if (data.tags.has('gardenBed')) {
      const cx = h.garageOnLeft ? halfW - 2.5 : -halfW + 2.5;
      add(cx, -halfD - 0.6, 1.6, 0.8, 0, 0.4, 'gardenBed');
    }

    if (data.tags.has('bike')) {
      const cx = garageCenterX - (h.garageOnLeft ? 1.6 : -1.6);
      add(cx, -halfD - 1.6, 0.5, 1.6, 0, 1.0, 'bike');
    }

    if (data.tags.has('kidsBikes')) {
      add(garageCenterX - 1.5, -halfD - 1.4, 0.5, 1.2, 0, 0.8, 'pinkbike');
      add(garageCenterX - 0.4, -halfD - 1.6, 0.5, 1.2, 0, 0.8, 'greenbike');
    }

    if (data.tags.has('patio')) {
      // Patio table set + BBQ in backyard
      add(1.5, backyardZ, 1.8, 1.8, 0, 1.0, 'patio-table');
      add(-2.0, backyardZ + 1.5, 1.0, 0.6, 0, 1.2, 'patio-bbq');
    }

    if (data.tags.has('flagpole')) {
      const cx = h.garageOnLeft ? -halfW - 1.0 : halfW + 1.0;
      add(cx, -halfD - 4.0, 0.4, 0.4, 0, 6.5, 'flagpole');
    }
  }

  return out;
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
