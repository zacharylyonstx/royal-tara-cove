import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, Vector3 } from 'three';
import type { CharacterDef } from '../types';

interface CharacterProps {
  def: CharacterDef;
  positionRef: Vector3;
  yawRef: { current: number };
  isActive: boolean;
}

/** Voxel-ish cartoon character with a walk animation. */
export function Character({ def, positionRef, yawRef, isActive }: CharacterProps) {
  const groupRef = useRef<Group>(null);
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
    g.rotation.y = yawRef.current;

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

    if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.9;
    if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.9;
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
    <group ref={groupRef}>
      {/* Legs (pivot from hip) */}
      <group position={[-h * 0.06, legsH, 0]}>
        <mesh ref={leftLegRef} position={[0, -legsH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.1, legsH, h * 0.12]} />
          <meshStandardMaterial color={def.pantsColor} />
        </mesh>
      </group>
      <group position={[h * 0.06, legsH, 0]}>
        <mesh ref={rightLegRef} position={[0, -legsH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.1, legsH, h * 0.12]} />
          <meshStandardMaterial color={def.pantsColor} />
        </mesh>
      </group>

      {/* shoes */}
      <mesh position={[-h * 0.06, 0.05, h * 0.05]} castShadow>
        <boxGeometry args={[h * 0.11, 0.1, h * 0.18]} />
        <meshStandardMaterial color={def.shoeColor} />
      </mesh>
      <mesh position={[h * 0.06, 0.05, h * 0.05]} castShadow>
        <boxGeometry args={[h * 0.11, 0.1, h * 0.18]} />
        <meshStandardMaterial color={def.shoeColor} />
      </mesh>

      {/* torso */}
      <mesh ref={torsoRef} position={[0, torsoY, 0]} castShadow>
        <boxGeometry args={[h * 0.3, torsoH, h * 0.18]} />
        <meshStandardMaterial color={def.bodyColor} />
      </mesh>

      {/* arms (pivot from shoulder) */}
      <group position={[-h * 0.21, torsoY + torsoH * 0.4, 0]}>
        <mesh ref={leftArmRef} position={[0, -armH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.085, armH, h * 0.1]} />
          <meshStandardMaterial color={def.bodyColor} />
        </mesh>
      </group>
      <group position={[h * 0.21, torsoY + torsoH * 0.4, 0]}>
        <mesh ref={rightArmRef} position={[0, -armH / 2, 0]} castShadow>
          <boxGeometry args={[h * 0.085, armH, h * 0.1]} />
          <meshStandardMaterial color={def.bodyColor} />
        </mesh>
      </group>

      {/* hands (don't swing — keeps things readable) */}
      <mesh position={[-h * 0.215, legsH + armH * 0.3, 0]} castShadow>
        <sphereGeometry args={[h * 0.052, 10, 10]} />
        <meshStandardMaterial color={def.skinTone} />
      </mesh>
      <mesh position={[h * 0.215, legsH + armH * 0.3, 0]} castShadow>
        <sphereGeometry args={[h * 0.052, 10, 10]} />
        <meshStandardMaterial color={def.skinTone} />
      </mesh>

      {/* neck */}
      <mesh position={[0, legsH + torsoH + h * 0.015, 0]} castShadow>
        <cylinderGeometry args={[h * 0.05, h * 0.05, h * 0.04, 8]} />
        <meshStandardMaterial color={def.skinTone} />
      </mesh>

      {/* head */}
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[headR, 16, 16]} />
        <meshStandardMaterial color={def.skinTone} />
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
