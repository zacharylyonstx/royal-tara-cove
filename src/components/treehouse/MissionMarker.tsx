import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useTreehouseStore } from '../../state/treehouseStore';
import { useGameStore } from '../../state/gameStore';
import {
  welcomeTargetPos,
  mailboxWorldPosition,
  sparkyTargetPosition,
} from '../../world/treehouseMissions';

export function MissionMarker() {
  const activeMissionId = useTreehouseStore((s) => s.activeMissionId);
  const phase = useGameStore((s) => s.phase);
  if (phase !== 'treehouse-play') return null;
  if (!activeMissionId) return null;

  let target: { x: number; z: number } | null = null;
  if (activeMissionId === 'welcome-to-the-cove') target = welcomeTargetPos();
  if (activeMissionId === 'missing-gnome') target = mailboxWorldPosition('10625');
  if (activeMissionId === 'wheres-sparky') target = sparkyTargetPosition();
  if (!target) return null;

  return <Marker x={target.x} z={target.z} />;
}

function Marker({ x, z }: { x: number; z: number }) {
  const ringRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ringRef.current) return;
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 2) * 0.08;
    ringRef.current.scale.set(s, 1, s);
  });
  return (
    <group position={[x, 0.02, z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.3, 32]} />
        <meshStandardMaterial color="#ffd86a" emissive="#ffa83a" emissiveIntensity={0.7} transparent opacity={0.85} />
      </mesh>
      <pointLight color="#ffd86a" intensity={1.0} distance={4} decay={2} />
    </group>
  );
}
