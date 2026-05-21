import { Html } from '@react-three/drei';
import { useTreehouseStore } from '../../state/treehouseStore';
import { liveOakPosition } from '../../world/treehouseMissions';

const FLOOR_Y = 4.0;
const FLOOR_SIZE = 3.2;

export function SouvenirShelf() {
  const souvenirs = useTreehouseStore((s) => s.souvenirs);
  const oak = liveOakPosition();
  const list = Object.values(souvenirs).sort((a, b) => a.earnedAt - b.earnedAt);
  return (
    <group position={[oak.x, FLOOR_Y + 0.4, oak.z + FLOOR_SIZE / 2 - 0.2]}>
      <mesh castShadow>
        <boxGeometry args={[2.4, 0.06, 0.18]} />
        <meshStandardMaterial color="#7a4828" roughness={0.85} />
      </mesh>
      {list.slice(0, 12).map((s, i) => (
        <Html
          key={s.id}
          position={[-1.05 + (i % 6) * 0.42, 0.18 + Math.floor(i / 6) * 0.22, 0.04]}
          center
          distanceFactor={6}
          style={{ pointerEvents: 'none', fontSize: 22 }}
        >
          <span title={s.label}>{s.emoji}</span>
        </Html>
      ))}
    </group>
  );
}
