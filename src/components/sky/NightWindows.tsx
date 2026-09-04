import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointLight } from 'three';
import { useSkyStore } from '../../state/skyStore';
import { hourOfDay, moonDirection, skyPalette, sunDirection, windowLightAmount } from '../../world/dayNight';
import { mat, GLASS_VARIANTS } from '../../world/materials';
import { windowGlassTexture } from '../../world/textures';

/**
 * Free Play night dressing for the houses. Every window in the neighborhood
 * shares one of six glass materials, so driving those six (emissive map /
 * colour / intensity) lights up the whole street with staggered "somebody's
 * home" windows at zero per-window cost. Same trick for the shared coach-
 * light / porch-lantern lens. One real point light warms 10600's porch.
 */

const WARM_ON = new THREE.Color('#ffd9a6');
const WARM_ON_B = new THREE.Color('#fff0d2');
const DAY_EMISSIVE = new THREE.Color('#ffffff');

export function NightWindows() {
  const porchRef = useRef<PointLight>(null);
  const glass = useMemo(() => Array.from({ length: GLASS_VARIANTS }, (_, i) => mat.glassFor(i) as THREE.MeshStandardMaterial), []);
  const dayMaps = useMemo(() => glass.map((m) => m.emissiveMap), [glass]);
  const warmMap = useMemo(() => windowGlassTexture(4), []);
  const dayIntensity = useMemo(() => glass.map((m) => m.emissiveIntensity), [glass]);
  const lens = useMemo(() => mat.lampLens() as THREE.MeshStandardMaterial, []);
  // 10600's front door is at world (10, 28.9) (house-local z + 37.9); the
  // porch light hangs just outside it under the porch roof.
  const porchPos = useMemo<[number, number, number]>(() => [10, 2.5, 27.4], []);

  // The glass + lens materials are shared with every other mode — put them
  // back to their daytime state when Free Play unmounts.
  useEffect(() => () => {
    glass.forEach((m, b) => {
      if (m.emissiveMap !== dayMaps[b]) { m.emissiveMap = dayMaps[b]; m.needsUpdate = true; }
      m.emissive.copy(DAY_EMISSIVE);
      m.emissiveIntensity = dayIntensity[b];
    });
    lens.emissiveIntensity = 0.85;
  }, [glass, dayMaps, dayIntensity, lens]);

  useFrame(() => {
    const sky = useSkyStore.getState();
    const sun = sunDirection(sky.dayFraction);
    const p = skyPalette(sun.elevationDeg, moonDirection(sky.dayFraction).elevationDeg);
    const hour = hourOfDay(sky.dayFraction);
    const night = 1 - p.day;
    for (let b = 0; b < glass.length; b++) {
      const m = glass[b];
      const on = windowLightAmount(b, hour, p.lamps);
      if (on > 0.01) {
        if (m.emissiveMap !== warmMap) { m.emissiveMap = warmMap; m.needsUpdate = true; }
        m.emissive.copy(b % 2 === 0 ? WARM_ON : WARM_ON_B);
        m.emissiveIntensity = dayIntensity[b] * (1 - on) + 1.35 * on;
      } else {
        if (m.emissiveMap !== dayMaps[b]) { m.emissiveMap = dayMaps[b]; m.needsUpdate = true; }
        m.emissive.copy(DAY_EMISSIVE);
        // Dark rooms at night: the pane only reflects the dim sky.
        m.emissiveIntensity = dayIntensity[b] * (1 - night * 0.92);
      }
    }
    // Coach lights / porch lanterns / string lights: bright at night, a faint
    // "is it on?" glow by day.
    lens.emissiveIntensity = 0.25 + 2.6 * p.lamps;
    if (porchRef.current) porchRef.current.intensity = 14 * p.lamps;
  });

  return <pointLight ref={porchRef} position={porchPos} color="#ffd9a0" intensity={0} distance={12} decay={2} />;
}
