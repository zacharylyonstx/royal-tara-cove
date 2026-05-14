import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import { useGameStore } from '../../state/gameStore';

const COUNT = 14;
const PARTY_COLORS = ['#ff5a3a', '#fff15a', '#5cb85c', '#3afff0', '#e26aa1', '#a0e84a', '#ff80b8', '#5acdff'];

interface PartyBlob {
  baseX: number; baseZ: number;
  baseColor: string;
  bopPhase: number;
  spinPhase: number;
  scale: number;
}

/** Spawns happy bouncing party-blob copies during the victory phase. */
export function DancingBlobs() {
  const phase = useGameStore((s) => s.phase);
  const groupRef = useRef<Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const eyeRefs = useRef<(THREE.Group | null)[]>([]);

  const data = useMemo<PartyBlob[]>(() => {
    return Array.from({ length: COUNT }, (_, i) => {
      // Cluster around the cul-de-sac
      const ang = (i / COUNT) * Math.PI * 2;
      const r = 5 + Math.random() * 10;
      return {
        baseX: Math.cos(ang) * r,
        baseZ: 0 + Math.sin(ang) * r,
        baseColor: PARTY_COLORS[i % PARTY_COLORS.length],
        bopPhase: Math.random() * Math.PI * 2,
        spinPhase: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.6,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (phase !== 'victory') return;
    const t = clock.elapsedTime;
    data.forEach((d, i) => {
      const m = meshRefs.current[i];
      const eye = eyeRefs.current[i];
      if (!m) return;
      const bop = Math.abs(Math.sin(t * 4 + d.bopPhase)) * 0.6;
      const spin = t * 2 + d.spinPhase;
      m.position.set(d.baseX, bop, d.baseZ);
      m.rotation.set(0, spin, Math.sin(t * 3 + d.bopPhase) * 0.2);
      // Color cycle
      const colorIdx = Math.floor(t * 1.5 + i * 0.3) % PARTY_COLORS.length;
      const matBase = m.material as THREE.MeshStandardMaterial;
      if (matBase) {
        matBase.color.set(PARTY_COLORS[colorIdx]);
        matBase.emissive.set(PARTY_COLORS[colorIdx]);
        matBase.emissiveIntensity = 0.4 + bop * 0.3;
      }
      if (eye) {
        eye.position.set(d.baseX, 0.3 + bop, d.baseZ + 0.4);
      }
    });
  });

  if (phase !== 'victory') return null;

  return (
    <group ref={groupRef}>
      {data.map((d, i) => (
        <group key={i}>
          <mesh
            ref={(m) => { meshRefs.current[i] = m; }}
            position={[d.baseX, 0, d.baseZ]}
            scale={d.scale}
            castShadow
          >
            <sphereGeometry args={[0.5, 18, 14]} />
            <meshStandardMaterial color={d.baseColor} emissive={d.baseColor} emissiveIntensity={0.3} roughness={0.4} />
          </mesh>
          {/* Party hat */}
          <mesh position={[d.baseX, d.scale * 0.65, d.baseZ]} scale={d.scale}>
            <coneGeometry args={[0.18, 0.4, 12]} />
            <meshStandardMaterial color={PARTY_COLORS[(i + 2) % PARTY_COLORS.length]} />
          </mesh>
          {/* Eyes */}
          <group ref={(g) => { eyeRefs.current[i] = g; }} position={[d.baseX, 0.3, d.baseZ + 0.4]} scale={d.scale}>
            <mesh position={[-0.15, 0, 0]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
            <mesh position={[-0.15, 0, 0.06]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#1a1a1c" />
            </mesh>
            <mesh position={[0.15, 0, 0]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
            <mesh position={[0.15, 0, 0.06]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#1a1a1c" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
