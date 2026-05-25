import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HOUSES } from '../world/houses';
import { buildLots } from '../world/lots';
import { getProjectorVideo } from '../world/projectorMedia';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';

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

// Hero house geometry is static, so the setup is computed once at module load
// (avoids the React Compiler complaining about manual useMemo).
type Setup = {
  pivotX: number;
  pivotZ: number;
  cosYaw: number;
  sinYaw: number;
  cosNegYaw: number;
  sinNegYaw: number;
  screenWorldX: number;
  screenWorldY: number;
  screenWorldZ: number;
  halfW: number;
  halfD: number;
};

const SETUP: Setup | null = (() => {
  const hero = HOUSES.find((h) => h.isHero);
  if (!hero) return null;
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === hero.address);
  if (!lot) return null;
  // Screen plane center in HOUSE-LOCAL space (matches ProjectorScreen.tsx).
  const localX = -1.58;
  const localY = 1.8;
  const localZ = -4;
  const cosYaw = Math.cos(lot.houseYaw);
  const sinYaw = Math.sin(lot.houseYaw);
  return {
    pivotX: lot.housePivot[0],
    pivotZ: lot.housePivot[1],
    cosYaw,
    sinYaw,
    cosNegYaw: Math.cos(-lot.houseYaw),
    sinNegYaw: Math.sin(-lot.houseYaw),
    screenWorldX: lot.housePivot[0] + localX * cosYaw + localZ * sinYaw,
    screenWorldY: localY,
    screenWorldZ: lot.housePivot[1] - localX * sinYaw + localZ * cosYaw,
    halfW: hero.width / 2,
    halfD: hero.depth / 2,
  };
})();

export function ProjectorController() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const activeId = myCharacterId ?? fallbackActive;
  const positions = useGameStore((s) => s.positions);

  // Resolve the video element once on mount.
  useEffect(() => {
    videoRef.current = getProjectorVideo();
  }, []);

  useFrame((_state, dt) => {
    const video = videoRef.current;
    if (!video || !SETUP) return;
    const pos = positions[activeId];
    if (!pos) return;

    // World-space distance from player ear (head height) to screen center.
    const dx = pos.x - SETUP.screenWorldX;
    const dy = pos.y + 1.5 - SETUP.screenWorldY;
    const dz = pos.z - SETUP.screenWorldZ;
    const dist = Math.hypot(dx, dy, dz);

    // Player position transformed to HOUSE-LOCAL coords for AABB check.
    const relX = pos.x - SETUP.pivotX;
    const relZ = pos.z - SETUP.pivotZ;
    const lx = relX * SETUP.cosNegYaw - relZ * SETUP.sinNegYaw;
    const lz = relX * SETUP.sinNegYaw + relZ * SETUP.cosNegYaw;
    const inside = lx > -SETUP.halfW && lx < SETUP.halfW && lz > -SETUP.halfD && lz < SETUP.halfD;

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
