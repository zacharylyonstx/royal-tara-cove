import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../state/tornadoStore';

// Tornado funnel — single TubeGeometry along a curved path with a custom
// vapor-noise shader, surrounded by a base dust ring and orbital debris.
// Replaces the v15 stack-of-tori look with something that reads as a
// coherent rotating vapor column.

const FUNNEL_HEIGHT = 24;
const BASE_RADIUS = 1.2;
const TOP_RADIUS = 5.5;
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

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

// Simplex noise 3D (Ashima)
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
  // Spin via horizontal UV scroll; updraft via vertical scroll.
  vec2 sUv = vec2(
    vUv.x * 4.0 + time * 0.9,         // rotation
    vUv.y * 2.5 - time * 1.2          // updraft (clouds moving up)
  );

  // Add second octave at different rate for chaos
  vec2 sUv2 = vec2(
    vUv.x * 7.5 - time * 0.4,
    vUv.y * 4.0 - time * 1.8
  );

  float n1 = fbm(vec3(sUv * 1.0, time * 0.2));
  float n2 = fbm(vec3(sUv2 * 1.5, time * 0.5 + 11.0));
  float cloud = clamp((n1 + n2 * 0.6) * 0.6 + 0.4, 0.0, 1.0);

  // Vapor color gradient by height (vUv.y, 0=ground, 1=top)
  vec3 baseCol  = vec3(0.78, 0.74, 0.70);  // pale grey at base
  vec3 midCol   = vec3(0.32, 0.30, 0.32);  // dark grey mid
  vec3 topCol   = vec3(0.10, 0.10, 0.12);  // near-black top (blends into clouds)
  vec3 color = mix(
    mix(baseCol, midCol, smoothstep(0.0, 0.45, vUv.y)),
    topCol,
    smoothstep(0.45, 1.0, vUv.y)
  );

  // Cloud density modulates color
  color = mix(color * 0.55, color * 1.2, cloud);

  // Fresnel softens edges so the cylinder doesn't read as a hard shape
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = 1.0 - max(0.0, dot(vNormal, viewDir));
  float edgeFade = smoothstep(0.3, 1.0, fres);

  // Lightning flare washes the funnel white
  color = mix(color, vec3(0.95), flashFlare * 0.65 * cloud);

  // Final alpha: more transparent at the edges, denser in the middle
  float alpha = clamp(cloud * (0.6 + edgeFade * 0.55), 0.0, 0.95) * opacity;

  // Fade out the very top so it bleeds into the dark clouds
  alpha *= smoothstep(1.0, 0.6, vUv.y);

  gl_FragColor = vec4(color, alpha);
}
`;

// Debris colors for the orbital cloud
const DEBRIS_COLORS = ['#7a5a32', '#5a3a22', '#dcd6c8', '#8a8a92', '#3a3a3c', '#a07050'];

interface DebrisItem {
  height: number;
  baseRadius: number;
  angle: number;
  angularSpeed: number;
  scaleX: number; scaleY: number; scaleZ: number;
  spinX: number; spinY: number; spinZ: number;
  colorIdx: number;
}

interface DustItem {
  angle: number;
  baseRadius: number;
  drift: number;
  height: number;
  spin: number;
}

const ORBITAL_DEBRIS_COUNT = 120;
const BASE_DUST_COUNT = 200;

export function Tornado() {
  const rootRef = useRef<THREE.Group>(null);
  const funnelMatRef = useRef<THREE.ShaderMaterial>(null);
  const debrisMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const dustMeshRef = useRef<THREE.InstancedMesh>(null);
  const dustMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const capMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // ---- Funnel: TubeGeometry along a slightly curved path ----
  const funnelGeom = useMemo(() => {
    // 12 control points from ground (y=0, narrow) to cloud top (y=24, wide)
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const y = t * FUNNEL_HEIGHT;
      // Slight S-bend so the funnel isn't a perfect line
      const x = Math.sin(t * Math.PI * 1.5) * 0.6 + Math.sin(t * Math.PI * 4) * 0.2;
      const z = Math.cos(t * Math.PI * 1.2) * 0.5;
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);

    // Custom tube with variable radius — use base TubeGeometry then scale per-segment.
    // Three.js doesn't natively support per-vertex tube radius, so we build manually.
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const segs = TUBE_SEGMENTS;
    const radial = TUBE_RADIAL;
    const frenetFrames = curve.computeFrenetFrames(segs, false);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const r = BASE_RADIUS + (TOP_RADIUS - BASE_RADIUS) * t;
      const N = frenetFrames.normals[i];
      const B = frenetFrames.binormals[i];
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
  }, []);

  const funnelMaterial = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: FUNNEL_VERT,
      fragmentShader: FUNNEL_FRAG,
      uniforms: {
        time: { value: 0 },
        flashFlare: { value: 0 },
        stormIntensity: { value: 0 },
        opacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    funnelMatRef.current = m;
    return m;
  }, []);

  // ---- Orbital debris cloud ----
  const debrisGroups = useMemo(() => {
    const groups: { color: string; items: DebrisItem[] }[] = DEBRIS_COLORS.map((c) => ({ color: c, items: [] }));
    for (let i = 0; i < ORBITAL_DEBRIS_COUNT; i++) {
      const h = Math.random() * FUNNEL_HEIGHT;
      const tNorm = h / FUNNEL_HEIGHT;
      const baseRadius = BASE_RADIUS + tNorm * (TOP_RADIUS - BASE_RADIUS) + 1.0 + Math.random() * 2.5;
      const colorIdx = Math.floor(Math.random() * DEBRIS_COLORS.length);
      groups[colorIdx].items.push({
        height: h,
        baseRadius,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: 0.8 + Math.random() * 2.5 + tNorm * 2.5,
        scaleX: 0.25 + Math.random() * 0.5,
        scaleY: 0.06 + Math.random() * 0.18,
        scaleZ: 0.15 + Math.random() * 0.4,
        spinX: (Math.random() - 0.5) * 8,
        spinY: (Math.random() - 0.5) * 6,
        spinZ: (Math.random() - 0.5) * 8,
        colorIdx,
      });
    }
    return groups;
  }, []);

  // ---- Base dust ring ----
  const dustItems = useMemo<DustItem[]>(() => {
    const arr: DustItem[] = [];
    for (let i = 0; i < BASE_DUST_COUNT; i++) {
      arr.push({
        angle: Math.random() * Math.PI * 2,
        baseRadius: 2.5 + Math.random() * 5,
        drift: 0.5 + Math.random() * 1.5,
        height: 0.05 + Math.random() * 1.6,
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

    // Funnel shader update
    if (funnelMatRef.current) {
      funnelMatRef.current.uniforms.time.value += dt * 1.2;
      funnelMatRef.current.uniforms.stormIntensity.value = t.stormIntensity;
      funnelMatRef.current.uniforms.opacity.value = t.tornadoOpacity;
      // Lightning flash flare
      const target = t.flashAlpha;
      const cur = funnelMatRef.current.uniforms.flashFlare.value;
      funnelMatRef.current.uniforms.flashFlare.value = target > cur
        ? target
        : Math.max(0, cur - dt * 6);
    }

    // Orbital debris
    const now = performance.now() / 1000;
    for (let g = 0; g < debrisGroups.length; g++) {
      const grp = debrisGroups[g];
      const mesh = debrisMeshRefs.current[g];
      if (!mesh) continue;
      for (let i = 0; i < grp.items.length; i++) {
        const d = grp.items[i];
        d.angle += d.angularSpeed * dt;
        const r = d.baseRadius + Math.sin(d.angle * 0.7 + d.height) * 0.6;
        tmp.position.set(
          Math.cos(d.angle) * r,
          d.height + Math.sin(now * 0.7 + d.height) * 0.3,
          Math.sin(d.angle) * r,
        );
        tmp.rotation.set(d.spinX * now * 0.1, d.spinY * now * 0.1, d.spinZ * now * 0.1);
        tmp.scale.set(d.scaleX, d.scaleY, d.scaleZ);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const dmat = mesh.material as THREE.MeshStandardMaterial;
      if (dmat) dmat.opacity = t.tornadoOpacity;
    }

    // Base dust ring (instanced quads, rotated to lay flat-ish then with some spin)
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
        const s = 1.4 + Math.sin(now + d.angle) * 0.3;
        tmp.scale.set(s, s, 1);
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
      {/* Funnel body */}
      <mesh geometry={funnelGeom} renderOrder={5}>
        <primitive object={funnelMaterial} attach="material" />
      </mesh>

      {/* Cloud cap (where the funnel bleeds into storm clouds) */}
      <mesh position={[0, FUNNEL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[12, 32]} />
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

      {/* Orbital debris */}
      {debrisGroups.map((g, i) => (
        <instancedMesh
          key={i}
          ref={(el) => { debrisMeshRefs.current[i] = el; }}
          args={[undefined, undefined, g.items.length]}
          castShadow
          renderOrder={4}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={g.color} transparent opacity={0} roughness={0.85} />
        </instancedMesh>
      ))}
    </group>
  );
}
