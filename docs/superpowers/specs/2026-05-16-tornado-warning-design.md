# Tornado Warning (v15) — second game mode

A second selectable game mode on the Royal Tara Cove welcome screen. The player must survive a tornado tearing down the cul-de-sac by reaching the first floor of 10600 before it arrives. Weather builds from calm → rain → hail → tornado-approach → arrival, with houses progressively destroyed and a comical ragdoll-throw on failure.

Sister to the existing **Alien Invasion** (Schmorgesblobs) game.

## Goals

- Player picks one of two games from the welcome screen.
- Tornado mode is its own self-contained game loop with weather phases, a moving tornado, house destruction, win/lose, and a cinematic defeat throw.
- Atmosphere is cinematic and emotionally satisfying — rain you can hear, sky darkening, tornado roar getting louder, camera shake.
- "Realistic" within the engine's voxel-cartoon style: stylized but cohesive. **Not** physics-grade simulation.
- All three family members (Dad, Penny, Luke) stick together — only the active character's position decides win/lose.

## Non-goals

- Multi-tornado, multi-storm.
- Per-character independent survival.
- Particle effects with hundreds of thousands of instances. Targets are mid-range laptop (60 fps at 1080p).
- Editing mode-shared infrastructure (PlayerController, CameraRig, NPCController) beyond a one-line `gameMode` gate where strictly necessary.

## Architecture

### State

`src/state/gameStore.ts` (extend):
```ts
type GameMode = 'aliens' | 'tornado';
type TornadoPhase =
  | 'calm' | 'rain' | 'hail' | 'tornado-approach' | 'tornado-arrived';
type GamePhase =
  | 'pre-intro' | 'intro' | 'combat' | 'victory' | 'defeat' | TornadoPhase;

gameMode: GameMode;                            // chosen on welcome screen
setGameMode(m: GameMode): void;

destroyedHouses: Record<string, number>;       // address → destroyedAt seconds
markHouseDestroyed(address: string): void;

ragdoll: {
  active: boolean;
  startedAt: number;
  originX: number; originY: number; originZ: number;
} | null;
startRagdoll(x: number, y: number, z: number): void;
clearRagdoll(): void;
```

`src/state/tornadoStore.ts` (new):
```ts
phaseEnteredAt: number;                        // perf.now()/1000 when phase began
tornadoZ: number;                              // world Z of tornado base, -110..+20
stormIntensity: number;                        // 0..1, drives sky/lights/fog/rain
windStrength: number;                          // 0..1
```

Two stores because tornado-specific atomic per-frame mutation shouldn't trigger React re-renders in unrelated subscribers. `tornadoStore` is updated via direct `useStore.setState` from `TornadoController` (no selector subscriptions outside the relevant components).

### Welcome screen

`src/ui/WelcomeScreen.tsx` (rewrite):
- Two large cards side-by-side, each with emoji, title, blurb, "Let's play ▶" button.
- Picking **Alien Invasion**: calls `setGameMode('aliens')`, then `closeWelcome()` — current flow unchanged.
- Picking **Tornado Warning**: calls `setGameMode('tornado')`, then `closeWelcome()`, then `setPhase('calm')` — skips the intro cinematic; tornado mode has its own pacing.

Mobile responsive: stacked vertically on narrow viewports.

### Controllers (gated by gameMode)

Every existing controller in `src/systems/*Controller.tsx` and the weapon/projectile/pickup/wave/blob/PowerUp systems get a one-line early return:

```ts
if (useGameStore.getState().gameMode !== 'aliens') return;
```

Inside their `useFrame` body, top of function. Pure short-circuit. No structural change.

Affected files (alphabetical): `BlobController`, `CombatController`, `PickupController` (if exists, otherwise `pickups/PickupsLive`), `PowerUpController`, `ProjectileController`, `SidekickController`, `WaveController`, `UFOCrash`, `RayGun`, `PennyBomber`, `LukeLegoLauncher`, `KidBlaster`, `Beams`, `BlobRenderer`, `SplatRenderer`, `HitParticles`, `BackyardPortal`, `MusicController` (or split by mode), `VictoryOnly`, `Fireflies`. Wherever the gate makes sense — the goal is "no combat artifacts during tornado mode."

New tornado-only controllers/components mount conditionally in `Game.tsx`:
```tsx
{gameMode === 'tornado' && (
  <>
    <TornadoController />
    <WeatherController />
    <RagdollController />
    <Tornado />
    <Rain />
    <Hail />
    <Lightning />
    <TornadoHud />
  </>
)}
```

### TornadoController

`src/systems/TornadoController.tsx` (new). Headless.

Drives phase progression and tornado motion. State machine:

| Phase | Duration | Transitions to | What this controller does |
|-------|----------|----------------|---------------------------|
| `calm` | 10s | `rain` | Set stormIntensity=0, tornadoZ=-200 (hidden) |
| `rain` | 20s | `hail` | Lerp stormIntensity 0→0.55 over 5s. Wind 0→0.3. |
| `hail` | 15s | `tornado-approach` | stormIntensity 0.55→0.9. Wind 0.3→0.7. Tornado materializes at z=-110 over last 3s (alpha 0→1). |
| `tornado-approach` | 60s nominal | `tornado-arrived` when tornadoZ ≥ 18 | tornadoZ lerps from -110 to 20 linearly. As it crosses each non-hero house's pivot (±6m radius), mark that house destroyed. stormIntensity → 1.0. Wind → 1.0. |
| `tornado-arrived` | (instant decision) | `victory` or `defeat` | Read active character position via gameStore. Inside hero house AABB → `victory`. Else → `defeat` and `startRagdoll(pos.x, pos.y, pos.z)`. |
| `victory` | (replay-able) | `pre-intro` on replay | Lerp stormIntensity 1→0 over 6s. Tornado fades. Show victory HUD. |
| `defeat` | 4s ragdoll | `pre-intro` on replay | RagdollController takes over. Show defeat HUD at end. |

On phase entry, write `tornadoStore.phaseEnteredAt = perf.now()/1000`.

### WeatherController

`src/systems/WeatherController.tsx` (new). Headless. Each frame:
- Read `phase` and `stormIntensity` from stores.
- Update `useGameStore.tornadoStore` derived values (e.g., `lightningCue` boolean — set true once per random interval during hail+).
- Drives the audio gain for rain/wind/siren/roar loops via `audio.ts` helpers.

### Visual components

**`Tornado.tsx`** (new): 12 tapered cylinders stacked along Y axis. Each cylinder rotates around Y at increasing angular velocity from base to top (0.3 rad/s at bottom → 4 rad/s at top). Funnel widens with height: base radius 0.8m at y=0, top radius 4m at y=18. Color: lerp from `#3a3a3c` at base to `#7a7a82` at top. Wrapped by an InstancedMesh of ~80 debris boxes (varied colors: brown plank, grey shingle, white siding) orbiting the funnel at varying heights and radii (radius = 1.5 + height*0.25, plus random jitter). Whole `<group>` positioned at `[0, 0, tornadoStore.tornadoZ]`. Opacity ramps from 0 to 1 during last 3s of hail phase.

**`Rain.tsx`** (new): `<lineSegments>` with BufferGeometry. ~2500 line segments, each 0.6m long. Each frame: subtract `dy * dt` from each Y (where `dy = 28` m/s + windStrength * 6). When Y < 0, recycle to spawnY (32m above player) with a fresh X/Z within ±40m of player. Slight X drift = windStrength * 4 m/s. Material: `LineBasicMaterial({ color: '#b8d0e8', transparent: true, opacity: 0.42 })`. Density (visible alpha) scales with stormIntensity (multiplied by `min(stormIntensity * 1.8, 1)`).

**`Hail.tsx`** (new): `InstancedMesh` with 350 small white spheres (radius 0.06m). Same gravity/respawn as rain. Rotational tumble via per-instance random axis. Only visible during `hail` + later phases. Plays hail-tick audio (sampled at low rate, 8/s) when stormIntensity high and player is at ground level (not jumping).

**`Lightning.tsx`** (new): Mounts a fullscreen quad behind everything that goes white opacity 0.85 → 0.3 → 0 over 3 frames. Triggered by `tornadoStore.lightningCue` (a counter that increments; component watches and flashes on change). Coincident thunderclap audio after random 0.4-1.8s delay. Frequency ramps with phase: 0 in calm/rain, 1 every 7s in hail, 1 every 4s in tornado phases.

**`weather/Wind.tsx`** could be added later (leaf particles, tree sway). Not in v1 — would touch too many components. Audio + camera shake will sell it.

### House destruction

`src/world/houseDestruction.ts` (new): pure helper exporting `destructionProgress(address: string, now: number): number` returning 0..1 based on `destroyedHouses[address]` + (now - that).

`House.tsx` (modify, for non-hero houses): in a `useFrame`, read `destructionProgress`. Apply transforms:
- 0..0.3: roof drops in Y by `progress * 1.5m` and rotates 30°
- 0.3..0.7: walls scale Y from 1 → 0.15
- 0.7..1.0: dust burst particle emitted (one-shot) + collider becomes a 1m-tall rubble box

For visual, simplest: a single `<group>` scaling Y to 0.1 over the duration, with a separate "rubble" mesh that fades in (low brown box) so something stays visible. Roof handled by a separate scaling on its own subgroup.

Audio cue fired once per destroyed house: layered crack + boom + dust via `audio.ts::houseCollapse(distance)`.

Hero house (10600) is **never** added to `destroyedHouses` — the tornado either kills the player (defeat → ragdoll) or whiffs (victory).

### RagdollController + cinematic throw

`src/systems/RagdollController.tsx` (new). Headless. Active only when `gameStore.ragdoll.active`.

Each frame, given `t = now - startedAt` in seconds (0..4):
- Compute new player position:
  - `y = origin.y + 22 * sin(t * Math.PI / 4)` — parabolic, peaks at t=2s, returns to ground at t=4
  - Spiral around tornado center `(0, 0, tornadoZ)`:
    - `theta = t * 4` (radians, spinning fast)
    - `radius = 2 + t * 6` (grows outward)
    - `x = tornadoCenterX + radius * cos(theta)`
    - `z = tornadoZ + radius * sin(theta)`
  - `scale = 1 - t / 4` — shrinks to 0 (the active character's `<Character>` mesh scale)
  - Write yaw = `t * 8` (extra spin)

Writes the active character's position back to `gameStore.positions`. The character renderer naturally follows.

Camera enters cinematic mode for the ragdoll: cinematic.target = player position (lerps), cinematic.camera = `(targetX + 14*cos(t), 8, targetZ + 14*sin(t))` (orbits to give the throw a 3D feel).

At `t >= 4`:
- `clearRagdoll()`
- `setPhase('defeat')`
- Whoosh audio fades out

### TornadoHud

`src/ui/TornadoHud.tsx` (new). Reads phase + tornado state. Renders:
- **Calm phase**: top-center "🌪️ TORNADO WARNING — get inside 10600 when the storm hits!"
- **Rain/hail**: a subtle "⚠️ Storm building" badge top-right
- **Tornado-approach**: countdown "TORNADO IMPACT IN 0:42" computed from `(20 - tornadoZ) / windFromTornado` (with the tornado's actual speed). Also a directional arrow pointing toward 10600 if player isn't inside.
- **Victory**: fullscreen overlay "🌈 You Survived!" with retry + back-to-menu buttons.
- **Defeat**: fullscreen "🌪️ Carried away by the storm!" + retry + back-to-menu.

Hides during alien-invasion mode (returns null if `gameMode !== 'tornado'`).

### Audio

`src/audio.ts` extensions (all procedural — no new sample files):

```ts
// Phase-driven loops:
startRainLoop() / stopRainLoop() / setRainVolume(v)
startWindLoop() / setWindVolume(v)
startSirenLoop() / setSirenVolume(v)
startRoarLoop() / setRoarVolume(v) / setRoarPitch(p)

// One-shots:
hailTick(panX: -1..1, pitch: 0.8..1.2)
lightningStrike(distance: 0..1)   // distance affects delay before rumble
houseCollapse(x, z)               // play once; volume by distance to active char
ragdollWhoosh()                   // looping whoosh while ragdoll active
fadeAllTornadoAudio(duration)     // for victory/cleanup
```

Buffer-source-based loops created on first use. Volume/pitch controlled via `GainNode` + `playbackRate`. All routed through one `tornadoGroup` GainNode so victory can `fadeAllTornadoAudio` cleanly.

`audio.ts::unlockAudio()` already runs on first gesture — no additional unlock needed.

### Sky + lighting

`Game.tsx` already has `DynamicSky` and `DynamicLights`. Modify them to read `tornadoStore.stormIntensity`:
- DynamicLights: ambient/hemi intensity × `(1 - 0.85 * stormIntensity)`, sun shifts toward grey + dims more aggressively.
- DynamicSky: turbidity += stormIntensity * 8, rayleigh += stormIntensity * 4, sun position pushed below horizon as stormIntensity nears 1 (so sky reads near-black).
- Add `<fog attach="fog" color="#3a3a40" near={20 - stormIntensity*5} far={120 - stormIntensity*60} />` to `<Canvas>` scene (mounted in `Game.tsx`).

### Camera shake

Existing `useCombatStore.shake` is set by combat. For tornado, write to it from `TornadoController`:
- `shake = clamp(0.4 / (1 + dist/8) , 0, 1.2)` where `dist = |player.z - tornadoZ|`
- Lightning bursts: `shake += 0.6` (one frame)

## Replay flow

Victory and defeat HUDs each have:
- **"Try again"** → reset game state to phase=`calm`, tornadoZ=-200, clear destroyedHouses, clear ragdoll, reset positions, replay.
- **"Back to menu"** → reset game state, set `welcomeOpen = true`, phase = `pre-intro`.

Reset helper in `gameStore`: `resetTornadoGame()` that clears all tornado-mode state.

## Edge cases

| Concern | Handling |
|---------|----------|
| Player switches character (1/2/3) during tornado | Allowed; the active character at the moment of `tornado-arrived` is the one checked. NPCs follow (existing logic), so usually all three are together. |
| Player hides on the loft (upper floor of 10600) | The "inside hero house" AABB doesn't care about floor; loft is inside the bounds → counts as a save. Intentional — climbing stairs to safety feels good. |
| Player exits 10600 mid-arrival, then dives back in | We read position only at the transition to `tornado-arrived`; if you're outside the AABB at that moment, defeat. Adds tension. |
| Mode switch on welcome → previously had aliens running | `resetTornadoGame()` is also called by `setGameMode` to guarantee a clean slate. Same goes for `aliens` mode reset on switch. |
| Browser audio gesture not yet given when tornado starts | All audio is silent; phase still progresses. Player who clicked the canvas to enter FPS pointer-lock already unlocked audio, so this is unlikely. |
| Cinematic from alien intro is preserved? | The alien intro cinematic only fires in aliens mode (UFO crash). Tornado mode has its own atmosphere; cinematic override only used for ragdoll throw. |
| Player on roof / on top of garage | "Inside" check uses 3D AABB — roof y > house maxY, so not counted as inside. Player has to be on ground floor or loft. |

## File map

**New:**
- `src/state/tornadoStore.ts`
- `src/ui/WelcomeScreen.tsx` (rewrite)
- `src/ui/TornadoHud.tsx`
- `src/systems/TornadoController.tsx`
- `src/systems/WeatherController.tsx`
- `src/systems/RagdollController.tsx`
- `src/components/Tornado.tsx`
- `src/components/weather/Rain.tsx`
- `src/components/weather/Hail.tsx`
- `src/components/weather/Lightning.tsx`
- `src/world/houseDestruction.ts`

**Modified:**
- `src/state/gameStore.ts` (extend with gameMode, destroyedHouses, ragdoll, resetTornadoGame)
- `src/components/Game.tsx` (mount tornado components conditionally; pass stormIntensity to sky/lights)
- `src/components/House.tsx` (read destructionProgress, apply transforms)
- `src/audio.ts` (extend with new loops + one-shots)
- All existing combat-only controllers/components (one-line `gameMode === 'aliens'` early-return gate)

## Implementation order (recommended)

1. **State + mode plumbing**: gameStore extension, tornadoStore, gate combat controllers, basic mode awareness. Nothing visual yet — alien mode still works.
2. **Welcome screen with selector**: pick between modes; tornado mode loads but shows the calm cul-de-sac with no weather.
3. **TornadoController + phase machine**: phases tick on a timer, no visuals or audio yet, just state.
4. **Weather: Rain.tsx + DynamicSky/Lights driven by stormIntensity** — see clouds darken + rain fall.
5. **Hail + Lightning + procedural storm audio** — full storm buildup.
6. **Tornado.tsx visual + motion down the street** — see the funnel approach.
7. **House destruction** — houses collapse as tornado reaches them.
8. **Win/lose detection + TornadoHud (victory/defeat screens)** — game has an outcome.
9. **RagdollController + cinematic throw** — defeat has its comical sendoff.
10. **Polish pass**: tuning, camera shake, NPC follow nudge, audio mix.

Each step is independently shippable and testable.

## Test plan (post-implementation)

1. Open welcome screen. Two cards visible. Click "Alien Invasion" → existing game plays unchanged.
2. Reload. Click "Tornado Warning". Spawn in cul-de-sac. Calm sky. Tooltip visible.
3. Wait 10s. Sky darkens. Rain begins. Audio swells.
4. Wait 20s. Hail joins. Lightning flashes. Siren audible.
5. Wait 15s. Tornado funnel materializes at street entrance. Slowly approaches.
6. As tornado reaches each house, that house collapses (visual + audio).
7. Run inside 10600 before the tornado arrives. Watch the funnel pass over you from the bay window. Victory screen.
8. Replay. This time, stay outside. Tornado arrives. Player ragdolls into a spiral, shrinks, defeat screen.
9. Switch character mid-tornado-approach (press 2). Penny becomes active. Continue play.
10. `npm run build` clean.

## Out of scope (deferred)

- Tornado physics on debris (kinematic only; no real-world physics)
- Per-character independent ragdoll (only active character dies; NPCs vanish with them)
- Variable tornado paths or random starts
- Tornado wraps around the cul-de-sac (linear path only in v1)
- Hail dents on houses
- Persistent damage (state resets on replay)
