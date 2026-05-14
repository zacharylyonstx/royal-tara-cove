interface BinsProps {
  position: [number, number, number];
  rotation?: number;
}

export function TrashBins({ position, rotation = 0 }: BinsProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[
        { x: -0.5, color: '#3a5a3e' }, // recycle
        { x: 0.5, color: '#3a3a3e' }, // trash
      ].map((b, i) => (
        <group key={i} position={[b.x, 0, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.7, 1.1, 0.85]} />
            <meshStandardMaterial color={b.color} roughness={0.85} />
          </mesh>
          {/* lid */}
          <mesh position={[0, 1.13, -0.01]} castShadow>
            <boxGeometry args={[0.74, 0.06, 0.88]} />
            <meshStandardMaterial color="#1a1a1c" />
          </mesh>
          {/* wheels */}
          <mesh position={[0.32, 0.04, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 10]} />
            <meshStandardMaterial color="#1a1a1c" />
          </mesh>
          <mesh position={[-0.32, 0.04, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 10]} />
            <meshStandardMaterial color="#1a1a1c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
