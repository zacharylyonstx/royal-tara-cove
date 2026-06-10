import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCombatStore } from '../../state/combatStore';

// Shared up-axis reused by every beam's orientation math (zero per-beam alloc).
const BEAM_UP = new THREE.Vector3(0, 1, 0);

// Per-character beam colors — Penny's lasers are pink, Luke's green, Dad's
// (and the default) cyan. The store has carried this tint all along; render it.
const TINT_COLORS: Record<'cyan' | 'pink' | 'green', { core: string; halo: string }> = {
  cyan: { core: '#3afff0', halo: '#aeffff' },
  pink: { core: '#ff7ad1', halo: '#ffd2ec' },
  green: { core: '#8aff5a', halo: '#dfffc8' },
};

/** Renders all active beam visuals. Each fades out over ~0.14s. */
export function Beams() {
  const beams = useCombatStore((s) => s.beams);
  return (
    <>
      {beams.map((b) => (
        <BeamMesh key={b.id} beam={b} />
      ))}
    </>
  );
}

function BeamMesh({ beam }: { beam: ReturnType<typeof useCombatStore.getState>['beams'][number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const colors = TINT_COLORS[beam.tint] ?? TINT_COLORS.cyan;
  // A beam's endpoints are fixed for its (very short) life, so compute the
  // midpoint / orientation / length ONCE per beam instead of allocating three
  // Vector3s + a Quaternion on every reconcile (the beams array re-renders
  // each time a shot is fired/expired).
  const { mid, quat, len } = useMemo(() => {
    const start = new THREE.Vector3(beam.fromX, beam.fromY, beam.fromZ);
    const end = new THREE.Vector3(beam.toX, beam.toY, beam.toZ);
    const m = start.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(start);
    const l = dir.length();
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(BEAM_UP, dir);
    return { mid: m, quat: q, len: l };
  }, [beam.fromX, beam.fromY, beam.fromZ, beam.toX, beam.toY, beam.toZ]);

  useFrame(() => {
    const age = performance.now() / 1000 - beam.spawnedAt;
    const fade = Math.max(0, 1 - age / 0.14);
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.opacity = fade;
        if (mat.emissive) {
          mat.emissiveIntensity = 1.4 * fade;
        }
      }
      meshRef.current.scale.set(1 + (1 - fade) * 0.5, 1, 1 + (1 - fade) * 0.5);
    }
    // The halo must fade with the core — an unfaded halo left a permanent
    // faint glow cylinder for every shot that outlived its reap window.
    if (haloRef.current) {
      const mat = haloRef.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = 0.18 * fade;
    }
  });

  return (
    <group position={mid.toArray()} quaternion={quat.toArray() as unknown as THREE.Quaternion}>
      {/* Inner core beam */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.05, 0.05, len, 6, 1, true]} />
        <meshStandardMaterial color={colors.core} emissive={colors.core} emissiveIntensity={1.6} transparent opacity={0.95} />
      </mesh>
      {/* Outer halo glow */}
      <mesh ref={haloRef}>
        <cylinderGeometry args={[0.14, 0.14, len, 6, 1, true]} />
        <meshStandardMaterial color={colors.halo} emissive={colors.halo} emissiveIntensity={0.6} transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}
