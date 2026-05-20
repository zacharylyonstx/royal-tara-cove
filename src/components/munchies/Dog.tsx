import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

interface DogProps {
  positionRef: { x: number; z: number; yaw: number };
  bluish: boolean;
}

/** Minimalist box-dog. Brown body, head, ears, tail. */
export function Dog({ positionRef, bluish }: DogProps) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.set(positionRef.x, 0, positionRef.z);
    ref.current.rotation.y = positionRef.yaw;
    const t = state.clock.elapsedTime;
    const tail = ref.current.getObjectByName('dog-tail');
    if (tail) tail.rotation.y = Math.sin(t * 8) * 0.6;
  });
  const body = bluish ? '#7a8aa8' : '#9a6a3a';
  const dark = bluish ? '#3a4a6a' : '#5a3a1a';
  return (
    <group ref={ref}>
      {/* body */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.45, 0.32, 0.7]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.45, -0.45]} castShadow>
        <boxGeometry args={[0.35, 0.32, 0.32]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* snout */}
      <mesh position={[0, 0.36, -0.62]} castShadow>
        <boxGeometry args={[0.22, 0.18, 0.18]} />
        <meshStandardMaterial color={dark} roughness={0.85} />
      </mesh>
      {/* ears */}
      <mesh position={[-0.12, 0.62, -0.42]}>
        <boxGeometry args={[0.06, 0.18, 0.12]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <mesh position={[0.12, 0.62, -0.42]}>
        <boxGeometry args={[0.06, 0.18, 0.12]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      {/* legs */}
      {[[-0.15, -0.22], [0.15, -0.22], [-0.15, 0.22], [0.15, 0.22]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.12, lz]} castShadow>
          <boxGeometry args={[0.1, 0.24, 0.1]} />
          <meshStandardMaterial color={body} />
        </mesh>
      ))}
      {/* tail */}
      <group name="dog-tail" position={[0, 0.4, 0.34]}>
        <mesh position={[0, 0, 0.12]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.24]} />
          <meshStandardMaterial color={body} />
        </mesh>
      </group>
    </group>
  );
}
