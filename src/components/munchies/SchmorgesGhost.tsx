import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';

interface Props {
  positionRef: { x: number; z: number; yaw: number };
  bluish: boolean; // tinted when powered
}

/**
 * Stripped-down "ghost" version of the Schmorgesblob from the aliens game.
 * Smaller, semi-translucent, cyan-tinted; bobs softly with floating tentacles.
 */
export function SchmorgesGhost({ positionRef, bluish }: Props) {
  const ref = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const leftEye = useRef<Mesh>(null);
  const rightEye = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.set(positionRef.x, 0.4 + Math.sin(t * 1.5) * 0.08, positionRef.z);
    ref.current.rotation.y = positionRef.yaw;
    if (body.current) {
      body.current.scale.y = 1 + Math.sin(t * 2.4) * 0.04;
    }
    if (leftEye.current) leftEye.current.position.y = 0.05 + Math.sin(t * 3.1) * 0.015;
    if (rightEye.current) rightEye.current.position.y = 0.05 + Math.sin(t * 3.1 + 1.5) * 0.015;
  });

  const bodyColor = bluish ? '#8acfff' : '#5fa890';
  const eyeColor = '#fff7e6';
  const pupilColor = bluish ? '#1f5a8a' : '#1a3a2a';

  return (
    <group ref={ref}>
      {/* Body blob */}
      <mesh ref={body} position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.4, 16, 12]} />
        <meshStandardMaterial
          color={bodyColor}
          transparent
          opacity={0.86}
          roughness={0.5}
          emissive={new THREE.Color(bodyColor)}
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Eye whites */}
      <group position={[0, 0.1, -0.32]}>
        <mesh ref={leftEye} position={[-0.13, 0.05, 0]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={eyeColor} />
        </mesh>
        <mesh ref={rightEye} position={[0.13, 0.05, 0]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={eyeColor} />
        </mesh>
        {/* Pupils */}
        <mesh position={[-0.13, 0.05, -0.07]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={pupilColor} />
        </mesh>
        <mesh position={[0.13, 0.05, -0.07]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={pupilColor} />
        </mesh>
      </group>
      {/* Three floppy tentacles below */}
      {[-0.18, 0, 0.18].map((tx, i) => (
        <mesh key={i} position={[tx, -0.32, 0]} castShadow>
          <coneGeometry args={[0.07, 0.32, 6]} />
          <meshStandardMaterial color={bodyColor} transparent opacity={0.82} />
        </mesh>
      ))}
      {/* Cyan glow */}
      <pointLight color={bluish ? '#bce6ff' : '#a8e6c8'} intensity={1.2} distance={2.6} decay={2} />
    </group>
  );
}
