interface PatioProps {
  position: [number, number, number];
  rotation?: number;
}

/** A round table + 4 chairs + small umbrella stand. */
export function PatioSet({ position, rotation = 0 }: PatioProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* table */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 24]} />
        <meshStandardMaterial color="#3a3a3c" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.7, 8]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 16]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* umbrella pole */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.6, 8]} />
        <meshStandardMaterial color="#5a5a5c" />
      </mesh>
      {/* umbrella canopy */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <coneGeometry args={[1.3, 0.5, 12]} />
        <meshStandardMaterial color="#a83a3a" roughness={0.85} />
      </mesh>
      {/* chairs */}
      {[
        { x: 0.95, z: 0, r: -Math.PI / 2 },
        { x: -0.95, z: 0, r: Math.PI / 2 },
        { x: 0, z: 0.95, r: Math.PI },
        { x: 0, z: -0.95, r: 0 },
      ].map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.r, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.45, 0.06, 0.45]} />
            <meshStandardMaterial color="#3a3a3c" metalness={0.4} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.7, 0.18]} castShadow>
            <boxGeometry args={[0.45, 0.5, 0.06]} />
            <meshStandardMaterial color="#3a3a3c" metalness={0.4} roughness={0.55} />
          </mesh>
          {[
            [-0.18, 0.22, 0.18],
            [0.18, 0.22, 0.18],
            [-0.18, 0.22, -0.18],
            [0.18, 0.22, -0.18],
          ].map(([x, y, z], j) => (
            <mesh key={j} position={[x, y, z]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.45, 6]} />
              <meshStandardMaterial color="#1a1a1c" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
