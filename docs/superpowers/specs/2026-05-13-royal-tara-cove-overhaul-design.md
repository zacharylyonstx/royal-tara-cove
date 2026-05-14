# Royal Tara Cove — Realism & Playability Overhaul

**Date:** 2026-05-13
**Status:** Approved (user authorized "do whatever you think is best")
**Player audience:** Penny (8) and Luke (6), with Dad

## Problem

The current build is a static mockup, not a game. Five concrete defects:

1. **Backyards collide.** Bulb houses use rectangle-shaped lots in local space; after rotation around the cul-de-sac the yards overlap into chaos. The straight-section lots have gaps and floating fences.
2. **Walls have no physics.** `PlayerController` only handles gravity. You walk through every house, fence, mailbox, and tree.
3. **3rd-person camera doesn't follow.** `CameraRig` updates `OrbitControls.target` but the camera position stays anchored in world space, so the spherical offset stretches as you walk.
4. **10600 isn't special.** It's the player's actual house in real life but appears as a generic 1-story `inferred` config.
5. **Houses are empty boxes.** No interior, no walkable doors, no rooms.

Plus the visuals are flat-shaded primitives that don't read as a real Texas suburb.

## Goal

Make the cul-de-sac feel like *being there* — solid walls, a camera that behaves, real lots, and at least one house (10600) you can actually go inside. Push visual realism via PBR materials, procedural textures, instanced foliage, and proper Texas-suburb props (trucks, BBQs, basketball hoops). Keep it browser-fast — no new deps unless required.

## Non-goals

- Multiplayer.
- Procedural city generation. We model exactly the 20 houses on Royal Tara Cove.
- Voice acting or NPC AI.
- Photorealism via raymarching/path tracing. We're chasing "that looks like a house in Avery Ranch," not Unreal Engine 5.

## Architecture

### New modules

```
src/world/
  lots.ts                # Lot polygon math (wedge for bulb, rect for straight)
  colliders.ts           # Static collider list derived from world
  textures.ts            # Procedural CanvasTexture factories (brick, stone, grass, asphalt)
  materials.ts           # Shared PBR material singletons
  props.ts               # Per-lot prop placement (deterministic by address hash)

src/systems/
  collision.ts           # Swept-circle resolve against AABBs + line segments
  CameraRig.tsx          # REWRITTEN: custom spherical follow cam with mouse look
  PlayerController.tsx   # MODIFIED: integrates collision; door interaction (E)

src/components/
  hero/
    HeroHouse10600.tsx   # Full exterior + interior wrapper for the hero house
    Interior10600.tsx    # Walls, doorways, room layout
    Bedroom.tsx          # Configurable kid bedroom (Penny / Luke / Dad)
    Kitchen.tsx
    LivingRoom.tsx
    Bathroom.tsx
  props/
    Truck.tsx            # F-150 silhouette in driveways
    Sedan.tsx
    BBQGrill.tsx
    BasketballHoop.tsx
    PatioSet.tsx
    GardenBed.tsx
    TrashBins.tsx
    Bike.tsx
    Hose.tsx
  vegetation/
    LiveOak.tsx          # Big Texas live oak — instanced leaf clusters
    CrepeMyrtle.tsx      # Pink-blooming small tree
    Hedge.tsx
    GrassPatch.tsx       # Procedural grass-blade instances near houses
  Door.tsx               # Animated, openable door with passable collider toggle
  Sky.tsx                # Custom dome sky (replaces drei <Sky> for cloud control)
```

### Modified

- `Yard.tsx` — consumes a `Lot` polygon instead of computing its own rectangle.
- `House.tsx` — uses shared materials, hipped roofs as an option, better window frames with insets, garage door panels with depth.
- `Game.tsx` — wires hero house, props, vegetation, environment lighting.
- `types.ts` — adds `isHero?`, `Floorplan`, `Collider`, `Lot`.
- `houses.ts` — 10600 promoted to hero with realistic dimensions; per-house seeded prop tags.

### Data flow

```
HouseConfig[] ──► lots.ts ──► Lot[]
                                │
                                ├─► Yard (lawn polygon, fence edges, gate slots)
                                └─► colliders.ts ──► Collider[] (static)
                                                       │
                                                       ▼
                                                  collision.ts ◄── PlayerController each frame
```

## Detailed design

### 1. Lot geometry (Phase 1)

`Lot` is a closed XZ polygon plus metadata:

```ts
interface Lot {
  address: string;
  polygon: Vec2[];          // CCW, world XZ
  frontEdgeIndex: number;   // which edge is the sidewalk side
  gateSlots: Vec2[];        // 0–2 points on side edges where gates go
  housePivot: Vec2;         // where to place the house body
  houseYaw: number;
}
```

**Bulb lots:** for a house at angle θ on the bulb (θ in radians, math convention), the wedge spans `[θ - π/n_bulb, θ + π/n_bulb]` where `n_bulb = 4`. So each gets a 90° wedge. (We had 60° in the brainstorm — bumping to 90° because there are exactly 4 bulb houses; the wedge edges meet cleanly.) The wedge runs from sidewalk radius to back-fence radius.

**Straight-section lots:** use neighbor midpoints in z. Lot for slot `i` runs from `(z[i-1]+z[i])/2` to `(z[i]+z[i+1])/2` in z, and from `STRAIGHT_LOT_FRONT_X` to `STRAIGHT_LOT_FRONT_X + houseDepth + BACKYARD_DEPTH` in x. End lots clamp to street start/end.

**Gate slots:** every lot gets two gates, one on each side edge, placed at the front-of-house line (matches current behavior but now follows lot edges).

**Yard rendering:** lawn becomes a custom `BufferGeometry` (extruded polygon, 0.01m thick). Fences become wall segments along non-front edges, broken at gate slots.

### 2. Collision system (Phase 1)

Two collider primitives: AABB rectangles (for buildings, fences, props) and line segments (for fences as thin walls — actually we use AABB everywhere for simplicity; fences are thin wide AABBs).

```ts
interface RectCollider {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  minY?: number; maxY?: number;  // for things you can crouch under
  passable?: boolean;             // doors, gates when open
}
```

`buildColliders(houses, lots, props)` produces a flat `RectCollider[]`. We build it once at world-init and store in a Zustand slice (or just module-level).

`collision.resolve(pos, dt, velocity)`:
1. Compute `desired = pos + velocity * dt`.
2. Try X axis only: if circle (radius 0.35) at `(desired.x, pos.z)` overlaps any rectangle, snap to rect edge.
3. Try Z axis only with new x.
4. Return resolved position. (This is the standard "axis-separated AABB sliding" trick — no tunneling at our speeds.)

For ~250 colliders this is O(n) per frame; cheap. We can add a uniform grid bucket later if needed.

### 3. Camera rig (Phase 1)

Drop `OrbitControls`. New `CameraRig` stores:

- `yaw`, `pitch`, `distance` in a ref (camera offset spherical from player).
- `targetYaw` / `targetPitch` (where the cam is *settling toward*).
- Mouse listeners on the canvas:
  - **Right-mouse drag** → adjust target yaw/pitch (does NOT use pointer lock; sensitivity ~0.005 rad/px).
  - **Wheel** → adjust target distance (3–18m).
  - When idle and player is moving forward, `targetYaw` slowly relaxes toward `playerYaw + π` (camera behind).
- Each frame: lerp `yaw → targetYaw` etc. Compute `desiredPos = playerPos + spherical(yaw, pitch, distance)`.
- **Camera collision:** raycast from `playerPos + (0, 1.5, 0)` toward `desiredPos`. If a collider blocks, place camera at hit-point - 0.3m. (Use the same `RectCollider[]`; we treat them as 3D boxes with default height 6m.)
- Camera looks at `playerPos + (0, 1.5, 0)`.

### 4. The hero house: 10600

Real-life context: 10600 Royal Tara Cv was Zak's family home, 1-story Avery Ranch tract built ~2004. Without WCAD scraping in the loop, we model it as 1750 sqft single-story, 4-bed/2-bath, with a south-facing front (matches the bulb angle 120° → west-northwest in our coords).

**Exterior upgrades vs other houses:**
- 16m × 14m footprint (vs 13×12 default).
- Stone-and-stucco mix on front facade (limestone wainscot 1.4m, stucco above).
- Hipped front roof (not pure gable) — adds a small front-facing bay.
- Two-car garage with proper panel details, recessed.
- Covered front porch with two square columns and a porch ceiling.
- Bay window in front (great room).
- Texas flag pole in front yard.
- Address numbers in copper on stone wainscot.

**Interior** (walkable, 1-story):
- Foyer (with closet door, mostly cosmetic)
- Great room (couch, coffee table, TV on stand, ceiling fan)
- Open kitchen with island, 4 bar stools, fridge, stove, sink, pendant lights
- Hallway leading back
- Master bedroom (Dad's): king bed, dresser, ceiling fan
- Penny's bedroom: twin bed with pink quilt, desk with laptop, bookshelf with books, polaroid wall, soccer ball
- Luke's bedroom: twin bed with blue dinosaur quilt, toy chest, Lego pile, race-car rug
- Bathroom (cosmetic — door visible from hall)
- Patio out back with patio set + grill

**Interior implementation:** all walls are colliders. Doors are `Door.tsx` instances with `passable` toggled by an `E` keypress when player is within 1.5m. Furniture is collider-blocking (you can't walk through the bed; you can walk around it).

### 5. Other houses (peek-in stubs)

Each non-hero house gets:
- Front door that *opens* (animation only; no walkable interior).
- Through the open door, a single backlit room with a couch silhouette and warm light. Cheap: one box geometry + one PointLight, conditional render based on player distance < 25m.
- Better window glow at night.

### 6. Yard props

Per-lot props placed deterministically from a hash of the address:

| Prop | Probability | Placement |
|---|---|---|
| Truck (F-150) | 0.45 | Driveway |
| Sedan | 0.35 | Driveway (mutually exclusive with truck) |
| Basketball hoop | 0.30 | End of driveway, edge |
| Trash bins (2) | 0.55 | Front yard or curb |
| BBQ + patio set | 0.70 | Backyard |
| Garden bed | 0.40 | Front foundation |
| Hose reel | 0.40 | Side of house |
| Bike | 0.25 | Driveway or porch |

Hero house (10600): basketball hoop yes, BBQ + patio yes, kids' bikes yes, F-150 in driveway.

### 7. Vegetation

- **Live oaks**: 1–2 per lot, big (8–12m tall), instanced leaf clusters with subtle wind on a vertex shader OR sine-bobbing rotation per cluster.
- **Crepe myrtles**: small ornamentals, magenta blooms.
- **Hedges**: low (0.6m) along select foundations.
- **Grass blades**: instanced cones (~5000 across the world, near walking paths only — culled by distance from active character).
- Mulch beds (dark brown rounded rectangles at foundation).

### 8. Materials & textures (procedural)

All generated in `textures.ts` via `OffscreenCanvas` → `THREE.CanvasTexture`. No external image files. Generators:

- **Brick** — red brick with mortar lines, slight noise.
- **Limestone wainscot** — Texas tan, stone block pattern.
- **Stucco** — beige/cream with subtle bumpy noise.
- **Asphalt** — dark gray, fine speckle, faint cracks.
- **Concrete** — light gray, larger speckle.
- **Grass** — overhead mottled greens, varies per region (dry patches near sidewalks).
- **Roof shingles** — repeating 3-tab pattern, subtle row variation.
- **Wood planking** — fence-board grain, with horizontal nail lines.

Textures are tiled with `repeat.set(...)` proportional to mesh size. Use `MeshStandardMaterial` with normal-map approximation (a flat normal generated alongside the diffuse where needed — mostly skip for performance and rely on baked-in shadows).

### 9. Lighting & sky

- Replace `<Sky>` from drei with a sky shader (or stick with drei `<Sky>` with sunset preset for warmer tones).
- Add `<Environment preset="park">` for cheap reflections on windows/cars.
- Directional sun at slightly warmer temp (`#fff0d0`), increased shadow map (4096 if perf allows).
- Hemisphere light tinted from Texas summer sky (cyan-up, dry-grass-down).
- Optional: time-of-day rotates sun every ~5 minutes (off by default; toggle with `T`).

### 10. Player & controls

- WASD / arrows = move, camera-relative.
- Shift = sprint.
- Space = jump.
- **E** = interact (open/close nearest door, sit on patio chair, etc. — phase 1 only doors).
- **1/2/3** = switch character.
- Right-mouse drag = look around.
- Wheel = zoom.
- **R** = reset to spawn (safety).
- Idle anim: subtle breathing scale on torso.
- Walk anim: leg swing using sine on x-axis rotation; arm counter-swing.

### 11. UI

- Existing `WelcomeScreen` and `ControlsHud` keep working.
- Update controls hud to reflect new bindings (E, R, right-drag).
- Add small "Press E" prompt when standing near an interactable.

### 12. Performance budget

Target: 60fps on a M1 MacBook in Chrome. Levers:
- Instance fence pickets (hundreds of thin boards) via `<Instances>`.
- Instance grass blades, cull by distance.
- One shared material per category (don't create per-mesh).
- Single shadow-casting directional light only; props use `castShadow={false}` for tiny stuff.
- Disable shadows on grass blades and leaf clusters.
- Lazy-load interior of 10600 only when player within 30m or with a `useState(true)` opt-in.
- Avoid `MeshPhysicalMaterial` (transmission) except for car windows and house glass — and only at close distance.

## Build sequence

This is the order I'll implement. Each step is independently runnable and committable.

1. **Lot polygons + new yards.** Replace `Yard.tsx` rendering. Bulb wedges + straight rects with neighbor midpoints. Verify visually that fences no longer overlap.
2. **Collision system.** Build colliders from houses + fences. Integrate into `PlayerController`. Verify you can't walk through anything.
3. **Follow camera rewrite.** Custom rig with mouse drag + wheel zoom + behind-character relax + camera-collision raycast.
4. **Procedural textures + shared materials.** Replace flat colors on ground, street, sidewalk, walls, roof.
5. **House upgrades.** Better window frames, deeper garage panels, hipped-roof option, porch step on front door.
6. **Hero house exterior** (10600 special geometry, porch, bay window, flagpole).
7. **Hero house interior.** Floorplan walls, doorways, three bedrooms, kitchen, great room, bathroom.
8. **Door interaction.** `E` to open, animation, passable collider toggle.
9. **Yard props.** Trucks, BBQs, hoops, bins, bikes — placed by address hash.
10. **Vegetation.** Live oaks, crepe myrtles, hedges, mulch beds. Instanced grass blades.
11. **Lighting & sky polish.** Environment, warmer sun, hemisphere tint.
12. **Character animation.** Walk/idle.
13. **HUD updates + Press-E prompts.**
14. **Verify build + dev server + commit.**

## Open questions / future work (not in this spec)

- Other-house walkable interiors → defer to v2.
- Audio (cicadas, sprinklers) → defer; would be fun but requires asset pipeline.
- Day/night toggle UI → stub the system, leave at "noon."
- Mobile/touch controls → defer.
- Real WCAD data scraping → defer; use family-remembered values for 10600.
- Penny + Luke walking around as autonomous NPCs when not the active char → defer (they currently stand in place).

## Risks

- **Performance:** instancing not done right could tank framerate. Mitigation: profile after vegetation + props pass; cull aggressively.
- **Collision tunneling:** at sprint speed (~8m/s) over 1/60s = 0.13m, well under 0.35m circle radius. Should be fine.
- **Texture memory:** 10 procedural 512×512 textures = ~10MB. Acceptable.
- **Door interaction discoverability:** Add the "Press E" prompt clearly.
