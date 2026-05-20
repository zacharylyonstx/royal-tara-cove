import { Html } from '@react-three/drei';
import { SLEEPWALKER_BEDS, getNode } from '../../world/munchiesGraph';
import type { SleepwalkerId } from '../../state/munchiesStore';

export function BedsLive() {
  return (
    <>
      <Bed who="dad" />
      <Bed who="penny" />
      <DogBed />
    </>
  );
}

function Bed({ who }: { who: SleepwalkerId }) {
  const node = getNode(SLEEPWALKER_BEDS[who]);
  const sheetColor = who === 'dad' ? '#3a5a8a' : '#e26aa1';
  const label = who === 'dad' ? "👨 Dad's bed" : "👧 Penny's bed";
  return (
    <group position={[node.x, 0.2, node.z]}>
      {/* frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.4, 2.2]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.85} />
      </mesh>
      {/* sheet */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[1.45, 0.05, 2.0]} />
        <meshStandardMaterial color={sheetColor} roughness={0.8} />
      </mesh>
      {/* pillow */}
      <mesh position={[0, 0.28, -0.8]} castShadow>
        <boxGeometry args={[1.0, 0.08, 0.4]} />
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
  const node = getNode(SLEEPWALKER_BEDS.dog);
  return (
    <group position={[node.x, 0.05, node.z]}>
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
