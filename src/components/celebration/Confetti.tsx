import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';

const COUNT = 80;
const COLORS = ['#ff5a3a', '#fff15a', '#5cb85c', '#3afff0', '#e26aa1', '#fff', '#ff80b8', '#5acdff'];

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rotX: number; rotY: number; rotZ: number;
  rotVx: number; rotVy: number; rotVz: number;
  color: string;
  size: number;
}

export function Confetti() {
  const phase = useGameStore((s) => s.phase);
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: COUNT }, () => ({
      x: (Math.random() - 0.5) * 80,
      y: 25 + Math.random() * 25,
      z: -40 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1 - Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 1.5,
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
      rotVx: (Math.random() - 0.5) * 6,
      rotVy: (Math.random() - 0.5) * 6,
      rotVz: (Math.random() - 0.5) * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 0.3 + Math.random() * 0.4,
    }));
  }, []);

  useFrame((_, dtRaw) => {
    if (phase !== 'victory') return;
    const dt = Math.min(dtRaw, 0.1);
    const g = groupRef.current;
    if (!g) return;
    g.children.forEach((m, i) => {
      const p = particles[i];
      // Sway via sin(time)
      const sway = Math.sin(performance.now() * 0.001 + i * 0.5) * 0.6;
      p.x += (p.vx + sway) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rotX += p.rotVx * dt;
      p.rotY += p.rotVy * dt;
      p.rotZ += p.rotVz * dt;
      if (p.y < -0.5) {
        // Recycle to top
        p.x = (Math.random() - 0.5) * 80;
        p.y = 25 + Math.random() * 15;
        p.z = -40 + (Math.random() - 0.5) * 100;
      }
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.rotX, p.rotY, p.rotZ);
    });
  });

  if (phase !== 'victory') return null;

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i}>
          <planeGeometry args={[p.size, p.size * 0.6]} />
          <meshBasicMaterial color={p.color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
