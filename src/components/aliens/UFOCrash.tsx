import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, PointLight } from 'three';
import { useGameStore } from '../../state/gameStore';
import { useCombatStore } from '../../state/combatStore';
import { ufoCrash } from '../../audio';

// Crash target — backyard of 10600
const CRASH_X = -16;
const CRASH_Z = 50;
const SKY_START_Y = 80;
const HOVER_Y = 14;
const GROUND_Y = 1.2;

const INTRO_DURATION = 6.2; // seconds
const PLUMMET_AT = 4.0;
const IMPACT_AT = 4.6;

export function UFOCrash() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setBlobsToSpawn = useCombatStore((s) => s.setBlobsToSpawn);
  const reset = useCombatStore((s) => s.reset);

  const introT = useRef(0);
  const triggeredCrash = useRef(false);
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const beaconL = useRef<PointLight>(null);
  const beaconR = useRef<PointLight>(null);

  // When phase becomes 'intro', reset and play the sound.
  useEffect(() => {
    if (phase === 'intro') {
      introT.current = 0;
      triggeredCrash.current = false;
      reset();
    }
  }, [phase, reset]);

  useFrame((_, dtRaw) => {
    if (phase !== 'intro' && phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1);
    introT.current += dt;
    const t = introT.current;
    const g = groupRef.current;
    if (!g) return;

    // Always spin the ring once visible
    if (ringRef.current) ringRef.current.rotation.y += dt * 4;
    // Flash beacons
    if (beaconL.current) beaconL.current.intensity = 0.5 + Math.abs(Math.sin(t * 12)) * 1.4;
    if (beaconR.current) beaconR.current.intensity = 0.5 + Math.abs(Math.sin(t * 12 + Math.PI)) * 1.4;

    if (phase === 'intro') {
      if (t < PLUMMET_AT) {
        // Descent: lerp Y from SKY to HOVER over PLUMMET_AT seconds
        const k = t / PLUMMET_AT;
        const y = SKY_START_Y - (SKY_START_Y - HOVER_Y) * easeInOut(k);
        g.position.set(CRASH_X + Math.sin(t * 2) * 1.5, y, CRASH_Z + Math.cos(t * 1.7) * 1.0);
        g.rotation.z = Math.sin(t * 3) * 0.05;
        g.rotation.x = Math.sin(t * 2.5) * 0.05;
      } else if (t < IMPACT_AT) {
        // Plummet
        const k = (t - PLUMMET_AT) / (IMPACT_AT - PLUMMET_AT);
        const y = HOVER_Y - (HOVER_Y - GROUND_Y) * Math.pow(k, 1.7);
        g.position.set(CRASH_X, y, CRASH_Z);
        g.rotation.z = -0.4 * k;
        g.rotation.x = 0.2 * k;
      } else {
        if (!triggeredCrash.current) {
          triggeredCrash.current = true;
          ufoCrash();
          // After a small delay, begin spawning blobs
          setBlobsToSpawn(8);
        }
        // Settled on ground at a tilt
        g.position.set(CRASH_X, GROUND_Y, CRASH_Z);
        g.rotation.set(0.2, t * 0.1, -0.4);

        if (t > INTRO_DURATION) {
          // Hand off to combat phase
          setPhase('combat');
        }
      }
    } else if (phase === 'combat') {
      // Crashed pose
      g.position.set(CRASH_X, GROUND_Y, CRASH_Z);
      g.rotation.set(0.2, g.rotation.y, -0.4);
    }
  });

  // Crater appears post-impact
  const showCrater = phase === 'combat' || (phase === 'intro' && introT.current >= IMPACT_AT);

  return (
    <>
      {showCrater && <Crater position={[CRASH_X, 0.02, CRASH_Z]} />}
      <group ref={groupRef} position={[CRASH_X, SKY_START_Y, CRASH_Z]}>
        <UFOMesh ringRef={ringRef} beaconL={beaconL} beaconR={beaconR} />
      </group>
    </>
  );
}

function UFOMesh({
  ringRef,
  beaconL,
  beaconR,
}: {
  ringRef: React.RefObject<Mesh | null>;
  beaconL: React.RefObject<PointLight | null>;
  beaconR: React.RefObject<PointLight | null>;
}) {
  return (
    <group>
      {/* Saucer body — flattened ellipsoid */}
      <mesh castShadow scale={[1, 0.3, 1]}>
        <sphereGeometry args={[3.2, 28, 16]} />
        <meshStandardMaterial color="#9ea8b8" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Dome */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[1.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#4a8aa6" metalness={0.4} roughness={0.18} transparent opacity={0.7} />
      </mesh>
      {/* Rotating ring of lights */}
      <mesh ref={ringRef} position={[0, -0.05, 0]}>
        <torusGeometry args={[3.0, 0.12, 8, 28]} />
        <meshStandardMaterial color="#c8a32a" emissive="#fff0a8" emissiveIntensity={0.8} />
      </mesh>
      {/* Beacon point lights */}
      <pointLight ref={beaconL} position={[2.8, 0, 0]} color="#ff3a3a" intensity={1} distance={20} decay={2} />
      <pointLight ref={beaconR} position={[-2.8, 0, 0]} color="#3afff0" intensity={1} distance={20} decay={2} />
      {/* Hatch on the underside (always visible — opens visually post-crash) */}
      <mesh position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshStandardMaterial color="#1a1a1c" emissive="#3afff0" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Crater({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.95} />
      </mesh>
      {/* charred ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[3.5, 4.5, 32]} />
        <meshStandardMaterial color="#5a2a1a" roughness={0.95} />
      </mesh>
      {/* a couple of smoke columns */}
      <SmokeColumn position={[1.0, 0.0, 0.6]} />
      <SmokeColumn position={[-0.8, 0.0, -0.4]} />
    </group>
  );
}

function SmokeColumn({ position }: { position: [number, number, number] }) {
  // Static "puff" cones — cheap visual
  return (
    <group position={position}>
      {[0.6, 1.5, 2.6].map((y, i) => (
        <mesh key={i} position={[Math.sin(i * 2.4) * 0.2, y, Math.cos(i * 2.4) * 0.2]}>
          <sphereGeometry args={[0.6 - i * 0.1, 8, 8]} />
          <meshStandardMaterial color="#5a5a5c" transparent opacity={0.45 - i * 0.08} />
        </mesh>
      ))}
    </group>
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Spawn location for blobs — under the UFO hatch.
export const BLOB_SPAWN: [number, number, number] = [CRASH_X, 0.6, CRASH_Z];
