import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { GYM, X, Z } from '../../world/colonySchool';
import { drawSchoolInterior, type SchoolLabel } from '../../world/colonySchoolRooms';
import { useSkyStore } from '../../state/skyStore';
import { usePlayStore } from '../../state/playStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { BasketballHoop } from '../props/BasketballHoop';
import { Basketball } from '../props/Basketball';
import { Batch, glowPaint } from './batch';

// Inside Colony Oaks Elementary (the plan and what it is drawn from:
// world/colonySchool.ts). The shell is part of Colony.tsx and always there;
// this is everything behind the doors — built the first time you come near,
// shown only while you are close, in three draw calls.

const CX = X(64), CZ = Z(41);
const BUILD_AT = 260, SHOW_AT = 185, SIGNS_AT = 115;
const HOOP_V = (GYM.v0 + GYM.v1) / 2;
/** The gym's two baskets: [x, z, turn] — one at each end, facing the middle. */
const HOOPS: [number, number, number][] = [[X(GYM.u0 + 1.0), Z(HOOP_V), Math.PI / 2], [X(GYM.u1 - 1.0), Z(HOOP_V), -Math.PI / 2]];

export function ColonySchool() {
  const [built, setBuilt] = useState(false);
  const [signs, setSigns] = useState(false);
  const group = useRef<THREE.Group>(null);
  const state = useRef({ built: false, signs: false });

  const made = useMemo(() => {
    if (!built) return null;
    const b = new Batch();
    const labels: SchoolLabel[] = [];
    drawSchoolInterior(b, () => undefined, labels);
    return { geo: b.build(), labels };
  }, [built]);
  const mats = useMemo(() => ({
    in: glowPaint(0.86),
    lamp: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    pane: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0.4, depthWrite: false }),
  }), []);

  useFrame(({ camera }) => {
    const d = Math.hypot(camera.position.x - CX, camera.position.z - CZ);
    if (!state.current.built && d < BUILD_AT) { state.current.built = true; setBuilt(true); }
    const near = d < SIGNS_AT;
    if (near !== state.current.signs) { state.current.signs = near; setSigns(near); }
    if (group.current) group.current.visible = d < SHOW_AT;
    // Indoor light: the rooms carry their own glow, a little by day (the roof
    // shades them) and more once it is dark outside.
    const sky = useSkyStore.getState();
    const on = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    mats.in.emissiveIntensity = 0.3 + 0.42 * on;
  });

  // The gym's baskets are real ones: pick up a ball and shoot.
  useEffect(() => {
    HOOPS.forEach(([x, z, turn], i) => usePlayStore.getState().registerHoop(`colony-gym-${i}`, { x: x + Math.sin(turn) * 0.65, z: z + Math.cos(turn) * 0.65, rimY: 2.85, rimR: 0.42 }));
  }, []);

  if (!made) return null;
  const g = made.geo;
  return (
    <>
      <group ref={group} visible={false}>
        {g.in && <mesh geometry={g.in} material={mats.in} receiveShadow />}
        {g.lamp && <mesh geometry={g.lamp} material={mats.lamp} />}
        {g.pane && <mesh geometry={g.pane} material={mats.pane} renderOrder={4} />}
        {HOOPS.map(([x, z, turn], i) => <BasketballHoop key={i} position={[x, 0.05, z]} rotation={turn} />)}
        {signs && made.labels.map((l, i) => (
          <Text key={i} position={[l.x, l.y, l.z]} rotation={[0, l.ry, 0]} fontSize={l.size} color={l.color} anchorX="center" anchorY="middle" maxWidth={l.width} textAlign="center" letterSpacing={0.03}>
            {l.text}
          </Text>
        ))}
      </group>
      {[0, 1, 2, 3].map((i) => <Basketball key={i} id={`colony-gym-ball-${i}`} position={[X(GYM.u0 + 6 + i * 6.2), 0, Z(GYM.v1 - 3 - (i % 2) * 1.4)]} />)}
    </>
  );
}
