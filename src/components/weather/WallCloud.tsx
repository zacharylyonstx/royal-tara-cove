import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../state/tornadoStore';
import { useGameStore } from '../../state/gameStore';

// Wall cloud — wide, flat-bottomed mesoscale cloud disc that hangs above the
// tornado. Descends during hail phase, then stays low. Tracks tornado X/Z.
// Custom shader: rolling 2D noise + slow spin + dark grey base.

const WC_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const WC_FRAG = `
precision highp float;
uniform float time;
uniform float opacity;
uniform float flashFlare;
varying vec2 vUv;

vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Rotate UV slowly around (0.5, 0.5)
  vec2 c = vUv - 0.5;
  float ang = time * 0.05;
  float ca = cos(ang); float sa = sin(ang);
  vec2 r = vec2(c.x*ca - c.y*sa, c.x*sa + c.y*ca);
  vec2 uv = r + 0.5;

  float n1 = fbm(vec3(uv * 4.0, time * 0.1));
  float n2 = fbm(vec3(uv * 9.0 + 7.0, time * 0.18));
  float density = clamp(n1 * 0.6 + n2 * 0.3 + 0.3, 0.0, 1.0);

  // Darker toward center (the "wall" hangs lowest in the middle)
  float radial = length(c) * 2.0;
  float disc = smoothstep(1.0, 0.55, radial);

  vec3 darkCol  = vec3(0.10, 0.10, 0.12);
  vec3 lightCol = vec3(0.32, 0.30, 0.30);
  vec3 color = mix(darkCol, lightCol, density);

  // Lightning flare
  color = mix(color, vec3(0.92), flashFlare * 0.55 * density);

  float alpha = density * disc * opacity;
  gl_FragColor = vec4(color, alpha);
}
`;

const WC_RADIUS = 55;
const WC_Y_HIGH = 30;
const WC_Y_LOW = 22;

export function WallCloud() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: WC_VERT,
      fragmentShader: WC_FRAG,
      uniforms: {
        time: { value: 0 },
        opacity: { value: 0 },
        flashFlare: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    matRef.current = m;
    return m;
  }, []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const ts = useTornadoStore.getState();
    const g = useGameStore.getState();
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    // Visible from hail onward, builds with storm intensity
    const baseOpacity = Math.max(0, Math.min(1, (ts.stormIntensity - 0.45) / 0.55));
    if (baseOpacity < 0.01) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    // Position follows tornado X/Z
    mesh.position.x = ts.tornadoX;
    mesh.position.z = ts.tornadoZ;

    // Descend from high → low based on phase
    let y = WC_Y_HIGH;
    if (g.phase === 'hail') {
      const elapsed = performance.now() / 1000 - ts.phaseEnteredAt;
      const HAIL_DURATION = 15;
      const tDescend = Math.min(1, elapsed / HAIL_DURATION);
      y = WC_Y_HIGH + (WC_Y_LOW - WC_Y_HIGH) * tDescend;
    } else if (g.phase === 'tornado-approach' || g.phase === 'tornado-arrived' || g.phase === 'defeat') {
      y = WC_Y_LOW;
    }
    mesh.position.y = y;

    mat.uniforms.time.value += dt;
    mat.uniforms.opacity.value = baseOpacity * 0.78;
    const flashTarget = ts.flashAlpha;
    const cur = mat.uniforms.flashFlare.value;
    mat.uniforms.flashFlare.value = flashTarget > cur ? flashTarget : Math.max(0, cur - dt * 6);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <circleGeometry args={[WC_RADIUS, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
