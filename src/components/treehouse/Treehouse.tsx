import { Text } from '@react-three/drei';
import { liveOakPosition } from '../../world/treehouseMissions';

const FLOOR_Y = 8.0;
const FLOOR_SIZE = 3.2;
const WALL_H = 2.2;
const WALL_T = 0.12;

export function Treehouse() {
  const oak = liveOakPosition();
  return (
    <group position={[oak.x, FLOOR_Y, oak.z]}>
      {/* Floor */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[FLOOR_SIZE, 0.18, FLOOR_SIZE]} />
        <meshStandardMaterial color="#8a5a3a" roughness={0.85} />
      </mesh>

      {/* North (back) wall — solid */}
      <mesh position={[0, WALL_H / 2 + 0.1, FLOOR_SIZE / 2]} castShadow>
        <boxGeometry args={[FLOOR_SIZE, WALL_H, WALL_T]} />
        <meshStandardMaterial color="#9a6b3e" roughness={0.85} />
      </mesh>
      {/* East wall — solid */}
      <mesh position={[FLOOR_SIZE / 2, WALL_H / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[WALL_T, WALL_H, FLOOR_SIZE]} />
        <meshStandardMaterial color="#9a6b3e" roughness={0.85} />
      </mesh>
      {/* West wall — solid */}
      <mesh position={[-FLOOR_SIZE / 2, WALL_H / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[WALL_T, WALL_H, FLOOR_SIZE]} />
        <meshStandardMaterial color="#9a6b3e" roughness={0.85} />
      </mesh>

      {/* South wall with doorway cutout (left + right + lintel) */}
      <mesh position={[-FLOOR_SIZE / 2 + 0.55, WALL_H / 2 + 0.1, -FLOOR_SIZE / 2]} castShadow>
        <boxGeometry args={[1.1, WALL_H, WALL_T]} />
        <meshStandardMaterial color="#9a6b3e" roughness={0.85} />
      </mesh>
      <mesh position={[FLOOR_SIZE / 2 - 0.55, WALL_H / 2 + 0.1, -FLOOR_SIZE / 2]} castShadow>
        <boxGeometry args={[1.1, WALL_H, WALL_T]} />
        <meshStandardMaterial color="#9a6b3e" roughness={0.85} />
      </mesh>
      <mesh position={[0, WALL_H - 0.2 + 0.1, -FLOOR_SIZE / 2]} castShadow>
        <boxGeometry args={[1.0, 0.4, WALL_T]} />
        <meshStandardMaterial color="#9a6b3e" roughness={0.85} />
      </mesh>

      {/* Gabled roof */}
      <group position={[0, WALL_H + 0.1, 0]}>
        <mesh rotation={[0, 0, Math.PI / 6]} position={[-0.7, 0.7, 0]} castShadow>
          <boxGeometry args={[2.2, 0.1, FLOOR_SIZE + 0.4]} />
          <meshStandardMaterial color="#5a3022" roughness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 6]} position={[0.7, 0.7, 0]} castShadow>
          <boxGeometry args={[2.2, 0.1, FLOOR_SIZE + 0.4]} />
          <meshStandardMaterial color="#5a3022" roughness={0.9} />
        </mesh>
      </group>

      {/* Chalkboard on back wall (interior side) */}
      <mesh position={[0, 1.3, FLOOR_SIZE / 2 - WALL_T / 2 - 0.05]} castShadow>
        <boxGeometry args={[1.6, 0.9, 0.04]} />
        <meshStandardMaterial color="#1f3a26" roughness={0.95} />
      </mesh>
      <Text
        position={[0, 1.32, FLOOR_SIZE / 2 - WALL_T / 2 - 0.08]}
        fontSize={0.15}
        color="#fff7e6"
        anchorX="center"
        anchorY="middle"
      >
        {`PENNY\n& LUKE'S\nCLUB`}
      </Text>

      {/* Letter board on east wall (interior side) — clickable */}
      <LetterBoard position={[FLOOR_SIZE / 2 - WALL_T / 2 - 0.05, 1.3, 0]} />
    </group>
  );
}

function LetterBoard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, -Math.PI / 2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.0, 0.7, 0.04]} />
        <meshStandardMaterial color="#a98654" roughness={0.85} />
      </mesh>
      <Text
        position={[0, 0.32, 0.03]}
        fontSize={0.08}
        color="#3a2010"
        anchorX="center"
        anchorY="middle"
      >
        📬 LETTERS
      </Text>
      {/* Click target — small opacity so pointer events fire */}
      <mesh
        position={[0, 0, 0.025]}
        onClick={(e) => {
          e.stopPropagation();
          import('../../state/gameStore').then((m) => m.useGameStore.getState().setPhase('treehouse-letter-open'));
        }}
      >
        <boxGeometry args={[1.0, 0.7, 0.01]} />
        <meshStandardMaterial color="#a98654" transparent opacity={0.01} />
      </mesh>
    </group>
  );
}
