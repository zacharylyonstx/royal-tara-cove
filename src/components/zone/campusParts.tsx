import { useMemo } from 'react';
import * as THREE from 'three';

/** Silver standing-seam metal — the roofs you see on Rutledge from the air. */
export const METAL_ROOF = new THREE.MeshStandardMaterial({ color: '#c3c9cf', roughness: 0.36, metalness: 0.62, side: THREE.DoubleSide });
const SEAM = new THREE.MeshStandardMaterial({ color: '#a9b0b8', roughness: 0.4, metalness: 0.6 });

/**
 * A gable roof as one solid prism (two slopes + the gable ends), sitting on a
 * rectangle `w` across × `len` along the ridge, eaves at height `y`. A few
 * raised seams sell the standing-seam metal. Authored in the parent's local
 * frame; `ridgeAlong` picks which local axis the ridge follows.
 */
export function GableRoof({ w, len, y, rise, ridgeAlong, material = METAL_ROOF }: {
  w: number; len: number; y: number; rise: number; ridgeAlong: 'x' | 'z'; material?: THREE.Material;
}) {
  const geo = useMemo(() => {
    const hx = len / 2, hz = w / 2;
    const A0 = [-hx, 0, -hz], A1 = [hx, 0, -hz], B0 = [-hx, 0, hz], B1 = [hx, 0, hz], C0 = [-hx, rise, 0], C1 = [hx, rise, 0];
    const tris = [
      A0, C0, C1, A0, C1, A1,   // north slope
      B0, B1, C1, B0, C1, C0,   // south slope
      A0, B0, C0,               // gable ends
      A1, C1, B1,
      A0, A1, B1, A0, B1, B0,   // soffit
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals();
    return g;
  }, [w, len, rise]);
  const slope = Math.hypot(w / 2, rise);
  const ang = Math.atan2(rise, w / 2);
  const seams = Math.max(2, Math.floor(len / 2.4));
  return (
    <group position={[0, y, 0]} rotation={[0, ridgeAlong === 'x' ? 0 : Math.PI / 2, 0]}>
      <mesh geometry={geo} material={material} castShadow receiveShadow />
      {Array.from({ length: seams }, (_, i) => {
        const x = -len / 2 + ((i + 0.5) * len) / seams;
        return [-1, 1].map((s) => (
          <mesh key={`${i}${s}`} position={[x, rise / 2 + 0.03, s * (w / 4)]} rotation={[s * ang, 0, 0]} material={SEAM}>
            <boxGeometry args={[0.07, 0.05, slope]} />
          </mesh>
        ));
      })}
      {/* ridge cap */}
      <mesh position={[0, rise + 0.03, 0]} material={SEAM}>
        <boxGeometry args={[len, 0.09, 0.3]} />
      </mesh>
    </group>
  );
}
