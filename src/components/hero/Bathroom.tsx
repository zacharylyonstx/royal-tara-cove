interface BathroomProps {
  origin: [number, number, number];
}

export function Bathroom({ origin }: BathroomProps) {
  return (
    <group position={origin}>
      {/* Toilet */}
      <Toilet position={[-0.6, 0, 0.5]} />
      {/* Vanity with sink */}
      <Vanity position={[0.5, 0, 0.4]} />
      {/* Mirror */}
      <Mirror position={[0.5, 1.6, 0.55]} />
    </group>
  );
}

function Toilet({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* base */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.36, 0.4, 0.55]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* tank */}
      <mesh position={[0, 0.6, -0.2]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.18]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* seat */}
      <mesh position={[0, 0.42, 0.1]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 16]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
    </group>
  );
}

function Vanity({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.9, 0.9, 0.5]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      <mesh position={[0, 0.94, 0]} castShadow>
        <boxGeometry args={[0.95, 0.05, 0.55]} />
        <meshStandardMaterial color="#dcd6c8" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* sink basin */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 16]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* faucet */}
      <mesh position={[0, 1.06, -0.1]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#bbb" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Mirror({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.7, 0.9, 0.04]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      <mesh position={[0, 0, 0.022]}>
        <boxGeometry args={[0.62, 0.82, 0.005]} />
        <meshStandardMaterial color="#dcdfe6" metalness={0.85} roughness={0.1} />
      </mesh>
    </group>
  );
}
