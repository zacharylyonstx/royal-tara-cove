import * as THREE from 'three';

// Vortex math — the velocity field that drives every particle in the
// tornado. Mirrors how real tornadoes move air: solid-body rotation in
// the core, 1/r falloff outside, plus radial suction and updraft.
//
// Also exports the funnel profile (radius as a function of height) so
// particles know where the "skin" of the funnel lives.

export const FUNNEL_HEIGHT = 26;
export const FUNNEL_TOP_Y = FUNNEL_HEIGHT;

// Tornado profile — radius at height y (in meters).
// Real tornadoes: narrow rope at base, quick widening to a bell,
// flaring at the top where they meet the wall cloud.
export function funnelRadiusAt(y: number): number {
  if (y <= 0) return 0.6;
  if (y >= FUNNEL_HEIGHT) return 8.5;
  // Smooth non-linear taper: narrow neck for the first 4m, then bell
  // shape, then flare into the wall cloud at the top.
  if (y < 4) {
    return 0.6 + (y / 4) * 0.4;            // 0.6 → 1.0 (tight rope)
  } else if (y < 18) {
    const t = (y - 4) / 14;
    const e = t * t * (3 - 2 * t);          // smoothstep
    return 1.0 + e * 4.5;                  // 1.0 → 5.5 (main bell)
  } else {
    const t = (y - 18) / (FUNNEL_HEIGHT - 18);
    return 5.5 + t * 3.0;                  // 5.5 → 8.5 (flare into cloud)
  }
}

// Vortex velocity at position (x, y, z) RELATIVE to tornado axis.
// Outputs a target velocity (m/s) the particle should accelerate toward.
//   - tangential: rotation around y axis (solid body inside r=2, 1/r outside)
//   - radial:     inward suction (stronger near the surface)
//   - updraft:    vertical lift (stronger near core)
//
// Tuned to feel chaotic but coherent. Reuses a passed Vector3 for zero alloc.
const ROTATION_OMEGA = 5.5;       // rad/s at the solid-core boundary
const SOLID_CORE_R   = 2.0;       // inside this radius = solid-body rotation
const RADIAL_PULL    = 1.4;       // m/s² baseline inward
const UPDRAFT_BASE   = 3.0;       // m/s baseline updraft
const UPDRAFT_CORE   = 7.0;       // additional m/s at axis

export function vortexVelocity(
  out: THREE.Vector3,
  x: number, _y: number, z: number,
): THREE.Vector3 {
  const r = Math.hypot(x, z);
  if (r < 0.001) {
    out.set(0, UPDRAFT_BASE + UPDRAFT_CORE, 0);
    return out;
  }
  const invR = 1 / r;
  const cosA = x * invR;
  const sinA = z * invR;

  // Tangential speed: solid rotation in core, 1/r decay outside.
  const tangSpeed = r < SOLID_CORE_R
    ? ROTATION_OMEGA * r
    : ROTATION_OMEGA * SOLID_CORE_R * (SOLID_CORE_R / r);

  // Tangent unit vector (perpendicular to radial, +CCW around y)
  const tx = -sinA;
  const tz =  cosA;

  // Radial inward (negative outward)
  const rx = -cosA;
  const rz = -sinA;

  // Updraft: strongest near the axis, weaker at the surface
  const coreFrac = Math.max(0, 1 - r / 6);
  const updraft = UPDRAFT_BASE + UPDRAFT_CORE * coreFrac;

  out.set(
    tx * tangSpeed + rx * RADIAL_PULL,
    updraft,
    tz * tangSpeed + rz * RADIAL_PULL,
  );
  return out;
}

// Build the skeleton funnel mesh — TubeGeometry along a slightly curved
// path, with per-vertex radius following the tornado profile.
export function buildSkeletonFunnel(): THREE.BufferGeometry {
  const segs = 64;
  const radial = 24;

  // Slight S-curve so the funnel doesn't read as a perfectly vertical pole
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const y = t * FUNNEL_HEIGHT;
    const x = Math.sin(t * Math.PI * 1.6) * 0.6;
    const z = Math.cos(t * Math.PI * 1.3) * 0.45;
    points.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const frames = curve.computeFrenetFrames(segs, false);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const r = funnelRadiusAt(p.y) * 0.8; // skeleton sits slightly inside the particle cloud
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;
      positions.push(p.x + r * nx, p.y + r * ny, p.z + r * nz);
      normals.push(nx, ny, nz);
      uvs.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + (radial + 1);
      const c = a + (radial + 1) + 1;
      const d = a + 1;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

// Radial gradient texture used by every billboard particle.
export function makeRadialGradientTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const d = Math.hypot(dx, dy) / (size / 2);
      const a = Math.max(0, 1 - d) ** 1.6;
      const i = (y * size + x) * 4;
      data[i] = 255; data[i+1] = 255; data[i+2] = 255;
      data[i+3] = Math.floor(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}
