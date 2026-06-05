import * as THREE from 'three';

// Vortex math — the velocity field that drives every particle in the
// tornado. Mirrors how real tornadoes move air: solid-body rotation in
// the core, 1/r falloff outside, plus radial suction and updraft.
//
// Also exports the funnel profile (radius as a function of height) so
// particles know where the "skin" of the funnel lives.

export const FUNNEL_HEIGHT = 32;
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
const ROTATION_OMEGA = 6.6;       // rad/s at the solid-core boundary — angrier spin
const SOLID_CORE_R   = 2.0;       // inside this radius = solid-body rotation
const RADIAL_PULL    = 1.7;       // m/s² baseline inward (tighter suction)
const UPDRAFT_BASE   = 3.4;       // m/s baseline updraft
const UPDRAFT_CORE   = 8.5;       // additional m/s at axis — violent core lift

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

// Wispy CLOUD-PUFF texture for the vortex vapor — a radial falloff broken up by
// value-noise so each sprite reads as an irregular clump of cloud instead of a
// clean dot. Stacking thousands of these makes the funnel look like churning
// volumetric vapor rather than a fuzzy cone.
export function makeCloudPuffTexture(): THREE.DataTexture {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const vnoise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(
      lerp(hash(xi, yi), hash(xi + 1, yi), u),
      lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u),
      v,
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2) / (size / 2);
      const dy = (y - size / 2) / (size / 2);
      const d = Math.hypot(dx, dy);
      const radial = Math.max(0, 1 - d);
      // 2-octave value-noise clump
      const n = vnoise(x / 13, y / 13) * 0.6 + vnoise(x / 5.5, y / 5.5) * 0.4;
      let a = radial ** 1.3 * (0.45 + n * 0.95);
      a = Math.max(0, Math.min(1, a)) * Math.max(0, 1 - d); // hard cutoff at the rim
      const i = (y * size + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.floor(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}
