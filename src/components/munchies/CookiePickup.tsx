import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';

// All cookie pellets render as two InstancedMeshes (cookie bodies + chocolate
// chips) driven by a SINGLE useFrame, instead of ~240 individual <group>s each
// with 4 meshes and their own per-frame callback. This collapses the largest
// draw-call + per-frame-callback concentration in the game (~1000 draw calls +
// ~240 callbacks) down to 2 draw calls + 1 callback — the biggest perf win for
// kid-class hardware (iPad/laptop). Same pattern used by Hail/VortexParticles.

const MAX_PELLETS = 512;
const CHIPS_PER = 3;
const CHIP_BASE_R = 0.02;
// Chip offsets/sizes copied verbatim from the old per-cookie geometry so the
// instanced look matches the hand-placed version exactly.
const CHIP_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0.05, 0.026, 0.03],
  [-0.04, 0.026, 0.05],
  [0.02, 0.026, -0.05],
];
const CHIP_RADII = [0.022, 0.02, 0.018];

// Module-scoped scratch objects — reused every frame, zero per-frame allocation.
const dummy = new THREE.Object3D();
const chipDummy = new THREE.Object3D();

export function CookiePickupsLive() {
  const cookieRef = useRef<THREE.InstancedMesh>(null);
  const chipRef = useRef<THREE.InstancedMesh>(null);

  // Start hidden so the first paint (before useFrame writes matrices) doesn't
  // flash a stack of cookies at the origin.
  useLayoutEffect(() => {
    if (cookieRef.current) cookieRef.current.count = 0;
    if (chipRef.current) chipRef.current.count = 0;
  }, []);

  useFrame((state) => {
    const cookie = cookieRef.current;
    const chips = chipRef.current;
    if (!cookie || !chips) return;
    const t = state.clock.elapsedTime;
    const pellets = useMunchiesStore.getState().pellets;

    let i = 0;
    for (const id in pellets) {
      if (i >= MAX_PELLETS) break;
      const p = pellets[id];
      const bobY = 0.25 + Math.sin(t * 2 + p.x * 0.7 + p.z * 0.3) * 0.04;
      const spin = t * 0.6;
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);

      // Cookie body
      dummy.position.set(p.x, bobY, p.z);
      dummy.rotation.set(0, spin, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      cookie.setMatrixAt(i, dummy.matrix);

      // Three chips, rotated with the cookie's spin about Y
      for (let c = 0; c < CHIPS_PER; c++) {
        const off = CHIP_OFFSETS[c];
        const lx = off[0] * cos - off[2] * sin;
        const lz = off[0] * sin + off[2] * cos;
        chipDummy.position.set(p.x + lx, bobY + off[1], p.z + lz);
        chipDummy.scale.setScalar(CHIP_RADII[c] / CHIP_BASE_R);
        chipDummy.updateMatrix();
        chips.setMatrixAt(i * CHIPS_PER + c, chipDummy.matrix);
      }
      i++;
    }

    cookie.count = i;
    chips.count = i * CHIPS_PER;
    cookie.instanceMatrix.needsUpdate = true;
    chips.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={cookieRef}
        args={[undefined, undefined, MAX_PELLETS]}
        castShadow
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.12, 0.12, 0.05, 16]} />
        <meshStandardMaterial color="#a86a3a" emissive="#5a2e10" emissiveIntensity={0.6} roughness={0.7} />
      </instancedMesh>
      <instancedMesh
        ref={chipRef}
        args={[undefined, undefined, MAX_PELLETS * CHIPS_PER]}
        frustumCulled={false}
      >
        <sphereGeometry args={[CHIP_BASE_R, 6, 6]} />
        <meshStandardMaterial color="#2a1a0a" />
      </instancedMesh>
    </>
  );
}
