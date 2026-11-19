// DEV ONLY (not part of the build): every NPC side by side, to judge the look.
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NPCS } from '../world/npcs';
import { AnimeNpcModel } from '../components/npc/AnimeNpcModel';

const q = new URLSearchParams(location.search);
const from = Number(q.get('from') ?? 0), n = Number(q.get('n') ?? 11), yaw = Number(q.get('yaw') ?? 0);
const list = NPCS.slice(from, from + n);
createRoot(document.getElementById('root')!).render(
  <Canvas camera={{ position: [0, 1.25, 1.6 + list.length * 0.55], fov: 30 }} dpr={2}>
    <hemisphereLight args={['#ffffff', '#b9c6a8', 1.5]} />
    <directionalLight position={[3, 6, 5]} intensity={1.6} />
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[30, 40]} /><meshStandardMaterial color="#9fd07a" /></mesh>
    {list.map((d, i) => (
      <group key={d.id} position={[(i - (list.length - 1) / 2) * 0.95, 0, 0]} rotation={[0, yaw, 0]}>
        <AnimeNpcModel id={d.id} look={d.look} />
      </group>
    ))}
    <OrbitControls target={[0, 0.85, 0]} />
  </Canvas>,
);
