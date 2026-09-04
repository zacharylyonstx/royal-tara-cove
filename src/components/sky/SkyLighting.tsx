import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { AmbientLight, DirectionalLight, Fog, HemisphereLight } from 'three';
import { useSkyStore } from '../../state/skyStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { moonColor, moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { isTouchDevice } from '../../systems/touchInput';

const TOUCH = isTouchDevice();
const SHADOW_RES = TOUCH ? 1024 : 2048;
const ENV_RES = TOUCH ? 64 : 128;
/** IBL re-renders when the clock crosses one of these buckets (48/day ≈ every
 *  30 real seconds) so reflections on glass/cars follow the sky. */
const ENV_BUCKETS = 48;

/**
 * Free Play lighting rig driven by the world clock:
 *  • ONE shadow-casting directional light that is the sun by day and the moon
 *    by night (crossfading through twilight), whose shadow frustum follows the
 *    local player so the whole neighborhood gets shadows, not just the bulb.
 *  • Hemisphere + ambient fill from the sky palette (a lifted blue floor at
 *    night keeps the yards readable — the street lamps do the rest).
 *  • Scene fog colour/range matched to the sky dome's horizon.
 *  • A procedural IBL environment tinted to the current sky.
 */
export function SkyLighting() {
  const dirRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const ambRef = useRef<AmbientLight>(null);
  const fogRef = useRef<Fog>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const [envBucket, setEnvBucket] = useState(0);

  useFrame(({ scene }) => {
    const sky = useSkyStore.getState();
    const sun = sunDirection(sky.dayFraction);
    const moon = moonDirection(sky.dayFraction);
    const p = skyPalette(sun.elevationDeg, moon.elevationDeg);

    // Follow the local player with the shadow frustum.
    const game = useGameStore.getState();
    const me = useNetStore.getState().myCharacterId ?? game.activeCharacterId;
    const pos = game.positions[me];
    target.position.set(pos.x, 0, pos.z);

    const dir = dirRef.current;
    if (dir) {
      const useMoon = p.moonIntensity > p.sunIntensity;
      const b = useMoon ? moon : sun;
      // Keep the light above a shallow grazing angle so shadows never go
      // infinitely long/streaky at sunrise/sunset.
      const ely = Math.max(b.y, 0.12);
      const hx = b.x, hz = b.z;
      const hl = Math.hypot(hx, hz) || 1;
      const horiz = Math.sqrt(Math.max(0, 1 - ely * ely));
      dir.position.set(pos.x + (hx / hl) * horiz * 110, ely * 110, pos.z + (hz / hl) * horiz * 110);
      if (useMoon) {
        const mc = moonColor();
        dir.color.setRGB(mc[0], mc[1], mc[2]);
        dir.intensity = p.moonIntensity;
      } else {
        dir.color.setRGB(p.sunColor[0], p.sunColor[1], p.sunColor[2]);
        dir.intensity = Math.max(p.sunIntensity, 0.02);
      }
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.setRGB(p.hemiSky[0], p.hemiSky[1], p.hemiSky[2]);
      hemi.groundColor.setRGB(p.hemiGround[0], p.hemiGround[1], p.hemiGround[2]);
      hemi.intensity = p.hemiIntensity;
    }
    const amb = ambRef.current;
    if (amb) {
      amb.color.setRGB(p.ambient[0], p.ambient[1], p.ambient[2]);
      amb.intensity = p.ambientIntensity;
    }
    const fog = fogRef.current;
    if (fog) {
      fog.color.setRGB(p.horizon[0], p.horizon[1], p.horizon[2]);
      fog.near = p.fogNear;
      fog.far = p.fogFar;
    }
    scene.environmentIntensity = p.envIntensity;

    const bucket = Math.floor(sky.dayFraction * ENV_BUCKETS);
    if (bucket !== envBucket) setEnvBucket(bucket);
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={['#c4dbef', 70, 330]} />
      <hemisphereLight ref={hemiRef} color="#fff5d8" groundColor="#6a9a4e" intensity={0.92} />
      <primitive object={target} />
      <directionalLight
        ref={dirRef}
        position={[60, 80, 35]}
        intensity={1.5}
        color="#fff0d0"
        target={target}
        castShadow
        shadow-mapSize-width={SHADOW_RES}
        shadow-mapSize-height={SHADOW_RES}
        shadow-radius={4}
        shadow-bias={-0.0008}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <ambientLight ref={ambRef} intensity={0.45} color="#bfe0ec" />
      <SkyEnvironment bucket={envBucket} />
    </>
  );
}

/** Offline IBL: three lightformers tinted to the sky at this clock bucket. */
function SkyEnvironment({ bucket }: { bucket: number }) {
  const f = (bucket + 0.5) / ENV_BUCKETS;
  const sun = sunDirection(f);
  const moon = moonDirection(f);
  const p = skyPalette(sun.elevationDeg, moon.elevationDeg);
  const c = (rgb: [number, number, number], k = 1) => new THREE.Color(Math.min(1, rgb[0] * k), Math.min(1, rgb[1] * k), Math.min(1, rgb[2] * k));
  const skyCol = c(p.zenith, 1.15);
  const horizonCol = c(p.horizon);
  const useMoon = p.moonIntensity > p.sunIntensity;
  const glint = useMoon ? c(moonColor(), 0.8) : c(p.sunColor);
  const glintI = useMoon ? 1.2 : 1.2 + 2.2 * p.day;
  const b = useMoon ? moon : sun;
  return (
    <Environment key={bucket} resolution={ENV_RES} frames={1} background={false}>
      <color attach="background" args={[horizonCol]} />
      <Lightformer form="circle" intensity={glintI} color={glint} scale={9} position={[b.x * 18, Math.max(2, b.y * 18), b.z * 18]} />
      <Lightformer form="rect" intensity={0.5 + 0.7 * p.day} color={skyCol} scale={[36, 36, 1]} position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={0.12 + 0.35 * p.day} color="#9bbf7a" scale={[36, 36, 1]} position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    </Environment>
  );
}
