import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNightStore } from '../../state/nightStore';
import { useGameStore } from '../../state/gameStore';
import { isTouchDevice } from '../../systems/touchInput';

// The glowing lanterns the family gathers to "light the block." Pure render
// consumers of nightStore.lanterns: the host owns each lantern's state/position
// (idle on the ground, carried beside a player, or delivered at base) and we
// just follow + glow. Warm light to contrast Siren Head's cold red.

const TOUCH = isTouchDevice();

const BODY = new THREE.MeshStandardMaterial({ color: '#caa14a', roughness: 0.5, metalness: 0.4, flatShading: true });

function LanternMesh({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null);
  const glowMat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const sx = useRef(0);
  const sz = useRef(0);
  const init = useRef(false);

  useFrame((state, dtRaw) => {
    const grp = group.current;
    if (!grp) return;
    const dt = Math.min(dtRaw, 0.1);
    const ns = useNightStore.getState();
    const l = ns.lanterns.find((x) => x.id === id);
    if (!l) { grp.visible = false; return; }
    grp.visible = true;

    // target position
    let tx = l.x, tz = l.z, ty = 0.55;
    if (l.state === 'carried' && l.carrier) {
      const p = useGameStore.getState().positions[l.carrier];
      if (p) { tx = p.x; tz = p.z; ty = 1.55; }
    } else if (l.state === 'delivered') {
      ty = 0.7;
    }
    if (!init.current) { sx.current = tx; sz.current = tz; init.current = true; }
    const k = 1 - Math.exp(-16 * dt);
    sx.current += (tx - sx.current) * k;
    sz.current += (tz - sz.current) * k;
    grp.position.x = sx.current;
    grp.position.z = sz.current;
    // gentle float bob
    grp.position.y = ty + Math.sin(state.clock.elapsedTime * 2 + sx.current) * 0.08;
    grp.rotation.y = state.clock.elapsedTime * 0.6;

    // delivered + carried lanterns shine brighter
    const target = l.state === 'idle' ? 1.6 : 2.6;
    if (glowMat.current) glowMat.current.emissiveIntensity += (target - glowMat.current.emissiveIntensity) * k;
    if (light.current) light.current.intensity += (target * 1.6 - light.current.intensity) * k;
  });

  return (
    <group ref={group}>
      {/* lantern cage */}
      <mesh material={BODY} position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.42, 6]} />
      </mesh>
      <mesh material={BODY} position={[0, 0.43, 0]}>
        <coneGeometry args={[0.2, 0.16, 6]} />
      </mesh>
      {/* glowing core */}
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial ref={glowMat} color="#ffe08a" emissive="#ffc24a" emissiveIntensity={1.6} roughness={0.4} />
      </mesh>
      {!TOUCH && <pointLight ref={light} color="#ffcf6a" intensity={2.6} distance={7} decay={1.7} />}
    </group>
  );
}

export function Lanterns() {
  // Subscribe only to the lantern ids (stable unless the set changes) so the
  // parent doesn't re-render every frame; each child follows its own state.
  const ids = useNightStore((s) => s.lanterns.map((l) => l.id).join(','));
  return (
    <>
      {ids.split(',').filter(Boolean).map((id) => (
        <LanternMesh key={id} id={id} />
      ))}
    </>
  );
}
