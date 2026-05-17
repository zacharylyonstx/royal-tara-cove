import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../state/tornadoStore';
import { buildDebrisArchetypes, type DebrisArchetype } from './weather/tornado/debrisShapes';

// Tornado funnel — three concentric vapor layers + 3 satellite vortices,
// each built from a custom variable-radius "tube" geometry with a vapor-noise
// shader. v17 upgrade from the single funnel in v16.
//
// Layers:
//   • rope    — inner narrow column, highest opacity, fastest spin
//   • mid     — the v16 funnel, medium opacity
//   • halo    — wide soft mist, low opacity, slow spin
// Satellites:
//   • 3 mini-funnels at scale 0.35, orbiting the base at radius 7–11m

const FUNNEL_HEIGHT = 24;
const TUBE_SEGMENTS = 64;
const TUBE_RADIAL = 24;

// ---- Funnel shader ----
const FUNNEL_VERT = `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FUNNEL_FRAG = `
precision highp float;

uniform float time;
uniform float flashFlare;
uniform float stormIntensity;
uniform float opacity;
uniform float scrollRate;     // horizontal scroll multiplier (spin speed)
uniform float updraftRate;    // vertical scroll multiplier
uniform float densityBias;    // pushes cloud density up/down (0..1)
uniform vec3  baseTint;       // bottom color
uniform vec3  midTint;        // mid color
uniform vec3  topTint;        // top color

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

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
  vec2 sUv = vec2(
    vUv.x * 4.0 + time * scrollRate,
    vUv.y * 2.5 - time * updraftRate
  );
  vec2 sUv2 = vec2(
    vUv.x * 7.5 - time * (scrollRate * 0.45),
    vUv.y * 4.0 - time * (updraftRate * 1.5)
  );
  float n1 = fbm(vec3(sUv * 1.0, time * 0.2));
  float n2 = fbm(vec3(sUv2 * 1.5, time * 0.5 + 11.0));
  float cloud = clamp((n1 + n2 * 0.6) * 0.6 + densityBias, 0.0, 1.0);

  vec3 color = mix(
    mix(baseTint, midTint, smoothstep(0.0, 0.45, vUv.y)),
    topTint,
    smoothstep(0.45, 1.0, vUv.y)
  );
  color = mix(color * 0.55, color * 1.2, cloud);

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = 1.0 - max(0.0, dot(vNormal, viewDir));
  float edgeFade = smoothstep(0.3, 1.0, fres);

  color = mix(color, vec3(0.95), flashFlare * 0.65 * cloud);

  float alpha = clamp(cloud * (0.6 + edgeFade * 0.55), 0.0, 0.95) * opacity;
  alpha *= smoothstep(1.0, 0.6, vUv.y);

  gl_FragColor = vec4(color, alpha);
}
`;

// Build a variable-radius "tube" geometry along a slightly S-curved path.
function buildFunnelGeom(baseR: number, topR: number, height: number, sBendAmp: number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const y = t * height;
    const x = (Math.sin(t * Math.PI * 1.5) * 0.6 + Math.sin(t * Math.PI * 4) * 0.2) * sBendAmp;
    const z = Math.cos(t * Math.PI * 1.2) * 0.5 * sBendAmp;
    points.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const segs = TUBE_SEGMENTS;
  const radial = TUBE_RADIAL;
  const frames = curve.computeFrenetFrames(segs, false);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const r = baseR + (topR - baseR) * t;
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

interface FunnelLayer {
  baseR: number;
  topR: number;
  scroll: number;
  updraft: number;
  density: number;
  baseTint: THREE.Color;
  midTint: THREE.Color;
  topTint: THREE.Color;
  opacityMult: number;
  sBend: number;
  renderOrder: number;
}

const LAYERS: FunnelLayer[] = [
  // Halo — wide soft mist, slow spin
  {
    baseR: 3.0, topR: 9.0,
    scroll: 0.32, updraft: 0.55, density: 0.28,
    baseTint: new THREE.Color('#6e6864'),
    midTint:  new THREE.Color('#322f30'),
    topTint:  new THREE.Color('#16161a'),
    opacityMult: 0.45, sBend: 0.55, renderOrder: 3,
  },
  // Funnel mid (v16 funnel)
  {
    baseR: 1.2, topR: 5.5,
    scroll: 0.9, updraft: 1.2, density: 0.4,
    baseTint: new THREE.Color('#78746e'),
    midTint:  new THREE.Color('#32303a'),
    topTint:  new THREE.Color('#1a1a1c'),
    opacityMult: 1.0, sBend: 1.0, renderOrder: 5,
  },
  // Rope core — narrow, fast spin, high opacity
  {
    baseR: 0.6, topR: 2.5,
    scroll: 1.55, updraft: 1.9, density: 0.55,
    baseTint: new THREE.Color('#8c8782'),
    midTint:  new THREE.Color('#2a262e'),
    topTint:  new THREE.Color('#0a0a0c'),
    opacityMult: 1.0, sBend: 1.2, renderOrder: 6,
  },
];

interface SatelliteInfo {
  baseOrbitR: number;
  /** Static angular offset around main funnel. */
  phase: number;
}

const SATELLITES: SatelliteInfo[] = [
  { baseOrbitR: 7.0,  phase: 0 },
  { baseOrbitR: 9.0,  phase: (2 * Math.PI) / 3 },
  { baseOrbitR: 11.0, phase: (4 * Math.PI) / 3 },
];
const SATELLITE_SCALE = 0.35;
const SATELLITE_ORBIT_SPEED = 0.4; // rad/s

interface DebrisItem {
  height: number;
  radiusOffset: number;     // per-instance constant added to tapered radius
  angle: number;
  angularSpeed: number;
  scale: number;            // single uniform scale multiplier
  spinX: number; spinY: number; spinZ: number;
  archetypeIdx: number;
  // Spiral-up motion (Task 3 will use these)
  climbRate: number;
  pulsePhase: number;
  tangentPhase: number;
}

interface DustItem {
  angle: number;
  baseRadius: number;
  drift: number;
  height: number;
  spin: number;
}

const ORBITAL_DEBRIS_COUNT = 240;
const BASE_DUST_COUNT = 260;

function buildLayerMaterial(layer: FunnelLayer): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FUNNEL_VERT,
    fragmentShader: FUNNEL_FRAG,
    uniforms: {
      time: { value: 0 },
      flashFlare: { value: 0 },
      stormIntensity: { value: 0 },
      opacity: { value: 0 },
      scrollRate:  { value: layer.scroll },
      updraftRate: { value: layer.updraft },
      densityBias: { value: layer.density },
      baseTint: { value: layer.baseTint.clone() },
      midTint:  { value: layer.midTint.clone() },
      topTint:  { value: layer.topTint.clone() },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function Tornado() {
  const rootRef = useRef<THREE.Group>(null);
  const layerMatRefs = useRef<THREE.ShaderMaterial[]>([]);
  const satelliteGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const satelliteMatRefs = useRef<THREE.ShaderMaterial[]>([]);
  const debrisMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const dustMeshRef = useRef<THREE.InstancedMesh>(null);
  const dustMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const capMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Build one geometry per layer
  const layerGeoms = useMemo(() => LAYERS.map((L) => buildFunnelGeom(L.baseR, L.topR, FUNNEL_HEIGHT, L.sBend)), []);
  const layerMaterials = useMemo(() => {
    const arr = LAYERS.map((L) => buildLayerMaterial(L));
    layerMatRefs.current = arr;
    return arr;
  }, []);

  // Satellite vortices reuse the MID layer geometry, scaled down. Each gets
  // its own material instance so opacity/time can be tweaked independently.
  const satelliteGeom = useMemo(() => buildFunnelGeom(LAYERS[1].baseR, LAYERS[1].topR, FUNNEL_HEIGHT, LAYERS[1].sBend), []);
  const satelliteMaterials = useMemo(() => {
    const arr = SATELLITES.map(() => {
      const m = buildLayerMaterial(LAYERS[1]);
      m.uniforms.opacity.value = 0;
      m.uniforms.densityBias.value = 0.3;
      return m;
    });
    satelliteMatRefs.current = arr;
    return arr;
  }, []);

  // ---- Debris archetypes (planks, shingles, sheet metal, branches, lumber) ----
  const debrisArchetypes = useMemo<DebrisArchetype[]>(() => buildDebrisArchetypes(), []);

  // Debris items grouped by archetype, distributed round-robin.
  const debrisGroups = useMemo(() => {
    const groups: { archetype: DebrisArchetype; items: DebrisItem[] }[] =
      debrisArchetypes.map((a) => ({ archetype: a, items: [] }));
    for (let i = 0; i < ORBITAL_DEBRIS_COUNT; i++) {
      const archetypeIdx = i % debrisArchetypes.length;
      const h = Math.random() * FUNNEL_HEIGHT;
      const tNorm = h / FUNNEL_HEIGHT;
      groups[archetypeIdx].items.push({
        height: h,
        radiusOffset: 1.0 + Math.random() * 3.5,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: 0.8 + Math.random() * 2.5 + tNorm * 2.5,
        scale: 0.8 + Math.random() * 0.7,
        spinX: (Math.random() - 0.5) * 8,
        spinY: (Math.random() - 0.5) * 6,
        spinZ: (Math.random() - 0.5) * 8,
        archetypeIdx,
        climbRate: 0.3 + Math.random() * 0.7,
        pulsePhase: Math.random() * Math.PI * 2,
        tangentPhase: Math.random() * Math.PI * 2,
      });
    }
    return groups;
  }, [debrisArchetypes]);

  // ---- Base dust ring ----
  const dustItems = useMemo<DustItem[]>(() => {
    const arr: DustItem[] = [];
    for (let i = 0; i < BASE_DUST_COUNT; i++) {
      arr.push({
        angle: Math.random() * Math.PI * 2,
        baseRadius: 2.5 + Math.random() * 7,
        drift: 0.5 + Math.random() * 1.5,
        height: 0.05 + Math.random() * 1.8,
        spin: (Math.random() - 0.5) * 4,
      });
    }
    return arr;
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const root = rootRef.current;
    if (!root) return;
    const t = useTornadoStore.getState();
    if (t.tornadoOpacity < 0.01) {
      root.visible = false;
      return;
    }
    root.visible = true;
    root.position.set(t.tornadoX, 0, t.tornadoZ);

    // Update layer materials
    const flashTarget = t.flashAlpha;
    for (let i = 0; i < layerMatRefs.current.length; i++) {
      const m = layerMatRefs.current[i];
      if (!m) continue;
      m.uniforms.time.value += dt * 1.2;
      m.uniforms.stormIntensity.value = t.stormIntensity;
      m.uniforms.opacity.value = t.tornadoOpacity * LAYERS[i].opacityMult;
      const cur = m.uniforms.flashFlare.value;
      m.uniforms.flashFlare.value = flashTarget > cur ? flashTarget : Math.max(0, cur - dt * 6);
    }

    // Update satellite vortices: position + rotation + material
    const now = performance.now() / 1000;
    for (let s = 0; s < SATELLITES.length; s++) {
      const g = satelliteGroupRefs.current[s];
      const m = satelliteMatRefs.current[s];
      if (!g) continue;
      const sat = SATELLITES[s];
      const orbitA = sat.phase + now * SATELLITE_ORBIT_SPEED;
      // Orbit radius wobbles slightly so satellites breathe in/out
      const orbitR = sat.baseOrbitR + Math.sin(now * 0.7 + sat.phase) * 0.6;
      g.position.set(Math.cos(orbitA) * orbitR, 0, Math.sin(orbitA) * orbitR);
      // Each satellite spins around its OWN vertical axis fast
      g.rotation.y = now * (1.8 + s * 0.4);
      g.scale.setScalar(SATELLITE_SCALE);
      if (m) {
        m.uniforms.time.value += dt * 1.6;
        m.uniforms.stormIntensity.value = t.stormIntensity;
        // Satellites are dimmer than the main funnel
        m.uniforms.opacity.value = t.tornadoOpacity * 0.55;
        const cur = m.uniforms.flashFlare.value;
        m.uniforms.flashFlare.value = flashTarget > cur ? flashTarget : Math.max(0, cur - dt * 6);
      }
    }

    // Orbital debris — chaotic spiral-up motion
    for (let gi = 0; gi < debrisGroups.length; gi++) {
      const grp = debrisGroups[gi];
      const mesh = debrisMeshRefs.current[gi];
      if (!mesh) continue;
      for (let i = 0; i < grp.items.length; i++) {
        const d = grp.items[i];

        // Spiral up the funnel — each piece climbs over its lifetime
        d.angle += d.angularSpeed * dt;
        d.height += d.climbRate * dt;
        if (d.height > FUNNEL_HEIGHT) {
          d.height = 0;
          d.angle = Math.random() * Math.PI * 2;
        }

        const tNorm = d.height / FUNNEL_HEIGHT;
        const taperedRadius = LAYERS[1].baseR + tNorm * (LAYERS[1].topR - LAYERS[1].baseR) + d.radiusOffset;
        // Radial pulse — breathing in/out so orbits aren't clean circles
        const r = taperedRadius + Math.sin(now * 0.7 + d.pulsePhase) * 1.2;
        // Tangential jitter — perpendicular wobble breaks the perfect arc
        const tangent = Math.sin(now * 1.5 + d.tangentPhase) * 0.3;
        const cx = Math.cos(d.angle);
        const sx = Math.sin(d.angle);
        tmp.position.set(
          cx * r + (-sx) * tangent,
          d.height + Math.sin(now * 0.7 + d.height) * 0.3,
          sx * r + cx * tangent,
        );
        tmp.rotation.set(d.spinX * now * 0.1, d.spinY * now * 0.1, d.spinZ * now * 0.1);
        tmp.scale.setScalar(d.scale);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const dmat = mesh.material as THREE.MeshStandardMaterial;
      if (dmat) dmat.opacity = t.tornadoOpacity;
    }

    // Base dust ring
    if (dustMeshRef.current) {
      for (let i = 0; i < dustItems.length; i++) {
        const d = dustItems[i];
        d.angle += d.drift * dt;
        const r = d.baseRadius + Math.sin(now * 0.3 + d.angle) * 0.4;
        tmp.position.set(
          Math.cos(d.angle) * r,
          d.height,
          Math.sin(d.angle) * r,
        );
        tmp.rotation.set(-Math.PI / 2, d.spin * now * 0.2, d.angle);
        const sc = 1.4 + Math.sin(now + d.angle) * 0.3;
        tmp.scale.set(sc, sc, 1);
        tmp.updateMatrix();
        dustMeshRef.current.setMatrixAt(i, tmp.matrix);
      }
      dustMeshRef.current.instanceMatrix.needsUpdate = true;
      if (dustMatRef.current) dustMatRef.current.opacity = 0.45 * t.tornadoOpacity;
    }

    if (capMatRef.current) capMatRef.current.opacity = 0.55 * t.tornadoOpacity;
  });

  return (
    <group ref={rootRef}>
      {/* Three concentric funnel layers */}
      {LAYERS.map((L, i) => (
        <mesh key={`layer-${i}`} geometry={layerGeoms[i]} renderOrder={L.renderOrder}>
          <primitive object={layerMaterials[i]} attach="material" />
        </mesh>
      ))}

      {/* Satellite vortices — mini-funnels orbiting the base */}
      {SATELLITES.map((_, i) => (
        <group key={`sat-${i}`} ref={(el) => { satelliteGroupRefs.current[i] = el; }}>
          <mesh geometry={satelliteGeom} renderOrder={4}>
            <primitive object={satelliteMaterials[i]} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Cloud cap */}
      <mesh position={[0, FUNNEL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[14, 32]} />
        <meshBasicMaterial ref={capMatRef} color="#1a1a1c" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* Base dust ring */}
      <instancedMesh
        ref={dustMeshRef}
        args={[undefined, undefined, BASE_DUST_COUNT]}
        frustumCulled={false}
        renderOrder={3}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={dustMatRef}
          color="#8a7a6a"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Orbital debris — one InstancedMesh per archetype */}
      {debrisGroups.map((g, i) => (
        <instancedMesh
          key={`deb-${i}`}
          ref={(el) => { debrisMeshRefs.current[i] = el; }}
          args={[g.archetype.geom, g.archetype.material, g.items.length]}
          castShadow
          renderOrder={4}
        />
      ))}
    </group>
  );
}
