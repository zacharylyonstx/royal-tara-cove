import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { activePlayers } from '../../world/munchiesRoster';
import { SIBLING_BOND_DIST } from '../../world/munchiesConfig';

/**
 * Renders a glowing line between Luke and Penny when both are claimed AND
 * within the bond distance. The line brightens with proximity.
 */
export function SiblingBond() {
  const lineRef = useRef<THREE.Line>(null);

  const { lineObj, geom, mat } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0]), 3));
    const mat = new THREE.LineBasicMaterial({ color: '#ffd86a', transparent: true, opacity: 0.5 });
    const lineObj = new THREE.Line(geom, mat);
    lineObj.visible = false;
    return { lineObj, geom, mat };
  }, []);

  useFrame(() => {
    const players = activePlayers();
    if (players.length !== 2) { lineObj.visible = false; return; }
    const gs = useGameStore.getState();
    const a = gs.positions[players[0]];
    const b = gs.positions[players[1]];
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    if (dist > SIBLING_BOND_DIST * 1.5) { lineObj.visible = false; return; }
    lineObj.visible = true;
    const arr = geom.attributes.position.array as Float32Array;
    arr[0] = a.x; arr[1] = 1.0; arr[2] = a.z;
    arr[3] = b.x; arr[4] = 1.0; arr[5] = b.z;
    geom.attributes.position.needsUpdate = true;
    const k = Math.max(0, 1 - dist / SIBLING_BOND_DIST);
    mat.opacity = 0.25 + 0.55 * k;
  });

  return <primitive ref={lineRef} object={lineObj} />;
}
