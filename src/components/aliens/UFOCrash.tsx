import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh, PointLight } from 'three';
import { useGameStore } from '../../state/gameStore';
import { useCombatStore } from '../../state/combatStore';
import { ufoCrash, ufoDescend, startCrackleLoop, gunWind } from '../../audio';
import { CrashFX, Debris } from './CrashFX';
import { SmokeColumn } from './SmokeColumn';

// Crash target — backyard of 10600
const CRASH_X = -16;
const CRASH_Z = 50;
const SKY_START_Y = 80;
const HOVER_Y = 14;
const GROUND_Y = 1.2;

const INTRO_DURATION = 6.4;
const PLUMMET_AT = 4.0;
const IMPACT_AT = 4.6;
const COMBAT_HANDOFF_AT = 6.2;

export function UFOCrash() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setBlobsToSpawn = useCombatStore((s) => s.setBlobsToSpawn);
  const reset = useCombatStore((s) => s.reset);
  const triggerCrashFlash = useCombatStore((s) => s.triggerCrashFlash);
  const spawnDebris = useCombatStore((s) => s.spawnDebris);
  const addShake = useCombatStore((s) => s.addShake);

  const introT = useRef(0);
  const triggeredCrash = useRef(false);
  const handedOffCombat = useRef(false);
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const beaconL = useRef<PointLight>(null);
  const beaconR = useRef<PointLight>(null);
  const sparksData = useRef<Float32Array | null>(null);

  // Spark trail particles — only emit during descent
  const sparksGeom = useMemo(() => {
    const N = 60;
    const arr = new Float32Array(N * 3);
    sparksData.current = arr;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useEffect(() => {
    if (phase === 'intro') {
      introT.current = 0;
      triggeredCrash.current = false;
      handedOffCombat.current = false;
      reset();
      ufoDescend();
    }
  }, [phase, reset]);

  useFrame((_, dtRaw) => {
    if (phase !== 'intro' && phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1);
    introT.current += dt;
    const t = introT.current;
    const g = groupRef.current;
    if (!g) return;

    // Always spin the ring + flash beacons
    if (ringRef.current) ringRef.current.rotation.y += dt * 4;
    if (beaconL.current) beaconL.current.intensity = 0.6 + Math.abs(Math.sin(t * 12)) * 1.6;
    if (beaconR.current) beaconR.current.intensity = 0.6 + Math.abs(Math.sin(t * 12 + Math.PI)) * 1.6;

    if (phase === 'intro') {
      if (t < PLUMMET_AT) {
        const k = t / PLUMMET_AT;
        const y = SKY_START_Y - (SKY_START_Y - HOVER_Y) * easeInOut(k);
        g.position.set(CRASH_X + Math.sin(t * 2) * 1.5, y, CRASH_Z + Math.cos(t * 1.7) * 1.0);
        g.rotation.z = Math.sin(t * 3) * 0.05;
        g.rotation.x = Math.sin(t * 2.5) * 0.05;
      } else if (t < IMPACT_AT) {
        const k = (t - PLUMMET_AT) / (IMPACT_AT - PLUMMET_AT);
        const y = HOVER_Y - (HOVER_Y - GROUND_Y) * Math.pow(k, 1.7);
        g.position.set(CRASH_X, y, CRASH_Z);
        g.rotation.z = -0.4 * k;
        g.rotation.x = 0.2 * k;
        // Sparks intensify during plummet
        emitSparks(g.position.x, g.position.y, g.position.z, k * 0.9);
      } else {
        if (!triggeredCrash.current) {
          triggeredCrash.current = true;
          ufoCrash();
          startCrackleLoop();
          triggerCrashFlash();
          spawnDebris(CRASH_X, GROUND_Y, CRASH_Z);
          addShake(0.6);
          setBlobsToSpawn(8);
        }
        g.position.set(CRASH_X, GROUND_Y, CRASH_Z);
        g.rotation.set(0.2, t * 0.1, -0.4);
        if (!handedOffCombat.current && t > COMBAT_HANDOFF_AT) {
          handedOffCombat.current = true;
          gunWind();
          setPhase('combat');
        }
      }
    } else if (phase === 'combat') {
      g.position.set(CRASH_X, GROUND_Y, CRASH_Z);
      g.rotation.set(0.2, g.rotation.y + dt * 0.05, -0.4);
    }

    // Decay sparks (move existing toward ground / drift)
    decaySparks();
  });

  const showCrater = phase === 'combat' || (phase === 'intro' && introT.current >= IMPACT_AT);

  function emitSparks(x: number, y: number, z: number, intensity: number) {
    const arr = sparksData.current;
    if (!arr) return;
    // Find one or two slots to write
    const writes = Math.max(1, Math.floor(intensity * 4));
    for (let n = 0; n < writes; n++) {
      const i = Math.floor(Math.random() * (arr.length / 3)) * 3;
      arr[i] = x + (Math.random() - 0.5) * 1.4;
      arr[i + 1] = y - 1.0 + Math.random() * 1.0;
      arr[i + 2] = z + (Math.random() - 0.5) * 1.4;
    }
    sparksGeom.attributes.position.needsUpdate = true;
  }

  function decaySparks() {
    const arr = sparksData.current;
    if (!arr) return;
    for (let i = 1; i < arr.length; i += 3) {
      if (arr[i] > 0.05) arr[i] -= 0.05;
      else if (arr[i] !== 0) arr[i] = 0;
    }
    sparksGeom.attributes.position.needsUpdate = true;
  }

  return (
    <>
      {/* Crash effects: flash, ring, glow */}
      {showCrater && <CrashFX position={[CRASH_X, 0.05, CRASH_Z]} />}
      {showCrater && <Crater position={[CRASH_X, 0.02, CRASH_Z]} />}
      {showCrater && (
        <>
          <SmokeColumn position={[CRASH_X + 1.0, 0.5, CRASH_Z + 0.6]} count={70} />
          <SmokeColumn position={[CRASH_X - 1.2, 0.5, CRASH_Z - 0.4]} count={70} />
          <SmokeColumn position={[CRASH_X + 0.2, 0.5, CRASH_Z - 1.0]} count={50} color="#5a5a5c" />
        </>
      )}

      {/* Spark trail (always present, emits during plummet) */}
      <points geometry={sparksGeom}>
        <pointsMaterial color="#ff8a3a" size={0.2} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
      </points>

      <Debris />

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
        <sphereGeometry args={[3.4, 32, 18]} />
        <meshStandardMaterial color="#9ea8b8" metalness={0.85} roughness={0.22} />
      </mesh>
      {/* Belt of vents around the rim */}
      <mesh position={[0, -0.05, 0]}>
        <torusGeometry args={[3.05, 0.18, 12, 36]} />
        <meshStandardMaterial color="#3a3a40" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Dome */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[1.5, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#4a8aa6" metalness={0.5} roughness={0.18} transmission={0.4} thickness={0.3} ior={1.4} />
      </mesh>
      {/* Pilot silhouette inside the dome */}
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshStandardMaterial color="#2d4a2d" emissive="#3a8a3a" emissiveIntensity={0.5} />
      </mesh>
      {/* Three landing struts */}
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 2.4, -0.5, Math.sin(a) * 2.4]}
          rotation={[0, -a, 0]}
        >
          <boxGeometry args={[0.18, 0.6, 0.18]} />
          <meshStandardMaterial color="#3a3a40" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* Rotating ring of lights */}
      <mesh ref={ringRef} position={[0, -0.1, 0]}>
        <torusGeometry args={[3.0, 0.14, 10, 32]} />
        <meshStandardMaterial color="#c8a32a" emissive="#fff0a8" emissiveIntensity={1.2} />
      </mesh>
      {/* Beacon point lights */}
      <pointLight ref={beaconL} position={[3.0, 0, 0]} color="#ff3a3a" intensity={1} distance={28} decay={2} />
      <pointLight ref={beaconR} position={[-3.0, 0, 0]} color="#3afff0" intensity={1} distance={28} decay={2} />
      {/* Hatch on the underside */}
      <mesh position={[0, -0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.0, 28]} />
        <meshStandardMaterial color="#1a1a1c" emissive="#3afff0" emissiveIntensity={0.5} />
      </mesh>
      {/* Underside glow */}
      <pointLight position={[0, -0.6, 0]} color="#3afff0" intensity={0.9} distance={6} decay={2} />
    </group>
  );
}

function Crater({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.0, 32]} />
        <meshStandardMaterial color="#1a0e08" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[3.8, 5.0, 32]} />
        <meshStandardMaterial color="#5a2a1a" roughness={0.95} emissive="#3a1208" emissiveIntensity={0.4} />
      </mesh>
      {/* Glowing ember pebbles in the crater */}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.3;
        const r = 0.5 + (i % 3) * 0.8;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.06, Math.sin(a) * r]} castShadow>
            <icosahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#5a2a1a" emissive="#ff5a1a" emissiveIntensity={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export const BLOB_SPAWN: [number, number, number] = [CRASH_X, 0.6, CRASH_Z];
void INTRO_DURATION; // referenced in spec; unused at runtime
