interface BBQProps {
  position: [number, number, number];
  rotation?: number;
}

export function BBQGrill({ position, rotation = 0 }: BBQProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* legs */}
      {[[-0.45, 0, -0.3], [0.45, 0, -0.3], [-0.45, 0, 0.3], [0.45, 0, 0.3]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, 0.45 + y, z]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
          <meshStandardMaterial color="#1a1a1c" />
        </mesh>
      ))}
      {/* main body */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[1.1, 0.5, 0.7]} />
        <meshStandardMaterial color="#2a2a2c" metalness={0.4} roughness={0.55} />
      </mesh>
      {/* lid */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 1.1, 16, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#3a3a3c" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* side shelf */}
      <mesh position={[0.78, 1.0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.04, 0.6]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* propane tank */}
      <mesh position={[-0.55, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.35, 12]} />
        <meshStandardMaterial color="#7a3a3a" />
      </mesh>
    </group>
  );
}
