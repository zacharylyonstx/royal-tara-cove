import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HOUSES } from '../world/houses';
import { buildLots } from '../world/lots';
import { getProjectorVideo } from '../world/projectorMedia';
import { useGameStore } from '../state/gameStore';

// Audio falloff for the great-room projector. Headless: no rendering.
//
// Distance curve:
//   inside hero house: full (0.7) within 3m of screen → 0 at 16m, linear
//   outside hero house: faint bleed (max 0.2) within 8m, then silent
//
// Volume is lerped each frame for a smooth ~250ms fade.

const MAX_VOLUME_INSIDE = 0.7;
const MAX_VOLUME_BLEED = 0.2;
const INSIDE_FULL_RADIUS = 3;
const INSIDE_SILENT_RADIUS = 16;
const BLEED_SILENT_RADIUS = 8;
const FADE_RATE = 4; // per second

export function ProjectorController() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);

  // Resolve the hero house lot and the screen's world position once.
  const setup = useMemo(() => {
    const hero = HOUSES.find((h) => h.isHero);
    if (!hero) return null;
    const lots = buildLots(HOUSES);
    const lot = lots.find((l) => l.address === hero.address);
    if (!lot) return null;

    // Screen plane center in house-local space (matches ProjectorScreen.tsx)
    const localScreen = new THREE.Vector3(-1.58, 1.8, -4);
    // Transform to world: rotate by houseYaw around Y, then translate by housePivot.
    const cy = Math.cos(lot.houseYaw);
    const sy = Math.sin(lot.houseYaw);
    const screenWorld = new THREE.Vector3(
      lot.housePivot[0] + localScreen.x * cy + localScreen.z * sy,
      localScreen.y,
      lot.housePivot[1] - localScreen.x * sy + localScreen.z * cy,
    );

    // House AABB in HOUSE-LOCAL space: x = -halfW..+halfW, z = -halfD..+halfD
    const halfW = hero.width / 2;
    const halfD = hero.depth / 2;
    return { lot, screenWorld, halfW, halfD };
  }, []);

  // Resolve the video element once on mount.
  useEffect(() => {
    videoRef.current = getProjectorVideo();
  }, []);

  useFrame((_state, dt) => {
    const video = videoRef.current;
    if (!video || !setup) return;
    const pos = positions[activeId];
    if (!pos) return;

    const { lot, screenWorld, halfW, halfD } = setup;

    // World-space distance from player ear (head height) to screen center.
    const dx = pos.x - screenWorld.x;
    const dy = pos.y + 1.5 - screenWorld.y;
    const dz = pos.z - screenWorld.z;
    const dist = Math.hypot(dx, dy, dz);

    // Player position transformed to HOUSE-LOCAL coords for AABB check.
    const cosNeg = Math.cos(-lot.houseYaw);
    const sinNeg = Math.sin(-lot.houseYaw);
    const relX = pos.x - lot.housePivot[0];
    const relZ = pos.z - lot.housePivot[1];
    const lx = relX * cosNeg - relZ * sinNeg;
    const lz = relX * sinNeg + relZ * cosNeg;
    const inside = lx > -halfW && lx < halfW && lz > -halfD && lz < halfD;

    let target: number;
    if (inside && dist < INSIDE_SILENT_RADIUS) {
      const t = 1 - Math.max(0, dist - INSIDE_FULL_RADIUS) / (INSIDE_SILENT_RADIUS - INSIDE_FULL_RADIUS);
      target = MAX_VOLUME_INSIDE * Math.max(0, Math.min(1, t));
    } else if (!inside && dist < BLEED_SILENT_RADIUS) {
      const t = 1 - dist / BLEED_SILENT_RADIUS;
      target = MAX_VOLUME_BLEED * Math.max(0, Math.min(1, t));
    } else {
      target = 0;
    }

    const k = Math.min(1, dt * FADE_RATE);
    video.volume = THREE.MathUtils.lerp(video.volume, target, k);
  });

  return null;
}
