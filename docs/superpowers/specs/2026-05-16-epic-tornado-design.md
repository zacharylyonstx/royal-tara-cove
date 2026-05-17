# Epic Tornado (v17) — 23.46× upgrade

Take the v16 tornado and crank every dimension to absurdity. User-pleasing
realism + kid-pleasing humor.

## Goals

- The tornado reads as an **F5 mega-storm**, not just one swirling cylinder.
- The player **feels** the storm in the controls (wind drag) and the camera
  (shake + vignette + slow-mo).
- The game opens cinematically.
- The defeat-throw lands a memorable visual joke (flying cow, Wilhelm scream).

## Architecture (one mega-commit, in this order)

### 1. Tornado v3 — multi-layer funnel + satellite vortices

`Tornado.tsx` extended:

**Three concentric vapor layers:**
- **Rope core** — inner narrow funnel (TubeGeometry, radius 0.6 → 2.5m), highest opacity, fastest spin
- **Funnel mid** — current TubeGeometry (radius 1.2 → 5.5m), the v16 funnel
- **Halo** — wide soft cylinder mist (radius 3 → 9m), very low opacity, slower spin
- All three share the same shader but with different `layer` uniform tweaking opacity/scroll rate

**Satellite vortices:**
- 3 mini-funnels at scale 0.35 of main
- Orbit around main funnel base at radius 7-11m
- Each spins around its own axis
- Each orbits the main funnel at 0.4 rad/s
- Same shader, lower opacity

### 2. Wall cloud

`weather/WallCloud.tsx` (new):
- Wide flat-bottomed disc at y=18 (above tornado top), radius 14m
- Custom shader: cloud noise + dark grey color + rotating very slowly
- Position: follows tornado X/Z
- Descends from y=24 → y=14 over hail phase, then stays low
- Opacity ramps with stormIntensity

### 3. Wind force on player

`PlayerController.tsx` extension:
- Each frame during tornado phases, compute wind force from active character to tornado:
  - `force = -toward_tornado * windPullStrength * (1 / max(1, dist/6))`
  - Apply as additional velocity to player movement
  - Net effect: walking toward tornado is slower; walking away is faster; standing still drifts toward tornado
- Caps: max wind force = 8 m/s

### 4. Trees bend

`LiveOak.tsx` extension:
- Subscribe to tornadoStore for windStrength + tornado position
- Each tree: rotation.x and rotation.z bend AWAY from tornado direction proportional to windStrength
- Crepe myrtle bends more (smaller tree)
- Bend amount = `windStrength * (1 / max(1, dist/15))` * 0.4 radians

### 5. Vignette + slow-mo near tornado

New `ui/StormVignette.tsx`:
- Fixed-position div with radial gradient (transparent center → black edges)
- Opacity scales with proximity to tornado (closer = darker vignette)
- Activates only when player within 12m of funnel

`TornadoController` extension:
- When player within 6m: set `useCombatStore.slowMo = 0.5` (half-speed)
- When > 6m: restore to 1.0
- Cliff approach: 1-second lerp to slow-mo

### 6. Cinematic intro pan

`TornadoController` extension:
- On `calm` phase entry, run an 8-second cinematic:
  - Start: camera high up (y=40, looking down at the cul-de-sac from south)
  - Mid: slow sweep showing clouds gathering (camera circles 180°)
  - End: descend smoothly to player's eye level + position
- Use existing `cinematic` override
- After 8s, restore normal FPS control

### 7. Ragdoll polish — flying cow + Wilhelm scream

`RagdollController` extension:
- On ragdoll start: play a Wilhelm-scream-like procedural shout (oscillator + filter sweep)
- Spawn 1-3 "comic debris" instances that fly past camera: a cow, a Santa, a trampoline (low-poly meshes), positioned to swing past the camera over the 4s throw
- "Moo" audio when cow is closest

`weather/RagdollComedy.tsx` (new):
- Renders the cow/Santa/trampoline meshes orbiting the ragdolling player
- Mounts only when `ragdoll.active`

### 8. First-person ragdoll camera

`RagdollController` extension:
- Instead of orbital cinematic, the camera stays AT the player's position + small offset
- yaw/pitch spin with the player
- Far more disorienting + fun (you SEE the world spinning around you)

## File map

**New:**
- `src/components/weather/WallCloud.tsx`
- `src/components/weather/RagdollComedy.tsx`
- `src/ui/StormVignette.tsx`

**Modified:**
- `src/components/Tornado.tsx` — multi-layer funnel + satellite vortices
- `src/systems/TornadoController.tsx` — intro cinematic + slow-mo + vignette trigger
- `src/systems/RagdollController.tsx` — first-person + Wilhelm + cow trigger
- `src/systems/PlayerController.tsx` — wind drag
- `src/components/vegetation/LiveOak.tsx` — tree bending
- `src/components/vegetation/CrepeMyrtle.tsx` — same
- `src/audio.ts` — Wilhelm scream + cow moo
- `src/App.tsx` — mount StormVignette
- `src/components/Game.tsx` — mount WallCloud + RagdollComedy

## Out of scope (v18+)

- Speech bubbles over NPC kids
- Power line sparks
- TV broadcaster voice
- Cars actually flipping
- Mailboxes ripped from posts
- Pressure-drop sound
- Cloud-to-cloud lightning visualized

## Test plan

1. Load tornado game.
2. **Cinematic intro plays** — 8s sweep of cul-de-sac with darkening clouds.
3. Storm builds normally. **Wall cloud descends** during hail phase.
4. Tornado materializes. **Tornado looks WAY beefier**: multi-layer vapor, 3 satellite vortices orbiting the base.
5. Walk around. **Trees bend** dramatically. **Wind tugs** the player toward the funnel (slower walking AT, faster walking AWAY).
6. Get within 12m of funnel. **Vignette** darkens screen edges.
7. Get within 6m. **Slow-mo** kicks in.
8. Walk into funnel. **Wilhelm-scream** plays. **Camera goes first-person** spinning. **A cow flies past**. Defeat screen at end.
9. `npm run build` clean.
