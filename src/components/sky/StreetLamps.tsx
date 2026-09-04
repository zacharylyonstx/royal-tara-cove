import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointLight } from 'three';
import { STREET_LAMPS, LAMP_HEIGHT, LAMP_ARM, lampLightPos, type StreetLamp } from '../../world/streetLamps';
import { useSkyStore } from '../../state/skyStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { skyPalette, sunDirection, moonDirection } from '../../world/dayNight';
import { isTouchDevice } from '../../systems/touchInput';
import { mat } from '../../world/materials';

/**
 * Residential street lamps for Free Play. Every lamp gets cheap "fake" light
 * (an additive pool on the pavement + a glow sprite at the head + an emissive
 * lens). Only a small fixed POOL of real pointLights exists; each frame they
 * jump to the lamps nearest the local player, so the light count never
 * changes (three.js would otherwise recompile every lit shader).
 */

const TOUCH = isTouchDevice();
const LIGHT_POOL = TOUCH ? 3 : 6;
const LAMP_COLOR = '#ffe3b4'; // ~3500K LED/sodium-ish

// --- shared textures (radial gradients) ---
let poolTex: THREE.Texture | null = null;
let glowTex: THREE.Texture | null = null;
function radialTexture(size: number, inner: string, mid: string, stops: [number, string][]): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  for (const [t, col] of stops) g.addColorStop(t, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function getPoolTex() {
  if (!poolTex) poolTex = radialTexture(256, 'rgba(255,225,170,0.85)', 'rgba(255,215,150,0.35)', [[0.7, 'rgba(255,205,130,0.08)'], [1, 'rgba(255,200,120,0)']]);
  return poolTex;
}
function getGlowTex() {
  if (!glowTex) glowTex = radialTexture(128, 'rgba(255,245,220,1)', 'rgba(255,230,180,0.5)', [[0.7, 'rgba(255,220,160,0.12)'], [1, 'rgba(255,220,160,0)']]);
  return glowTex;
}

function CobraHead({ lamp }: { lamp: StreetLamp }) {
  const h = LAMP_HEIGHT.cobra;
  const arm = LAMP_ARM.cobra;
  return (
    <group position={[lamp.x, 0, lamp.z]} rotation={[0, lamp.yaw, 0]}>
      {/* base + tapered pole */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.5, 10]} />
        <meshStandardMaterial color="#6b6f74" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.13, h, 10]} />
        <meshStandardMaterial color="#8e9297" roughness={0.45} metalness={0.7} />
      </mesh>
      {/* arm sweeping out over the road (slight upward curve) */}
      <mesh position={[0, h - 0.35, arm / 2]} rotation={[Math.PI / 2 - 0.12, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, arm + 0.3, 8]} />
        <meshStandardMaterial color="#8e9297" roughness={0.45} metalness={0.7} />
      </mesh>
      {/* cobra head */}
      <group position={[0, h - 0.2, arm]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.16, 0.95]} />
          <meshStandardMaterial color="#5f6368" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.09, 0.05]}>
          <boxGeometry args={[0.3, 0.03, 0.7]} />
          <primitive object={mat.lampLens()} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

function AcornPost({ lamp }: { lamp: StreetLamp }) {
  const h = LAMP_HEIGHT.acorn;
  return (
    <group position={[lamp.x, 0, lamp.z]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.6, 8]} />
        <meshStandardMaterial color="#1e2224" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, h - 0.5, 8]} />
        <meshStandardMaterial color="#1e2224" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* acorn globe */}
      <mesh position={[0, h - 0.15, 0]}>
        <sphereGeometry args={[0.26, 12, 10]} />
        <primitive object={mat.lampLens()} attach="material" />
      </mesh>
      <mesh position={[0, h + 0.12, 0]} castShadow>
        <coneGeometry args={[0.2, 0.22, 8]} />
        <meshStandardMaterial color="#1e2224" roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  );
}

export function StreetLamps() {
  const poolGroup = useRef<THREE.Group>(null);
  const glowGroup = useRef<THREE.Group>(null);
  const lights = useRef<(PointLight | null)[]>([]);
  const lightPositions = useMemo(() => STREET_LAMPS.map(lampLightPos), []);
  const poolMat = useMemo(() => new THREE.MeshBasicMaterial({
    map: getPoolTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false,
  }), []);
  const glowMat = useMemo(() => new THREE.SpriteMaterial({
    map: getGlowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false,
  }), []);

  useFrame(() => {
    const sky = useSkyStore.getState();
    const sun = sunDirection(sky.dayFraction);
    const p = skyPalette(sun.elevationDeg, moonDirection(sky.dayFraction).elevationDeg);
    const on = p.lamps;
    poolMat.opacity = 0.55 * on;
    glowMat.opacity = 0.8 * on;
    // Pool lights → nearest lamps to the local player.
    const game = useGameStore.getState();
    const me = useNetStore.getState().myCharacterId ?? game.activeCharacterId;
    const pos = game.positions[me];
    const order = lightPositions
      .map((lp, i) => ({ i, d: (lp[0] - pos.x) ** 2 + (lp[2] - pos.z) ** 2 }))
      .sort((a, b) => a.d - b.d);
    for (let k = 0; k < LIGHT_POOL; k++) {
      const L = lights.current[k];
      if (!L) continue;
      const pick = order[k];
      if (!pick) { L.intensity = 0; continue; }
      const lp = lightPositions[pick.i];
      L.position.set(lp[0], lp[1] - 0.15, lp[2]);
      // Cobra heads are brighter/higher than acorn posts.
      const kind = STREET_LAMPS[pick.i].kind;
      L.intensity = (kind === 'cobra' ? 95 : 32) * on;
      L.distance = kind === 'cobra' ? 30 : 16;
    }
  });

  return (
    <group>
      {STREET_LAMPS.map((l, i) => (l.kind === 'cobra' ? <CobraHead key={i} lamp={l} /> : <AcornPost key={i} lamp={l} />))}
      {/* light pools on the pavement */}
      <group ref={poolGroup}>
        {lightPositions.map((lp, i) => {
          const kind = STREET_LAMPS[i].kind;
          const r = kind === 'cobra' ? 11 : 6;
          return (
            <mesh key={`pool-${i}`} position={[lp[0], 0.03, lp[2]]} rotation={[-Math.PI / 2, 0, 0]} material={poolMat} renderOrder={2}>
              <planeGeometry args={[r * 2, r * 2]} />
            </mesh>
          );
        })}
      </group>
      {/* glow sprites at the luminaire */}
      <group ref={glowGroup}>
        {lightPositions.map((lp, i) => {
          const s = STREET_LAMPS[i].kind === 'cobra' ? 2.1 : 1.6;
          return <sprite key={`glow-${i}`} position={[lp[0], lp[1], lp[2]]} scale={[s, s, 1]} material={glowMat} renderOrder={3} />;
        })}
      </group>
      {/* the real light pool */}
      {Array.from({ length: LIGHT_POOL }, (_, k) => (
        <pointLight
          key={`pl-${k}`}
          ref={(el) => { lights.current[k] = el; }}
          color={LAMP_COLOR}
          intensity={0}
          distance={30}
          decay={2}
        />
      ))}
    </group>
  );
}
