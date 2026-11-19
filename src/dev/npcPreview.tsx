// DEV ONLY (not part of the build): NPCs side by side, to judge the look.
// ?from=0&n=8  which NPCs   ?yaw=0.6  turn them   ?walk=1  swing the limbs   ?old=1  the chibi version
import { Suspense, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import { NPCS, type NpcDef } from '../world/npcs';
import { AnimeNpcModel } from '../components/npc/AnimeNpcModel';
import { AvatarNpcModel } from '../components/npc/AvatarNpcModel';

const q = new URLSearchParams(location.search);
const from = Number(q.get('from') ?? 0), n = Number(q.get('n') ?? 8), yaw = Number(q.get('yaw') ?? 0);
const walk = q.get('walk'), old = q.has('old');
const list = NPCS.slice(from, from + n);

function One({ d, i }: { d: NpcDef; i: number }) {
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null), leftArm = useRef<Group>(null), rightArm = useRef<Group>(null), torso = useRef<Group>(null);
  const rig = useMemo(() => ({ leftLeg, rightLeg, leftArm, rightArm, torso }), []);
  useFrame(({ clock }) => {
    const t = walk === 'freeze' ? 0.55 + i : clock.elapsedTime * 6 + i;
    const s = walk ? Math.sin(t) * 0.6 : 0;
    const sit = walk === 'sit' ? -1.45 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = (sit ? 0 : s) + sit;
    if (rightLeg.current) rightLeg.current.rotation.x = (sit ? 0 : -s) + sit;
    if (leftArm.current) leftArm.current.rotation.x = -s * 0.9;
    if (rightArm.current) { rightArm.current.rotation.x = walk === 'wave' ? -2.7 : s * 0.9; rightArm.current.rotation.z = walk === 'wave' ? 0.3 : 0; }
  });
  return (
    <group position={[(i - (list.length - 1) / 2) * 0.8, 0, 0]} rotation={[0, yaw, 0]}>
      {old ? <AnimeNpcModel id={d.id} look={d.look} rig={rig} /> : <AvatarNpcModel look={d.look} rig={rig} />}
    </group>
  );
}
createRoot(document.getElementById('root')!).render(
  <Canvas camera={{ position: [0, 1.2, 1.5 + list.length * 0.5], fov: 30 }} dpr={2}>
    <hemisphereLight args={['#ffffff', '#b9c6a8', 1.7]} />
    <directionalLight position={[3, 6, 5]} intensity={1.5} />
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[30, 40]} /><meshStandardMaterial color="#9fd07a" /></mesh>
    <Suspense fallback={null}>{list.map((d, i) => <One key={d.id} d={d} i={i} />)}</Suspense>
    <OrbitControls target={[0, 0.85, 0]} />
  </Canvas>,
);
