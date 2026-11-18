import { useMemo } from 'react';
import * as THREE from 'three';
import { SOUTH_X0, SOUTH_X1, SOUTH_Z0, SOUTH_Z1, WIDE_Z0, WIDE_X0, WIDE_X1, SOUTH_BED_HALF, SOUTH_SHOULDER, southHeight, landKind, type LandKind } from '../../world/terrain';
import { RAIL_MID_X } from '../../world/westAvery';

// The ground the Red Line runs across on its way to the Domain, Downtown and
// Bastrop: a finer mesh than the horizon backdrop, dead level under the tracks,
// with the limestone cut, the quarry pit, the SH-45 cut, Walnut Creek, Lady
// Bird Lake and the Colorado River shaped into it.
// Height comes from world/terrain.ts southHeight() — purely visual (everything
// you can walk on down here is at y = 0). Drawn a stretch at a time so the
// stretches out of sight cost nothing.

/** [z0, z1, row spacing, wide?] — the first is the original Avery → Domain land. */
const CHUNKS: [number, number, number, boolean][] = [
  [SOUTH_Z0, 1040, 6, false],
  [1040, 1500, 6, false],
  [1500, 1960, 6, false],
  [1960, WIDE_Z0, 8, false],
  [WIDE_Z0, 2890, 8, true],
  [2890, 3340, 10, true],
  [3340, SOUTH_Z1, 20, true],
];
const TINT: Record<LandKind, [string, string]> = {
  hill: ['#5d9a4a', '#9aa85f'],
  city: ['#8f9684', '#a3a391'],
  prairie: ['#86a352', '#b3ad66'],
  pines: ['#5a8a46', '#8f8a56'],
  lawn: ['#63a04c', '#84a858'],
};

function buildLand(z0c: number, z1c: number, dz: number, wide: boolean): THREE.BufferGeometry {
  {
    const X0 = wide ? WIDE_X0 : SOUTH_X0, X1 = wide ? WIDE_X1 : SOUTH_X1;
    // Columns: tight around the railway formation, widening toward the haze.
    const ds = [SOUTH_BED_HALF, 11, SOUTH_SHOULDER, 20, 28, 38, 50, 64, 80, 98, 118, 140, 165, 195, 230, 270, 315, 365, 420, 480, 540];
    if (wide) { ds.length = 14; for (let d = 222; d < 920; d += 27) ds.push(d); }
    const xs: number[] = [];
    for (const d of ds) {
      for (const x of [RAIL_MID_X - d, RAIL_MID_X + d]) if (x > X0 && x < X1) xs.push(x);
    }
    xs.push(X0, X1);
    xs.sort((a, b) => a - b);
    const zs: number[] = [];
    for (let z = z0c; z < z1c - 0.01; z += dz) zs.push(z);
    zs.push(z1c);

    const pos: number[] = [];
    const col: number[] = [];
    const grass = new THREE.Color();
    const dry = new THREE.Color();
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
      const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
      // (Where you can walk about at Bastrop the haze tint starts further out.)
      const far = Math.min(1, Math.max(0, (Math.abs(mx - RAIL_MID_X) - (wide ? 520 : 200)) / 300));
      const tint = TINT[landKind(mx, mz)];
      grass.set(tint[0]); dry.set(tint[1]);
      // A little patchiness so big flat areas aren't one flat colour.
      const patch = 0.5 + 0.5 * Math.sin(mx * 0.045 + mz * 0.031) * Math.cos(mx * 0.017 - mz * 0.052);
      c.copy(grass).lerp(dry, Math.max(0, Math.min(1, mid / 9 + (z0c >= 716 ? patch * 0.35 : 0))));
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
    g.computeBoundingSphere();
    return g;
  }
}

export function SouthLand() {
  const geos = useMemo(() => CHUNKS.map(([z0, z1, dz, wide]) => buildLand(z0, z1, dz, wide)), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), []);
  return (
    // A hair below the play disc where the two overlap, so the disc wins.
    <group position={[0, -0.04, 0]}>
      {geos.map((g, i) => <mesh key={i} geometry={g} material={mat} receiveShadow />)}
    </group>
  );
}
