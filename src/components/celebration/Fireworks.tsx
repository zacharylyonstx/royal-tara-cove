import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCombatStore } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';

const COLORS = ['#ff5a3a', '#fff15a', '#5cb85c', '#3afff0', '#e26aa1', '#fff'];
const SPAWN_INTERVAL = 0.6;

/**
 * Spawns and renders fireworks bursts during the victory phase. Each burst is a
 * small particle-explosion + light flash. Capped to ~4 simultaneously per spec.
 */
export function Fireworks() {
  const phase = useGameStore((s) => s.phase);
  const fireworks = useCombatStore((s) => s.fireworks);
  const spawnFirework = useCombatStore((s) => s.spawnFirework);
  const accum = useRef(0);

  useFrame((_, dtRaw) => {
    if (phase !== 'victory') return;
    const dt = Math.min(dtRaw, 0.1);
    accum.current += dt;
    if (accum.current > SPAWN_INTERVAL) {
      accum.current = 0;
      // Spawn over and around the cul-de-sac (closer to player so always visible)
      const cx = (Math.random() - 0.5) * 50;
      const cz = -10 + (Math.random() - 0.5) * 50;
      const cy = 14 + Math.random() * 8;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      spawnFirework(cx, cy, cz, color);
    }
  });

  return (
    <>
      {fireworks.slice(-4).map((f) => <Burst key={f.id} firework={f} />)}
    </>
  );
}

function Burst({ firework }: { firework: ReturnType<typeof useCombatStore.getState>['fireworks'][number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const PARTICLES = 24;

  // Random per-burst direction unit vectors
  const dirs = useRef<{ x: number; y: number; z: number }[]>([]);
  useEffect(() => {
    dirs.current = Array.from({ length: PARTICLES }, () => {
      const phi = Math.random() * Math.PI * 2;
      const cosTheta = Math.random() * 2 - 1;
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      return { x: sinTheta * Math.cos(phi), y: cosTheta, z: sinTheta * Math.sin(phi) };
    });
  }, []);

  useFrame(({ clock }) => {
    const age = clock.elapsedTime - firework.spawnedAt;
    const k = Math.min(1, age / 2.4);
    const radius = k * 12;
    if (groupRef.current) {
      const children = groupRef.current.children;
      for (let i = 0; i < children.length && i < dirs.current.length; i++) {
        const d = dirs.current[i];
        children[i].position.set(
          d.x * radius,
          d.y * radius - 0.5 * 9.8 * age * age * 0.1,
          d.z * radius,
        );
        const m = (children[i] as THREE.Mesh).material as THREE.Material & { opacity?: number };
        if (m) m.opacity = 1 - k;
      }
    }
  });

  return (
    <group position={[firework.x, firework.y, firework.z]}>
      <group ref={groupRef}>
        {Array.from({ length: PARTICLES }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.45, 8, 8]} />
            <meshBasicMaterial color={firework.color} transparent opacity={1} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
