# Funnel Realism v18 — debris shapes + ragged silhouette + vapor wisps

Take the v17 multi-layer tornado and address the "lots of gray balls
spinning in a circle" feedback. Real debris shapes, vertex-displaced
silhouette, vapor wisps shedding sideways, brown dust fountain at base,
chaotic motion, and proper color zoning.

## Goals

- Funnel silhouette reads as a chaotic, breathing vortex — not a perfect cylinder
- Debris is recognizable: planks, shingles, branches, sheet metal, lumber
- Volumetric vapor feel via wisp sprite shedding
- Base reads as an F5 "debris ball" hiding ground contact
- Color zoning: brown lower, dark grey middle, near-black bell

## Architecture

Keeps v17 architecture intact (3 concentric tube layers + 3 satellites).
Adds two new sibling components and one helper:

- `weather/tornado/VaporWisps.tsx` — billboard sprite vapor shed
- `weather/tornado/DustFountain.tsx` — brown debris fountain at base
- `weather/tornado/debrisShapes.ts` — geometry + material factory for archetypes

`Tornado.tsx` grows vertex-displacement on the funnel shader, chaotic motion
on debris, yeet jets at top, and new color tints. It also mounts the two new
sibling systems. `Game.tsx` is unchanged because Tornado.tsx still mounts everything.

## Component changes

### 1. Vertex-displaced funnel silhouette

In the funnel vertex shader, sample 3D simplex noise at
`worldPos.xyz + time * 0.4` and push the vertex along its normal by
`noise * displaceAmp`. Per layer:

- rope: 0.15m
- mid: 0.5m
- halo: 0.9m
- satellites: 0.3m (uniform from mid)

Add a `displaceAmp` uniform; set per material. Fresnel uses the original
(un-displaced) normal — slightly inaccurate, visually fine, no cost.

The vertex shader needs the snoise function — the same Ashima snoise
already in FUNNEL_FRAG. Extract it into a shared GLSL chunk string in
Tornado.tsx so it can be reused in both vert + frag.

### 2. Debris archetype system

Replace the 6 color-grouped box-instance arrays with 5 archetype-grouped
arrays. New helper `debrisShapes.ts` exports:

```ts
export interface DebrisArchetype {
  name: string;
  geom: THREE.BufferGeometry;
  material: THREE.Material;
}
export function buildDebrisArchetypes(): DebrisArchetype[];
```

Archetypes:

1. **Fence plank** — BoxGeometry(0.04, 0.04, 0.6), MeshStandardMaterial(`#7a5a32`, roughness 0.9)
2. **Asphalt shingle** — BoxGeometry(0.2, 0.02, 0.15), MeshStandardMaterial(`#3a3a3c`, roughness 0.95)
3. **Sheet metal** — BoxGeometry(0.25, 0.01, 0.3), MeshStandardMaterial(`#8a8a92`, metalness 0.55, roughness 0.4)
4. **Tree branch** — CylinderGeometry(0.04, 0.04, 0.5, 6), MeshStandardMaterial(`#5a3a22`, roughness 0.95)
5. **2×4 lumber** — BoxGeometry(0.05, 0.1, 1.0), MeshStandardMaterial(`#a07050`, roughness 0.85)

Tornado.tsx replaces the existing `debrisGroups` (color-indexed) with
`debrisGroups` (archetype-indexed). Total instance count bumps from
160 → 240, distributed across archetypes (round-robin by index).

### 3. Chaotic motion

Per debris instance, add fields:

- `climbRate: number` — 0.3 + random * 0.7 (m/s) — spirals upward
- `pulsePhase: number` — random — for radial pulse
- `tangentPhase: number` — random — for tangential jitter

Per frame:

```
d.height += d.climbRate * dt;
if (d.height > FUNNEL_HEIGHT) {
  d.height = 0;
  d.angle = Math.random() * Math.PI * 2;
}
const tNorm = d.height / FUNNEL_HEIGHT;
const taperedRadius = LAYERS[1].baseR + tNorm * (LAYERS[1].topR - LAYERS[1].baseR) + 1.0 + (d.baseRadius - (LAYERS[1].baseR + 1.0));
// pulse + tangential jitter
const r = taperedRadius + Math.sin(now * 0.7 + d.pulsePhase) * 1.2;
const tangent = Math.sin(now * 1.5 + d.tangentPhase) * 0.3;
const radialX = Math.cos(d.angle);
const radialZ = Math.sin(d.angle);
const tangX = -radialZ;
const tangZ = radialX;
tmp.position.set(
  radialX * r + tangX * tangent,
  d.height + Math.sin(now * 0.7 + d.height) * 0.3,
  radialZ * r + tangZ * tangent,
);
```

This makes debris spiral UP visibly instead of orbiting at fixed heights,
and the radius pulses so orbits aren't clean circles.

### 4. Yeet jets — debris flying out the top

New module-level mutable array in Tornado.tsx: `yeetItems: YeetItem[]`.

```ts
interface YeetItem {
  archetypeIdx: number;
  x: number; y: number; z: number;       // relative to tornado center
  vx: number; vy: number; vz: number;
  spinX: number; spinY: number; spinZ: number;
  spawnedAt: number;
}
```

Lifecycle (per frame, inside the same useFrame):

- Spawn schedule: track `nextYeetAt` ref. When `now >= nextYeetAt` and
  `tornadoOpacity > 0.3`, spawn 3–5 items and set `nextYeetAt = now + 0.7 + random * 0.5`.
- Spawn: random archetypeIdx; spawn at y=FUNNEL_HEIGHT, angle random,
  radius = LAYERS[0].topR (rope top, narrow); velocity is tangential
  + 35° outward + small upward kick: `speed = 8 + random * 7`
- Per frame: `vy -= 5 * dt; pos += v * dt; spin += spin * dt`. Cull
  when `y < 0` or `Math.hypot(x, z) > 30`.

Render: separate InstancedMesh per archetype dedicated to yeet items,
sized 20 each (100 total). Active count tracked in a ref; inactive
slots are written with scale=0 matrices so they don't render visibly.

### 5. Vapor wisps (`VaporWisps.tsx`)

80 instanced billboard planes. Procedural radial-gradient alpha texture:

```ts
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
```

Per wisp:

```ts
interface Wisp {
  originY: number;        // 4..18 on funnel
  originAngle: number;    // 0..2π
  age: number;
  lifetime: number;       // 1.0..1.5s
  spinDir: number;        // ±1
  size: number;           // 1.2..2.5m
}
```

Per frame:

- `age += dt`; if `age > lifetime`, respawn with new random origin
- World position (relative to tornado):
  - radius at originY: `LAYERS[1].baseR + (originY / FUNNEL_HEIGHT) * (LAYERS[1].topR - LAYERS[1].baseR) + 0.5`
  - angle: `originAngle + age * spinDir * 1.5`
  - `x = cos(angle) * radius + sin(age * 4) * 0.4`
  - `y = originY + age * 1.5` (rises 1.5 m/s)
  - `z = sin(angle) * radius + cos(age * 4) * 0.4`
- Scale: `size * (0.4 + age * 0.8)` (grows as it rises)
- Alpha: `smoothstep(0, 0.2, age/lifetime) * (1 - smoothstep(0.5, 1, age/lifetime))`

Custom shader: vertex shader billboards toward camera by extracting the
camera right (column 0) and camera up (column 1) from `modelViewMatrix`,
then computing the world position as
`instanceCenter + camRight * vertex.x * scale + camUp * vertex.y * scale`.
Per-instance attributes: `instanceCenter` (vec3), `instanceScale` (float),
`instanceAlpha` (float). Fragment samples the gradient texture and
multiplies by `instanceAlpha * globalOpacity`.

Settings: `transparent=true`, `depthWrite=false`, `depthTest=true`,
`blending=AdditiveBlending`, `renderOrder=7` (after funnel=5 and
debris=4, so wisps draw last and aren't z-fought; depthTest still
hides wisps behind opaque objects).

### 6. Brown dust fountain (`DustFountain.tsx`)

Same shader pattern as VaporWisps but tinted brown (`#8a6a4a`),
NormalBlending (additive on brown → orange ugliness).

150 instances.

Per particle:

```ts
interface DustParticle {
  originX: number; originZ: number;   // in disc r=4m, relative to tornado
  vx: number; vy: number; vz: number;
  x: number; y: number; z: number;
  age: number; lifetime: number;      // 1.5s
  size: number;                       // 0.8..1.6m
}
```

Initial spawn / respawn:

- `originX, originZ`: random point in disc r=4m
- `vx, vz`: random ±2 m/s outward bias
- `vy`: 2 + random * 2 m/s
- `age = 0`, `lifetime = 1.5`

Per frame:

- `vy -= 3 * dt` (gravity)
- `x += vx * dt`, etc.
- `age += dt`; respawn when `age > lifetime || y < 0`
- Final world position: `(tornadoX + x, y, tornadoZ + z)`
- Alpha: `(1 - age/lifetime) * stormOpacity`

### 7. Color zoning

Update LAYERS in Tornado.tsx:

- **rope** baseTint: `#7a5a3a` (was `#8c8782`)
- **mid** baseTint: `#7a5a3a` (was `#78746e`)
- halo baseTint: keep grey-ish (`#6e6864`) — it's the outer mist, not the debris-stained core
- mid/top tints unchanged (already correct)

## File map

**New:**

- `src/components/weather/tornado/VaporWisps.tsx`
- `src/components/weather/tornado/DustFountain.tsx`
- `src/components/weather/tornado/debrisShapes.ts`

**Modified:**

- `src/components/Tornado.tsx` — vertex displacement, chaotic motion, yeet jets, new tints, mount VaporWisps + DustFountain, use debris archetypes from helper

**Unchanged:** Game.tsx, store, audio, all v17 systems.

## Out of scope

- Ray-marched volumetric funnel (v19+)
- GPU compute particles
- Debris physics (collision with houses / ground)
- Audio changes
- Performance profiling / optimization beyond natural budget (+~1ms acceptable)

## Test plan

1. `npm run build` clean
2. Pick Tornado Warning → wait ~45s for materialization
3. **Funnel silhouette ripples + breathes** (not a perfect cylinder)
4. **Debris is recognizable shapes** — planks, shingles, branches, sheet metal, lumber — not cubes
5. **Debris visibly spirals UP** the funnel (each piece climbs over its lifetime), not just orbits flat
6. **Periodic burst of boards** flies tangentially out the top every ~1s
7. **Tall brown dust fountain** rises from base, hiding ground contact
8. **Vapor wisps** shed off the funnel mid-section and curl upward, fading
9. Lower funnel is **brown-tinged**; bell at top reads **near-black**
10. No z-fighting, no disappearing geometry, no NaN-position artifacts at displaced vertices
