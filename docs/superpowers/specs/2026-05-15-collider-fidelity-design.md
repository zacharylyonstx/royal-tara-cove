# Collider Fidelity v9 — Kill the Invisible Walls

**Date:** 2026-05-15
**Audience:** Penny (8) and Luke (6) playing the game with their dad.

## Two distinct bugs

1. **Invisible walls around rotated houses.** `colliders.ts:32-45`
   computes the AABB of the rotated house body. For 10601 (yaw 40°) and
   10604 (yaw -45°) the AABB is up to ~1-2m larger than the visible
   house. Players hit a "wall" in front yards.

2. **Invisible walls along wedge-lot fence segments.** Same code,
   `colliders.ts:50-72`. Spokes and arc segments aren't axis-aligned;
   each AABB has 0.5-1m of padding around the visible fence.

3. **Walking through visible objects.** `props.ts:buildPropsFor` only
   emits visual *tags* — no colliders. Trucks, sedans, basketball hoop
   posts, BBQ + chairs, trash bins, kids' bikes, garden beds, hoses,
   flagpoles — all visible, all walk-throughable.

## Fix: add OBB support, emit tight colliders for everything

### 1. `RectCollider.yaw`

```ts
// types.ts
export interface RectCollider {
  minX, maxX, minZ, maxZ;
  minY?, maxY?;
  passable?, tag?;
  /** Yaw in radians around the rect's center. When set, the rect is
      treated as an oriented bounding box; otherwise it's an AABB. */
  yaw?: number;
}
```

Backwards-compatible: every existing collider stays an AABB; opt-in OBB.

### 2. `resolveMotion` & `unclipCamera` learn OBBs

For each candidate collider during X-axis or Z-axis motion resolution:

- If `yaw` undefined or 0: existing AABB code path.
- Else: transform player center into the box's local frame
  (`world - center`, then rotate by `-yaw`), do AABB closest-point on
  the centered local rect, push the player out along the local outward
  normal, transform the push back to world space, and apply.

Camera unclip raycast: same transform — sample points along the ray,
test each against OBBs in their local frame.

The math is well-known (circle vs OBB = closest-point clamp in box
local space). Per-collider cost rises only for OBB candidates, so the
hot path (~150 axis-aligned colliders) is unchanged.

### 3. House body emits OBB for all houses

```ts
// colliders.ts
for (const h of houses) {
  if (h.isHero) continue;  // hero house already emits piecewise walls
  const tx = houseTransform(h.position, h.depth);
  const halfW = h.width / 2;
  const halfD = h.depth / 2;
  out.push({
    minX: tx.worldX - halfW, maxX: tx.worldX + halfW,
    minZ: tx.worldZ - halfD, maxZ: tx.worldZ + halfD,
    minY: 0, maxY: h.stories * 3 + 2,
    yaw: tx.yaw,                      // ← OBB
    tag: `house-${h.address}`,
  });
}
```

Now matches the visible house exactly.

### 4. Fence segments emit thin OBB along their actual line

```ts
const cx = (a[0] + b[0]) / 2;
const cz = (a[1] + b[1]) / 2;
const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
out.push({
  minX: cx - len / 2,            maxX: cx + len / 2,
  minZ: cz - FENCE_THICKNESS,    maxZ: cz + FENCE_THICKNESS,
  minY: 0, maxY: 1.8,
  yaw,
  tag: `fence-${lot.address}-${i}`,
});
```

Tight to the visible fence rail.

### 5. Prop colliders: `buildPropColliders`

New helper in `colliders.ts`. Iterates `propsByAddress`, replicates the
exact placement math from `HouseProps.tsx` (same `garageCenterX`,
`driveZCenter`, `sidewalkZ`, `backyardZ`), and emits a collider per
visible prop. All emitted in HOUSE-LOCAL coords then translated to
world with `yaw = lot.houseYaw` (so each becomes an OBB aligned with
the house orientation).

Footprints (HOUSE-LOCAL):

| Tag         | Footprint (m)        | Center                                    | Notes                |
|-------------|----------------------|-------------------------------------------|----------------------|
| truck       | 4.8 × 2.0            | (garageCenterX, driveZCenter)             | yaw=lot              |
| sedan       | 4.4 × 1.7            | (garageCenterX, driveZCenter)             | yaw=lot              |
| hoop        | 0.4 × 0.4            | (post: garageCenterX±2.6, sidewalkZ-0.4)  | thin post            |
| bins        | 1.5 × 0.7            | (curb position from HouseProps)           | two cans grouped     |
| gardenBed   | 1.6 × 0.8            | (garageCenterX±2.5, -halfD-0.6)           | low — maxY=0.4       |
| bike        | 1.6 × 0.5            | (garageCenterX±1.6, -halfD-1.6)           | yaw=lot              |
| kidsBikes   | 2x (1.2 × 0.5)       | hero front yard                           | per-bike colliders   |
| patio       | 2.4 × 1.2 (table)    | (1.5, backyardZ)                          | + 1.0 × 0.6 BBQ      |
| flagpole    | 0.4 × 0.4            | hero front-side                           | tall — maxY=6        |

Hose: visible but it's a flat coiled mat — no collider needed (player
can step over).

### 6. Game.tsx wires the new emitter

```ts
const propColliders = useMemo(
  () => buildPropColliders(HOUSES, lots, propsByAddress),
  [lots, propsByAddress],
);
// ...
setStaticColliders([...base, ...extra, ...propColliders]);
```

## Verification (browser, real movement)

For each test, take a screenshot at the moment of contact and confirm
visually that Dad's body is touching the visible mesh (not floating in
empty space).

1. Walk Dad to the front-left corner of 10604. Confirm contact at the
   visible wall, not 1-2m short.
2. Walk Dad straight at the basketball hoop in any neighbor's driveway.
   Confirm he stops at the post.
3. Walk Dad through the truck in 10600's driveway. Confirm he stops at
   the bumper.
4. Walk Dad along a side fence of any wedge lot (10601, 10604).
   Confirm he slides along the visible fence, not 0.5-1m away.
5. Open the hero front door, walk in. Confirm v7 still works.
6. Walk into the trash bins. Confirm contact.

If any check fails, fix and re-verify before commit.

## Tradeoffs

- **OBB cost.** Per-collider OBB check is ~5× the AABB check
  (transform + closest-point), but only ~10 OBBs (most colliders stay
  AABB). Negligible perf impact.
- **Collider duplication.** Hero house is special-cased; non-hero
  houses use OBB. Two paths but each is small and clear.
- **Prop placement coupling.** `buildPropColliders` mirrors the
  placement constants in `HouseProps.tsx`. If those change, colliders
  drift. Mitigated by extracting the constants into a shared
  `propPlacement.ts` so both renderer and collider read from one
  source.

## Files

```
src/types.ts                            # MOD: add yaw to RectCollider
src/systems/collision.ts                # MOD: OBB path in resolveMotion + unclipCamera
src/world/colliders.ts                  # MOD: OBB house bodies + fence segments + buildPropColliders
src/world/propPlacement.ts              # NEW: shared placement constants (DRY w/ HouseProps.tsx)
src/components/HouseProps.tsx           # MOD: import constants from propPlacement
src/components/Game.tsx                 # MOD: include propColliders in setStaticColliders
```

## Build sequence

1. Add `yaw` to RectCollider type.
2. Implement OBB math in `collision.ts` (resolveMotion + unclipCamera).
3. Update `colliders.ts` house body + fence emitters to emit OBBs.
4. Build, smoke test (just to confirm no regression).
5. Extract placement constants to `propPlacement.ts`.
6. Implement `buildPropColliders`.
7. Wire into Game.tsx.
8. Build, run the verification checks in the browser.
9. Commit only after all checks pass.
