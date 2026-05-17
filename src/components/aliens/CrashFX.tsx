import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { Mesh, PointLight } from 'three';
import { useCombatStore } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';

interface CrashFXProps {
  position: [number, number, number];
}

/**
 * Renders the bright flash sphere + expanding shock ring + persistent crater
 * glow pointlight after the UFO impact. Reads `crashFlashAt` from
 * combatStore. Self-contained: each frame computes age and animates.
 */
export function CrashFX({ position }: CrashFXProps) {
  const flashRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const glowRef = useRef<PointLight>(null);
  const crashAt = useCombatStore((s) => s.crashFlashAt);

  useFrame((state) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    const now = state.clock.elapsedTime;
    const age = now - (crashAt > 0 ? crashAt : -999);
    // Flash sphere: 0..0.18s grow + fade
    if (flashRef.current) {
      const a = Math.max(0, Math.min(1, age / 0.18));
      const scale = 0.5 + a * 4;
      flashRef.current.scale.setScalar(scale);
      const mat = flashRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = age < 0.2 ? 1 - a : 0;
    }
    // Ring: 0..0.45s grow + fade
    if (ringRef.current) {
      const a = Math.max(0, Math.min(1, age / 0.45));
      const r = 0.5 + a * 12;
      ringRef.current.scale.setScalar(r);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = age < 0.5 ? (1 - a) * 0.85 : 0;
    }
    // Crater glow: persists with flicker after impact
    if (glowRef.current) {
      const visible = crashAt > 0 && age > 0.1;
      glowRef.current.intensity = visible ? 1.5 + Math.sin(now * 9) * 0.4 + Math.sin(now * 23) * 0.2 : 0;
    }
  });

  return (
    <group position={position}>
      {/* Flash sphere */}
      <mesh ref={flashRef} scale={0.0001}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color="#fff8d8" transparent opacity={0} />
      </mesh>
      {/* Expanding shock ring (parallel to ground) */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial color="#fff8d8" transparent opacity={0} side={2} />
      </mesh>
      {/* Persistent orange glow inside crater */}
      <pointLight ref={glowRef} position={[0, 0.6, 0]} color="#ff8a3a" intensity={0} distance={14} decay={2} />
    </group>
  );
}

/**
 * Animated debris fragments. Reads from combatStore.debris each frame and
 * renders one mesh per fragment. Cleans up via reapDebris.
 */
export function Debris() {
  const debris = useCombatStore((s) => s.debris);
  const reapDebris = useCombatStore((s) => s.reapDebris);
  useFrame((state) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    reapDebris(state.clock.elapsedTime);
  });
  return (
    <>
      {debris.map((d) => <DebrisPiece key={d.id} d={d} />)}
    </>
  );
}

function DebrisPiece({ d }: { d: ReturnType<typeof useCombatStore.getState>['debris'][number] }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    const now = state.clock.elapsedTime;
    const age = now - d.spawnedAt;
    const x = d.x + d.vx * age;
    const y = d.y + d.vy * age - 0.5 * 14 * age * age;
    const z = d.z + d.vz * age;
    if (ref.current) {
      ref.current.position.set(x, Math.max(0.1, y), z);
      ref.current.rotation.x = d.rot + d.rotSpeed * age;
      ref.current.rotation.z = d.rot * 0.5 + d.rotSpeed * 0.7 * age;
    }
  });
  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={[0.18, 0.12, 0.18]} />
      <meshStandardMaterial color="#5a4a3a" emissive="#ff7a3a" emissiveIntensity={0.3} />
    </mesh>
  );
}
