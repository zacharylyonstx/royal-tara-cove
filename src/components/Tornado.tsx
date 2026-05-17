import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../state/tornadoStore';
import { buildDebrisArchetypes, type DebrisArchetype } from './weather/tornado/debrisShapes';
import { VortexParticles } from './weather/tornado/VortexParticles';
import { DebrisDome } from './weather/tornado/DebrisDome';
import {
  FUNNEL_HEIGHT,
  funnelRadiusAt,
  vortexVelocity,
  buildConeGeometry,
} from './weather/tornado/vortex';

// v19 — particle-driven vortex tornado.
//
// The funnel is built from three layers of FX:
//   1. Skeleton mesh — a single thin funnel-shaped mesh giving silhouette
//   2. Vortex particles — 600 dark vapor sprites swirling in a real vortex
//      velocity field. THE FUNNEL'S APPARENT FORM emerges from here.
//   3. Debris particles — recognizable shapes (planks, shingles, branches,
//      sheet metal, lumber) riding the same vortex field
//   4. Debris dome (separate component) — wide low dust cloud at base
//   5. Yeet jets — occasional debris pieces flung tangentially out the top
//
// This is a complete architectural rewrite from v17/v18 which used 3 stacked
// TubeGeometry shaders (looked like textured cylinders, not a tornado).

const DEBRIS_COUNT = 80;
const YEET_POOL_PER_ARCHETYPE = 10;

interface DebrisItem {
  x: number; y: number; z: number;          // relative to tornado axis
  vx: number; vy: number; vz: number;
  scale: number;
  spinX: number; spinY: number; spinZ: number;
  archetypeIdx: number;
}

interface YeetItem {
  archetypeIdx: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  spinX: number; spinY: number; spinZ: number;
  scale: number;
  spawnedAt: number;
  alive: boolean;
}

// ---- Cone funnel shader ----
// SOLID dark cone — opaque so the silhouette READS clearly from any
// angle. depthWrite=true so it occludes properly. Subtle scrolling noise
// suggests swirling vapor texture on the surface, but the SHAPE is
// driven by the LatheGeometry, not the shader.
const CONE_VERT = `
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

const CONE_FRAG = `
precision highp float;
uniform float time;
uniform float opacity;
uniform float flashFlare;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  // Scroll: rotation (uv.x) + updraft (uv.y) — texture suggesting vapor swirl
  vec2 sUv = vec2(vUv.x * 6.0 + time * 0.7, vUv.y * 4.0 - time * 1.3);
  float n = noise(sUv) * 0.55 + noise(sUv * 2.4) * 0.3 + noise(sUv * 5.7) * 0.15;

  // Color palette — warm grey body so cone reads distinct from the cool
  // grey storm sky. Body kept medium-ish so the SILHOUETTE is visible.
  vec3 baseCol = vec3(0.55, 0.46, 0.36);   // warm mid-grey at bottom
  vec3 midCol  = vec3(0.38, 0.33, 0.32);   // mid warm-grey
  vec3 topCol  = vec3(0.22, 0.20, 0.20);   // dark warm-grey at bell

  vec3 color;
  if (vUv.y < 0.35) {
    color = mix(baseCol, midCol, vUv.y / 0.35);
  } else {
    color = mix(midCol, topCol, (vUv.y - 0.35) / 0.65);
  }

  // Surface noise modulation — modest so SHAPE dominates
  color *= (0.8 + n * 0.4);

  // STRONG rim light — fresnel-based brightening at silhouette edges so
  // the cone is unambiguously visible against any sky. This is the key
  // trick: the SHAPE is defined by the bright outline against the dark
  // sky behind.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = 1.0 - max(0.0, dot(vNormal, viewDir));
  float rim = smoothstep(0.35, 1.0, fres);
  color = mix(color, vec3(0.75, 0.70, 0.62), rim * 0.65);

  // Lightning flash
  color = mix(color, vec3(0.95), flashFlare * 0.6);

  // Cone is essentially OPAQUE. Tiny softening only at the very tip so it
  // bleeds into the wall cloud — everything else solid.
  float topSoft = smoothstep(1.0, 0.94, vUv.y);
  float alpha = opacity * topSoft;
  gl_FragColor = vec4(color, alpha);
}
`;

export function Tornado() {
  const rootRef = useRef<THREE.Group>(null);
  // Mesh ref — we read the material off the mesh each frame instead of
  // caching a ref inside useMemo (Strict Mode double-invokes useMemo,
  // creating a 2nd material that the rendered mesh DOESN'T use).
  const coneMeshRef = useRef<THREE.Mesh>(null);

  // ---- Solid cone funnel mesh ----
  const coneGeom = useMemo(() => buildConeGeometry(), []);
  const coneMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: CONE_VERT,
      fragmentShader: CONE_FRAG,
      uniforms: {
        time: { value: 0 },
        opacity: { value: 1 },        // visible by default; useFrame overrides per-frame
        flashFlare: { value: 0 },
      },
      transparent: true,
      depthWrite: true,             // CONE OCCLUDES — crucial for it to read solid
      side: THREE.FrontSide,
    });
  }, []);

  // ---- Debris archetypes (planks / shingles / sheet metal / branches / lumber) ----
  const debrisArchetypes = useMemo<DebrisArchetype[]>(() => buildDebrisArchetypes(), []);

  // Debris items distributed round-robin across archetypes
  const debrisGroups = useMemo(() => {
    const groups: { archetype: DebrisArchetype; items: DebrisItem[] }[] =
      debrisArchetypes.map((a) => ({ archetype: a, items: [] }));
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const archetypeIdx = i % debrisArchetypes.length;
      const y = Math.random() * FUNNEL_HEIGHT;
      const surfaceR = funnelRadiusAt(y);
      const r = surfaceR * (0.8 + Math.random() * 0.5);
      const angle = Math.random() * Math.PI * 2;
      groups[archetypeIdx].items.push({
        x: Math.cos(angle) * r,
        y,
        z: Math.sin(angle) * r,
        vx: 0, vy: 0, vz: 0,
        scale: 0.9 + Math.random() * 0.7,
        spinX: (Math.random() - 0.5) * 8,
        spinY: (Math.random() - 0.5) * 6,
        spinZ: (Math.random() - 0.5) * 8,
        archetypeIdx,
      });
    }
    return groups;
  }, [debrisArchetypes]);
  const debrisMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  // ---- Yeet jets — occasional debris flying tangentially out the top ----
  const yeetMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const yeetItems = useMemo<YeetItem[][]>(() =>
    debrisArchetypes.map(() =>
      Array.from({ length: YEET_POOL_PER_ARCHETYPE }, () => ({
        archetypeIdx: 0,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        spinX: 0, spinY: 0, spinZ: 0,
        scale: 1,
        spawnedAt: 0,
        alive: false,
      }))
    ), [debrisArchetypes]);
  const nextYeetAtRef = useRef(0);

  const tmp = useMemo(() => new THREE.Object3D(), []);
  const tmpVel = useMemo(() => new THREE.Vector3(), []);

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

    // Cone material update — read material off the mesh ref to dodge the
    // Strict Mode "two memos, one in scene" bug.
    const coneMat = coneMeshRef.current?.material as THREE.ShaderMaterial | undefined;
    if (coneMat) {
      coneMat.uniforms.time.value += dt;
      coneMat.uniforms.opacity.value = t.tornadoOpacity;
      const flashTarget = t.flashAlpha;
      const cur = coneMat.uniforms.flashFlare.value;
      coneMat.uniforms.flashFlare.value = flashTarget > cur ? flashTarget : Math.max(0, cur - dt * 6);
    }

    const now = performance.now() / 1000;

    // ---- Yeet jet spawning ----
    if (t.tornadoOpacity > 0.3 && now >= nextYeetAtRef.current) {
      const burstCount = 1 + Math.floor(Math.random() * 2); // 1..2
      for (let b = 0; b < burstCount; b++) {
        const archetypeIdx = Math.floor(Math.random() * debrisArchetypes.length);
        const pool = yeetItems[archetypeIdx];
        const slot = pool.find((p) => !p.alive);
        if (!slot) continue;
        const ang = Math.random() * Math.PI * 2;
        const r = funnelRadiusAt(FUNNEL_HEIGHT - 1);
        // Tangential direction
        const tangX = -Math.sin(ang);
        const tangZ = Math.cos(ang);
        // Outward bias (~35° outward from tangent)
        const outX = Math.cos(ang);
        const outZ = Math.sin(ang);
        const tanCos = Math.cos(0.61);
        const tanSin = Math.sin(0.61);
        const dirX = tangX * tanCos + outX * tanSin;
        const dirZ = tangZ * tanCos + outZ * tanSin;
        const speed = 10 + Math.random() * 8;
        slot.archetypeIdx = archetypeIdx;
        slot.x = Math.cos(ang) * r;
        slot.y = FUNNEL_HEIGHT - 0.5;
        slot.z = Math.sin(ang) * r;
        slot.vx = dirX * speed;
        slot.vy = 3 + Math.random() * 3;
        slot.vz = dirZ * speed;
        slot.spinX = (Math.random() - 0.5) * 12;
        slot.spinY = (Math.random() - 0.5) * 8;
        slot.spinZ = (Math.random() - 0.5) * 12;
        slot.scale = 1.4 + Math.random() * 1.0;
        slot.spawnedAt = now;
        slot.alive = true;
      }
      nextYeetAtRef.current = now + 3 + Math.random() * 3;
    }

    // ---- Yeet integration + write matrices ----
    for (let ai = 0; ai < yeetItems.length; ai++) {
      const pool = yeetItems[ai];
      const mesh = yeetMeshRefs.current[ai];
      if (!mesh) continue;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) {
          tmp.scale.set(0, 0, 0);
          tmp.position.set(0, -1000, 0);
          tmp.rotation.set(0, 0, 0);
          tmp.updateMatrix();
          mesh.setMatrixAt(i, tmp.matrix);
          continue;
        }
        p.vy -= 5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const dist = Math.hypot(p.x, p.z);
        if (p.y < 0 || dist > 40) {
          p.alive = false;
          tmp.scale.set(0, 0, 0);
          tmp.position.set(0, -1000, 0);
          tmp.rotation.set(0, 0, 0);
          tmp.updateMatrix();
          mesh.setMatrixAt(i, tmp.matrix);
          continue;
        }
        const age = now - p.spawnedAt;
        tmp.position.set(p.x, p.y, p.z);
        tmp.rotation.set(p.spinX * age, p.spinY * age, p.spinZ * age);
        tmp.scale.setScalar(p.scale);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m) m.opacity = t.tornadoOpacity;
    }

    // ---- Debris integration — ride the same vortex field ----
    for (let gi = 0; gi < debrisGroups.length; gi++) {
      const grp = debrisGroups[gi];
      const mesh = debrisMeshRefs.current[gi];
      if (!mesh) continue;
      for (let i = 0; i < grp.items.length; i++) {
        const d = grp.items[i];
        vortexVelocity(tmpVel, d.x, d.y, d.z);
        // Smooth toward target velocity (debris is heavier than vapor)
        const k = Math.min(1, dt * 4);
        d.vx += (tmpVel.x - d.vx) * k;
        d.vy += (tmpVel.y - d.vy) * k;
        d.vz += (tmpVel.z - d.vz) * k;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        // Recycle when debris exits top
        if (d.y > FUNNEL_HEIGHT + 1) {
          const y = Math.random() * 3;
          const surfaceR = funnelRadiusAt(y);
          const r = surfaceR * (0.8 + Math.random() * 0.4);
          const angle = Math.random() * Math.PI * 2;
          d.x = Math.cos(angle) * r;
          d.y = y;
          d.z = Math.sin(angle) * r;
          d.vx = 0; d.vy = 0; d.vz = 0;
        }
        tmp.position.set(d.x, d.y, d.z);
        tmp.rotation.set(d.spinX * now * 0.1, d.spinY * now * 0.1, d.spinZ * now * 0.1);
        tmp.scale.setScalar(d.scale);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const dmat = mesh.material as THREE.MeshStandardMaterial;
      if (dmat) dmat.opacity = t.tornadoOpacity;
    }
  });

  return (
    <>
      <group ref={rootRef}>
        {/* Solid cone funnel mesh — THE TORNADO */}
        <mesh ref={coneMeshRef} geometry={coneGeom} renderOrder={2}>
          <primitive object={coneMaterial} attach="material" />
        </mesh>

        {/* Debris — instanced per archetype, riding the vortex field */}
        {debrisGroups.map((g, i) => (
          <instancedMesh
            key={`deb-${i}`}
            ref={(el) => { debrisMeshRefs.current[i] = el; }}
            args={[g.archetype.geom, g.archetype.material, g.items.length]}
            castShadow
            renderOrder={4}
          />
        ))}

        {/* Yeet jets — separate per archetype */}
        {debrisArchetypes.map((a, i) => (
          <instancedMesh
            key={`yeet-${i}`}
            ref={(el) => { yeetMeshRefs.current[i] = el; }}
            args={[a.geom, a.material, YEET_POOL_PER_ARCHETYPE]}
            castShadow
            renderOrder={4}
          />
        ))}
      </group>

      {/* Vortex vapor cloud — the THING that makes it look like a tornado */}
      <VortexParticles />

      {/* Wide low debris cloud at base */}
      <DebrisDome />
    </>
  );
}
