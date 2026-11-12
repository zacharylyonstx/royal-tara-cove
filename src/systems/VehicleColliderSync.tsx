import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';
import type { RectCollider } from '../types';

// Parked vehicles get a static collider at their ORIGINAL driveway spot
// (world/colliders.ts buildPropColliders). Once cars became drivable and
// parkable that box never followed them: drive Dad's truck away and an invisible
// truck-sized wall stayed in the driveway by the hoop (blocking walkers, cars
// and basketballs), while the truck itself had no collision where it now stood.
//
// This keeps those boxes glued to the vehicles: it moves each collider to
// wherever its car/bike is parked right now and makes it passable while someone
// is driving/riding it. The colliders are mutated in place, so every consumer of
// gameStore.staticColliders (players, NPCs, dogs, balls) sees the same truth.

const BIKE_TAGS: [suffix: string, tag: string][] = [
  ['-bike', 'bike'],
  ['-kbike-0', 'pinkbike'],
  ['-kbike-1', 'greenbike'],
];

interface Tracked { c: RectCollider; sx: number; sz: number }

export function VehicleColliderSync() {
  const cache = useRef<{ src: RectCollider[] | null; byTag: Map<string, Tracked> }>({ src: null, byTag: new Map() });

  useFrame(() => {
    const colliders = useGameStore.getState().staticColliders;
    const k = cache.current;
    if (k.src !== colliders) {
      k.src = colliders;
      k.byTag = new Map();
      for (const c of colliders) {
        if (!c.tag || !c.tag.startsWith('prop-')) continue;
        if (/-(truck|sedan|bike|pinkbike|greenbike)$/.test(c.tag)) {
          k.byTag.set(c.tag, { c, sx: c.maxX - c.minX, sz: c.maxZ - c.minZ });
        }
      }
    }
    if (k.byTag.size === 0) return;
    const play = usePlayStore.getState();
    const inUse = new Set<string>();
    for (const r of Object.values(play.riding)) if (r && !r.passengerOf && r.bikeId) inUse.add(r.bikeId);

    const place = (t: Tracked, x: number, z: number, heading: number, busy: boolean) => {
      t.c.passable = busy;
      if (busy) return;
      t.c.minX = x - t.sx / 2; t.c.maxX = x + t.sx / 2;
      t.c.minZ = z - t.sz / 2; t.c.maxZ = z + t.sz / 2;
      // RectCollider.yaw is the collision convention = −(three.js rotation.y).
      t.c.yaw = -heading || 0;
    };

    for (const car of Object.values(play.cars)) {
      if (!car.id.endsWith('-car')) continue;
      const addr = car.id.slice(0, -4);
      const t = k.byTag.get(`prop-${addr}-${car.kind === 'truck' ? 'truck' : 'sedan'}`);
      if (t) place(t, car.x, car.z, car.yaw, inUse.has(car.id));
    }
    for (const bike of Object.values(play.bikes)) {
      for (const [suffix, tag] of BIKE_TAGS) {
        if (!bike.id.endsWith(suffix)) continue;
        const t = k.byTag.get(`prop-${bike.id.slice(0, -suffix.length)}-${tag}`);
        if (!t) break;
        // A bike still in its driveway slot keeps its authored collider; only a
        // re-parked one moves.
        if (bike.parked) place(t, bike.x, bike.z, bike.parked.yaw, inUse.has(bike.id));
        else t.c.passable = inUse.has(bike.id);
        break;
      }
    }
  });
  return null;
}
