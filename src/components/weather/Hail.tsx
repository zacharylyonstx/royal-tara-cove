import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../state/gameStore';
import { useTornadoStore } from '../../state/tornadoStore';
import { hailTick } from '../../audio';

// White hail spheres recycled around the active player, with low rate of
// audible "tick" sounds when player is near ground level. Only visible during
// hail+ phases (stormIntensity > 0.55).

const COUNT = 350;
const SPAWN_HALF = 35;
const SPAWN_HEIGHT_TOP = 28;
const FALL_SPEED = 22;
const TICK_INTERVAL = 0.18;

export function Hail() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => {
    const arr: { x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number; spin: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 2 * SPAWN_HALF,
        y: Math.random() * SPAWN_HEIGHT_TOP,
        z: (Math.random() - 0.5) * 2 * SPAWN_HALF,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        spin: 2 + Math.random() * 4,
      });
    }
    return arr;
  }, []);

  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const sinceTick = useRef(0);

  useFrame((_state, dtRaw) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const intensity = useTornadoStore.getState().stormIntensity;
    mesh.visible = intensity > 0.55;
    if (!mesh.visible) return;
    const dt = Math.min(dtRaw, 0.05);
    const wind = useTornadoStore.getState().windStrength;
    const dy = FALL_SPEED * dt;
    const dx = wind * 4 * dt;
    const player = positions[activeId];
    const px = player?.x ?? 0;
    const pz = player?.z ?? 0;

    for (let i = 0; i < COUNT; i++) {
      const d = drops[i];
      d.y -= dy;
      d.x += dx;
      d.rotX += d.spin * dt;
      d.rotZ += d.spin * 0.7 * dt;
      const rx = d.x - px;
      const rz = d.z - pz;
      if (d.y < 0 || rx < -SPAWN_HALF || rx > SPAWN_HALF || rz < -SPAWN_HALF || rz > SPAWN_HALF) {
        d.x = px + (Math.random() - 0.5) * 2 * SPAWN_HALF;
        d.z = pz + (Math.random() - 0.5) * 2 * SPAWN_HALF;
        d.y = SPAWN_HEIGHT_TOP * (0.6 + Math.random() * 0.4);
      }
      tmp.position.set(d.x, d.y, d.z);
      tmp.rotation.set(d.rotX, d.rotY, d.rotZ);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Hail-tick audio: sample at TICK_INTERVAL, weighted by intensity.
    sinceTick.current += dt;
    if (sinceTick.current >= TICK_INTERVAL) {
      sinceTick.current = 0;
      if (intensity > 0.6 && Math.random() < intensity) {
        hailTick((Math.random() - 0.5) * 1.6, 0.85 + Math.random() * 0.3);
      }
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0.1} />
    </instancedMesh>
  );
}
