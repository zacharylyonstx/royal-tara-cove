# Storm overhaul (v16)

User feedback after v15 ship:
- Sky stays too blue while it rains — need dramatically darker, layered storm clouds
- Tornado funnel looks like a stack of donuts — needs to be a coherent rotating vapor column
- Tornado moves in a straight line — should wobble side-to-side like a real one
- Walking into the funnel should throw the player (currently nothing happens until arrival)
- House destruction is bland — should be dramatic: roof launches, walls tilt+fall, debris flies, dust burst

## Architecture

Three commits. Each ships an independently-testable improvement.

### Commit A: Visual overhaul

**Storm sky (`src/components/weather/StormDome.tsx`)**

Inside-facing sphere (radius 280, segments 32×16) wrapping the scene during tornado-mode storm phases. Custom `ShaderMaterial` with these uniforms:
- `time` — drives cloud motion
- `stormIntensity` — 0..1, drives opacity + darkness
- `windOffset` — accumulates from wind strength
- `flashAlpha` — bumped by Lightning component for storm-cloud illumination

Fragment shader paints:
- 3-octave simplex noise in 2D for cloud structure
- Color ramp: horizon `#7a6a5a` (sickly green-grey) → zenith `#1c1c20` (near-black charcoal)
- Slight green tint band at horizon (pre-tornado atmosphere)
- `flashAlpha` adds a brief whitish wash across the whole sky
- Final alpha = `clamp(stormIntensity * 1.2, 0, 0.96)` so it fully obscures the drei `<Sky>` at peak

Mounted in `TornadoModeSystems`, renders BEHIND everything (`renderOrder = -100`, `depthWrite=false`). Coexists with the existing `<Sky>` underneath.

**Branched lightning (`src/components/weather/LightningBolt.tsx`)**

Standalone component drawn from a pool of 4 reusable bolt geometries. Each bolt is a `LineSegments` built from a fractal-displaced line from cloud (y=70) to ground (y=0) with 2-4 random branches. Bolt visible for ~140ms then despawned. New strikes pick a random cloud-side X/Z within ±80m of the player.

Extends `Lightning.tsx`: when `lightningCue` bumps, spawn 1-2 bolts at random ground points, write the storm dome's `flashAlpha = 0.6` for 120ms, then 0.

**Tornado funnel rewrite (`src/components/Tornado.tsx`)**

Replace stacked tori with:

1. **Funnel body** — single `TubeGeometry` along a `CatmullRomCurve3` path:
   - 12 control points from ground (y=0, radius 1.2) to cloud top (y=24, radius 5.5)
   - Slight sinusoidal bend in X (~1.5m wave) so it isn't perfectly straight
   - Material: custom `ShaderMaterial` with uniforms `{ time, rotation, flashFlare, stormIntensity }`
   - Fragment: animated 3D simplex noise + vertical UV scroll (updraft) + horizontal scroll (spin) + vapor color ramp (`#aaa6a0` base → `#3a3a3c` mid → `#1c1c1f` top) + fresnel edge softness for vapor look + `flashFlare` adds momentary emissive white
   - Slight per-frame distortion of vertex Y for "breathing" (multiplied displacement)

2. **Base dust ring** — 200 instanced quads spread in a ring around the funnel base (radius 3..8m), y=0.05..2.0, faded by distance. Each quad rotates around its Y axis with wind. Material: `meshBasicMaterial({ color: '#8a7a6a', transparent, opacity: 0.35, blending: NormalBlending, depthWrite: false })`.

3. **Orbital debris cloud** — 120 instanced box meshes (planks, shingles) orbiting the funnel at variable heights (0..20m) and radii (2..8m + height-scaled). Larger and more visible than v15 (avg scale 0.4). 3-4 color variants for chunkiness.

4. **Cloud cap** — large disc at y=22 (radius 12), dark grey, semi-transparent, bleeds funnel into storm clouds above.

Whole `<group>` positioned at `(tornadoX, 0, tornadoZ)` — adds **tornadoX** wobble to existing tornadoZ.

### Commit B: Motion + interaction + destruction

**TornadoController: wobble path**

Add to `useTornadoStore`: `tornadoX: number` (default 0).

In `TornadoController` tornado-approach update:
```ts
const t = elapsed / APPROACH_DURATION;
const z = TORNADO_START_Z + (TORNADO_END_Z - TORNADO_START_Z) * t;
// Wobble: ±5m amplitude, decays as it approaches 10600 (gentle end)
const wobbleAmp = 5 * (1 - Math.pow(t, 2));
const x = Math.sin(t * 4 * Math.PI) * wobbleAmp +
          Math.sin(t * 9.3 * Math.PI + 1.7) * wobbleAmp * 0.3;
setTornadoZ(z);
setTornadoX(x);
```

**Player-tornado collision (kill zone)**

In `TornadoController` during `tornado-approach`:
```ts
const KILL_RADIUS = 4;
for (const id of CHARACTER_ORDER) {
  const p = positions[id];
  const dx = p.x - x;
  const dz = p.z - z;
  if (Math.hypot(dx, dz) < KILL_RADIUS) {
    if (id === activeCharacterId) {
      g.startRagdoll(p.x, p.y, p.z, now);
      g.setPhase('defeat');
    } else {
      // NPC swept into the void — yeet them away silently
      p.x = x + (Math.random() - 0.5) * 50;
      p.z = z + 60 + Math.random() * 20;
      p.y = 0;
    }
    return;
  }
}
```

The active character entering the tornado triggers immediate ragdoll throw and defeat (intentional kid-pleasing feature — "walk into it on purpose to see the launch"). NPCs get teleported far away (not visible in cinematic, no clutter).

Also update house destruction to use **distance to funnel center** instead of just Z-pass:
```ts
for (const h of housePath) {
  if (g.destroyedHouses[h.address] != null) continue;
  if (Math.hypot(h.x - x, h.z - z) < TORNADO_KILL_RADIUS) {
    g.markHouseDestroyed(h.address, now);
    houseCollapse(...);
  }
}
```

So a wobbling tornado that passes near a house but not through it might miss — adds randomness across plays.

**House destruction overhaul (`src/components/House.tsx` + new `DestructionFX.tsx`)**

When `destructionProgress > 0`:
- **Roof**: launches up + tumbles + scales away over 1.2s
  - position.y += progress * 8
  - rotation.x += progress * 6 (radians, multiple flips)
  - rotation.z += progress * 4
  - scale lerps 1 → 0 in last 30% of progress
- **Walls**: tilt 25° away from tornado direction over 0.5s, then scale Y from 1 → 0 over 0.5s. Walls fall in sequence (front first, then sides, then back).
- **Debris**: spawn 40 instanced boxes at house position with random initial velocity (upward + outward + spin). Falls under gravity. Settles into rubble. State held in `useGameStore.debris: DebrisItem[]` per-destruction.
- **Dust burst**: large sphere of instanced low-alpha quads expanding from center to ~12m over 1.5s then fading.
- **Audio**: extend `houseCollapse()` with glass-shatter layer (high-frequency oscillator bursts) and bigger sub-bass.

Add a new component `DestructionFX.tsx` that renders the debris + dust burst for each destroyed house. Reads from `useGameStore.destroyedHouses` (and a new `debrisItems: Record<address, DebrisItem[]>` populated on destruction).

For initial v16, keep it bounded: max 8 active destruction effects at once (older ones snap to "done" state to keep particle count manageable).

### Commit C: Audio + ambient tuning

**Audio extensions (`audio.ts`)**

- `houseCollapse(distance)` adds:
  - Glass-shatter: 3 high-freq oscillator bursts (3-5kHz square sweeps decaying fast)
  - Bigger sub-bass boom (extended decay)
- New `setRoarHiss(v)`: layered high-frequency noise on the roar, ramps with proximity
- New `rainGroundTick()`: low-volume short tick spawned at low rate when player is outside

**Hero-house "safe" audio cue**

In `TornadoController`, when player is inside hero AABB during tornado-approach, halve roar volume + reduce wind. Makes it audibly clear they're safe.

**Wind diagonal rain**: extend `Rain.tsx` so drop X velocity is larger at high wind strength (already partially does this; bump multiplier from 6 to 18 m/s at max wind).

### File map

**New:**
- `src/components/weather/StormDome.tsx`
- `src/components/weather/LightningBolt.tsx`
- `src/components/weather/DestructionFX.tsx`

**Modified:**
- `src/components/Tornado.tsx` (full rewrite)
- `src/components/weather/Lightning.tsx` (spawn bolts + drive storm-dome flash)
- `src/state/tornadoStore.ts` (add tornadoX, flashAlpha, debrisItems)
- `src/state/gameStore.ts` (add debrisItems for destruction FX)
- `src/systems/TornadoController.tsx` (wobble + collision + new house destroy check)
- `src/components/House.tsx` (overhauled destruction transforms)
- `src/world/houseDestruction.ts` (extend phase helpers for new sequence)
- `src/components/Game.tsx` (mount StormDome + DestructionFX in tornado systems)
- `src/audio.ts` (glass shatter + roar hiss + rain ground tick)

### Performance budget

- Storm dome: 1 sphere, shader. Cheap.
- Lightning bolts: max 2 active line geometries, ~24 verts each. Cheap.
- Tornado funnel: 1 tube mesh ~768 verts + custom shader. Cheap.
- Base dust: 200 instanced quads. Cheap.
- Orbital debris: 120 instanced boxes. Cheap.
- Destruction FX: max 8 active × 40 debris each = 320 instanced boxes. Manageable.
- Total new draw calls: ~12. Total new instances: ~640. Fine on a mid-range laptop.

### Test plan

1. Start tornado game. Sky darkens dramatically. Storm clouds visible (not just blue).
2. Lightning bolts visible striking the ground at random points. Sky flashes white.
3. Tornado funnel looks like a coherent rotating vapor column with debris orbiting and base dust kicking up.
4. Tornado wobbles side-to-side as it walks down the street (visibly serpentine).
5. Walk into the funnel during approach — instant ragdoll spiral + defeat.
6. House destruction is dramatic: roof launches into the sky, walls tilt and collapse in sequence, debris fountain, dust burst.
7. Inside hero house during approach — roar audibly quieter.
8. `npm run build` clean. No new console errors.

### Out of scope (for future polish)

- Tornado actually destroying 10600 if you stay outside (visually). Currently 10600 never destroys; we just defeat-throw the player.
- Multiple tornadoes.
- Mud puddles on the ground.
- Wet shader on materials.
- Rain bouncing off roofs.
- Branched lightning hitting and destroying a tree.
