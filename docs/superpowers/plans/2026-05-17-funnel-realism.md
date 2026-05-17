# Funnel Realism v18 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the v17 tornado funnel from "gray balls spinning in a circle" to a chaotic, breathing F5 vortex with recognizable debris, ragged silhouette, vapor wisps, and brown debris fountain at base.

**Architecture:** v17's 3-layer + satellites + instanced debris design stays. Add vertex-displacement on the funnel shaders, replace box debris with 5 real archetypes (planks, shingles, branches, sheet metal, lumber), add chaotic spiral-up motion, yeet jets out the top, vapor wisp sprites, and a brown dust fountain at the base. Two new sibling components mount alongside the existing funnel inside `Tornado.tsx`.

**Tech Stack:** React 19 + React Three Fiber + Three.js + Vite + TypeScript. No test framework — this is a real-time 3D game; verification is `npm run build` plus visual inspection in the browser.

---

## Note on TDD

This codebase has no unit test framework — it's a visual real-time game. The plan substitutes "write failing test" steps with **`npm run build` + visual verification in the browser at http://localhost:5173/**. Each task ends with a build + visual check.

## File Structure

**New files:**
- `src/components/weather/tornado/debrisShapes.ts` — geometry + material factory
- `src/components/weather/tornado/VaporWisps.tsx` — billboard sprite vapor shed
- `src/components/weather/tornado/DustFountain.tsx` — brown debris fountain at base

**Modified files:**
- `src/components/Tornado.tsx` — vertex displacement, chaotic motion, yeet jets, archetype debris, color tints, mount the two new sibling systems

**Unchanged:** Game.tsx, App.tsx, store, audio, all v17 systems.

---

## Task 1: Create debris archetype factory

**Files:**
- Create: `src/components/weather/tornado/debrisShapes.ts`

- [ ] **Step 1: Write the helper file**

```ts
import * as THREE from 'three';

// Real-world debris shapes pulled into the funnel: planks, shingles,
// sheet metal, tree branches, 2×4 lumber. Each archetype gets its own
// geometry + material so an InstancedMesh per archetype renders cleanly.

export interface DebrisArchetype {
  name: string;
  geom: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

export function buildDebrisArchetypes(): DebrisArchetype[] {
  return [
    {
      name: 'plank',
      geom: new THREE.BoxGeometry(0.04, 0.04, 0.6),
      material: new THREE.MeshStandardMaterial({ color: '#7a5a32', roughness: 0.9, transparent: true, opacity: 0 }),
    },
    {
      name: 'shingle',
      geom: new THREE.BoxGeometry(0.2, 0.02, 0.15),
      material: new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.95, transparent: true, opacity: 0 }),
    },
    {
      name: 'sheet-metal',
      geom: new THREE.BoxGeometry(0.25, 0.01, 0.3),
      material: new THREE.MeshStandardMaterial({ color: '#8a8a92', metalness: 0.55, roughness: 0.4, transparent: true, opacity: 0 }),
    },
    {
      name: 'branch',
      geom: new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6),
      material: new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.95, transparent: true, opacity: 0 }),
    },
    {
      name: 'lumber-2x4',
      geom: new THREE.BoxGeometry(0.05, 0.1, 1.0),
      material: new THREE.MeshStandardMaterial({ color: '#a07050', roughness: 0.85, transparent: true, opacity: 0 }),
    },
  ];
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/zak/Game && npm run build`
Expected: build succeeds (file is unused at this point but typechecks).

- [ ] **Step 3: Commit**

```bash
git add src/components/weather/tornado/debrisShapes.ts
git commit -m "v18 (1/8): add debris archetype factory (planks/shingles/branches/metal/lumber)"
```

---

## Task 2: Switch Tornado.tsx debris from boxes to archetypes

Replace the 6 color-grouped box InstancedMeshes with 5 archetype InstancedMeshes. Per-instance motion stays as v17 for now (orbiting circles) — Task 3 adds the chaotic motion.

**Files:**
- Modify: `src/components/Tornado.tsx`

- [ ] **Step 1: Replace the DEBRIS_COLORS / DebrisItem / debrisGroups section**

Find this block in `src/components/Tornado.tsx`:

```ts
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
```

Replace with:

```ts
import { buildDebrisArchetypes, type DebrisArchetype } from './weather/tornado/debrisShapes';

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
```

- [ ] **Step 2: Replace the ORBITAL_DEBRIS_COUNT constant and bump the count**

Find:
```ts
const ORBITAL_DEBRIS_COUNT = 160;
```
Replace with:
```ts
const ORBITAL_DEBRIS_COUNT = 240;
```

- [ ] **Step 3: Replace the debrisGroups memo**

Find this:

```ts
  // ---- Orbital debris cloud ----
  const debrisGroups = useMemo(() => {
    const groups: { color: string; items: DebrisItem[] }[] = DEBRIS_COLORS.map((c) => ({ color: c, items: [] }));
    for (let i = 0; i < ORBITAL_DEBRIS_COUNT; i++) {
      const h = Math.random() * FUNNEL_HEIGHT;
      const tNorm = h / FUNNEL_HEIGHT;
      const baseRadius = LAYERS[1].baseR + tNorm * (LAYERS[1].topR - LAYERS[1].baseR) + 1.0 + Math.random() * 3.5;
      const colorIdx = Math.floor(Math.random() * DEBRIS_COLORS.length);
      groups[colorIdx].items.push({
        height: h,
        baseRadius,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: 0.8 + Math.random() * 2.5 + tNorm * 2.5,
        scaleX: 0.25 + Math.random() * 0.55,
        scaleY: 0.06 + Math.random() * 0.2,
        scaleZ: 0.15 + Math.random() * 0.45,
        spinX: (Math.random() - 0.5) * 8,
        spinY: (Math.random() - 0.5) * 6,
        spinZ: (Math.random() - 0.5) * 8,
        colorIdx,
      });
    }
    return groups;
  }, []);
```

Replace with:

```ts
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
```

- [ ] **Step 4: Update the per-frame debris loop to use new fields (motion unchanged from v17, just adapt to new field names)**

Find this loop:

```ts
    // Orbital debris
    for (let gi = 0; gi < debrisGroups.length; gi++) {
      const grp = debrisGroups[gi];
      const mesh = debrisMeshRefs.current[gi];
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
```

Replace with:

```ts
    // Orbital debris (archetype-based; chaotic motion lands in Task 3)
    for (let gi = 0; gi < debrisGroups.length; gi++) {
      const grp = debrisGroups[gi];
      const mesh = debrisMeshRefs.current[gi];
      if (!mesh) continue;
      for (let i = 0; i < grp.items.length; i++) {
        const d = grp.items[i];
        d.angle += d.angularSpeed * dt;
        const tNorm = d.height / FUNNEL_HEIGHT;
        const taperedRadius = LAYERS[1].baseR + tNorm * (LAYERS[1].topR - LAYERS[1].baseR) + d.radiusOffset;
        const r = taperedRadius + Math.sin(d.angle * 0.7 + d.height) * 0.6;
        tmp.position.set(
          Math.cos(d.angle) * r,
          d.height + Math.sin(now * 0.7 + d.height) * 0.3,
          Math.sin(d.angle) * r,
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
```

- [ ] **Step 5: Replace the JSX for orbital debris meshes**

Find:

```tsx
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
```

Replace with:

```tsx
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
```

- [ ] **Step 6: Verify build + visual**

Run: `cd /Users/zak/Game && npm run build`
Expected: clean build.

Visual check: load http://localhost:5173/, pick Tornado Warning, wait ~45s. Debris should now read as **planks / shingles / sheet metal / branches / lumber** instead of cubes. Motion still circular (Task 3 fixes that).

- [ ] **Step 7: Commit**

```bash
git add src/components/Tornado.tsx
git commit -m "v18 (2/8): switch debris from boxes to 5 real archetypes (240 instances)"
```

---

## Task 3: Add chaotic spiral-up motion

Replace flat-circle orbits with: helical climb (each debris piece rises over its lifetime, then recycles to the base), radial pulse, and tangential jitter.

**Files:**
- Modify: `src/components/Tornado.tsx`

- [ ] **Step 1: Replace the per-frame debris loop**

Find the loop you wrote in Task 2 Step 4. Replace its inner body with chaotic motion:

```ts
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
```

- [ ] **Step 2: Verify build + visual**

Run: `cd /Users/zak/Game && npm run build`

Visual: debris should now visibly **spiral UPWARD** through the funnel — track one piece, it should climb from base to top over a few seconds, then teleport back down. Radius should breathe (not clean circles).

- [ ] **Step 3: Commit**

```bash
git add src/components/Tornado.tsx
git commit -m "v18 (3/8): chaotic debris motion — helical climb + radial pulse + tangent jitter"
```

---

## Task 4: Vertex-displaced funnel silhouette

Make the funnel meshes deform vertex positions via 3D noise so the outline ripples and breathes instead of being a perfect tube.

**Files:**
- Modify: `src/components/Tornado.tsx`

- [ ] **Step 1: Extract snoise into a shared GLSL chunk**

Near the top of the shader section in `Tornado.tsx` (just before `const FUNNEL_VERT`), add a shared chunk:

```ts
// Shared GLSL helpers (used by both vert and frag shaders).
const SNOISE_GLSL = `
vec4 mod289_v4(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec3 mod289_v3(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 permute_v4(vec4 x){return mod289_v4(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt_v4(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise3(vec3 v){
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
  i = mod289_v3(i);
  vec4 p = permute_v4(permute_v4(permute_v4(
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
  vec4 norm = taylorInvSqrt_v4(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;
```

- [ ] **Step 2: Replace FUNNEL_VERT with a displacing vertex shader**

Find:

```ts
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
```

Replace with:

```ts
const FUNNEL_VERT = `
uniform float time;
uniform float displaceAmp;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

${SNOISE_GLSL}

void main() {
  vUv = uv;
  // Sample 3D noise at world position over time → push along normal.
  // worldPos before displacement, for stable noise sampling per vertex.
  vec4 wp0 = modelMatrix * vec4(position, 1.0);
  float n = snoise3(wp0.xyz * 0.25 + vec3(time * 0.4));
  vec3 disp = normal * n * displaceAmp;
  vec4 wp = modelMatrix * vec4(position + disp, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
```

- [ ] **Step 3: Update FUNNEL_FRAG to reuse SNOISE_GLSL instead of inlining its own**

Find this block inside `FUNNEL_FRAG`:

```glsl
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  ... (~40 lines)
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
```

Replace those ~45 lines with: nothing. (The function is now provided by SNOISE_GLSL.)

Then change the template literal to inject SNOISE_GLSL. Find the `const FUNNEL_FRAG = \`` line and inject:

```ts
const FUNNEL_FRAG = `
precision highp float;

uniform float time;
uniform float flashFlare;
uniform float stormIntensity;
uniform float opacity;
uniform float scrollRate;
uniform float updraftRate;
uniform float densityBias;
uniform vec3  baseTint;
uniform vec3  midTint;
uniform vec3  topTint;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

${SNOISE_GLSL}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise3(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}
```

(Keep the rest of `FUNNEL_FRAG` body unchanged — the `void main()` and onwards — but every reference to `snoise(` becomes `snoise3(`. There's only one direct call: inside `fbm` above. Already updated.)

- [ ] **Step 4: Add displaceAmp to the layer config and material builder**

Find the `FunnelLayer` interface:

```ts
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
```

Add a field:

```ts
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
  displaceAmp: number;
}
```

Find the LAYERS array and add `displaceAmp` to each entry:

```ts
const LAYERS: FunnelLayer[] = [
  // Halo
  {
    baseR: 3.0, topR: 9.0,
    scroll: 0.32, updraft: 0.55, density: 0.28,
    baseTint: new THREE.Color('#6e6864'),
    midTint:  new THREE.Color('#322f30'),
    topTint:  new THREE.Color('#16161a'),
    opacityMult: 0.45, sBend: 0.55, renderOrder: 3,
    displaceAmp: 0.9,
  },
  // Funnel mid
  {
    baseR: 1.2, topR: 5.5,
    scroll: 0.9, updraft: 1.2, density: 0.4,
    baseTint: new THREE.Color('#78746e'),
    midTint:  new THREE.Color('#32303a'),
    topTint:  new THREE.Color('#1a1a1c'),
    opacityMult: 1.0, sBend: 1.0, renderOrder: 5,
    displaceAmp: 0.5,
  },
  // Rope core
  {
    baseR: 0.6, topR: 2.5,
    scroll: 1.55, updraft: 1.9, density: 0.55,
    baseTint: new THREE.Color('#8c8782'),
    midTint:  new THREE.Color('#2a262e'),
    topTint:  new THREE.Color('#0a0a0c'),
    opacityMult: 1.0, sBend: 1.2, renderOrder: 6,
    displaceAmp: 0.15,
  },
];
```

In `buildLayerMaterial`, add `displaceAmp` to uniforms:

```ts
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
      displaceAmp: { value: layer.displaceAmp },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
```

- [ ] **Step 5: Satellite material — give satellites a smaller displaceAmp than mid**

Find the satelliteMaterials memo:

```ts
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
```

Replace with:

```ts
  const satelliteMaterials = useMemo(() => {
    const arr = SATELLITES.map(() => {
      // Satellites use the mid layer as a base but get a smaller displaceAmp
      // and lower density (they're thinner mini-funnels).
      const baseLayer: FunnelLayer = { ...LAYERS[1], displaceAmp: 0.3 };
      const m = buildLayerMaterial(baseLayer);
      m.uniforms.opacity.value = 0;
      m.uniforms.densityBias.value = 0.3;
      return m;
    });
    satelliteMatRefs.current = arr;
    return arr;
  }, []);
```

- [ ] **Step 6: Verify build + visual**

Run: `cd /Users/zak/Game && npm run build`

Expected: clean build.

Visual: the funnel silhouette should **ripple** — outline is no longer a perfect cylinder. The halo (outer mist) breathes most; the rope core stays mostly stable.

- [ ] **Step 7: Commit**

```bash
git add src/components/Tornado.tsx
git commit -m "v18 (4/8): vertex-displaced funnel silhouette via shared snoise + per-layer displaceAmp"
```

---

## Task 5: Color zoning — brown lower funnel

Update the rope + mid layer `baseTint` to a debris-stained brown.

**Files:**
- Modify: `src/components/Tornado.tsx`

- [ ] **Step 1: Change rope.baseTint and mid.baseTint**

In the LAYERS array, change two color values:

In the **Funnel mid** entry, change:
```ts
    baseTint: new THREE.Color('#78746e'),
```
to:
```ts
    baseTint: new THREE.Color('#7a5a3a'),
```

In the **Rope core** entry, change:
```ts
    baseTint: new THREE.Color('#8c8782'),
```
to:
```ts
    baseTint: new THREE.Color('#8a6e48'),
```

Leave the halo entry's baseTint (#6e6864) alone — the outer mist stays grey.

- [ ] **Step 2: Verify build + visual**

Run: `cd /Users/zak/Game && npm run build`

Visual: lower third of the funnel should now read **brown-tinged** (dust-stained) rather than uniform grey. The bell at the top should still be near-black.

- [ ] **Step 3: Commit**

```bash
git add src/components/Tornado.tsx
git commit -m "v18 (5/8): color zoning — brown debris-stained lower funnel"
```

---

## Task 6: Yeet jets — debris flying out the top

Spawn periodic bursts of debris that fly tangentially out the top of the funnel.

**Files:**
- Modify: `src/components/Tornado.tsx`

- [ ] **Step 1: Add YeetItem interface and module-level state holders**

Add near the top of the file (after the imports + above `LAYERS`):

```ts
const YEET_POOL_PER_ARCHETYPE = 20;

interface YeetItem {
  archetypeIdx: number;
  x: number; y: number; z: number;     // relative to tornado center
  vx: number; vy: number; vz: number;
  spinX: number; spinY: number; spinZ: number;
  scale: number;
  spawnedAt: number;
  alive: boolean;
}
```

- [ ] **Step 2: Add yeet state inside the Tornado component**

Inside `function Tornado()`, after the existing `dustItems` memo, add:

```ts
  // ---- Yeet jets — debris flying tangentially out the top ----
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
```

- [ ] **Step 3: Add yeet spawn + per-frame update inside the useFrame**

Inside the existing `useFrame(...)` body, just AFTER the satellite update loop (the `for (let s = 0; s < SATELLITES.length; s++)` block ends) and BEFORE the orbital debris loop, insert:

```ts
    // ---- Yeet jets ----
    if (t.tornadoOpacity > 0.3 && now >= nextYeetAtRef.current) {
      const burstCount = 3 + Math.floor(Math.random() * 3); // 3..5
      for (let b = 0; b < burstCount; b++) {
        const archetypeIdx = Math.floor(Math.random() * debrisArchetypes.length);
        const pool = yeetItems[archetypeIdx];
        const slot = pool.find((p) => !p.alive);
        if (!slot) continue;
        const ang = Math.random() * Math.PI * 2;
        const r = LAYERS[0].topR;
        // Tangential direction
        const tangX = -Math.sin(ang);
        const tangZ = Math.cos(ang);
        // Outward bias (35° outward from tangent)
        const outX = Math.cos(ang);
        const outZ = Math.sin(ang);
        const tanCos = Math.cos(0.61);  // ~35° in rad
        const tanSin = Math.sin(0.61);
        const dirX = tangX * tanCos + outX * tanSin;
        const dirZ = tangZ * tanCos + outZ * tanSin;
        const speed = 8 + Math.random() * 7;
        slot.archetypeIdx = archetypeIdx;
        slot.x = Math.cos(ang) * r;
        slot.y = FUNNEL_HEIGHT;
        slot.z = Math.sin(ang) * r;
        slot.vx = dirX * speed;
        slot.vy = 2 + Math.random() * 3;
        slot.vz = dirZ * speed;
        slot.spinX = (Math.random() - 0.5) * 12;
        slot.spinY = (Math.random() - 0.5) * 8;
        slot.spinZ = (Math.random() - 0.5) * 12;
        slot.scale = 1.2 + Math.random() * 0.9;
        slot.spawnedAt = now;
        slot.alive = true;
      }
      nextYeetAtRef.current = now + 0.7 + Math.random() * 0.5;
    }

    // Per-frame integration + write matrices
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
        if (p.y < 0 || dist > 30) {
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
```

- [ ] **Step 4: Render the yeet meshes in JSX**

Just AFTER the orbital debris `{debrisGroups.map(...)}` block, add:

```tsx
      {/* Yeet jets — separate InstancedMesh per archetype */}
      {debrisArchetypes.map((a, i) => (
        <instancedMesh
          key={`yeet-${i}`}
          ref={(el) => { yeetMeshRefs.current[i] = el; }}
          args={[a.geom, a.material, YEET_POOL_PER_ARCHETYPE]}
          castShadow
          renderOrder={4}
        />
      ))}
```

- [ ] **Step 5: Verify build + visual**

Run: `cd /Users/zak/Game && npm run build`

Visual: every ~1 second, a burst of 3–5 debris pieces should fly **tangentially out the top** of the funnel, arcing outward and falling under gravity.

- [ ] **Step 6: Commit**

```bash
git add src/components/Tornado.tsx
git commit -m "v18 (6/8): yeet jets — periodic debris bursts fly tangentially out the funnel top"
```

---

## Task 7: Vapor wisps shedding off the funnel

Billboard sprite particles that emit from the funnel surface, rise + curl + fade.

**Files:**
- Create: `src/components/weather/tornado/VaporWisps.tsx`
- Modify: `src/components/Tornado.tsx` (mount the new component)

- [ ] **Step 1: Create VaporWisps.tsx**

```tsx
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';

// Vapor wisps that shed off the funnel mid-section, rise + curl + fade.
// Instanced billboard sprites with a radial-gradient alpha texture.

const WISP_COUNT = 80;
const FUNNEL_HEIGHT = 24;
const BASE_R = 1.2;   // matches LAYERS[1].baseR
const TOP_R  = 5.5;   // matches LAYERS[1].topR

interface Wisp {
  originY: number;
  originAngle: number;
  age: number;
  lifetime: number;
  spinDir: number;
  size: number;
}

function makeRadialGradientTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const d = Math.hypot(dx, dy) / (size / 2);
      const a = Math.max(0, 1 - d) ** 1.5;
      const i = (y * size + x) * 4;
      data[i] = 255; data[i+1] = 255; data[i+2] = 255;
      data[i+3] = Math.floor(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

const WISP_VERT = `
attribute float instanceAlpha;
attribute float instanceScale;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = instanceAlpha;
  // Instance center comes from instanceMatrix translation.
  vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 mvPos = modelViewMatrix * instancePos;
  // Billboard: position attribute is the unit quad in local XY, apply scale.
  mvPos.xy += position.xy * instanceScale;
  gl_Position = projectionMatrix * mvPos;
}
`;

const WISP_FRAG = `
precision highp float;
uniform sampler2D gradientTex;
uniform vec3 tint;
uniform float globalOpacity;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 t = texture2D(gradientTex, vUv);
  gl_FragColor = vec4(tint, t.a * vAlpha * globalOpacity);
}
`;

function spawnWisp(w: Wisp) {
  w.originY = 4 + Math.random() * 14;
  w.originAngle = Math.random() * Math.PI * 2;
  w.age = 0;
  w.lifetime = 1.0 + Math.random() * 0.5;
  w.spinDir = Math.random() < 0.5 ? -1 : 1;
  w.size = 1.2 + Math.random() * 1.3;
}

export function VaporWisps() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const wisps = useMemo<Wisp[]>(() => {
    const arr: Wisp[] = [];
    for (let i = 0; i < WISP_COUNT; i++) {
      const w: Wisp = { originY: 0, originAngle: 0, age: 0, lifetime: 1, spinDir: 1, size: 1 };
      spawnWisp(w);
      // Stagger starting ages so they don't all spawn synchronously
      w.age = Math.random() * w.lifetime;
      arr.push(w);
    }
    return arr;
  }, []);

  const { material, geometry, alphaArr, scaleArr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    const alphaArr = new Float32Array(WISP_COUNT);
    const scaleArr = new Float32Array(WISP_COUNT);
    geom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
    const gradient = makeRadialGradientTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: WISP_VERT,
      fragmentShader: WISP_FRAG,
      uniforms: {
        gradientTex: { value: gradient },
        tint: { value: new THREE.Color('#d4d0cc') },
        globalOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    matRef.current = mat;
    return { material: mat, geometry: geom, alphaArr, scaleArr };
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const ts = useTornadoStore.getState();
    const mesh = meshRef.current;
    if (!mesh || !matRef.current) return;
    if (ts.tornadoOpacity < 0.05) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    matRef.current.uniforms.globalOpacity.value = ts.tornadoOpacity * 0.6;

    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i];
      w.age += dt;
      if (w.age > w.lifetime) spawnWisp(w);

      const ageNorm = w.age / w.lifetime;
      const radiusAtY = BASE_R + (w.originY / FUNNEL_HEIGHT) * (TOP_R - BASE_R) + 0.5;
      const angle = w.originAngle + w.age * w.spinDir * 1.5;
      const x = ts.tornadoX + Math.cos(angle) * radiusAtY + Math.sin(w.age * 4) * 0.4;
      const y = w.originY + w.age * 1.5;
      const z = ts.tornadoZ + Math.sin(angle) * radiusAtY + Math.cos(w.age * 4) * 0.4;

      const scale = w.size * (0.4 + w.age * 0.8);
      const alpha =
        smoothstep(0, 0.2, ageNorm) *
        (1 - smoothstep(0.5, 1, ageNorm));

      tmp.position.set(x, y, z);
      tmp.scale.setScalar(1); // shader uses instanceScale for sizing
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      alphaArr[i] = alpha;
      scaleArr[i] = scale;
    }
    mesh.instanceMatrix.needsUpdate = true;
    (geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('instanceScale') as THREE.InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, WISP_COUNT]}
      frustumCulled={false}
      renderOrder={7}
    />
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 2: Mount VaporWisps inside Tornado.tsx**

In `src/components/Tornado.tsx`, add the import at the top of the file (with the other React/three imports):

```ts
import { VaporWisps } from './weather/tornado/VaporWisps';
```

Then in the JSX returned by `Tornado()`, add `<VaporWisps />` as a sibling, INSIDE the root `<group ref={rootRef}>` but OUTSIDE since vapor wisps already include tornadoX/tornadoZ in their position calculation. Place it AFTER `</group>` close — wait, the root group transform contains `tornadoX/tornadoZ` too. Avoid double-applying.

Actually re-read: the root group sets `root.position.set(t.tornadoX, 0, t.tornadoZ)` in useFrame. Vapor wisps add `ts.tornadoX` themselves. So mounting wisps INSIDE the root group would double-add.

Mount OUTSIDE the root group. Wrap the return in a fragment:

Find:
```tsx
  return (
    <group ref={rootRef}>
      {/* ... existing children ... */}
    </group>
  );
```

Replace with:

```tsx
  return (
    <>
      <group ref={rootRef}>
        {/* ... existing children ... */}
      </group>
      <VaporWisps />
    </>
  );
```

- [ ] **Step 3: Verify build + visual**

Run: `cd /Users/zak/Game && npm run build`

Visual: soft glowing **vapor wisps** should shed off the funnel mid-section, rise + curl slightly, then fade out. They read as 3D volumetric vapor.

- [ ] **Step 4: Commit**

```bash
git add src/components/weather/tornado/VaporWisps.tsx src/components/Tornado.tsx
git commit -m "v18 (7/8): vapor wisps — billboarded sprite vapor shed from funnel mid-section"
```

---

## Task 8: Brown dust fountain at base

Brown billboard particles fountaining up from the base, hiding ground contact.

**Files:**
- Create: `src/components/weather/tornado/DustFountain.tsx`
- Modify: `src/components/Tornado.tsx` (mount)

- [ ] **Step 1: Create DustFountain.tsx**

```tsx
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';

// Brown dust fountain at the tornado base. Hides ground contact and
// gives the F5 "debris ball" silhouette. Normal-blended (additive on
// brown goes orange).

const DUST_COUNT = 150;
const FOUNTAIN_RADIUS = 4;

interface DustParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; lifetime: number;
  size: number;
}

function makeRadialGradientTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const d = Math.hypot(dx, dy) / (size / 2);
      const a = Math.max(0, 1 - d) ** 1.5;
      const i = (y * size + x) * 4;
      data[i] = 255; data[i+1] = 255; data[i+2] = 255;
      data[i+3] = Math.floor(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

const DUST_VERT = `
attribute float instanceAlpha;
attribute float instanceScale;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = instanceAlpha;
  vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 mvPos = modelViewMatrix * instancePos;
  mvPos.xy += position.xy * instanceScale;
  gl_Position = projectionMatrix * mvPos;
}
`;

const DUST_FRAG = `
precision highp float;
uniform sampler2D gradientTex;
uniform vec3 tint;
uniform float globalOpacity;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 t = texture2D(gradientTex, vUv);
  gl_FragColor = vec4(tint, t.a * vAlpha * globalOpacity);
}
`;

function spawnParticle(p: DustParticle) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * FOUNTAIN_RADIUS;
  p.x = Math.cos(a) * r;
  p.z = Math.sin(a) * r;
  p.y = 0;
  p.vx = (Math.random() - 0.5) * 4;
  p.vz = (Math.random() - 0.5) * 4;
  p.vy = 2 + Math.random() * 2;
  p.age = 0;
  p.lifetime = 1.5;
  p.size = 0.8 + Math.random() * 0.8;
}

export function DustFountain() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const particles = useMemo<DustParticle[]>(() => {
    const arr: DustParticle[] = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      const p: DustParticle = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 1.5, size: 1 };
      spawnParticle(p);
      p.age = Math.random() * p.lifetime; // stagger
      arr.push(p);
    }
    return arr;
  }, []);

  const { material, geometry, alphaArr, scaleArr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    const alphaArr = new Float32Array(DUST_COUNT);
    const scaleArr = new Float32Array(DUST_COUNT);
    geom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
    const gradient = makeRadialGradientTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        gradientTex: { value: gradient },
        tint: { value: new THREE.Color('#8a6a4a') },
        globalOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
    matRef.current = mat;
    return { material: mat, geometry: geom, alphaArr, scaleArr };
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const ts = useTornadoStore.getState();
    const mesh = meshRef.current;
    if (!mesh || !matRef.current) return;
    if (ts.tornadoOpacity < 0.05) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    matRef.current.uniforms.globalOpacity.value = ts.tornadoOpacity;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += dt;
      p.vy -= 3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.age > p.lifetime || p.y < 0) spawnParticle(p);

      tmp.position.set(ts.tornadoX + p.x, p.y, ts.tornadoZ + p.z);
      tmp.scale.setScalar(1);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      alphaArr[i] = Math.max(0, 1 - p.age / p.lifetime);
      scaleArr[i] = p.size;
    }
    mesh.instanceMatrix.needsUpdate = true;
    (geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('instanceScale') as THREE.InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, DUST_COUNT]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}
```

- [ ] **Step 2: Mount DustFountain in Tornado.tsx**

Add the import:

```ts
import { DustFountain } from './weather/tornado/DustFountain';
```

In the JSX, alongside `<VaporWisps />` from Task 7:

```tsx
  return (
    <>
      <group ref={rootRef}>
        {/* ... existing children ... */}
      </group>
      <VaporWisps />
      <DustFountain />
    </>
  );
```

- [ ] **Step 3: Verify build + visual**

Run: `cd /Users/zak/Game && npm run build`

Visual: a tall **brown dust fountain** rises from the base of the funnel, hiding ground contact. Particles spread + fall under gravity.

- [ ] **Step 4: Final visual sweep**

Load http://localhost:5173/, pick Tornado Warning, wait ~45s. Verify the full picture:

1. Funnel silhouette ripples + breathes ✓
2. Debris is real shapes (planks, shingles, branches, sheet metal, lumber) ✓
3. Debris spirals UP the funnel ✓
4. Periodic burst of boards out the top ✓
5. Tall brown dust fountain at base ✓
6. Vapor wisps shed off mid funnel ✓
7. Lower funnel brown-tinged, bell near-black ✓
8. No z-fighting, no NaN artifacts ✓

- [ ] **Step 5: Commit**

```bash
git add src/components/weather/tornado/DustFountain.tsx src/components/Tornado.tsx
git commit -m "v18 (8/8): brown dust fountain at funnel base — F5 debris ball silhouette"
```

---

## Self-review summary

- **Spec coverage:** Each of the spec's 7 component-change sections maps to a task: §1→T4, §2→T1+T2, §3→T3, §4→T6, §5→T7, §6→T8, §7→T5. File-map matches exactly.
- **No placeholders:** Every step contains the literal code or command. No "TBD" / "similar to" / "handle edge cases".
- **Type consistency:** `DebrisItem` defined in T2 (with `radiusOffset`, `climbRate`, `pulsePhase`, `tangentPhase`), used unchanged in T3. `YeetItem` defined in T6 with the same fields used in its spawn + integration. `Wisp` defined inside VaporWisps.tsx only. `DustParticle` inside DustFountain.tsx only. `FunnelLayer.displaceAmp` added in T4 step 4 and used in T4 step 4's `buildLayerMaterial` and `LAYERS` array.

Plan complete.
