import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../state/tornadoStore';

// Inside-facing sphere with a procedural-cloud shader. Rides ON TOP of the
// drei <Sky> (which keeps painting atmospheric scattering underneath) and
// fades in as the storm builds. The shader paints dark charcoal clouds at
// zenith, a sickly green-grey band at horizon, animated by simplex noise
// and wind-driven UV scroll. Lightning strikes briefly flash the whole dome.

const VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// 2D simplex noise — Ashima/McEwan port (https://github.com/ashima/webgl-noise)
const FRAGMENT_SHADER = `
precision highp float;

uniform float time;
uniform float stormIntensity;
uniform float windOffset;
uniform float flashAlpha;

varying vec2 vUv;
varying vec3 vWorldPos;

// Simplex noise 2D
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                       + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Spherical UV — vUv.y goes 0 (bottom) to 1 (top) of dome surface
  // wind-scrolled cloud coords
  vec2 uv = vUv * vec2(8.0, 3.0) + vec2(windOffset * 0.4, time * 0.012);

  float cloud = fbm(uv);
  cloud = smoothstep(-0.3, 0.7, cloud);

  // Color ramp by height (vUv.y)
  vec3 horizon = vec3(0.40, 0.38, 0.32); // sickly green-grey
  vec3 zenith  = vec3(0.10, 0.10, 0.12); // dark charcoal
  vec3 base = mix(horizon, zenith, smoothstep(0.0, 0.85, vUv.y));

  // Cloud lightens or darkens base depending on density
  vec3 lit = mix(base * 0.55, base * 1.25, cloud);
  // Subtle green tint band at horizon for pre-tornado vibes
  float greenBand = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.18, 0.35, vUv.y));
  lit += vec3(0.0, 0.08, -0.02) * greenBand * 0.7;

  // Lightning flash: full white wash, multiplied through the clouds
  lit = mix(lit, vec3(1.0), flashAlpha * (0.4 + cloud * 0.6));

  // Final alpha — ramps with storm intensity, never fully opaque so we
  // still get hints of the underlying drei Sky at very-low intensity.
  float alpha = clamp(stormIntensity * 1.25, 0.0, 0.96);

  gl_FragColor = vec4(lit, alpha);
}
`;

export function StormDome() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const windAccum = useRef(0);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        time: { value: 0 },
        stormIntensity: { value: 0 },
        windOffset: { value: 0 },
        flashAlpha: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    });
  }, []);

  useFrame((_state, dtRaw) => {
    const mat = matRef.current;
    if (!mat) return;
    const dt = Math.min(dtRaw, 0.05);
    const ts = useTornadoStore.getState();
    windAccum.current += dt * ts.windStrength;
    mat.uniforms.time.value += dt;
    mat.uniforms.stormIntensity.value = ts.stormIntensity;
    mat.uniforms.windOffset.value = windAccum.current;
    // Decay flash alpha each frame; Lightning sets it back up on strike.
    const newFlash = Math.max(0, mat.uniforms.flashAlpha.value - dt * 6);
    mat.uniforms.flashAlpha.value = newFlash;
    // Also sync from the store so Lightning can drive it
    if (ts.flashAlpha > newFlash) {
      mat.uniforms.flashAlpha.value = ts.flashAlpha;
    }
  });

  // Wire the ref to the same material instance for useFrame access.
  matRef.current = material;

  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[280, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
