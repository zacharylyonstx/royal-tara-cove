# Midnight Munchies — third game mode

**Date:** 2026-05-20
**For:** Luke (6). Playable solo, expandable to co-op later. Lives next to Alien Invasion and Tornado Warning on the welcome screen.

A Pac-Man-style top-down sneak game. It's midnight. Luke is hungry. The rest of the family is sleepwalking through the house. Snatch every cookie before they catch you and walk you back to bed.

## Goals

- A self-contained third mode added to the welcome screen, selected next to Aliens and Tornado.
- Plays like Pac-Man: maze, pellets, chasers, power pellet that flips the dynamic, lives, level progression.
- The "maze" is the existing 10600 hero-house floor plan, viewed top-down at night.
- The "ghosts" are sleepwalking family members (Dad, Penny, the dog), not enemies — getting caught is gentle (walked back to bed, lose a cookie, life lost) with zero scary fail state.
- One-handed friendly for a 6-year-old: WASD only, no mouse, no jumping, no aiming.
- Reuses existing systems (collision, character mesh, audio, game-mode gating) wherever possible. New code is scoped to munchies-specific files.

## Non-goals (v1)

- **Multiplayer.** Single-player only in v1. Architecture leaves a clear door open (sleepwalkers are server-authoritative, character roster can be reassigned) but no net wiring this round.
- **Multiple house layouts.** Levels reuse the same hero-house floor plan; difficulty scales by sleepwalker speed and pellet count.
- **New character art.** Sleepwalkers reuse the existing Character mesh. The dog is a new but small mesh (cube body, cube head, ears, tail). No Mom in v1.
- **3D camera tricks.** Locked top-down camera, slight tilt, no orbit, no mouse-look, no zoom.
- **Persistence.** High scores are session-only.
- **Editing combat / tornado controllers.** Munchies code goes in new files; existing controllers add at most a one-line `gameMode !== '...'` early-return.

## Visual & feel

Top-down view of the 10600 hero house, dim and warm at night. House lights are off; a few cozy details glow:
- A bathroom nightlight casting a yellow puddle into the hall.
- Moonlight slanting through the great-room bay window.
- TV in the great room showing a flickering blue static loop.
- Pellets (cookies) softly emissive so they pop on the dark floor.

Sleepwalkers have a `Zzz` sprite floating above them, slumped pose, and a faint shuffle-slipper SFX loop. When powered, they tint blue, gain a bigger `Zzz`, and shuffle slowly toward their own beds. Touch one in this state and they get "tucked in" (small particle puff + a `+200` floating number).

## Player experience flow

```
Welcome screen
  └─ 🥛 MIDNIGHT MUNCHIES card → setGameMode('munchies') → CharacterSelect
       (always Luke in v1; card auto-selects)
            └─ Munchies intro overlay: "It's midnight. SHHHH. Eat every cookie before they catch you."
                  └─ phase: 'munchies-play' → gameplay begins
                       ├─ pellets collected → score++, audio.crunch()
                       ├─ milk (power pellet) → phase: 'munchies-powered' for 8s → sleepwalkers tintable
                       ├─ touched by ghost (when not powered) → phase: 'munchies-caught' → cinematic walk-back
                       │     └─ life lost → respawn → phase: 'munchies-play' (or 'munchies-game-over' if 0 lives)
                       ├─ touched a sleepwalker (when powered) → +200, sleepwalker "tucked in",
                       │     respawns from bed after 5s
                       └─ all pellets cleared → phase: 'munchies-level-clear' → next level (faster ghosts)
                            └─ after level 3 → phase: 'munchies-victory'
```

3 lives. 3 levels (configurable constants). Cookies counter shown.

## Architecture

### Mode integration

`src/state/gameStore.ts`:
```ts
export type GameMode = 'aliens' | 'tornado' | 'munchies';

export type MunchiesPhase =
  | 'munchies-intro'
  | 'munchies-play'
  | 'munchies-powered'
  | 'munchies-caught'
  | 'munchies-level-clear'
  | 'munchies-game-over'
  | 'munchies-victory';

export type GamePhase =
  | 'pre-intro' | 'intro' | 'combat' | 'victory' | 'defeat' | 'free-play'
  | TornadoPhase
  | MunchiesPhase;
```

`closeWelcome()` extended:
```ts
phase: s.gameMode === 'tornado' ? 'calm'
     : s.gameMode === 'munchies' ? 'munchies-intro'
     : 'intro'
```

### New store: `src/state/munchiesStore.ts`

```ts
interface PelletPosition { x: number; z: number; id: string; }

interface SleepwalkerState {
  id: 'dad' | 'penny' | 'dog';
  x: number; z: number; yaw: number;
  /** node graph: id of the node they're heading toward */
  targetNodeId: string;
  /** which node they last visited (anti-backtrack hint) */
  lastNodeId: string;
  /** 'normal' = chase; 'powered' = wander toward own bed; 'tucked' = inactive, respawning */
  mode: 'normal' | 'powered' | 'tucked';
  /** seconds since 'tucked' began, used for respawn timer */
  tuckedAt: number;
}

interface MunchiesStore {
  level: number;                       // 1-based; gameplay ends after MAX_LEVEL
  score: number;
  lives: number;
  pellets: Record<string, PelletPosition>;   // small cookies, removed as eaten
  milks: Record<string, PelletPosition>;     // power pellets (4 per level)
  bonus: { x: number; z: number; spawnedAt: number } | null;  // big chocolate chip
  poweredUntil: number;                 // perf.now()/1000 when 'powered' ends
  pelletCount: number;                  // running total of pellets remaining
  sleepwalkers: Record<string, SleepwalkerState>;
  caughtAt: number | null;              // when the player was caught (cinematic timer)
  // mutations:
  startLevel: (level: number) => void;
  eatPellet: (id: string) => void;
  eatMilk: (id: string) => void;
  eatBonus: () => void;
  tuckIn: (sleepwalkerId: string, now: number) => void;
  resetAfterCaught: (now: number) => void;
  loseLife: () => void;
  reset: () => void;
}
```

Direct-mutation-friendly fields (`x`, `z`, `yaw` on sleepwalkers) are mutated in-place from `useFrame` to avoid per-frame re-renders; only state transitions (mode/tucked/caught) go through `setState`.

### Welcome screen

`src/ui/WelcomeScreen.tsx`: grid becomes `gridTemplateColumns: '1fr 1fr 1fr'` (responsive: stacks single-column under ~700px). New card:
- emoji `🥛`, title `MIDNIGHT MUNCHIES`, accent `#7a5cad` (warm purple), blurb: *"It's midnight. Sneak through the house, grab every cookie, and don't let sleepwalking Dad and Penny catch you!"*
- `pick('munchies')`

Character select: in munchies mode, auto-claim Luke and skip the select screen (single-player), OR display only the Luke card. Simpler choice: extend CharacterSelect to render only Luke when `gameMode === 'munchies'`. (Co-op multiplayer later can add Penny as a second player here.)

### Camera

`src/systems/MunchiesCamera.tsx` (new). Replaces `CameraRig`'s behavior in munchies mode. Two options:

**Chosen:** Add `MunchiesCamera` as a sibling component to `CameraRig` and have `CameraRig` early-return when `gameMode === 'munchies'`. This keeps CameraRig untouched structurally.

Camera math:
- Position: `(luke.x, 14, luke.z + 1.5)` — slight south offset so the camera looks slightly back-and-down (forward tilt of ~6°).
- LookAt: `(luke.x, 0.6, luke.z)`.
- Smooth lerp at 6/sec so the camera glides.
- FOV reduced to 50° (current is 80°) for a tighter, more "tabletop" feel.
- No pointer lock. No mouse look. The click-to-lock canvas handler in `CameraRig` is already gated on `welcomeOpen`; in munchies mode, `CameraRig` returns null before binding.

### Player controller

`src/systems/PlayerController.tsx` gets a munchies branch at the top of `useFrame`. Two cleanest options considered:

**Chosen:** Add a small `MunchiesPlayerLogic` block inside `PlayerController` gated by `gameMode === 'munchies'`. Pre-conditions:
- 4-direction movement only (no diagonals): if both X and Z keys are pressed, prefer the most recently pressed (track via key timestamps).
- World-axis movement (NOT camera-relative). W = -Z, S = +Z, A = -X, D = +X.
- Speed = `MUNCHIES_PLAYER_SPEED` (4.2 m/s, slightly slower than normal walk).
- No jump, no sprint, no door-interact, no gravity (player stays at y=0).
- `resolveMotion` still used for collision against the existing interior walls.
- After move, no yaw smoothing — snap yaw to movement direction (more Pac-Man-feel).

(Alternative considered: extract munchies movement into its own `MunchiesPlayerController.tsx` and have the existing controller early-return. This is cleaner long-term but introduces duplication; with the branch ~20 lines, inlining wins for v1.)

### Sleepwalker AI

`src/world/munchiesGraph.ts` (new): hand-defined corridor graph derived from `floorPlan.ts`. ~14 nodes — one at the center of each room, one per doorway. Each node lists neighboring node IDs. Example:

```ts
export interface GraphNode {
  id: string;
  x: number; z: number;
  neighbors: string[];
}

export const MUNCHIES_GRAPH: GraphNode[] = [
  { id: 'great-c',     x: -5.0, z: -4.0, neighbors: ['great-n', 'great-kitchen-door', 'great-hall-door'] },
  { id: 'great-n',     x: -5.0, z: -7.0, neighbors: ['great-c'] },
  // ...
  { id: 'hall-w',      x: -7.5, z: 0.75, neighbors: ['great-hall-door', 'hall-master-door', 'hall-penny-door'] },
  { id: 'hall-e',      x: 0.5,  z: 0.75, neighbors: ['kitchen-hall-door', 'hall-bath-door', 'hall-luke-door'] },
  // ...
];
```

The full graph (~14 nodes) is enumerated in the implementation plan; node positions are derived from `floorPlan.ts` doorway centers and room centers so the graph stays in sync if the floor plan changes.

`src/systems/SleepwalkerController.tsx` (new). For each sleepwalker:

1. **Pathing:** Per frame, walk straight-line toward `targetNodeId`. When arrived (dist < 0.3), pick a new neighbor of the current node based on **AI rule** (see below). Avoid picking `lastNodeId` unless it's the only option.

2. **AI rules:**
   - **Dad** (Blinky, red marker): pick neighbor whose graph-distance to Luke's current node is smallest.
   - **Penny** (Pinky, pink marker): pick neighbor whose graph-distance to Luke's *projected* node (Luke's position + 3m in his current yaw direction → nearest node) is smallest.
   - **Dog** (Clyde, orange marker): if `worldDist(self, luke) > 6m` → behave like Dad. Else → pick neighbor whose graph-distance to a fixed "doghouse node" (kitchen-c) is smallest. (Classic Clyde "shy" behavior.)

3. **Powered mode:** while `phase === 'munchies-powered'`, sleepwalkers tint blue, speed halved, and pick neighbor whose graph-distance to their assigned **bed node** is smallest (running away, in effect).

4. **Tucked mode:** when player touches a sleepwalker during powered phase, the sleepwalker is snapped to their bed node, `mode = 'tucked'`, `tuckedAt = now`. Render is a small `Zzz` particle puff in place; mesh is hidden. After `TUCK_RESPAWN_S` (5s), `mode = 'normal'` again and they resume from the bed node.

5. **Catch detection:** in `MunchiesController` (not here), each frame checks `worldDist(luke, eachSleepwalker) < CATCH_RADIUS (0.6m)`. If hit during `'munchies-play'`, transitions to `'munchies-caught'`.

Movement uses `resolveMotion` against the same static colliders so sleepwalkers never clip walls. The corridor graph guarantees they pathfind through doorways, but `resolveMotion` is the safety net.

### Pellet placement

`src/world/munchiesPellets.ts` (new): generates pellet positions deterministically from `floorPlan.ts`. Algorithm:

1. For each room: lay a grid of cookie positions with 1.2m spacing, skipping cells within 0.4m of any interior wall.
2. For each corridor (hallway + room doorways): lay cookies along the centerline at 1.0m spacing.
3. Skip cells within 0.8m of the player spawn (great room couch area).
4. Skip cells within 0.5m of a sleepwalker bed.
5. Output ~80-100 cookie positions per level.

Power-pellet milks: 4 fixed positions:
- `'milk-nw'`: master bedroom NW corner, (-8.0, 7.0)
- `'milk-ne'`: Luke's bedroom NE corner, (1.5, 7.0)
- `'milk-sw'`: great room SW corner, (-8.0, -7.0)
- `'milk-se'`: kitchen SE corner, (1.5, -7.0)

Bonus: Big Chocolate Chip Cookie spawns at kitchen center at 30% and 70% pellets-remaining thresholds. Despawns after 8s.

### Sleepwalker beds

`src/components/munchies/Bed.tsx` (new): renders a simple box bed (mattress + pillow + sheet). Bed positions live in `src/world/munchiesGraph.ts` keyed by sleepwalker id:

- Dad: `master-bed`, room center of master bedroom.
- Penny: `penny-bed`, room center of Penny's bedroom.
- Dog: `dog-bed`, near the kitchen pantry (a soft pet bed). Rendered as a small round cushion.

Beds are visible during gameplay so the kid can see where ghosts come from.

### Components added

- `src/components/munchies/CookiePickup.tsx` — small brown disk with darker spots, soft emissive, bob animation. Renders one mesh per pellet in `munchiesStore.pellets`.
- `src/components/munchies/MilkPickup.tsx` — small carton mesh, pulsing emissive glow.
- `src/components/munchies/BonusCookie.tsx` — big chocolate chip cookie. Wobbles. Despawn fade.
- `src/components/munchies/Sleepwalker.tsx` — reuses `<Character>` for dad/penny, dedicated minimal `<Dog>` for the dog. Adds an HTML `Zzz` overhead via drei `<Html>` (or sprite if HTML perf is poor — pick HTML for v1, profile if needed).
- `src/components/munchies/Bed.tsx` — per-bed mesh.
- `src/components/munchies/NightAtmosphere.tsx` — moonlight, nightlight, TV flicker, swaps in only when `gameMode === 'munchies'`. Replaces `DynamicLights` color/intensity behavior for munchies mode by setting time-of-day to night locally and adding three small point lights. (Implementation choice: `NightAtmosphere` reads `gameMode` and **adds** night-only lights; the existing `DynamicLights` ambient/hemi values are overridden via `useFrame` writes in `NightAtmosphere` instead of branching `DynamicLights`. Keeps existing modes untouched.)

### Controllers added

- `src/systems/MunchiesController.tsx` — top-level game loop:
  - Watches `phase`. On `'munchies-intro'`, after 3s (or on first WASD press), transitions to `'munchies-play'`.
  - On `'munchies-play'`: checks player-pellet overlap (eat), player-milk overlap (eat + powered), player-bonus overlap (eat bonus), player-sleepwalker overlap (catch or tuck-in based on phase).
  - Manages the powered-timer; on expire returns phase to `'munchies-play'`.
  - On `'munchies-caught'`: 2.5s cinematic (camera holds, sleepwalker walks Luke to spawn). Then `resetAfterCaught` → either `'munchies-play'` (life remaining) or `'munchies-game-over'`.
  - On `pelletCount === 0`: transitions to `'munchies-level-clear'`. After 2s, increments level. If `level > MAX_LEVEL` → `'munchies-victory'`. Else `startLevel(level+1)`.
- `src/systems/SleepwalkerController.tsx` — the AI loop (see above).
- `src/systems/MunchiesCamera.tsx` — top-down camera (see above).

### UI added

- `src/ui/MunchiesHud.tsx` — top-of-screen bar: cookie count remaining, score, lives (mini cookie icons), level number. Bottom-of-screen WASD hint on level 1 only.
- `src/ui/MunchiesIntro.tsx` — full-screen overlay on `'munchies-intro'`: dim card with title "🥛 Midnight Munchies", subtitle "It's midnight. SHHHH.", hint "Press any movement key to start." Fades out on first input.
- `src/ui/MunchiesLevelClear.tsx` — "Level N cleared! 🍪" banner with bonus score breakdown.
- `src/ui/MunchiesGameOver.tsx` — "Caught! Dad walked you back to bed. 😴" with score + Try Again button (resets to `'munchies-intro'`).
- `src/ui/MunchiesVictoryScreen.tsx` — "🍪🥛🍪 You ate everything! 🍪🥛🍪" with confetti reused from celebration components.

`App.tsx` mounts the four new UI overlays at the bottom of the JSX tree.

### Audio

`src/audio.ts` adds:
- `audio.crunch()` — short crunch SFX on cookie eat.
- `audio.glug()` — milk glug on power pellet.
- `audio.shh()` — sting on first move + on getting caught.
- `audio.zzz()` — soft snore loop, played when any sleepwalker is within 4m of the player; volume scales with proximity (great horror-comedy beat).
- Background loop: a slow piano lullaby (royalty-free, ~30s loop) plays on `'munchies-play'` and `'munchies-powered'`. Quiet (~0.15 gain).
- `MusicController` early-returns on munchies; munchies plays its own theme via `MunchiesController` triggering `audio.playMunchiesTheme()`.

### Mode-gating existing systems

These all add a one-line early-return at the top of their `useFrame` (or render-null at top of component):

- `NPCController` — `if (mode !== 'aliens' && mode !== 'tornado') return;` (already wandering family in cul-de-sac; not used in munchies).
- `CameraRig` — already gates on welcome/pointer-lock; add `if (gameMode === 'munchies') return null;` at top of component.
- `MusicController` — early-return on munchies.
- `WaveController`, `CombatController`, `BlobController`, `ProjectileController`, `PowerUpController`, `SidekickController`, `TornadoController`, `RagdollController` — all already gated to their respective modes. Confirm no munchies leakage. Add gate if missing.
- `Game.tsx`'s `AliensModeSystems` and `TornadoModeSystems` already gate on gameMode; add a new `MunchiesModeSystems` parallel:

```tsx
function MunchiesModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return (
    <>
      <NightAtmosphere />
      <MunchiesCamera />
      <MunchiesController />
      <SleepwalkerController />
      <CookiePickupsLive />
      <MilkPickupsLive />
      <BonusCookieLive />
      <BedsLive />
      <SleepwalkersLive />
    </>
  );
}
```

### Constants (one file)

`src/world/munchiesConfig.ts`:
```ts
export const MAX_LEVEL = 3;
export const STARTING_LIVES = 3;
export const MUNCHIES_PLAYER_SPEED = 4.2;
export const SLEEPWALKER_BASE_SPEED = 2.4;
export const SLEEPWALKER_SPEED_PER_LEVEL = 0.35;
export const POWERED_DURATION_S = 8.0;
export const POWERED_SPEED_MULT = 0.5;
export const CATCH_RADIUS = 0.6;
export const PELLET_PICKUP_RADIUS = 0.45;
export const MILK_PICKUP_RADIUS = 0.55;
export const TUCK_RESPAWN_S = 5.0;
export const PLAYER_SPAWN: [number, number] = [-5.0, -3.0]; // great room couch
export const CAUGHT_CINEMATIC_S = 2.5;
export const COOKIE_POINTS = 10;
export const MILK_POINTS = 50;
export const BONUS_POINTS = 500;
export const TUCK_POINTS_BASE = 200;
export const TUCK_POINTS_COMBO = 2;  // doubles per tuck during one powered window
```

## Data flow (per frame)

```
PlayerController (munchies branch)
  → reads WASD → mutates positions.luke
  → resolveMotion against staticColliders (hero house interior walls)

SleepwalkerController
  → for each sleepwalker: walk toward targetNodeId
  → on node arrival: pick next neighbor using AI rule + lukes node + current mode
  → mutate sleepwalker.x/z/yaw in store (no setState — direct mutation of object refs)

MunchiesController
  → check overlaps (player ↔ pellet/milk/bonus/sleepwalker)
  → call store actions (eatPellet, eatMilk, tuckIn, etc) — triggers re-render of pickups
  → manage phase transitions (level-clear, game-over, victory)

MunchiesCamera
  → reads positions.luke → sets camera

CookiePickupsLive / MilkPickupsLive / BonusCookieLive / SleepwalkersLive
  → render from store snapshots
```

## Error handling / edge cases

- **Player spawns clipped into a wall**: spawn point `(-5.0, -3.0)` is the great-room couch area; collision-tested in implementation.
- **Sleepwalker stuck on geometry**: if `worldDist(sleepwalker, sleepwalker.targetNodeId) > 1m` and they haven't moved >0.05m in 0.5s, jump them to their current target node (rare-event safety net).
- **Player exits the hero house through patio slider / front door**: hero house doors are closed by default in munchies mode (set `door.open = false` on phase enter and disable interact). If a door is somehow open, an invisible collider blocks exits.
- **Welcome reopened mid-game**: `resetTornadoGame()` analog: `resetMunchiesGame()` clears munchies store. Called when welcome reopens or mode changes.
- **Multiplayer peers**: `MunchiesController` and `SleepwalkerController` early-return on non-host. `NetSyncController` already broadcasts `positions` and `phase`. We do not add a new broadcast channel in v1; the host-only sleepwalker state means peers won't see ghosts. Single-player only is documented in non-goals; if non-host sees munchies in v1, sleepwalkers are invisible — acceptable, but `WelcomeScreen.tsx` will additionally disable the munchies card when not host (text: "host picks the game").

## Testing

No automated tests in v1 (matches the existing project — no test suite exists; manual playtest is the bar). Manual playtest checklist:

- Welcome screen shows three cards; munchies card works.
- Camera locks top-down; WASD moves Luke in world axes; collision against interior walls works.
- Pellets visible, eaten on overlap, sound plays, score increments.
- Milk eaten → sleepwalkers tint blue and slow → 8s timer → revert.
- Touch sleepwalker (normal) → caught cinematic → respawn → life lost.
- Touch sleepwalker (powered) → +200, sleepwalker disappears, 5s respawn from bed.
- All pellets cleared → level clear banner → level 2 begins, ghosts faster.
- 3 lives → game-over screen → try-again resets.
- Beat level 3 → victory screen with confetti.
- Aliens mode still works (regression).
- Tornado mode still works (regression).
- Multiplayer aliens game still works (regression).

## Files summary

**New files (19):**
```
src/state/munchiesStore.ts
src/world/munchiesGraph.ts
src/world/munchiesPellets.ts
src/world/munchiesConfig.ts
src/systems/MunchiesController.tsx
src/systems/SleepwalkerController.tsx
src/systems/MunchiesCamera.tsx
src/components/munchies/CookiePickup.tsx
src/components/munchies/MilkPickup.tsx
src/components/munchies/BonusCookie.tsx
src/components/munchies/Sleepwalker.tsx
src/components/munchies/Dog.tsx
src/components/munchies/Bed.tsx
src/components/munchies/NightAtmosphere.tsx
src/ui/MunchiesHud.tsx
src/ui/MunchiesIntro.tsx
src/ui/MunchiesLevelClear.tsx
src/ui/MunchiesGameOver.tsx
src/ui/MunchiesVictoryScreen.tsx
```

**Modified files (8, all small):**
```
src/state/gameStore.ts          # add 'munchies' to GameMode, MunchiesPhase to GamePhase, closeWelcome branch
src/ui/WelcomeScreen.tsx        # third card
src/ui/CharacterSelect.tsx      # auto-claim Luke in munchies mode
src/components/Game.tsx         # mount MunchiesModeSystems
src/systems/CameraRig.tsx       # early-return when gameMode === 'munchies'
src/systems/PlayerController.tsx # munchies branch (4-dir, world-axis, no jump)
src/audio.ts                    # crunch/glug/shh/zzz/lullaby
src/App.tsx                     # mount MunchiesHud, MunchiesIntro, MunchiesLevelClear, MunchiesGameOver, MunchiesVictoryScreen
```

(The mode-gate sweep adds at most one line each to ~5 controllers; counted as "no structural change" not file-modification.)

## Future work (not in v1)

- **Co-op multiplayer:** Penny becomes a second player (and the dog stays as the lone "ghost" alongside Dad). Sleepwalker state broadcast via `NetSyncController`.
- **Versus mode:** A second player plays sleepwalking Dad, hunting the kids. Asymmetric, hilarious.
- **More levels / layouts:** Use other houses on the cove as alternate maze layouts.
- **Pajamas / costumes:** Customize Luke's pajamas. Unlocks per high-score milestone.
- **Sounds:** Penny dream-talking ("nooo my pony..."), Dad mumbling about work. Random clips.
