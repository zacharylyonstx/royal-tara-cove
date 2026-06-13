import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNightStore } from '../../state/nightStore';
import { useGameStore } from '../../state/gameStore';

// SIREN HEAD — built procedurally, not from a GLB. Text-to-3D can't make a
// headless humanoid whose head IS two opposed siren horns (it produces a
// demon-skull-with-megaphones every time), and procedural geometry lets us
// (a) guarantee the iconic silhouette, (b) match the faceted low-poly world,
// and (c) animate the canon "stop-motion lurch" with full joint control and
// ZERO rig-distortion risk (see project_photoreal_characters).
//
// Pure render consumer of nightStore: the host's SirenHeadController (or the
// guest's snapshot) writes sirenX/Z/yaw/state; this component smoothly follows
// and animates the pose locally. No network logic here.

const SCALE = 1.35; // ~10 m tall — looms over the two-storey rooftops

const SKIN = new THREE.MeshStandardMaterial({ color: '#5b4a3a', roughness: 0.95, metalness: 0.05, flatShading: true });
const DARK = new THREE.MeshStandardMaterial({ color: '#241d18', roughness: 1.0, metalness: 0.0, flatShading: true });
const METAL = new THREE.MeshStandardMaterial({ color: '#787268', roughness: 0.55, metalness: 0.6, flatShading: true });

const TWO_PI = Math.PI * 2;
function shortestAngle(from: number, to: number): number {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

// A single megaphone siren horn: open cone + a dark glowing throat. Points +X
// (rotate the wrapping group to aim it).
function Horn({ glowRef }: { glowRef?: React.Ref<THREE.MeshStandardMaterial> }) {
  return (
    <group>
      <mesh material={METAL} castShadow>
        <coneGeometry args={[0.82, 1.5, 14, 1, true]} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <coneGeometry args={[0.7, 1.25, 14, 1, true]} />
        <meshStandardMaterial ref={glowRef} color="#ff6a36" emissive="#ff3a12" emissiveIntensity={0.5} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function SirenHead() {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const horns = useRef<THREE.Group>(null);
  const hornGlow = useRef<THREE.MeshStandardMaterial>(null);
  const hornGlow2 = useRef<THREE.MeshStandardMaterial>(null);
  const hornLight = useRef<THREE.PointLight>(null);

  const rx = useRef(useNightStore.getState().sirenX);
  const rz = useRef(useNightStore.getState().sirenZ);
  const ryaw = useRef(useNightStore.getState().sirenYaw);
  const walkPhase = useRef(0);
  const glow = useRef(0.5);

  useFrame((state, dtRaw) => {
    const g = group.current;
    if (!g) return;
    if (useGameStore.getState().gameMode !== 'night') return;
    const dt = Math.min(dtRaw, 0.1);
    const ns = useNightStore.getState();

    const prevX = rx.current, prevZ = rz.current;
    const k = 1 - Math.exp(-12 * dt);
    rx.current += (ns.sirenX - rx.current) * k;
    rz.current += (ns.sirenZ - rz.current) * k;
    ryaw.current += shortestAngle(ryaw.current, ns.sirenYaw) * k;
    const moveSpeed = Math.hypot(rx.current - prevX, rz.current - prevZ) / dt;

    g.position.x = rx.current;
    g.position.z = rz.current;
    g.rotation.y = ryaw.current;

    const chasing = ns.sirenState === 'chase';
    const alerted = ns.sirenState === 'alerted';

    // STOP-MOTION: quantize the clock so the pose jerks between frozen frames.
    const t = state.clock.elapsedTime;
    const STEP = chasing ? 0.085 : 0.12;
    const stepT = Math.floor(t / STEP) * STEP;

    const gaitRate = chasing ? 7.5 : 3.4;
    if (moveSpeed > 0.4) walkPhase.current += dt * gaitRate;
    const wp = Math.floor(walkPhase.current / (STEP * 3)) * (STEP * 3);

    const swing = moveSpeed > 0.4 ? (chasing ? 0.7 : 0.45) : 0.06;
    if (legL.current) legL.current.rotation.x = Math.sin(wp) * swing;
    if (legR.current) legR.current.rotation.x = Math.sin(wp + Math.PI) * swing;
    if (armL.current) armL.current.rotation.x = Math.sin(wp + Math.PI) * swing * 0.6;
    if (armR.current) armR.current.rotation.x = Math.sin(wp) * swing * 0.6;

    g.position.y = Math.abs(Math.sin(stepT * (chasing ? 6 : 3))) * (chasing ? 0.22 : 0.1);
    g.rotation.z = Math.sin(stepT * 2.1) * (moveSpeed > 0.4 ? 0.05 : 0.015);
    g.rotation.x = chasing ? 0.08 : 0.0;

    if (horns.current) {
      const targetScan = chasing || alerted ? 0 : Math.sin(t * 0.5) * 0.6;
      horns.current.rotation.y += (targetScan - horns.current.rotation.y) * (1 - Math.exp(-4 * dt));
    }
    const targetGlow = chasing ? 2.6 : alerted ? 1.5 : 0.55;
    glow.current += (targetGlow - glow.current) * (1 - Math.exp(-6 * dt));
    if (hornGlow.current) hornGlow.current.emissiveIntensity = glow.current;
    if (hornGlow2.current) hornGlow2.current.emissiveIntensity = glow.current;
    if (hornLight.current) hornLight.current.intensity = 1.6 + glow.current * 3.0;
  });

  return (
    <group ref={group}>
      <group scale={SCALE}>
        {/* legs (hip-pivoted at y≈4) */}
        <group ref={legL} position={[0.36, 4.0, 0]}>
          <mesh material={SKIN} position={[0, -2.0, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.2, 4.0, 6]} />
          </mesh>
          <mesh material={DARK} position={[0.05, -4.05, 0.14]} castShadow>
            <boxGeometry args={[0.32, 0.2, 0.66]} />
          </mesh>
        </group>
        <group ref={legR} position={[-0.36, 4.0, 0]}>
          <mesh material={SKIN} position={[0, -2.0, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.2, 4.0, 6]} />
          </mesh>
          <mesh material={DARK} position={[-0.05, -4.05, 0.14]} castShadow>
            <boxGeometry args={[0.32, 0.2, 0.66]} />
          </mesh>
        </group>

        {/* gaunt tapered torso hip(y4)→shoulder(y6.1) */}
        <mesh material={SKIN} position={[0, 5.05, 0]} castShadow>
          <cylinderGeometry args={[0.44, 0.52, 2.1, 6]} />
        </mesh>
        {[5.5, 5.15, 4.8, 4.45].map((y, i) => (
          <mesh key={i} material={DARK} position={[0, y, 0.36]}>
            <boxGeometry args={[0.7 - i * 0.05, 0.07, 0.12]} />
          </mesh>
        ))}

        {/* long dangling arms (shoulder-pivoted at y≈6) */}
        <group ref={armL} position={[0.6, 6.0, 0]}>
          <mesh material={SKIN} position={[0, -1.5, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.14, 3.0, 6]} />
          </mesh>
          <mesh material={DARK} position={[0, -3.1, 0.05]} castShadow>
            <boxGeometry args={[0.18, 0.4, 0.18]} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.6, 6.0, 0]}>
          <mesh material={SKIN} position={[0, -1.5, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.14, 3.0, 6]} />
          </mesh>
          <mesh material={DARK} position={[0, -3.1, 0.05]} castShadow>
            <boxGeometry args={[0.18, 0.4, 0.18]} />
          </mesh>
        </group>

        {/* neck-pole rising from the shoulders */}
        <mesh material={METAL} position={[0, 6.55, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.16, 1.1, 6]} />
        </mesh>
        {/* coiling cable */}
        <mesh material={DARK} position={[0.1, 6.2, 0.06]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.035, 0.035, 1.6, 5]} />
        </mesh>

        {/* THE HEAD = two opposed air-raid siren horns, back-to-back on a hub */}
        <group ref={horns} position={[0, 7.2, 0]}>
          {/* central hub / amplifier */}
          <mesh material={METAL} castShadow>
            <boxGeometry args={[0.4, 0.5, 0.4]} />
          </mesh>
          {/* +X horn: apex at the hub, wide mouth flares OUTWARD to +X */}
          <group position={[0.5, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
            <Horn glowRef={hornGlow} />
          </group>
          {/* −X horn: mirror — wide mouth flares OUTWARD to −X */}
          <group position={[-0.5, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <Horn glowRef={hornGlow2} />
          </group>
          {/* eerie glow so he reads through the fog */}
          <pointLight ref={hornLight} color="#ff6433" intensity={2.2} distance={26} decay={1.5} />
        </group>
      </group>
    </group>
  );
}
