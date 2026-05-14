interface KitchenProps {
  origin: [number, number, number];
}

export function Kitchen({ origin }: KitchenProps) {
  return (
    <group position={origin}>
      {/* Island with countertop */}
      <Island position={[0, 0, 0]} />
      {/* Wall cabinets along the back wall (assumed at z=+1.5) */}
      <Cabinets position={[-1.5, 0, 1.0]} />
      {/* Fridge */}
      <Fridge position={[-1.0, 0, 1.4]} />
      {/* Stove */}
      <Stove position={[0, 0, 1.4]} />
      {/* Sink */}
      <Sink position={[1.0, 0, 1.4]} />
      {/* Pendant lights over island */}
      <Pendant position={[-0.6, 2.4, 0]} />
      <Pendant position={[0.6, 2.4, 0]} />
    </group>
  );
}

function Island({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.9, 1.0]} />
        <meshStandardMaterial color="#dcd2c0" roughness={0.7} />
      </mesh>
      {/* countertop */}
      <mesh position={[0, 0.94, 0]} castShadow>
        <boxGeometry args={[2.4, 0.05, 1.15]} />
        <meshStandardMaterial color="#3a3a3c" roughness={0.4} metalness={0.05} />
      </mesh>
      {/* bar stools on one side */}
      {[-0.8, 0, 0.8].map((x, i) => (
        <group key={i} position={[x, 0, 0.85]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 16]} />
            <meshStandardMaterial color="#5a3a22" />
          </mesh>
          <mesh position={[0, 0.27, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.55, 6]} />
            <meshStandardMaterial color="#3a3a3c" metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.18, 0.04, 12]} />
            <meshStandardMaterial color="#3a3a3c" />
          </mesh>
        </group>
      ))}
      {/* fruit bowl on countertop */}
      <mesh position={[0.5, 1.0, -0.2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.06, 12]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>
      {[
        [0.5, 1.07, -0.2],
        [0.45, 1.08, -0.18],
        [0.55, 1.08, -0.22],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={['#c8392a', '#e6b94a', '#5cb85c'][i]} />
        </mesh>
      ))}
    </group>
  );
}

function Cabinets({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[3.0, 0.9, 0.6]} />
        <meshStandardMaterial color="#dcd2c0" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.94, 0]} castShadow>
        <boxGeometry args={[3.0, 0.05, 0.65]} />
        <meshStandardMaterial color="#3a3a3c" roughness={0.4} />
      </mesh>
      {/* upper cabinets */}
      <mesh position={[0, 2.1, -0.05]} castShadow>
        <boxGeometry args={[3.0, 0.8, 0.4]} />
        <meshStandardMaterial color="#dcd2c0" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Fridge({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.8, 1.9, 0.7]} />
        <meshStandardMaterial color="#dcd6c8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* handle */}
      <mesh position={[0.38, 1.4, 0.36]} castShadow>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial color="#3a3a3c" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Stove({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.75, 0.9, 0.6]} />
        <meshStandardMaterial color="#3a3a3c" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* burners */}
      {[-0.18, 0.18].map((x) => (
        [-0.13, 0.13].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.92, z]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 12]} />
            <meshStandardMaterial color="#1a1a1c" />
          </mesh>
        ))
      ))}
    </group>
  );
}

function Sink({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* basin */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.7, 0.04, 0.5]} />
        <meshStandardMaterial color="#9c9890" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.83, 0]} castShadow>
        <boxGeometry args={[0.6, 0.08, 0.4]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* faucet */}
      <mesh position={[0, 1.05, -0.1]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} />
        <meshStandardMaterial color="#bbb" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.18, -0.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
        <meshStandardMaterial color="#bbb" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Pendant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.5, 4]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      <mesh castShadow>
        <coneGeometry args={[0.18, 0.3, 12, 1, true]} />
        <meshStandardMaterial color="#e6b94a" emissive="#fff0a8" emissiveIntensity={0.7} side={2} />
      </mesh>
      <pointLight intensity={0.55} color="#fff0c8" distance={4} decay={2} />
    </group>
  );
}
