import { mat } from '../../world/materials';

interface BedroomProps {
  origin: [number, number, number];
  size: [number, number]; // width, depth in plan
  kid: 'dad' | 'penny' | 'luke';
}

const THEMES = {
  dad: {
    bedColor: '#3a3a45',
    pillowColor: '#dcd6c8',
    quiltColor: '#5a6a82',
    wallAccent: '#8a8a92',
  },
  penny: {
    bedColor: '#fff0f5',
    pillowColor: '#ffe0ee',
    quiltColor: '#e26aa1',
    wallAccent: '#f5d3e3',
  },
  luke: {
    bedColor: '#3a5aa6',
    pillowColor: '#dcd6c8',
    quiltColor: '#3a8aa6',
    wallAccent: '#5cb85c',
  },
} as const;

export function Bedroom({ origin, size, kid }: BedroomProps) {
  const theme = THEMES[kid];
  const isKid = kid !== 'dad';
  const bedW = isKid ? 1.0 : 1.6;
  const bedL = isKid ? 1.9 : 2.0;

  return (
    <group position={origin}>
      {/* Bed */}
      <Bed
        position={[0, 0, -size[1] / 2 + bedL / 2 + 0.2]}
        width={bedW}
        length={bedL}
        bedColor={theme.bedColor}
        quiltColor={theme.quiltColor}
        pillowColor={theme.pillowColor}
      />

      {/* Dresser */}
      <Dresser position={[size[0] / 2 - 0.4, 0, 0]} />

      {/* Themed extras */}
      {kid === 'dad' && <DadExtras position={[-size[0] / 2 + 0.5, 0, size[1] / 2 - 0.3]} />}
      {kid === 'penny' && <PennyExtras position={[-size[0] / 2 + 0.4, 0, size[1] / 2 - 0.4]} />}
      {kid === 'luke' && <LukeExtras position={[-size[0] / 2 + 0.4, 0, size[1] / 2 - 0.4]} />}

      {/* Rug for kids */}
      {isKid && (
        <mesh position={[0, 0.005, 0]} receiveShadow>
          <boxGeometry args={[Math.min(size[0] - 0.5, 1.6), 0.01, Math.min(size[1] - 1.0, 1.4)]} />
          <primitive object={mat.rug()} attach="material" />
        </mesh>
      )}
    </group>
  );
}

function Bed({
  position,
  width,
  length,
  bedColor,
  quiltColor,
  pillowColor,
}: {
  position: [number, number, number];
  width: number;
  length: number;
  bedColor: string;
  quiltColor: string;
  pillowColor: string;
}) {
  return (
    <group position={position}>
      {/* frame */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.36, length]} />
        <meshStandardMaterial color={bedColor} />
      </mesh>
      {/* mattress */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[width - 0.05, 0.18, length - 0.05]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* quilt */}
      <mesh position={[0, 0.54, 0.1]} castShadow>
        <boxGeometry args={[width - 0.04, 0.04, length - 0.5]} />
        <meshStandardMaterial color={quiltColor} roughness={0.95} />
      </mesh>
      {/* pillow */}
      <mesh position={[0, 0.55, -length / 2 + 0.3]} castShadow>
        <boxGeometry args={[width - 0.2, 0.08, 0.35]} />
        <meshStandardMaterial color={pillowColor} />
      </mesh>
      {/* headboard */}
      <mesh position={[0, 0.7, -length / 2 - 0.05]} castShadow>
        <boxGeometry args={[width + 0.1, 1.1, 0.08]} />
        <meshStandardMaterial color={bedColor} />
      </mesh>
    </group>
  );
}

function Dresser({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.9, 0.4]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      {[0.18, 0.5, 0.78].map((y) => (
        <mesh key={y} position={[0, y, 0.21]} castShadow>
          <boxGeometry args={[0.6, 0.22, 0.04]} />
          <meshStandardMaterial color="#7a4a32" />
        </mesh>
      ))}
      {/* lamp on top — emissive replaces removed pointlight */}
      <mesh position={[0.2, 1.1, 0]}>
        <coneGeometry args={[0.12, 0.18, 12, 1, true]} />
        <meshStandardMaterial color="#f5ecd9" emissive="#fff0a8" emissiveIntensity={1.4} side={2} />
      </mesh>
    </group>
  );
}

function DadExtras({ position }: { position: [number, number, number] }) {
  // Desk with monitor + chair
  return (
    <group position={position}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.2, 0.06, 0.5]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      {[
        [-0.5, 0.35, -0.18],
        [0.5, 0.35, -0.18],
        [-0.5, 0.35, 0.18],
        [0.5, 0.35, 0.18],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.05, 0.7, 0.05]} />
          <meshStandardMaterial color="#3a2a1c" />
        </mesh>
      ))}
      {/* monitor */}
      <mesh position={[0, 0.96, -0.15]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.04]} />
        <meshStandardMaterial color="#0a0a0c" />
      </mesh>
      <mesh position={[0, 0.96, -0.13]}>
        <boxGeometry args={[0.66, 0.36, 0.01]} />
        <meshStandardMaterial color="#3a8aa6" emissive="#3a8aa6" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.78, -0.15]} castShadow>
        <cylinderGeometry args={[0.04, 0.07, 0.08, 12]} />
        <meshStandardMaterial color="#0a0a0c" />
      </mesh>
    </group>
  );
}

function PennyExtras({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* desk */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.9, 0.06, 0.5]} />
        <meshStandardMaterial color="#fff0f5" />
      </mesh>
      {[-0.4, 0.4].flatMap((x) => [-0.18, 0.18].map((z) => [x, 0.32, z] as const)).map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.05, 0.65, 0.05]} />
          <meshStandardMaterial color="#e26aa1" />
        </mesh>
      ))}
      {/* laptop */}
      <mesh position={[0, 0.71, 0]} castShadow>
        <boxGeometry args={[0.4, 0.02, 0.28]} />
        <meshStandardMaterial color="#dcd6c8" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.85, -0.15]} rotation={[-Math.PI / 9, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.28, 0.02]} />
        <meshStandardMaterial color="#dcd6c8" />
      </mesh>
      <mesh position={[0, 0.85, -0.135]} rotation={[-Math.PI / 9, 0, 0]}>
        <boxGeometry args={[0.36, 0.24, 0.005]} />
        <meshStandardMaterial color="#3a8aa6" emissive="#3a8aa6" emissiveIntensity={0.4} />
      </mesh>
      {/* soccer ball */}
      <mesh position={[1.0, 0.16, 0.3]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* polaroid wall (behind desk) */}
      {[
        [-0.3, 1.2, -0.24, '#e26aa1'],
        [0, 1.3, -0.24, '#5cb85c'],
        [0.3, 1.2, -0.24, '#e6b94a'],
      ].map(([x, y, z, c], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <boxGeometry args={[0.16, 0.2, 0.005]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
    </group>
  );
}

function LukeExtras({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* toy chest */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.5]} />
        <meshStandardMaterial color="#3a5aa6" />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[0.9, 0.06, 0.5]} />
        <meshStandardMaterial color="#5a7ac6" />
      </mesh>
      {/* legos pile (a few colored boxes) */}
      {[
        [0.6, 0.05, 0.4, '#c8392a'],
        [0.55, 0.05, 0.5, '#3a5aa6'],
        [0.7, 0.05, 0.45, '#e6b94a'],
        [0.5, 0.12, 0.45, '#5cb85c'],
        [0.62, 0.12, 0.55, '#9a3aa6'],
      ].map(([x, y, z, c], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
          <boxGeometry args={[0.1, 0.06, 0.08]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
      {/* dinosaur toy */}
      <mesh position={[1.1, 0.18, 0.2]} castShadow>
        <boxGeometry args={[0.3, 0.18, 0.5]} />
        <meshStandardMaterial color="#3a8a4a" />
      </mesh>
      <mesh position={[1.25, 0.36, -0.05]} castShadow>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#3a8a4a" />
      </mesh>
    </group>
  );
}
