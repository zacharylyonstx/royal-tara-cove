# Playable & Fun v7 — Make 10600 Actually Enterable

**Date:** 2026-05-15
**Audience:** Penny (8) and Luke (6) playing the game with their dad.

## The bug

`src/world/colliders.ts:38` builds one solid AABB per house spanning the
rotated body of the structure. The hero house (10600) is a 18×16m solid
block from y=0 to y≈8. The `Door` system registers a tiny passable AABB
at the door rectangle — but the surrounding house body is *always* solid.
So the door opens visually, the player walks up, and bumps into the wall
*around* the door. They cannot enter the house at all.

Every interior feature shipped in v5–v6 (doorways, stairs, loft, kid
bedrooms, bedroom props, the play loft sign) is unreachable.

## The fix

Replace the hero house's body AABB with **piecewise wall colliders** that
match the visible exterior, with door-sized gaps where the front door
and patio slider live. Other houses stay as solid AABBs — they have no
interior, and a closed garage door from the outside is fine.

## Architecture

```
src/world/colliders.ts                 # MOD: skip the hero house body AABB
src/components/hero/HeroHouse10600.tsx # MOD: export buildHeroExteriorColliders
src/components/Game.tsx                # MOD: include hero exterior colliders
```

### `buildHeroExteriorColliders(config, lot)` returns

For house local coordinates (rotated to world via `lot.houseYaw`):

1. **Front wall** (z = -halfD), split around the front door:
   - Left segment: x = -halfW .. (doorCenterX - DOOR_W/2)
   - Right segment: x = (doorCenterX + DOOR_W/2) .. halfW
2. **Back wall** (z = +halfD), split around the patio slider:
   - Left: x = -halfW .. -sliderHalf
   - Right: x = +sliderHalf .. halfW
3. **Left side wall**: x = -halfW, full depth, solid
4. **Right side wall**: x = +halfW, full depth, solid
5. **Ceiling**: full footprint, y ∈ [5.95, 6.05] — keeps player off the
   roof and prevents the loft railing from being a launch pad.

All wall thickness `WALL_T` = 0.2m, height matches `STORY_H * stories` =
6m. Local rectangles get rotated to world bounding boxes the same way
`buildInteriorColliders` already does (existing helper).

The garage door and bay window stay as solid wall (no collider gap) —
the player wouldn't expect to walk through a closed garage door, and we
don't render an interior on the garage side anyway.

### `colliders.ts` change

Wrap the body-AABB push in `if (!h.isHero)`. Hero house body is now
emitted by the new function instead.

### `Game.tsx` wiring

Inside the existing `useEffect`:

```ts
extra = [
  ...buildInteriorColliders(hero, heroLot),
  ...buildPorchColliders(hero, heroLot),
  ...buildHeroExteriorColliders(hero, heroLot), // NEW
];
```

The Door system already removes its closed-door AABB on open; nothing
else needs to change.

## Verification plan (run in browser, no teleport cheating)

1. Click "Let's play" — start fresh, play as Dad.
2. Walk Dad north through the cul-de-sac to the front porch of 10600.
3. Press **E** at the front door. Confirm door swings open.
4. Walk forward through the door. **Confirm Dad is now standing inside
   the great room, on the wood floor.** Screenshot.
5. Walk to the kitchen-hall doorway gap (back of great room). Pass
   through. Screenshot in the kitchen.
6. Find the staircase in the back-left corner. Walk up. Confirm Dad
   rises to y ≈ 3 on the loft. Screenshot on the loft.
7. Run a wave 1→3 fight from the porch. Confirm difficulty hasn't
   regressed. Screenshot at victory.

If any step fails, **revert and report**, do not ship-and-pray.

## Tradeoffs

- **Hero-only fix vs. all houses**: chose hero-only. Other houses have
  no interior; making their walls passable would just expose the void
  inside.
- **Solid garage door vs. enterable**: keeping garage door as wall.
  The garage interior IS rendered (workbench), but you'd have to crouch
  or dodge a closed garage door to enter — feels weird. Defer.
- **Ceiling collider**: small redundancy with no real cost — without it,
  a determined player could jump-stack onto the railing onto the loft
  wall and escape onto the roof.

## Build sequence

1. Add `buildHeroExteriorColliders` to `HeroHouse10600.tsx`.
2. Skip hero body in `colliders.ts`.
3. Wire into `Game.tsx`.
4. Build (type-check).
5. Run the verification plan in the browser. Do not skip steps.
6. Commit only after all verification screenshots succeed.
