import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNightStore } from '../../state/nightStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';

// SIREN HEAD — built procedurally (text-to-3D can't make a headless humanoid
// whose head IS two opposed siren horns). Creepiness tuned from canon + research:
// impossibly tall/thin, hunched + asymmetric, mummified-rust surface, oversized
// CLAW hands, OWL-SWIVEL horns that jerkily track you, a dim PULSING red throat
// glow, eerie stop-motion lurch, and a HAND-SWAT chop when it whacks you.
// Pure render consumer of nightStore (host/snapshot writes transform/state).

const SCALE = 1.5; // ~11 m — towers over the rooftops

// Darker, grimier, more "mummified flesh the colour of rusted metal."
const SKIN = new THREE.MeshStandardMaterial({ color: '#4d3a2a', roughness: 1.0, metalness: 0.03, flatShading: true });
const DARK = new THREE.MeshStandardMaterial({ color: '#150f0b', roughness: 1.0, metalness: 0.0, flatShading: true });
const METAL = new THREE.MeshStandardMaterial({ color: '#5b554a', roughness: 0.72, metalness: 0.5, flatShading: true });

const SWING_DUR = 0.55; // hand-swat: raise then chop
const TWO_PI = Math.PI * 2;
function shortestAngle(from: number, to: number): number {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

// Oversized splayed claw hand (palm + 3 long fingers).
function Claw({ material }: { material: THREE.Material }) {
  return (
    <group>
      <mesh material={material} castShadow><boxGeometry args={[0.2, 0.26, 0.16]} /></mesh>
      {[-0.07, 0, 0.07].map((dx, i) => (
        <mesh key={i} material={material} position={[dx, -0.26, 0.02]} rotation={[0.3, 0, dx * 2]} castShadow>
          <boxGeometry args={[0.05, 0.34, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

// One megaphone siren horn: open cone + a dark glowing throat (mouth faces +X).
function Horn({ glowRef }: { glowRef?: React.Ref<THREE.MeshStandardMaterial> }) {
  return (
    <group>
      <mesh material={METAL} castShadow>
        <coneGeometry args={[0.82, 1.5, 14, 1, true]} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <coneGeometry args={[0.7, 1.25, 14, 1, true]} />
        <meshStandardMaterial ref={glowRef} color="#ff5a2a" emissive="#dd2200" emissiveIntensity={0.7} roughness={0.6} side={THREE.DoubleSide} />
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
  const glow = useRef(0.7);
  const hornStep = useRef(-1);   // last stop-motion step the horns snapped on
  const swingStart = useRef(-10);
  const lastSwing = useRef(0);

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
    const STEP = chasing ? 0.085 : 0.13;
    const stepIdx = Math.floor(t / STEP);
    const stepT = stepIdx * STEP;

    const gaitRate = chasing ? 8.0 : 3.2;
    if (moveSpeed > 0.4) walkPhase.current += dt * gaitRate;
    const wp = Math.floor(walkPhase.current / (STEP * 3)) * (STEP * 3);

    const swing = moveSpeed > 0.4 ? (chasing ? 0.8 : 0.45) : 0.05;
    if (legL.current) legL.current.rotation.x = Math.sin(wp) * swing;
    if (legR.current) legR.current.rotation.x = Math.sin(wp + Math.PI) * swing;
    if (armL.current) armL.current.rotation.x = Math.sin(wp + Math.PI) * swing * 0.6;

    // ---- HAND-SWAT: latch on the swing counter, override the right arm ----
    if (ns.sirenSwingCount !== lastSwing.current) {
      lastSwing.current = ns.sirenSwingCount;
      swingStart.current = t;
    }
    const swingP = (t - swingStart.current) / SWING_DUR;
    if (armR.current) {
      if (swingP >= 0 && swingP < 1) {
        // raise overhead (0–0.4) then CHOP down & forward (0.4–1)
        armR.current.rotation.x = swingP < 0.4
          ? -2.6 * (swingP / 0.4)
          : -2.6 + (1.2 - (-2.6)) * ((swingP - 0.4) / 0.6);
      } else {
        armR.current.rotation.x = Math.sin(wp) * swing * 0.6;
      }
    }

    g.position.y = Math.abs(Math.sin(stepT * (chasing ? 6 : 3))) * (chasing ? 0.22 : 0.08);
    g.rotation.z = Math.sin(stepT * 2.1) * (moveSpeed > 0.4 ? 0.05 : 0.012);
    g.rotation.x = chasing ? 0.16 : 0.0; // aggressive forward hunch on the chase

    // ---- OWL-SWIVEL: the horns jerk to track YOU in stop-motion steps ----
    if (horns.current) {
      if (chasing || alerted) {
        // looking right at the target — face forward (snap quickly)
        horns.current.rotation.y += (0 - horns.current.rotation.y) * (1 - Math.exp(-10 * dt));
      } else if (stepIdx !== hornStep.current) {
        hornStep.current = stepIdx;
        const game = useGameStore.getState();
        const localId = useNetStore.getState().myCharacterId ?? game.activeCharacterId;
        const p = game.positions[localId];
        if (p) {
          const worldYaw = Math.atan2(-(p.x - rx.current), -(p.z - rz.current));
          const targetLocal = worldYaw - ryaw.current;
          horns.current.rotation.y += shortestAngle(horns.current.rotation.y, targetLocal); // hard snap
        }
      }
    }

    // ---- dim PULSING red glow (powering-up-to-scream feel) + rare flicker ----
    const targetGlow = chasing ? 3.4 : alerted ? 2.1 : 1.05;
    glow.current += (targetGlow - glow.current) * (1 - Math.exp(-6 * dt));
    const pulse = 0.68 + 0.32 * Math.sin(t * (chasing ? 7 : 2.5));
    const flick = Math.random() < 0.04 ? 0.4 : 1;
    const em = glow.current * pulse * flick;
    if (hornGlow.current) hornGlow.current.emissiveIntensity = em;
    if (hornGlow2.current) hornGlow2.current.emissiveIntensity = em;
    if (hornLight.current) hornLight.current.intensity = 1.6 + em * 1.9;
  });

  return (
    <group ref={group}>
      {/* slight constant hunch + lean baked into the scaled body = "wrongness" */}
      <group scale={SCALE} rotation={[0.05, 0, -0.03]}>
        {/* legs (asymmetric: right is offset wider + a touch longer) */}
        <group ref={legL} position={[0.32, 4.0, 0]}>
          <mesh material={SKIN} position={[0, -2.0, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.17, 4.0, 6]} />
          </mesh>
          <mesh material={DARK} position={[0.05, -4.05, 0.14]} castShadow>
            <boxGeometry args={[0.3, 0.18, 0.64]} />
          </mesh>
        </group>
        <group ref={legR} position={[-0.4, 4.1, 0]}>
          <mesh material={SKIN} position={[0, -2.05, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.17, 4.1, 6]} />
          </mesh>
          <mesh material={DARK} position={[-0.05, -4.15, 0.14]} castShadow>
            <boxGeometry args={[0.3, 0.18, 0.64]} />
          </mesh>
        </group>

        {/* gaunt tapered torso, deep exposed ribs */}
        <mesh material={SKIN} position={[0, 5.05, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.5, 2.1, 6]} />
        </mesh>
        {[5.55, 5.2, 4.85, 4.5].map((y, i) => (
          <mesh key={i} material={DARK} position={[0, y, 0.34]}>
            <boxGeometry args={[0.66 - i * 0.05, 0.08, 0.14]} />
          </mesh>
        ))}

        {/* long dangling arms (RIGHT is the higher, swat arm with a bigger claw) */}
        <group ref={armL} position={[0.58, 6.0, 0]}>
          <mesh material={SKIN} position={[0, -1.55, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.12, 3.1, 6]} />
          </mesh>
          <group position={[0, -3.2, 0.04]}><Claw material={DARK} /></group>
        </group>
        <group ref={armR} position={[-0.58, 6.18, 0]}>
          <mesh material={SKIN} position={[0, -1.65, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.13, 3.3, 6]} />
          </mesh>
          <group position={[0, -3.45, 0.04]} scale={1.25}><Claw material={DARK} /></group>
        </group>

        {/* neck-pole + coiling cables */}
        <mesh material={METAL} position={[0, 6.6, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.15, 1.2, 6]} />
        </mesh>
        {[[0.1, 0.2], [-0.08, -0.25], [0.04, 0.5]].map(([dx, rot], i) => (
          <mesh key={i} material={DARK} position={[dx, 6.2, 0.06]} rotation={[0, 0, rot]}>
            <cylinderGeometry args={[0.03, 0.03, 1.7, 5]} />
          </mesh>
        ))}

        {/* THE HEAD = two opposed siren horns (asymmetric sizes/tilt) */}
        <group ref={horns} position={[0, 7.25, 0]}>
          <mesh material={METAL} castShadow>
            <boxGeometry args={[0.4, 0.5, 0.4]} />
          </mesh>
          {/* +X horn (slightly larger, tilted) */}
          <group position={[0.52, 0.08, 0]} rotation={[0.06, 0, Math.PI / 2]} scale={1.08}>
            <Horn glowRef={hornGlow} />
          </group>
          {/* −X horn (smaller, tilted the other way) */}
          <group position={[-0.5, 0.0, 0]} rotation={[-0.05, 0, -Math.PI / 2]} scale={0.93}>
            <Horn glowRef={hornGlow2} />
          </group>
          <pointLight ref={hornLight} color="#ff3a1a" intensity={1.6} distance={24} decay={1.6} />
        </group>
      </group>
    </group>
  );
}
