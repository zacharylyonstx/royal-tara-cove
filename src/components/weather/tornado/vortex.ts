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

// Build a SOLID cone-shaped funnel mesh — LatheGeometry revolution of
// the proper tornado profile (narrow rope at base, fat bell at top).
// Closed top/bottom so the mesh is a watertight solid and renders as a
// readable dark CONE, not a hollow tube.
export function buildConeGeometry(): THREE.BufferGeometry {
  // Profile = (radius, height) points from bottom → top.
  // Start + end with (0, y) to cap the mesh closed.
  const samples = 24;
  const profile: THREE.Vector2[] = [];
  // Bottom cap (closes the mesh underneath)
  profile.push(new THREE.Vector2(0, 0));
  for (let i = 0; i <= samples; i++) {
    const y = (i / samples) * FUNNEL_HEIGHT;
    const r = funnelRadiusAt(y);
    profile.push(new THREE.Vector2(r, y));
  }
  // Top cap (closes the mesh on top)
  profile.push(new THREE.Vector2(0, FUNNEL_HEIGHT));
  const geom = new THREE.LatheGeometry(profile, 64);
  geom.computeVertexNormals();
  return geom;
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
