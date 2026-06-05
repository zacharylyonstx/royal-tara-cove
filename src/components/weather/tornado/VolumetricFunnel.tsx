import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';
import { isTouchDevice } from '../../../systems/touchInput';
import { FUNNEL_HEIGHT } from './vortex';

// TRUE VOLUMETRIC FUNNEL — camera raymarching through an animated 3D noise
// density field bounded by a cheap box (technique per deep-research: FBM density
// shaped into a funnel profile, domain-warped swirl + height-twist, a nested
// light-march for Beer–Lambert self-shadowing so it has real depth — dark debris
// core fading to lit condensation — instead of a flat cone). A static mesh /
// Meshy model fundamentally can't do this; the realism IS the per-frame volume.

// Box half-extents around the funnel axis (world units).
const BOX_R = 16;
const BOX_H = FUNNEL_HEIGHT + 2;

// Step budgets — the box only covers the funnel's screen footprint, so this is
// far cheaper than a full-screen cloud. Trimmed hard on touch.
const STEPS = isTouchDevice() ? 26 : 44;
const LIGHT_STEPS = isTouchDevice() ? 2 : 2;

const VERT = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uFlash;
uniform vec3  uBase;     // funnel base world pos (x, 0, z)
uniform float uHeight;   // funnel height
uniform vec3  uBoxMin;
uniform vec3  uBoxMax;
uniform vec3  uLightDir; // normalized, toward the light
varying vec3 vWorldPos;

// --- cheap 3D value-noise FBM ---
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0.,0.,0.)), hash(i + vec3(1.,0.,0.)), f.x),
                 mix(hash(i + vec3(0.,1.,0.)), hash(i + vec3(1.,1.,0.)), f.x), f.y),
             mix(mix(hash(i + vec3(0.,0.,1.)), hash(i + vec3(1.,0.,1.)), f.x),
                 mix(hash(i + vec3(0.,1.,1.)), hash(i + vec3(1.,1.,1.)), f.x), f.y), f.z);
}
float fbm3(vec3 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){ v += a * vnoise(p); p = p * 2.02; a *= 0.5; }
  return v;
}
float fbm2(vec3 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 2; i++){ v += a * vnoise(p); p = p * 2.03; a *= 0.5; }
  return v;
}

// Funnel radius profile: thin rope at the ground, widening to a slim iconic bell.
float funnelRadius(float hn){
  return 0.7 + pow(clamp(hn, 0.0, 1.0), 0.6) * 8.2;
}

// Volumetric density at a world point.
float density(vec3 wp){
  vec3 lp = wp - uBase;          // funnel-local, +y up
  float h = lp.y;
  if (h < 0.0 || h > uHeight) return 0.0;
  float hn = h / uHeight;
  // Sway: the whole column leans + wanders with height for a living shape.
  lp.x -= (sin(uTime * 0.5) * 2.2 + sin(uTime * 1.3 + hn * 3.0) * 1.2) * hn;
  lp.z -= (cos(uTime * 0.4) * 1.8 + cos(uTime * 1.1 + hn * 2.5) * 1.0) * hn;
  float r = length(lp.xz);
  float Rf = funnelRadius(hn);
  float radial = 1.0 - smoothstep(Rf * 0.5, Rf * 1.12, r);
  if (radial <= 0.001) return 0.0;
  // Swirl: rotate sample coords by a twist that grows with height + spins.
  float ang = hn * 7.5 - uTime * 1.8;
  float ca = cos(ang), sa = sin(ang);
  vec2 rot = vec2(lp.x * ca - lp.z * sa, lp.x * sa + lp.z * ca);
  vec3 sp = vec3(rot * 0.21, lp.y * 0.14 - uTime * 0.65);
  // Domain-warped FBM → turbulent churning bands.
  float warp = fbm2(sp * 1.4 + 3.0);
  float n = fbm3(sp + warp * 0.9);
  n = n * 0.5 + 0.5;
  // Carve hard so thin noise vanishes into wisps and dense bands read solid —
  // this is what makes it churn instead of looking like a smooth column.
  float carve = smoothstep(0.30, 0.82, n);
  float dens = radial * carve;
  // MULTI-VORTEX: a couple of sub-vortices orbiting the core (the signature of a
  // violent tornado — denser knots that spiral around inside the main funnel).
  float sub = 0.0;
  for (int k = 0; k < 2; k++){
    float a = uTime * 2.3 + hn * 3.2 + float(k) * 3.14159;
    vec2 c = vec2(cos(a), sin(a)) * Rf * 0.5;
    float dd = length(lp.xz - c);
    sub += exp(-dd * dd * 0.45) * (0.55 + 0.45 * n);
  }
  dens = max(dens, radial * sub * 0.9);
  // Helical striations — the visible spiralling bands of a real spinning funnel.
  float theta = atan(lp.z, lp.x);
  dens *= 0.8 + 0.2 * sin(theta * 4.0 + hn * 16.0 - uTime * 5.0);
  dens *= smoothstep(0.0, 0.05, hn);            // fade in just off the ground
  dens *= 1.0 - smoothstep(0.80, 1.0, hn);      // dissolve top into the wall cloud
  return clamp(dens * 2.4, 0.0, 1.0);
}

// Coarse density (no warp/helix, 2-octave) — used only for self-shadowing, so
// the expensive full density() isn't evaluated inside the nested light loop.
float densityCheap(vec3 wp){
  vec3 lp = wp - uBase;
  float h = lp.y;
  if (h < 0.0 || h > uHeight) return 0.0;
  float hn = h / uHeight;
  float r = length(lp.xz);
  float Rf = funnelRadius(hn);
  float radial = 1.0 - smoothstep(Rf * 0.5, Rf * 1.12, r);
  if (radial <= 0.0) return 0.0;
  float n = fbm2(vec3(lp.xz * 0.2, lp.y * 0.14 - uTime * 0.6)) * 0.5 + 0.5;
  return radial * n * 1.7;
}

// Cheap self-shadow: march a few steps toward the light, accumulate density.
float lightMarch(vec3 wp){
  float ls = 2.2;
  float sum = 0.0;
  vec3 p = wp;
  for (int i = 0; i < ${LIGHT_STEPS}; i++){
    p += uLightDir * ls;
    sum += densityCheap(p);
  }
  return exp(-sum * ls * 2.1);
}

void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - ro);
  // Ray vs AABB (slab test) → [tn, tf]
  vec3 t0 = (uBoxMin - ro) / rd;
  vec3 t1 = (uBoxMax - ro) / rd;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  tn = max(tn, 0.0);
  if (tf <= tn) discard;

  float stepSize = (tf - tn) / float(${STEPS});
  // Per-pixel jitter hides banding from the low step count.
  float jit = hash(vec3(gl_FragCoord.xy, uTime * 60.0));
  float t = tn + stepSize * jit;

  float transmittance = 1.0;
  vec3 col = vec3(0.0);
  vec3 dark = vec3(0.035, 0.035, 0.045); // shadowed debris core
  vec3 pale = vec3(0.82, 0.83, 0.88);    // lit condensation

  for (int i = 0; i < ${STEPS}; i++){
    if (transmittance < 0.02) break;
    vec3 p = ro + rd * t;
    float d = density(p);
    if (d > 0.003){
      float lt = lightMarch(p);
      vec3 lp = p - uBase;
      float hn = clamp(lp.y / uHeight, 0.0, 1.0);
      // Directional FORM: the side facing the light is bright, the far side dark
      // — this is what turns a flat grey blob into a 3D lit column.
      float side = 0.5 + 0.5 * dot(normalize(lp.xz + vec2(1e-4)), normalize(uLightDir.xz + vec2(1e-4)));
      float form = clamp(lt * (0.35 + 0.65 * side), 0.0, 1.0);
      vec3 c = mix(dark, pale, form);
      c = mix(vec3(0.16, 0.13, 0.11), c, smoothstep(0.0, 0.22, hn)); // churned-dirt base
      c = mix(c, pale, hn * 0.18);                                    // condensation up high
      c += uFlash * 0.5;                 // lightning wash
      float absorb = d * stepSize * 2.3;
      float a = 1.0 - exp(-absorb);
      col += transmittance * a * c;
      transmittance *= 1.0 - a;
    }
    t += stepSize;
  }

  float alpha = (1.0 - transmittance) * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export function VolumetricFunnel() {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uFlash: { value: 0 },
        uBase: { value: new THREE.Vector3(0, 0, 0) },
        uHeight: { value: FUNNEL_HEIGHT },
        uBoxMin: { value: new THREE.Vector3() },
        uBoxMax: { value: new THREE.Vector3() },
        uLightDir: { value: new THREE.Vector3(-0.3, 0.92, 0.25).normalize() },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide, // always have a fragment, even from inside the box
    });
  }, []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const ts = useTornadoStore.getState();
    const mesh = meshRef.current;
    if (!mesh) return;
    const u = material.uniforms;
    if (ts.tornadoOpacity < 0.02) { mesh.visible = false; return; }
    mesh.visible = true;
    // Box follows the funnel; its world AABB drives the in-shader ray bounds.
    mesh.position.set(ts.tornadoX, BOX_H / 2, ts.tornadoZ);
    u.uTime.value += dt;
    u.uOpacity.value = ts.tornadoOpacity;
    u.uBase.value.set(ts.tornadoX, 0, ts.tornadoZ);
    (u.uBoxMin.value as THREE.Vector3).set(ts.tornadoX - BOX_R, 0, ts.tornadoZ - BOX_R);
    (u.uBoxMax.value as THREE.Vector3).set(ts.tornadoX + BOX_R, BOX_H, ts.tornadoZ + BOX_R);
    const flashTarget = ts.flashAlpha;
    const cur = u.uFlash.value as number;
    u.uFlash.value = flashTarget > cur ? flashTarget : Math.max(0, cur - dt * 6);
  });

  return (
    <mesh ref={meshRef} renderOrder={2} frustumCulled={false}>
      <boxGeometry args={[BOX_R * 2, BOX_H, BOX_R * 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
