import { Html } from '@react-three/drei';
import { MAZE_BLOCKS, WALKER_HOME } from '../../world/munchiesMap';
import { HERO_PIVOT_X, HERO_PIVOT_Z, HERO_YAW } from '../../world/heroPlace';
import { useMunchiesStore } from '../../state/munchiesStore';

// The sleepwalkers' beds. For Midnight Munchies the family is camping out in
// the den (the maze's "ghost house") — the bed rects come from MAZE_BLOCKS so
// what you see is exactly what you bump into.

export function BedsLive() {
  const roster = useMunchiesStore((s) => s.activeRoster);
  const kid = roster.includes('penny') ? 'penny' : roster.includes('luke') ? 'luke' : null;
  return (
    <>
      <group position={[HERO_PIVOT_X, 0, HERO_PIVOT_Z]} rotation={[0, HERO_YAW, 0]}>
        <Bed blockId="bed-dad" sheetColor="#3a5a8a" label={"👨 Dad's bed"} />
        <Bed
          blockId="bed-penny"
          sheetColor={kid === 'luke' ? '#4f9a5c' : '#e26aa1'}
          label={kid === 'penny' ? "👧 Penny's bed" : kid === 'luke' ? "👦 Luke's bed" : '🛏️ comfy bed'}
        />
      </group>
      <DogBed />
    </>
  );
}

function Bed({ blockId, sheetColor, label }: { blockId: string; sheetColor: string; label: string }) {
  const b = MAZE_BLOCKS.find((m) => m.id === blockId);
  if (!b) return null;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  return (
    <group position={[(b.minX + b.maxX) / 2, 0.33, (b.minZ + b.maxZ) / 2]}>
      {/* frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, 0.4, d]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.85} />
      </mesh>
      {/* sheet */}
      <mesh position={[0, 0.22, 0.1]} castShadow>
        <boxGeometry args={[w - 0.15, 0.06, d - 0.4]} />
        <meshStandardMaterial color={sheetColor} roughness={0.8} />
      </mesh>
      {/* pillow */}
      <mesh position={[0, 0.3, -d / 2 + 0.3]} castShadow>
        <boxGeometry args={[w * 0.62, 0.1, 0.4]} />
        <meshStandardMaterial color="#fff7e6" roughness={0.8} />
      </mesh>
      <Html
        position={[0, 0.9, 0]}
        center
        distanceFactor={10}
        style={{
          pointerEvents: 'none',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: '#fff7e6',
          background: 'rgba(20,16,30,0.7)',
          padding: '2px 6px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.18)',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        {label}
      </Html>
    </group>
  );
}

function DogBed() {
  const node = WALKER_HOME.dog;
  return (
    <group position={[node.x, 0.2, node.z]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.15, 16]} />
        <meshStandardMaterial color="#a04848" roughness={0.9} />
      </mesh>
      <Html
        position={[0, 0.5, 0]}
        center
        distanceFactor={10}
        style={{
          pointerEvents: 'none',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: '#fff7e6',
          background: 'rgba(20,16,30,0.7)',
          padding: '2px 6px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.18)',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        🐕 dog bed
      </Html>
    </group>
  );
}
