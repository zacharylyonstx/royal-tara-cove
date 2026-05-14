# Polish v4 — Aim, Turn, Mini-map, Hero House Redux

**Date:** 2026-05-14
**Status:** Approved (--fully-auto)

## Feedback addressed

1. **Mini-map dots don't match world.** The rotation sign is wrong — when the
   player turns, blob dots rotate the wrong direction relative to the player
   triangle.
2. **Turning is too coarse.** Mouse-drag camera sensitivity is too high (0.0055
   rad/px), and the character yaw lerp is fast (14/s), so small movement input
   causes large rotation. Combined with kinetic camera, this makes precision
   aim difficult.
3. **Aiming needs help.** Currently the gun fires straight along the player's
   facing. Movement-direction-as-aim is awkward when moving sideways and
   shooting forward. We need an assist.
4. **10600 should be bigger and at the very end of the street.** The user
   actually lived there. They want it as a 2-story home with a big backyard,
   placed at the southern-most point of the cul-de-sac (end-of-street). The
   UFO crash should land in that big backyard.

## Fixes

### 1. Mini-map rotation

In `MiniMap.tsx`, replace `const ang = -playerYaw` with `const ang = playerYaw`.
Verified: with player facing world direction (-sin(yaw), -cos(yaw)) and rotating
by `+yaw`, the resulting (rx, rz) for a blob in front of the player has rz < 0,
which when added to map center produces a dot ABOVE center in the SVG.

### 2. Camera + character turning

`CameraRig.tsx`:
- `DRAG_SENSITIVITY` 0.0055 → 0.0028 (~50% slower).
- `RELAX_SPEED` 1.6 → 1.0 (slightly slower auto-relax-behind).

`PlayerController.tsx`:
- Yaw lerp factor 14 → 8 (smoother character rotation when changing direction).

### 3. Auto-aim assist

`CombatController.tsx` adds a *cone snap*:

- Define cone half-angle 25° around player facing direction, range 25m.
- For each alive blob, compute angle between player facing and direction-to-blob.
- If a blob is within the cone:
  - Pick the nearest such blob (by 3D distance).
  - **Override** the raycast direction to point exactly at the blob center.
  - Set the player's `yaw` toward that direction (snap-to-face) so the gun
    visually points at the target.
- If no blob is in the cone, fire straight (legacy behavior).

The cone snap means casual aim is forgiving but the player still has to face
roughly the right direction. The visual snap also makes it obvious which
target was selected.

### 4. 10600 v2

`houses.ts` for 10600:
- `position.angleDeg` 120 → 90 (due south on the bulb = end of cul-de-sac).
- `width` 16 → 18, `depth` 14 → 16 (~30% bigger footprint).
- `stories` 1 → 2.
- `sqft` 1750 → 2400 (matches a 2-story Avery Ranch tract).

`HeroHouse10600.tsx`:
- Rebuild for two stories: ground floor as today; add an upper floor with
  windows + a bedroom or two; raise hipped roof accordingly.
- Stair + landing visible through the foyer.
- Upstairs walls and railings as colliders.
- Keep porch + stone wainscot + bay window on the ground floor.
- Penny + Luke bedrooms move upstairs (kid bedrooms upstairs is the Avery
  Ranch convention); Dad's master stays downstairs.

`world/streetLayout.ts` (or new constant):
- Hero house gets a custom `BACKYARD_DEPTH_HERO = 22` (vs 12 default), used
  when `buildLots` produces the wedge polygon for 10600 (and when colliders
  derive from that).

`UFOCrash.tsx`:
- Move `CRASH_X, CRASH_Z` so the impact lands inside 10600's expanded backyard
  (~ pivot + outward-from-origin direction × (depth/2 + ~12)).
- Recompute `BLOB_SPAWN` to match.

### 5. Polish: spawn spread + camera + dialogue tweaks

- Blob spawn jitter widened (3m → 5m radius around BLOB_SPAWN).
- Spawn batches stagger more (0.4s → 0.6s) so they don't pile up.
- Welcome screen scrubbed of the "press 1 / 2 / 3" keys — added prompt for
  click-to-fire.

## Architecture

```
src/components/aliens/UFOCrash.tsx         # MODIFIED — relocate CRASH point
src/components/hero/HeroHouse10600.tsx     # MODIFIED — second story, stair
src/components/hero/Interior10600.tsx      # MODIFIED — split rooms by floor
src/components/hero/Bedroom.tsx            # already supports kid theme
src/world/houses.ts                        # MODIFIED — 10600 stats
src/world/streetLayout.ts                  # ADD HERO_BACKYARD_DEPTH constant
src/world/lots.ts                          # MODIFIED — hero wedge uses big depth
src/world/colliders.ts                     # consumes lot polygons; no change

src/systems/CameraRig.tsx                  # tune DRAG_SENSITIVITY, RELAX_SPEED
src/systems/PlayerController.tsx           # tune yaw lerp factor
src/systems/CombatController.tsx           # ADD cone snap auto-aim
src/systems/WaveController.tsx             # tighter spawn jitter

src/ui/MiniMap.tsx                         # FIX rotation sign
```

## Risks

- **Hero house geometry** with 2 stories may break the existing collider
  derivation if assumptions about house height changed elsewhere. Verify
  collisions still work after the change (player can walk around outside
  and inside without phasing into walls).
- **Auto-aim cone** could feel sticky if blobs cluster — pick the nearest
  by 3D distance, not by angle, to avoid jittering between two same-distance
  targets.
- **Backyard expansion** could push the lot polygon into a neighbor's lot.
  Bulb wedge at 90° has neighbors at 0° (10605) and 180° (10604) — we need
  to keep the wedge half-angle < 45° on each side to avoid collision. Default
  is exactly 45° (since N_BULB=4). Even with depth expanded, a wedge stays
  inside its angular bounds, so neighbors are safe.

## Out of scope (future)

- Full mouse-aim (decouple gun direction from player facing).
- Touchscreen controls.
- Networked multiplayer.
- Audio occlusion / 3D positioning.
