interface LivingRoomProps {
  origin: [number, number, number];
  doorCenterX: number;
}

export function LivingRoom({ origin }: LivingRoomProps) {
  return (
    <group position={origin}>
      {/* Couch */}
      <Couch position={[0, 0, 0]} rotation={Math.PI / 2} />
      {/* Coffee table */}
      <CoffeeTable position={[1.4, 0, 0]} />
      {/* Floor lamp */}
      <FloorLamp position={[0.2, 0, -1.2]} />
      {/* Bookshelf */}
      <Bookshelf position={[-0.2, 0, 1.2]} />
      {/* Ceiling fan */}
      <CeilingFan position={[1.5, 2.7, 0]} />
    </group>
  );
}

function Couch({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* base */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.4, 0.85]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.95} />
      </mesh>
      {/* back */}
      <mesh position={[0, 0.7, -0.3]} castShadow>
        <boxGeometry args={[2.2, 0.6, 0.25]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.95} />
      </mesh>
      {/* arms */}
      <mesh position={[-1.05, 0.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.45, 0.85]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.95} />
      </mesh>
      <mesh position={[1.05, 0.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.45, 0.85]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.95} />
      </mesh>
      {/* cushions */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 0.1]} castShadow>
          <boxGeometry args={[0.55, 0.18, 0.65]} />
          <meshStandardMaterial color="#7a6a4a" roughness={0.95} />
        </mesh>
      ))}
      {/* throw pillow */}
      <mesh position={[-0.7, 0.7, 0.2]} castShadow>
        <boxGeometry args={[0.32, 0.18, 0.32]} />
        <meshStandardMaterial color="#a83a3a" />
      </mesh>
    </group>
  );
}

function CoffeeTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.0, 0.06, 0.6]} />
        <meshStandardMaterial color="#6a4a32" roughness={0.6} />
      </mesh>
      {[
        [-0.4, 0.2, -0.22],
        [0.4, 0.2, -0.22],
        [-0.4, 0.2, 0.22],
        [0.4, 0.2, 0.22],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
          <meshStandardMaterial color="#3a2a1c" />
        </mesh>
      ))}
      {/* book */}
      <mesh position={[0.2, 0.45, 0]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.26]} />
        <meshStandardMaterial color="#3a5aa6" />
      </mesh>
    </group>
  );
}

function FloorLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.1, 12]} />
        <meshStandardMaterial color="#2a2a2c" />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1.7, 6]} />
        <meshStandardMaterial color="#4a4a4c" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <coneGeometry args={[0.22, 0.4, 12, 1, true]} />
        <meshStandardMaterial color="#f5ecd9" emissive="#fff0a8" emissiveIntensity={0.3} side={2} />
      </mesh>
    </group>
  );
}

function Bookshelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[1.0, 1.8, 0.3]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      {/* shelves */}
      {[0.4, 0.8, 1.2, 1.6].map((y) => (
        <mesh key={y} position={[0, y, 0.01]}>
          <boxGeometry args={[0.92, 0.04, 0.28]} />
          <meshStandardMaterial color="#3a2a1c" />
        </mesh>
      ))}
      {/* books */}
      {[0.45, 0.85, 1.25].flatMap((y, row) => (
        Array.from({ length: 6 }, (_, i) => {
          const x = -0.4 + i * 0.16;
          const colors = ['#a83a3a', '#3a5aa6', '#5cb85c', '#e6b94a', '#9a3aa6', '#3a3a3c'];
          return (
            <mesh key={`${row}-${i}`} position={[x, y + 0.18, 0.05]} castShadow>
              <boxGeometry args={[0.14, 0.32, 0.18]} />
              <meshStandardMaterial color={colors[i]} />
            </mesh>
          );
        })
      ))}
    </group>
  );
}

function CeilingFan({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 12]} />
        <meshStandardMaterial color="#5a4a3a" />
      </mesh>
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((r, i) => (
        <mesh key={i} position={[0, -0.05, 0]} rotation={[0, r, 0]} castShadow>
          <boxGeometry args={[0.85, 0.04, 0.18]} />
          <meshStandardMaterial color="#7a6a4a" />
        </mesh>
      ))}
      {/* light below */}
      <mesh position={[0, -0.18, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#fff0c8" emissive="#fff0c8" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
