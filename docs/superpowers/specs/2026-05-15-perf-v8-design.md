# Performance v8 — 14fps → 60fps

**Date:** 2026-05-15
**Audience:** Penny (8) and Luke (6) playing the game with their dad.

## Diagnosis

Measured in browser:

| Metric | Now |
|---|---|
| FPS | **14.6** |
| JS heap (used / total) | 129 MB / 206 MB |
| JS bundle | 1.4 MB single chunk |
| Shadow map | **4096 × 4096** (~32 MB GPU) |
| Live `<pointLight>` count | ~30 (each blob, pickup, firework, firefly, disco light, lamp) |
| `useFrame` call sites | 83 |
| `Environment preset="park"` | active (large HDR + IBL eval per pixel) |

The pixel pipeline is the bottleneck: every material in three.js evaluates
**every light in the scene** for every pixel. With ~30 lights, our cartoon
materials are doing 30× the lighting math they need to.

## Cuts

### 1. Shadow map: 4096 → 1024

```ts
// Game.tsx
shadow-mapSize-width={1024}
shadow-mapSize-height={1024}
```

4× cheaper depth pass. Cartoon shadows look fine at 1024 over our small
neighborhood.

### 2. Drop `<Environment preset="park">`

The hemisphere + directional + ambient lights already give us the cartoon
look we want. The HDR environment is invisible-but-paid-for IBL.

```ts
// Game.tsx — delete this line:
<Environment preset="park" background={false} environmentIntensity={0.35} />
```

### 3. Replace per-blob/pickup/firework pointlights with emissive

Pattern:

```diff
- <pointLight color={c} intensity={0.4} distance={3} />
- <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.4} />
+ <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.4} />
```

Affected files:

- `Schmorgesblob.tsx` — Hopper, Sprinter, Splitter (3 lights)
- `Pickup.tsx` — every floating gem
- `Fireworks.tsx` — every burst
- `Fireflies.tsx` — 18 firefly lights
- `Bedroom.tsx` — 3 dresser lamp lights (one per bedroom)
- `Kitchen.tsx`, `LivingRoom.tsx`, `StairsAndLoft.tsx`,
  `Interior10600.tsx` — interior accent point lights

**Kept**:
- `BossBlob.tsx` — boss aura is a feature
- `RayGun.tsx` — muzzle flash is a feature
- `BackyardPortal.tsx` — portal is meant to throw light around
- `DiscoLights.tsx` — reduced from 7 → 3
- `DynamicLights` (Game.tsx) — directional + hemisphere + ambient

End state: ~30 lights → ~5–6.

### 4. Distance-gated `useFrame` for far-from-player props

New helper:

```ts
// src/systems/distance.ts
import { useGameStore } from '../state/gameStore';
export function isNearPlayer(x: number, z: number, r = 40): boolean {
  const id = useGameStore.getState().activeCharacterId;
  const p = useGameStore.getState().positions[id];
  return (x - p.x) ** 2 + (z - p.z) ** 2 < r * r;
}
```

Each props/vegetation `useFrame` becomes:

```ts
useFrame((state, dt) => {
  if (!isNearPlayer(positionX, positionZ, 40)) return;
  // ... existing animation work
});
```

Files: `Cat.tsx`, `Basketball.tsx`, `Sprinkler.tsx`, `Flagpole.tsx`,
`LiveOak.tsx`. Other `useFrame` users (controllers, character, weapons,
camera, sky) are global or near-player by definition and skip the gate.

## Architecture summary

```
src/components/Game.tsx                # MOD: shadow 1024, drop Environment
src/systems/distance.ts                 # NEW: isNearPlayer helper
src/components/aliens/Schmorgesblob.tsx # MOD: drop pointlights, bump emissive
src/components/pickups/Pickup.tsx       # MOD: drop pointlight
src/components/celebration/Fireworks.tsx # MOD: drop burst pointlight
src/components/celebration/Fireflies.tsx # MOD: drop 18 pointlights, bump emissive
src/components/celebration/DiscoLights.tsx # MOD: 7 spots → 3
src/components/hero/Bedroom.tsx          # MOD: drop dresser lamp light
src/components/hero/Kitchen.tsx          # MOD: drop accent light
src/components/hero/LivingRoom.tsx       # MOD: drop accent + bookshelf lamps
src/components/hero/StairsAndLoft.tsx    # MOD: drop loft pointlight
src/components/hero/Interior10600.tsx    # MOD: drop interior pointlights
src/components/props/Cat.tsx             # MOD: distance gate
src/components/props/Basketball.tsx      # MOD: distance gate
src/components/props/Sprinkler.tsx       # MOD: distance gate
src/components/props/Flagpole.tsx        # MOD: distance gate
src/components/vegetation/LiveOak.tsx    # MOD: distance gate
```

## Verification (real, this time)

In the same browser session, after changes:

1. `closeWelcome()` to enter combat.
2. Run a 2-second FPS measurement. **Expect ≥45 FPS, target 60.**
3. Log heap. Expect ≤100 MB.
4. Visual check via screenshot from cul-de-sac. Should look effectively
   identical at gameplay distance.
5. If FPS < 45, keep cutting (next: blob sphere segments 22→12, particle
   counts).

If FPS hits ≥45 and visual passes, commit.

## Tradeoffs

- **Removing pointlights changes look slightly.** Without lights,
  emissive surfaces don't actually cast warm onto neighboring surfaces.
  Acceptable — kids care about the *thing glowing*, not the surrounding
  glow.
- **Distance gate breaks animations far away.** Sprinklers freeze, cat
  stops blinking. Acceptable — you can't see them anyway. They resume
  when you get close.
- **Dropping `Environment` changes reflection feel.** Our materials are
  mostly diffuse, low metalness, so loss is minimal.
- **Reducing disco lights from 7 → 3.** Still enough to convey "disco."

## Build sequence

1. Helper file `distance.ts`.
2. Game.tsx (shadow + Environment).
3. Drop pointlights one component at a time.
4. Add distance gates to props + vegetation.
5. Build (type-check).
6. Reload browser, run FPS test.
7. Commit only after FPS ≥ 45.
