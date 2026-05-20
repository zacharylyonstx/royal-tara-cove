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
    </group>
  );
}
