# Gameplay v6 — Skill, Theatre, and Walking Around the House

**Date:** 2026-05-14
**Audience:** Penny (8) and Luke (6) playing the game with their dad.

## Goal

v5 made the game *delightful*. v6 makes it **legible** and **explorable**.
The kids should:

- Actually have to aim, not be carried by auto-aim
- See the schmorgesblobs *coming*, not just appear
- Watch the blobs stream around the hero house from the backyard
- Walk through the front door of 10600, room to room

Five themes:

1. **Soft-assist auto-aim** — keep gentle far-range help, drop the close-range
   crutch and the lowest-HP-targeting.
2. **Spawn cinematic** — every wave starts with a 2-second camera pan to the
   backyard portal, with a glowing emergence effect.
3. **Backyard pathing** — non-boss blobs detour around the hero house via
   per-side waypoints so they fan around it instead of clipping through it.
4. **House interior doorways** — cut 1m gaps in the hero-house interior walls
   so the kids can actually walk room to room.
5. **Small-detail polish** — right-rail HUD layout, intermission countdown,
   per-blob HP bars when damaged, beefier damage flash.

## Theme 1 — Soft-assist auto-aim

`src/systems/CombatController.tsx` change three constants and one block.

```ts
// Before:
const AIM_CONE_DEG = 50;
const PASSIVE_AIM_RANGE = 22;
const PASSIVE_AIM_LERP = 4;

// After:
const AIM_CONE_DEG = 18;          // tighter snap
const PASSIVE_AIM_NEAR = 10;      // disable inside 10m
const PASSIVE_AIM_FAR = 22;       // engage only between near and far
const PASSIVE_AIM_LERP = 1.5;     // slower turn
```

In `snapTargetForYaw`:
- Sort by **distance only**. Drop the lowest-HP preference and the
  "demote last target" alternation. Pick the nearest blob inside the cone.
- (Result: shooting one blob until it dies is the natural play.)

In passive-aim block: skip rotation if `nearestD < PASSIVE_AIM_NEAR`. Inside
10m, the player aims for themselves.

## Theme 2 — Spawn cinematic

A new piece of state in `combatStore`:

```ts
interface CinematicState {
  active: boolean;
  // World-space "look-at" target.
  targetX: number; targetY: number; targetZ: number;
  // Camera world position the rig should blend toward.
  cameraX: number; cameraY: number; cameraZ: number;
  endsAt: number;
}
```

Default: `active: false`.

`WaveController` changes:

- When entering `'spawning'` state, call `startWaveCinematic()`. This sets
  `cinematic.active = true`, `endsAt = now + 2.0`, target = `BLOB_SPAWN`,
  camera at `(BLOB_SPAWN.x, 16, BLOB_SPAWN.z + 14)` looking down toward it.
- Spawning is **paused** during the cinematic (`if (cinematic.active) return`
  in the spawn loop). Once it ends, normal spawning resumes — first blob
  appears with the existing pop, with a stronger emergence VFX.

`CameraRig` changes:

- Each frame, check `combatStore.cinematic`. If active, lerp `camera.position`
  toward `cinematic.cameraXYZ` and `lookAt` `cinematic.targetXYZ` with a
  blend factor of ~3 dt. If inactive, run the existing follow logic.
- When cinematic flips off, the rig naturally re-blends back to the player
  by the same lerp.

A new `BackyardPortal.tsx` (under `components/celebration/`):

- Renders a swirling glowing torus + pulsing point light + radial particles
  at the spawn point.
- Visible whenever there are queued blobs OR the cinematic is active.
- Uses three rotating rings at different speeds + a vertical pillar of
  rising particles for "portal" feel.

Blob "erupt" animation lives in `Schmorgesblob.tsx`:

- For 0.4s after spawn, scale ramps from 0 → 1 with a slight overshoot.
- Already partly there via `spawnDelay` in `BlobController`; we extend by
  storing `spawnedAt` on the blob and using `(now - spawnedAt) / 0.4` for
  scale.

## Theme 3 — Backyard pathing

Extend `Blob` (state):

```ts
interface Blob {
  ...
  // Detour waypoint in world XZ. -1 means "no waypoint, head straight to
  // player." Set at spawn for non-boss blobs.
  waypointX: number;
  waypointZ: number;
  waypointReached: boolean;
}
```

`spawnBlob` (or `WaveController` at spawn time) computes the waypoint:

- Hero house at world position `housePivotX, housePivotZ`. Choose left or
  right side randomly: `side = Math.random() < 0.5 ? -1 : 1`.
- Waypoint = `(housePivotX + side * (houseWidth/2 + 3), housePivotZ)` —
  a meter or two outside the house's side wall, at the house's center Z.
- Boss skips waypoint (`waypointReached = true` from spawn). Boss is too
  big for the gap; instead, when boss spawns we visually **explode the back
  fence section** behind the hero house (single particle burst + remove
  fence debris from view) for "boss broke through" energy.

`BlobController` movement logic:

```ts
if (!b.waypointReached) {
  const dx = b.waypointX - b.x, dz = b.waypointZ - b.z;
  const d = Math.hypot(dx, dz);
  if (d < 1.0) b.waypointReached = true;
  else { steer toward (waypointX, waypointZ) }
} else {
  // existing player-targeted steering
}
```

Apply this to all kinds (hopper / sprinter / splitter), but *not* boss.
Splitter babies inherit `waypointReached: true` from their parent's death
location — they're already past the house.

## Theme 4 — Hero house interior doorways

`buildInteriorColliders` in `HeroHouse10600.tsx` currently emits 8 solid
walls. Each "wall with doorway" becomes **two segments** with a 1.0m gap
where the doorway sits.

Wall-by-wall rewrite:

| Wall | Old span | Doorway gap | New segments |
|---|---|---|---|
| lr-kitchen (z 4m at x=-1.5) | z=-3..1 | center z=0 | z=-3..-0.5 + z=0.5..1 |
| kitchen-hall (x 5m at z=1.5) | x=-5.5..-0.5 | x=-3..-2 | x=-5.5..-3 + x=-2..-0.5 |
| hall-bed-back (x 6m at z=4) | x=-5.5..0.5 | x=-2.5..-1.5 | x=-5.5..-2.5 + x=-1.5..0.5 |
| garage-house | full | center z=0 | upper + lower halves |
| bath-1 (x=3) | z=2.5..5.5 | z=4..5 | z=2.5..4 + z=5..5.5 |

The other walls (penny-luke divider, master-luke divider, bath-2 short)
have no doorways — bedroom dividers stay solid.

Bonus per spec: place small named props in each kid's bedroom:

- **Penny's room** (back-left): a stuffed bunny on a tiny bed mesh
- **Luke's room** (back-right): a Lego castle (3-block stack)
- **Master bedroom** (back-center): a king bed mesh

Lives in `HeroHouseInterior.tsx` as a small new component called by
`HeroHouse10600`.

## Theme 5 — Small details

**Right-rail HUD reflow** (`App.tsx` / individual HUD components):
The right side currently has CharacterIndicator (top:16), MiniMap (top:100),
EnemyArrow (full screen). Reflow:

- CharacterIndicator → top:16 (unchanged)
- MiniMap → top:80
- (PowerUpHud already moved to bottom:130)
- ComboHud already on left
- EnemyArrow stays as full-screen overlay; shouldn't conflict

Verify nothing overlaps at common breakpoints.

**Intermission countdown** (`WaveBanner.tsx` change or new component):
During `waveState === 'intermission'`, show a centered countdown:
"Wave 2 incoming in… 3 / 2 / 1" (1Hz tick). Replaces the silent gap.

**Per-blob HP bar** (`Schmorgesblob.tsx` / `BossBlob.tsx`):
When `blob.hp < blob.maxHp`, render a small floating bar above the blob:

- 0.6m wide, 0.06m tall, just above the head
- Red gradient → green based on hp/maxHp
- Always camera-facing (use `<Billboard>` from drei or compute lookAt yaw)
- Boss bar is wider (1.6m) and persistent (always shown)

**Beefier damage flash**: bump `DamageFlash.tsx` peak opacity from current
~0.2 to 0.5, hold 0.05s before fading.

## Architecture

```
src/state/combatStore.ts            # MOD: cinematic state, waypoint fields
src/systems/WaveController.tsx      # MOD: trigger cinematic, compute waypoints
src/systems/BlobController.tsx      # MOD: waypoint-then-player steering
src/systems/CombatController.tsx    # MOD: nerf auto-aim params + sort
src/systems/CameraRig.tsx           # MOD: cinematic camera blend
src/components/celebration/
  BackyardPortal.tsx                # NEW
src/components/aliens/
  Schmorgesblob.tsx                 # MOD: erupt scale-in + HP bar
  BossBlob.tsx                      # MOD: HP bar + back-fence-burst
src/components/hero/
  HeroHouse10600.tsx                # MOD: doorway gaps in walls
  HeroHouseInterior.tsx             # NEW: bedroom props
src/ui/WaveBanner.tsx               # MOD: intermission countdown
src/ui/DamageFlash.tsx              # MOD: beefier flash
```

## Tradeoffs

- **Cinematic length**: 2s every wave is repetitive but worth it for
  readability. We could skip on intermissions after wave 1, but the kids
  will love the drama every time.
- **Waypoint hack vs A* pathfinding**: a single waypoint per blob is dumb
  but works for our 1-house-in-the-way layout. Real pathfinding is overkill.
- **Auto-aim removal**: makes the boss harder. Acceptable; that's the
  point. If it's *too* hard, ship a hidden Penny/Luke kid-mode in v7.
- **HP bars on every blob**: visually busy. Keep them small and only show
  when the blob is damaged (not at full HP).

## Build sequence

1. State scaffold: cinematic + waypoint fields in combatStore.
2. Auto-aim nerf (cheapest, immediate feel change).
3. Backyard portal + cinematic + camera blend.
4. Blob waypoint pathing + erupt scale-in.
5. Hero house doorway gaps + bedroom props.
6. HP bars + intermission countdown + damage flash bump.
7. Smoke test by playing through a full wave 1→2→3 in browser, commit.
