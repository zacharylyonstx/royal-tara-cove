import { Html } from '@react-three/drei';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { liveOakPosition } from '../../world/treehouseMissions';

const LADDER_X_OFFSET = 0;
const LADDER_Z_OFFSET = -1.55;
const LADDER_HEIGHT = 4.0;
const PROMPT_RADIUS = 2.5;

export function Ladder() {
  const oak = liveOakPosition();
  return (
    <group position={[oak.x + LADDER_X_OFFSET, 0, oak.z + LADDER_Z_OFFSET]}>
      {/* Two vertical rails */}
      <mesh position={[-0.25, LADDER_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.06, LADDER_HEIGHT, 0.06]} />
        <meshStandardMaterial color="#7a4a26" roughness={0.85} />
      </mesh>
      <mesh position={[0.25, LADDER_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.06, LADDER_HEIGHT, 0.06]} />
        <meshStandardMaterial color="#7a4a26" roughness={0.85} />
      </mesh>
      {Array.from({ length: Math.floor(LADDER_HEIGHT / 0.4) }).map((_, i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.4, 0]} castShadow>
          <boxGeometry args={[0.56, 0.05, 0.05]} />
          <meshStandardMaterial color="#8a5a32" roughness={0.85} />
        </mesh>
      ))}
      <ClimbPrompt />
    </group>
  );
}

function ClimbPrompt() {
  const oak = liveOakPosition();
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const id = myCharacterId ?? fallbackActive;
  const pos = useGameStore((s) => s.positions[id]);
  const dist = Math.hypot(pos.x - oak.x, pos.z - oak.z);
  if (dist > PROMPT_RADIUS) return null;
  const direction = pos.y < 0.5 ? 'Climb up' : 'Climb down';
  return (
    <Html
      position={[0, 1.6, 0]}
      center
      distanceFactor={10}
      style={{
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 13,
        fontWeight: 700,
        color: '#fff7e6',
        background: 'rgba(20,16,30,0.78)',
        padding: '4px 10px',
        borderRadius: 8,
        whiteSpace: 'nowrap',
        border: '1px solid rgba(255,255,255,0.18)',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      <kbd style={{ background: '#fff7e6', color: '#2a1f4a', padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>E</kbd>
      {direction}
    </Html>
  );
}
