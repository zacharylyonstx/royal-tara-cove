import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, Vector3 } from 'three';
import type { CharacterDef } from '../types';
import { usePlayStore } from '../state/playStore';

interface CharacterProps {
  def: CharacterDef;
  positionRef: Vector3;
  yawRef: { current: number };
  isActive: boolean;
}

/** Voxel-ish cartoon character with a walk animation. */
export function Character({ def, positionRef, yawRef, isActive }: CharacterProps) {
  const groupRef = useRef<Group>(null);
  // The local player's body is normally hidden (FPS), but show it while riding
  // a bike so the third-person chase camera has a rider to follow.
  const riding = usePlayStore((s) => s.riding[def.id]);
  const lastPos = useRef({ x: positionRef.x, z: positionRef.z });
  const phase = useRef(0);

  const leftLegRef = useRef<Mesh>(null);
  const rightLegRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);
  const torsoRef = useRef<Mesh>(null);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const g = groupRef.current;
    if (!g) return;
    g.position.copy(positionRef);
    g.rotation.order = 'YXZ';
    g.rotation.y = yawRef.current;

    // Bike air tricks: pitch the rider end-over-end with the bike, and tip
    // sideways during a wipeout. Read live (flip is mutated per-frame, not via set).
    const live = usePlayStore.getState().riding[def.id];
    g.rotation.x = live?.flip ? live.flip.angle : 0;
    const wipeActive = !!live && live.wipeoutUntil > performance.now();
    g.rotation.z += ((wipeActive ? 1.15 : 0) - g.rotation.z) * Math.min(1, dt * 12);

    // Estimate horizontal speed.
    const dx = positionRef.x - lastPos.current.x;
    const dz = positionRef.z - lastPos.current.z;
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    lastPos.current.x = positionRef.x;
    lastPos.current.z = positionRef.z;

    if (speed > 0.1) {
      phase.current += dt * Math.min(12, 4 + speed);
    } else {
      // Damp toward 0 phase.
      phase.current += dt * 1.5 * (-Math.sin(phase.current));
    }
    const swing = Math.sin(phase.current) * Math.min(0.5, speed * 0.08);

    if (live) {
      // Seated riding pose (legs to pedals, hands to bars) — no walk swing.
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0.7;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0.7;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0.55;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0.55;
    } else {
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.9;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.9;
    }
    if (torsoRef.current) torsoRef.current.position.y = baseTorsoY(def.height) + Math.sin(state.clock.elapsedTime * 1.4) * 0.012;
  });

  const h = def.height;
  const headR = h * 0.13;
  const torsoH = h * 0.36;
  const legsH = h * 0.42;
  const armH = h * 0.32;
  const torsoY = legsH + torsoH / 2;
  const headY = legsH + torsoH + headR;

  return (
    <group ref={groupRef} visible={!isActive || !!riding}>
      {/* Legs (pivot from hip) */}
      <group position={[-h * 0.06, legsH, 0]}>
        <mesh ref={leftLegRef} position={[0, -legsH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.1, legsH, h * 0.12]} />
          <meshStandardMaterial color={def.pantsColor} roughness={0.84} metalness={0} />
        </mesh>
      </group>
      <group position={[h * 0.06, legsH, 0]}>
        <mesh ref={rightLegRef} position={[0, -legsH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.1, legsH, h * 0.12]} />
          <meshStandardMaterial color={def.pantsColor} roughness={0.84} metalness={0} />
        </mesh>
      </group>

      {/* shoes */}
      <mesh position={[-h * 0.06, 0.05, h * 0.05]} castShadow>
        <boxGeometry args={[h * 0.11, 0.1, h * 0.18]} />
        <meshStandardMaterial color={def.shoeColor} roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[h * 0.06, 0.05, h * 0.05]} castShadow>
        <boxGeometry args={[h * 0.11, 0.1, h * 0.18]} />
        <meshStandardMaterial color={def.shoeColor} roughness={0.7} metalness={0} />
      </mesh>

      {/* torso */}
      <mesh ref={torsoRef} position={[0, torsoY, 0]} castShadow>
        <boxGeometry args={[h * 0.3, torsoH, h * 0.18]} />
        <meshStandardMaterial color={def.bodyColor} roughness={0.82} metalness={0} />
      </mesh>

      {/* arms (pivot from shoulder) */}
      <group position={[-h * 0.21, torsoY + torsoH * 0.4, 0]}>
        <mesh ref={leftArmRef} position={[0, -armH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.085, armH, h * 0.1]} />
          <meshStandardMaterial color={def.bodyColor} roughness={0.82} metalness={0} />
        </mesh>
      </group>
      <group position={[h * 0.21, torsoY + torsoH * 0.4, 0]}>
        <mesh ref={rightArmRef} position={[0, -armH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.085, armH, h * 0.1]} />
          <meshStandardMaterial color={def.bodyColor} roughness={0.82} metalness={0} />
        </mesh>
      </group>

      {/* hands (don't swing — keeps things readable) */}
      <mesh position={[-h * 0.215, legsH + armH * 0.3, 0]} castShadow>
        <sphereGeometry args={[h * 0.052, 10, 10]} />
        <meshStandardMaterial color={def.skinTone} roughness={0.62} metalness={0} />
      </mesh>
      <mesh position={[h * 0.215, legsH + armH * 0.3, 0]} castShadow>
        <sphereGeometry args={[h * 0.052, 10, 10]} />
        <meshStandardMaterial color={def.skinTone} roughness={0.62} metalness={0} />
      </mesh>

      {/* neck */}
      <mesh position={[0, legsH + torsoH + h * 0.015, 0]} castShadow>
        <cylinderGeometry args={[h * 0.05, h * 0.05, h * 0.04, 8]} />
        <meshStandardMaterial color={def.skinTone} roughness={0.62} metalness={0} />
      </mesh>

      {/* head */}
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[headR, 16, 16]} />
        <meshStandardMaterial color={def.skinTone} roughness={0.62} metalness={0} />
      </mesh>

      {/* hair cap */}
      <mesh position={[0, headY + headR * 0.15, -headR * 0.05]} castShadow>
        <sphereGeometry args={[headR * 1.06, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={def.hairColor} />
      </mesh>

      {/* eyes */}
      <mesh position={[-headR * 0.3, headY + headR * 0.1, headR * 0.82]} castShadow>
        <sphereGeometry args={[headR * 0.1, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[headR * 0.3, headY + headR * 0.1, headR * 0.82]} castShadow>
        <sphereGeometry args={[headR * 0.1, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* active-character ring */}
      {isActive && (
        <mesh position={[0, headY + headR * 1.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[headR * 0.7, headR * 0.85, 32]} />
          <meshBasicMaterial color="#ffd866" transparent opacity={0.92} />
        </mesh>
      )}
    </group>
  );
}

function baseTorsoY(h: number): number {
  return h * 0.42 + (h * 0.36) / 2;
}
