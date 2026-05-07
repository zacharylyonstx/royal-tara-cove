import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Vector3 } from 'three';
import type { CharacterDef } from '../types';

interface CharacterProps {
  def: CharacterDef;
  positionRef: Vector3;
  yawRef: { current: number };
  isActive: boolean;
}

// Voxel-ish cartoon character. All proportions scale with `def.height` so the
// dad reads as visibly larger than Penny, who reads larger than Luke.
export function Character({ def, positionRef, yawRef, isActive }: CharacterProps) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.copy(positionRef);
    g.rotation.y = yawRef.current;
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
      {/* legs */}
      <mesh position={[-h * 0.06, legsH / 2, 0]} castShadow>
        <boxGeometry args={[h * 0.1, legsH, h * 0.12]} />
        <meshStandardMaterial color={def.pantsColor} />
      </mesh>
      <mesh position={[h * 0.06, legsH / 2, 0]} castShadow>
        <boxGeometry args={[h * 0.1, legsH, h * 0.12]} />
        <meshStandardMaterial color={def.pantsColor} />
      </mesh>

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
      <mesh position={[0, torsoY, 0]} castShadow>
        <boxGeometry args={[h * 0.3, torsoH, h * 0.18]} />
        <meshStandardMaterial color={def.bodyColor} />
      </mesh>

      {/* arms */}
      <mesh position={[-h * 0.21, torsoY + torsoH * 0.15, 0]} castShadow>
        <boxGeometry args={[h * 0.085, armH, h * 0.1]} />
        <meshStandardMaterial color={def.bodyColor} />
      </mesh>
      <mesh position={[h * 0.21, torsoY + torsoH * 0.15, 0]} castShadow>
        <boxGeometry args={[h * 0.085, armH, h * 0.1]} />
        <meshStandardMaterial color={def.bodyColor} />
      </mesh>

      {/* hands */}
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
