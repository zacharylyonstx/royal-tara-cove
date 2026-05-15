import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import { isNearPlayer } from '../../systems/distance';

interface LiveOakProps {
  position: [number, number, number];
  scale?: number;
  /** Seed for procedural variance (so trees aren't identical clones). */
  seed?: number;
}

/**
 * A big Texas live oak: thick trunk, several spreading branches,
 * each branch terminating in a foliage cluster. Foliage clusters
 * gently bob in the wind.
 */
export function LiveOak({ position, scale = 1, seed = 0 }: LiveOakProps) {
  const group = useRef<Group>(null);

  const { branches, clusters } = useMemo(() => {
    const rng = mulberry32(seed * 9301 + 1);
    const branches: { rot: [number, number, number]; len: number; tilt: number; pos: [number, number, number] }[] = [];
    const clusters: { pos: [number, number, number]; r: number; color: string; phase: number }[] = [];

    const trunkH = 3.2;

    // Crown clusters (large central canopy)
    const crownColors = ['#3d6e34', '#4a7a3e', '#356333', '#588a44', '#436b35'];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng() * 0.4;
      const r = 1.6 + rng() * 1.6;
      const h = trunkH + 1.2 + rng() * 1.4;
      clusters.push({
        pos: [Math.cos(a) * r, h, Math.sin(a) * r],
        r: 1.4 + rng() * 0.7,
        color: crownColors[Math.floor(rng() * crownColors.length)],
        phase: rng() * Math.PI * 2,
      });
    }
    // Top dome
    clusters.push({
      pos: [0, trunkH + 2.2 + rng() * 0.5, 0],
      r: 1.9,
      color: crownColors[0],
      phase: rng() * Math.PI * 2,
    });

    // A couple of side spreading branches with foliage at the tips
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng() * 0.6;
      const len = 1.6 + rng() * 0.7;
      const tilt = -Math.PI / 2.5 + rng() * 0.3;
      const branchY = trunkH * (0.5 + rng() * 0.3);
      branches.push({ rot: [tilt, a, 0], len, tilt, pos: [0, branchY, 0] });
      const tipR = len * 0.95;
      clusters.push({
        pos: [Math.cos(a) * tipR * 1.05, branchY + Math.sin(-tilt) * len * 0.6, Math.sin(a) * tipR * 1.05],
        r: 1.0 + rng() * 0.5,
        color: crownColors[Math.floor(rng() * crownColors.length)],
        phase: rng() * Math.PI * 2,
      });
    }

    return { branches, clusters };
  }, [seed]);

  useFrame((state) => {
    if (!isNearPlayer(position[0], position[2], 40)) return;
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.children.forEach((c, i) => {
      if (c.userData.cluster) {
        const phase = c.userData.phase as number;
        c.position.y = c.userData.baseY + Math.sin(t * 0.9 + phase) * 0.04;
        c.rotation.z = Math.sin(t * 0.6 + phase) * 0.03;
      }
      void i;
    });
  });

  return (
    <group position={position} scale={scale}>
      {/* trunk */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.46, 3.2, 10]} />
        <meshStandardMaterial color="#5a3d22" roughness={0.92} flatShading />
      </mesh>
      {/* base flare */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <coneGeometry args={[0.62, 0.5, 10]} />
        <meshStandardMaterial color="#5a3d22" roughness={0.92} flatShading />
      </mesh>

      {/* branches */}
      {branches.map((b, i) => (
        <group key={`b${i}`} position={b.pos} rotation={b.rot}>
          <mesh position={[0, 0, b.len / 2]} castShadow>
            <cylinderGeometry args={[0.07, 0.16, b.len, 8]} />
            <meshStandardMaterial color="#5a3d22" roughness={0.92} flatShading />
          </mesh>
        </group>
      ))}

      <group ref={group}>
        {clusters.map((c, i) => (
          <ClusterMesh key={`c${i}`} cluster={c} />
        ))}
      </group>
    </group>
  );
}

function ClusterMesh({ cluster }: { cluster: { pos: [number, number, number]; r: number; color: string; phase: number } }) {
  return (
    <mesh
      position={cluster.pos}
      castShadow
      userData={{ cluster: true, baseY: cluster.pos[1], phase: cluster.phase }}
    >
      <icosahedronGeometry args={[cluster.r, 1]} />
      <meshStandardMaterial color={cluster.color} flatShading roughness={0.9} />
    </mesh>
  );
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// suppress unused warning for THREE
void THREE;
