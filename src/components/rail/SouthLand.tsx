import { useMemo } from 'react';
import * as THREE from 'three';
import { SOUTH_X0, SOUTH_X1, SOUTH_Z0, SOUTH_Z1, SOUTH_BED_HALF, SOUTH_SHOULDER, southHeight } from '../../world/terrain';
import { RAIL_MID_X } from '../../world/westAvery';

// The ground the Red Line runs across on its way to the Domain: a finer mesh
// than the horizon backdrop, dead level under the tracks, with the limestone
// cut, the quarry pit, the SH-45 cut and Walnut Creek shaped into it.
// Height comes from world/terrain.ts southHeight() — purely visual (everything
// you can walk on down here is at y = 0).

const DZ = 6;

export function SouthLand() {
  const geo = useMemo(() => {
    // Columns: tight around the railway formation, widening toward the haze.
    const xs: number[] = [];
    for (const d of [SOUTH_BED_HALF, 11, SOUTH_SHOULDER, 20, 28, 38, 50, 64, 80, 98, 118, 140, 165, 195, 230, 270, 315, 365, 420, 480, 540]) {
      for (const x of [RAIL_MID_X - d, RAIL_MID_X + d]) if (x > SOUTH_X0 && x < SOUTH_X1) xs.push(x);
    }
    xs.push(SOUTH_X0, SOUTH_X1);
    xs.sort((a, b) => a - b);
    const zs: number[] = [];
    for (let z = SOUTH_Z0; z <= SOUTH_Z1 + 0.01; z += DZ) zs.push(z);

    const pos: number[] = [];
    const col: number[] = [];
    const grass = new THREE.Color('#5d9a4a');
    const dry = new THREE.Color('#9aa85f');
    const rock = new THREE.Color('#d9d0b8');
    const rockDark = new THREE.Color('#b9ad90');
    const haze = new THREE.Color('#a9bfae');
    const c = new THREE.Color();
    const H = (x: number, z: number) => southHeight(x, z);
    // Non-indexed so each triangle can take its own (slope-based) colour.
    const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
      const ay = H(ax, az), by = H(bx, bz), cy = H(cx, cz);
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      const span = Math.max(ay, by, cy) - Math.min(ay, by, cy);
      const run = Math.min(Math.abs(bx - ax) + Math.abs(cx - ax), Math.abs(bz - az) + Math.abs(cz - az)) || 1;
      const steep = Math.min(1, Math.max(0, span / run - 0.35) * 2.2);
      const mid = (ay + by + cy) / 3;
      const far = Math.min(1, Math.max(0, (Math.abs((ax + bx + cx) / 3 - RAIL_MID_X) - 200) / 300));
      c.copy(grass).lerp(dry, Math.max(0, Math.min(1, mid / 9)));
      // Cut faces and the quarry are bare limestone, banded light and dark.
      if (steep > 0) c.lerp(Math.floor(mid * 0.9) % 2 === 0 ? rock : rockDark, steep);
      if (mid < -5) c.lerp(rock, 0.85);
      c.lerp(haze, far * 0.8);
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    };
    for (let j = 0; j < zs.length - 1; j++) {
      for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
        tri(x0, z0, x0, z1, x1, z0);
        tri(x1, z0, x0, z1, x1, z1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    // A hair below the play disc where the two overlap, so the disc wins.
    <mesh geometry={geo} position={[0, -0.04, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} flatShading />
    </mesh>
  );
}
