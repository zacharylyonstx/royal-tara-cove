import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGameStore } from '../state/gameStore';

// 3rd-person follow camera using OrbitControls. Each frame we push the controls'
// target onto the active character's chest height; OrbitControls keeps the
// spherical offset (azimuth/polar/distance) stable, so the camera "follows" as
// the character moves and the user can still drag-orbit / scroll-zoom freely.
export function CameraRig() {
  // OrbitControls type from drei is awkward to reference; cast to any internally.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);

  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;
    const pos = positions[activeId];
    c.target.set(pos.x, pos.y + 1.1, pos.z);
    c.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={4}
      maxDistance={60}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2 - 0.08}
      enableDamping
      dampingFactor={0.12}
    />
  );
}
