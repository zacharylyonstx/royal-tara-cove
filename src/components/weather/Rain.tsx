import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { useTornadoStore } from '../../state/tornadoStore';

// Rain rendered as ~2500 short vertical line segments that follow the active
// player around (recycled to top of spawn box when they fall below ground).
// Opacity scales with stormIntensity. Only mounted in tornado-mode storm phases.

const COUNT = 2500;
const SPAWN_HALF = 40;
const SPAWN_HEIGHT_TOP = 32;
const SPAWN_HEIGHT_BOTTOM = 0;
const FALL_SPEED = 28;          // m/s
const DROP_LEN = 0.55;          // visible streak length in metres

export function Rain() {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const activeId = myCharacterId ?? fallbackActive;
  const positions = useGameStore((s) => s.positions);

  const { positionsAttr, dropArray } = useMemo(() => {
    // Each drop is two vertices (top, bottom). dropArray holds [x, y, z] for
    // the TOP vertex; the bottom is derived = top - (0, DROP_LEN, 0).
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 2 * SPAWN_HALF;
      arr[i * 3 + 1] = Math.random() * SPAWN_HEIGHT_TOP;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2 * SPAWN_HALF;
    }
    const positionsBuf = new Float32Array(COUNT * 6); // 2 verts per drop
    for (let i = 0; i < COUNT; i++) {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      const z = arr[i * 3 + 2];
      positionsBuf[i * 6] = x;
      positionsBuf[i * 6 + 1] = y;
      positionsBuf[i * 6 + 2] = z;
      positionsBuf[i * 6 + 3] = x;
      positionsBuf[i * 6 + 4] = y - DROP_LEN;
      positionsBuf[i * 6 + 5] = z;
    }
    return {
      positionsAttr: new THREE.BufferAttribute(positionsBuf, 3),
      dropArray: arr,
    };
  }, []);

  useFrame((_state, dtRaw) => {
    const geom = geomRef.current;
    const mat = matRef.current;
    if (!geom || !mat) return;
    const intensity = useTornadoStore.getState().stormIntensity;
    if (intensity < 0.02) {
      mat.opacity = 0;
      return;
    }
    mat.opacity = Math.min(0.5, 0.05 + intensity * 0.5);
    const wind = useTornadoStore.getState().windStrength;
    const dt = Math.min(dtRaw, 0.05);
    const dy = FALL_SPEED * dt;
    const dx = wind * 6 * dt;
    const player = positions[activeId];
    const px = player?.x ?? 0;
    const pz = player?.z ?? 0;

    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const buf = pos.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      let y = dropArray[i * 3 + 1];
      let x = dropArray[i * 3];
      let z = dropArray[i * 3 + 2];
      y -= dy;
      x += dx;
      // Keep drops centred on the player
      const rx = x - px;
      const rz = z - pz;
      if (y < SPAWN_HEIGHT_BOTTOM || rx < -SPAWN_HALF || rx > SPAWN_HALF || rz < -SPAWN_HALF || rz > SPAWN_HALF) {
        x = px + (Math.random() - 0.5) * 2 * SPAWN_HALF;
        z = pz + (Math.random() - 0.5) * 2 * SPAWN_HALF;
        y = SPAWN_HEIGHT_TOP * (0.6 + Math.random() * 0.4);
      }
      dropArray[i * 3] = x;
      dropArray[i * 3 + 1] = y;
      dropArray[i * 3 + 2] = z;
      const vi = i * 6;
      buf[vi] = x;
      buf[vi + 1] = y;
      buf[vi + 2] = z;
      buf[vi + 3] = x;
      buf[vi + 4] = y - DROP_LEN;
      buf[vi + 5] = z;
    }
    pos.needsUpdate = true;
  });

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry ref={geomRef}>
        <primitive object={positionsAttr} attach="attributes-position" />
      </bufferGeometry>
      <lineBasicMaterial ref={matRef} color="#b8d0e8" transparent opacity={0} depthWrite={false} />
    </lineSegments>
  );
}
