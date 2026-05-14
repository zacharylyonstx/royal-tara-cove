# Combat & Aliens v2 — Juice Pass

**Date:** 2026-05-14
**Status:** Approved (--full-auto)

## What's wrong with v1

User feedback:
- **Ray gun doesn't stay in the hand.** It renders at a stale position because the active character's Vector3 is mutated (not React state), and the gun is rendered outside the character group. It also points the wrong way — `rotation = yaw + π` instead of `yaw`.
- **The UFO crash is underwhelming.** Descent + plummet + smoke columns, but no spark trail during fall, no flash, no debris, no camera shake. Crater is static.
- **Audio is flat.** Single noise burst + one sub-bass thump. No layered descent whine, no sustained smoke crackle, no secondary booms.
- **Schmorgesblobs are too cute.** Round gel + googly eyes don't read as menacing. They should also feel more *alien*: tentacles, glowing weak spot, attack telegraph.
- **No combat feedback.** No crosshair, no screen shake when hit, no flash when the player takes damage.

## Fixes (this pass)

### 1. Ray gun: live attachment

`RayGun.tsx` switches to a `useFrame` group-ref pattern (the same pattern `Character.tsx` already uses to follow position refs):

```tsx
const groupRef = useRef<Group>(null);
useFrame(() => {
  const pos = positions[activeId];
  const yaw = yaws[activeId];
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const wx = pos.x + HAND_X * cy + HAND_Z * sy;
  const wz = pos.z - HAND_X * sy + HAND_Z * cy;
  const g = groupRef.current!;
  g.position.set(wx, GUN_Y + bob(state.clock.elapsedTime), wz);
  g.rotation.y = yaw;  // not yaw + π
});
```

Rotation correction: `gun.rotation.y = playerYaw` makes the gun barrel (which extends in local −Z) align with the player's forward (−Z after the same yaw rotation). The bob term adds a subtle 0.02m vertical sway tied to player horizontal speed (using last-frame position delta) so the gun moves with the walk anim.

### 2. UFO crash juice

`UFOCrash.tsx` gets:

- **Descent spark trail** — emitter at the UFO's underside emits small glowing orange points that fall behind it.
- **Shock-ring flash** — at impact, instantiate an expanding `<ringGeometry>` mesh that grows from 0 → 8m radius in 0.4s, fading to transparent.
- **Bright flash sphere** — at impact, instantiate a sphere `meshBasicMaterial color #ffeed4` that scales 0.5 → 4 in 0.15s and fades.
- **Debris** — six small spinning cubes/wedges thrown radially with parabolic Y, 1.2s lifetime.
- **Rising smoke columns** — replace the static spheres with `<Points>` particles that rise + fade; ember particles in the column.
- **Sustained crater glow** — orange `<pointLight>` inside the crater (slow flicker).
- **Camera shake** — store-driven shake amount that the camera rig reads each frame and adds to the camera position as random offset; triggered on impact (0.5s, magnitude 0.4 → 0).

### 3. Audio layers

`audio.ts` additions:

- `ufoDescend()` — a 4-second oscillator pair (descending saw + tremolo'd square) for the descent whine. Plays at intro start.
- `ufoCrash()` — keep existing noise burst + thump; chain a *second* longer thump 0.25s later for double-impact feel.
- `crackleLoop()` — a tape-noise loop driven by a `BufferSourceNode` with `loop = true`. Started at impact, stopped at victory/defeat.
- `damageHit()` — short distorted square blip for when the player takes damage.
- `gunWind()` — quick rising-sweep blip when the ray gun appears (combat phase start).

### 4. Schmorgesblob redesign

`Schmorgesblob.tsx` rewritten as a multi-part rig:

- **Main body** — translucent sphere with `MeshPhysicalMaterial` (transmission 0.35, slightly rough, emissive glow from below). The body is shaped a bit more elongated vertically when idle, squashed during hops.
- **Glowing core** — a small inner emissive sphere that pulses (intensity sine). Acts as the visual "weak spot."
- **Two googly eyes** — bigger sclera, pupil tracks the active player.
- **Three tentacles** — short cylinders dropping from the underside that wiggle with a sine offset per tentacle (so they're not in sync).
- **Mouth** — a downturned arc made from a torus segment that opens (rotation pivot) during attack telegraph.
- **Hat-spike antennae** — two angled spikes with glowing tips.

Animation states:
- `idle` — body bobs (Y position) + wobble (XZ scale).
- `hop` — Y arc + brief stretch (Y scale to 1.3) at takeoff.
- `attack-telegraph` — body squashes down, mouth opens, glow core flashes red. 0.25s before the actual hit.
- `damaged` — color shifts toward red + body flash for 0.15s.
- `die` — Y scale → 0 in 0.4s, then spawn an exaggerated `GooSplat` with 6 splat-dot satellites.

### 5. Combat HUD / feel

- **Crosshair** — centered `<div>` with a stylized "+" graphic (CSS only, no canvas). Visible only in combat phase.
- **Damage flash** — full-screen red overlay (CSS `<div>`) that fades from 0.5 → 0 in 0.5s when `playerHp` decreases.
- **Camera shake on damage** — small magnitude shake (0.15 → 0 over 0.3s).
- **Camera shake on UFO impact** — larger (0.4 over 0.6s).
- **Beam halo** — beam mesh gets a second concentric translucent cylinder slightly larger with low opacity to look like a glow halo.
- **Muzzle flash** — small light + bright disc at the gun tip for ~0.08s after firing.

## Architecture

```
src/state/combatStore.ts        # ADD: shakeAmount, shakeDecay; addShake(n, dur)
                                # ADD: damageFlashAt

src/audio.ts                     # ADD: ufoDescend, crackleLoop start/stop,
                                #      damageHit, gunWind, layered ufoCrash

src/components/weapons/RayGun.tsx  # REWRITE: useFrame group ref, correct yaw,
                                   #         bob with motion, muzzle flash
src/components/weapons/MuzzleFlash.tsx # NEW

src/components/aliens/Schmorgesblob.tsx  # REWRITE multi-part rig
src/components/aliens/UFOCrash.tsx       # ADD spark trail, flash, ring,
                                          # debris, smoke particles
src/components/aliens/CrashFX.tsx        # NEW — flash, ring, debris,
                                          # crater glow lights
src/components/aliens/SmokeColumn.tsx    # NEW — animated points

src/systems/CameraRig.tsx        # ADD shake offset read from combatStore
src/ui/Crosshair.tsx             # NEW
src/ui/DamageFlash.tsx           # NEW
```

## Sequence (gameplay)

```
Click "Let's play!"
  → unlockAudio
  → phase=intro
  → ufoDescend() starts (audible whine)
  → UFO descends from 80m, with spark trail
  → at t=4.0, plummet begins
  → at t=4.6, impact:
      - ufoCrash() plays (layered noise + thump + secondary)
      - crackleLoop() starts (sustained crackle)
      - addShake(0.4, 0.6)
      - spawn flash sphere + shock ring + 6 debris fragments
      - crater appears with point-light glow
  → at t=6.2, phase=combat
      - gunWind() plays
      - RayGun becomes visible, glued to the active char's hand
      - Crosshair appears
      - BlobController begins spawning 8 schmorgesblobs from UFO hatch
combat:
  click → laserZap() + spawn beam (with halo) + muzzle flash
  blob hit → damaged anim, particle burst
  blob death → die anim + dramatic splat
  blob attack → damagePlayer(1), damageHit(), screen red flash, addShake(0.15, 0.3)
victory: stop crackleLoop, fanfare
defeat: stop crackleLoop, sting
```

## Risks

- **Points-based smoke** can spike GPU on lots of particles. Cap to ~120 particles per column, ~3 columns.
- **MeshPhysicalMaterial transmission** is expensive. We already use it for blobs; with 8 blobs + redesign the cost adds up. We'll measure; can downgrade to `MeshStandardMaterial` with subtle emissive if perf hits.
- **Camera shake** can cause motion sickness — keep it short and small.
- **CrackleLoop** must be stopped reliably on phase changes or it bleeds into win/lose.

## Out of scope

- Multi-wave / boss.
- Penny + Luke shooting alongside.
- Ammo / reload mechanic.
- Multiple weapons.
