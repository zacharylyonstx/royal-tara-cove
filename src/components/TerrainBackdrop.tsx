import { useMemo } from 'react';
import * as THREE from 'three';
import { GROUND_CX, GROUND_CZ, GROUND_R, terrainHeight } from '../world/terrain';

// The land beyond the playable map, shaped from real elevation data
// (world/terrain.ts): the ridge rising to the south, the long fall north to
// Brushy Creek Lake. Purely visual — nobody walks out here.

const OUTER_R = 700;
const SEG = 120;
const RINGS = 16;

export function TerrainBackdrop() {
  const geo = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const near = new THREE.Color('#5d9a4a');
    const dry = new THREE.Color('#9fae6a');
    const far = new THREE.Color('#a9bfae');
    const c = new THREE.Color();
    for (let j = 0; j <= RINGS; j++) {
      const t = j / RINGS;
      const r = GROUND_R + (OUTER_R - GROUND_R) * t * t; // tighter rings near the map
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const x = GROUND_CX + Math.cos(a) * r, z = GROUND_CZ + Math.sin(a) * r;
        const h = terrainHeight(x, z);
        pos.push(x, h, z);
        // Greener low ground, sun-dried hilltops, hazing out with distance.
        c.copy(near).lerp(dry, Math.max(0, Math.min(1, h / 16))).lerp(far, Math.min(1, t * 1.15));
        col.push(c.r, c.g, c.b);
      }
    }
    const w = SEG + 1;
    for (let j = 0; j < RINGS; j++) {
      for (let i = 0; i < SEG; i++) {
        const a = j * w + i, b = a + 1, d = a + w, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* Brushy Creek Lake, down in the low ground to the north. */}
      <mesh position={[GROUND_CX + 60, -19.5, GROUND_CZ - 470]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[900, 420]} />
        <meshStandardMaterial color="#5f97b8" roughness={0.12} metalness={0.35} />
      </mesh>
    </group>
  );
}
