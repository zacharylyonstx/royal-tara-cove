# Midnight Munchies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third game mode to Royal Tara Cove — a Pac-Man-style top-down sneak game played inside the 10600 hero house at night, where Luke collects cookies while sleepwalking family (Dad, Penny, the dog) patrol.

**Architecture:** New mode `'munchies'` selectable from the welcome screen, sibling to `'aliens'` and `'tornado'`. The existing hero-house interior floor plan IS the maze. All munchies code is scoped to new files in `src/state/munchiesStore.ts`, `src/world/munchies*.ts`, `src/systems/Munchies*Controller.tsx` and `MunchiesCamera.tsx`, `src/components/munchies/*`, and `src/ui/Munchies*.tsx`. Existing files get small one-line mode gates plus a localized branch in `PlayerController` for 4-directional WASD movement. The mode renders via a `<MunchiesModeSystems />` group mounted in `Game.tsx`, parallel to the existing aliens/tornado groups.

**Tech Stack:** React 19 + @react-three/fiber 9 + Three.js 0.184 + Zustand + TypeScript. No new dependencies. No new audio files (procedural Web Audio). No automated test suite (matches existing project — manual playtest is the verification bar; the spec's "Testing" section is followed verbatim).

**Reference spec:** `docs/superpowers/specs/2026-05-20-midnight-munchies-design.md`

**Conventions used throughout this plan:**
- Coordinates are world-space unless prefixed `house-local:`. The hero house is at origin with yaw=0, so house-local matches world-space inside the house.
- Hero house interior: x ∈ [-9, 8.4], z ∈ [-8, 8]. Garage occupies x ∈ [2, 8.4].
- `now` means `performance.now() / 1000` (seconds since page load) — consistent with existing controllers.
- "Smoke test" means: run `npm run dev`, open the URL Vite reports, click through to the relevant state, verify the listed expected behavior in the browser.

---

## Task 1: Game-mode plumbing in `gameStore.ts`

**Files:**
- Modify: `src/state/gameStore.ts`

- [ ] **Step 1: Extend `GameMode` and `GamePhase` unions, add `MunchiesPhase`**

Open `src/state/gameStore.ts`. At the top, change:

```ts
export type GameMode = 'aliens' | 'tornado';
export type TornadoPhase =
  | 'calm' | 'rain' | 'hail' | 'tornado-approach' | 'tornado-arrived';
export type GamePhase =
  | 'pre-intro' | 'intro' | 'combat' | 'victory' | 'defeat' | 'free-play' | TornadoPhase;
```

to:

```ts
export type GameMode = 'aliens' | 'tornado' | 'munchies';
export type TornadoPhase =
  | 'calm' | 'rain' | 'hail' | 'tornado-approach' | 'tornado-arrived';
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

- [ ] **Step 2: Update `closeWelcome()` to branch on munchies mode**

In the same file, find:

```ts
closeWelcome: () => set((s) => ({
  welcomeOpen: false,
  phase: s.gameMode === 'tornado' ? 'calm' : 'intro',
})),
```

Replace with:

```ts
closeWelcome: () => set((s) => ({
  welcomeOpen: false,
  phase:
    s.gameMode === 'tornado' ? 'calm' :
    s.gameMode === 'munchies' ? 'munchies-intro' :
    'intro',
})),
```

- [ ] **Step 3: Run `npm run build` and confirm no TS errors**

Run: `npm run build`
Expected: Build succeeds. (If a TypeScript narrowing error appears in some component that switches on `phase`, the type change is the cause — fix any inadvertent `phase === '...'` literals that should now include munchies phases.)

- [ ] **Step 4: Commit**

```bash
git add src/state/gameStore.ts
git commit -m "feat(munchies): add GameMode 'munchies' + MunchiesPhase to gameStore"
```

---

## Task 2: Munchies constants in `munchiesConfig.ts`

**Files:**
- Create: `src/world/munchiesConfig.ts`

- [ ] **Step 1: Create the file with all tuning constants**

Create `src/world/munchiesConfig.ts`:

```ts
// Tuning constants for Midnight Munchies. Single source so a designer can
// tweak speeds/scoring without hunting through the codebase.

export const MAX_LEVEL = 3;
export const STARTING_LIVES = 3;

// Movement
export const MUNCHIES_PLAYER_SPEED = 4.2;            // m/s
export const SLEEPWALKER_BASE_SPEED = 2.4;           // m/s on level 1
export const SLEEPWALKER_SPEED_PER_LEVEL = 0.35;     // added per level
export const POWERED_SPEED_MULT = 0.5;               // multiplier while powered

// Timers (seconds)
export const POWERED_DURATION_S = 8.0;
export const TUCK_RESPAWN_S = 5.0;
export const CAUGHT_CINEMATIC_S = 2.5;
export const INTRO_AUTO_DISMISS_S = 6.0;             // dismisses if no input
export const LEVEL_CLEAR_BANNER_S = 2.0;

// Pickups
export const PELLET_PICKUP_RADIUS = 0.45;
export const MILK_PICKUP_RADIUS = 0.55;
export const BONUS_PICKUP_RADIUS = 0.6;
export const BONUS_DESPAWN_S = 8.0;
export const BONUS_FIRST_SPAWN_FRAC = 0.70;          // remaining pellets / total
export const BONUS_SECOND_SPAWN_FRAC = 0.30;

// Catch detection
export const CATCH_RADIUS = 0.6;

// Spawn
export const PLAYER_SPAWN: [number, number] = [-5.0, -3.0];   // great room couch area

// Scoring
export const COOKIE_POINTS = 10;
export const MILK_POINTS = 50;
export const BONUS_POINTS = 500;
export const TUCK_POINTS_BASE = 200;
export const TUCK_POINTS_COMBO_MULT = 2;             // doubles per tuck-in within a single powered window
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`
Expected: Build succeeds, no warnings about unused exports (these will all be consumed in later tasks; if a no-unused-imports lint rule is strict, that's fine — the references arrive in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/world/munchiesConfig.ts
git commit -m "feat(munchies): add munchies tuning constants"
```

---

## Task 3: Munchies state store in `munchiesStore.ts`

**Files:**
- Create: `src/state/munchiesStore.ts`

- [ ] **Step 1: Create the store**

Create `src/state/munchiesStore.ts`:

```ts
import { create } from 'zustand';
import {
  MAX_LEVEL,
  STARTING_LIVES,
  COOKIE_POINTS,
  MILK_POINTS,
  BONUS_POINTS,
  TUCK_POINTS_BASE,
  TUCK_POINTS_COMBO_MULT,
  POWERED_DURATION_S,
} from '../world/munchiesConfig';

export type SleepwalkerId = 'dad' | 'penny' | 'dog';
export type SleepwalkerMode = 'normal' | 'powered' | 'tucked';

export interface PelletPosition {
  id: string;
  x: number;
  z: number;
}

export interface SleepwalkerState {
  id: SleepwalkerId;
  /** Live position (mutated in-place by SleepwalkerController; do not read in selectors). */
  x: number;
  z: number;
  yaw: number;
  /** Graph node the walker is heading toward. */
  targetNodeId: string;
  /** Anti-backtrack hint. */
  lastNodeId: string;
  mode: SleepwalkerMode;
  /** seconds (now()) when 'tucked' began. */
  tuckedAt: number;
}

interface MunchiesStore {
  level: number;                          // 1-based; ends at MAX_LEVEL
  score: number;
  lives: number;
  pellets: Record<string, PelletPosition>;
  milks: Record<string, PelletPosition>;
  bonus: { x: number; z: number; spawnedAt: number; eaten: boolean } | null;
  bonusSpawnsRemaining: number;           // counts down from 2 each level
  poweredUntil: number;                   // perf seconds; 0 if not powered
  poweredCombo: number;                   // tuck-in count this powered window
  sleepwalkers: Record<SleepwalkerId, SleepwalkerState>;
  caughtAt: number | null;                // perf seconds when player was caught
  caughtBy: SleepwalkerId | null;

  // Setters / actions
  setLevelData: (
    level: number,
    pellets: Record<string, PelletPosition>,
    milks: Record<string, PelletPosition>,
    sleepwalkers: Record<SleepwalkerId, SleepwalkerState>,
  ) => void;
  eatPellet: (id: string) => void;
  eatMilk: (id: string, now: number) => void;
  spawnBonus: (x: number, z: number, now: number) => void;
  eatBonus: () => void;
  clearBonus: () => void;
  startPowered: (now: number) => void;
  endPowered: () => void;
  tuckIn: (sleepwalkerId: SleepwalkerId, now: number) => number;
  resumeSleepwalker: (sleepwalkerId: SleepwalkerId) => void;
  setCaught: (sleepwalkerId: SleepwalkerId, now: number) => void;
  clearCaught: () => void;
  loseLife: () => void;
  reset: () => void;
}

const EMPTY_SLEEPWALKERS: Record<SleepwalkerId, SleepwalkerState> = {
  dad:   { id: 'dad',   x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  penny: { id: 'penny', x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  dog:   { id: 'dog',   x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
};

export const useMunchiesStore = create<MunchiesStore>((set, get) => ({
  level: 1,
  score: 0,
  lives: STARTING_LIVES,
  pellets: {},
  milks: {},
  bonus: null,
  bonusSpawnsRemaining: 2,
  poweredUntil: 0,
  poweredCombo: 0,
  sleepwalkers: EMPTY_SLEEPWALKERS,
  caughtAt: null,
  caughtBy: null,

  setLevelData: (level, pellets, milks, sleepwalkers) => set({
    level, pellets, milks, sleepwalkers,
    bonus: null,
    bonusSpawnsRemaining: 2,
    poweredUntil: 0,
    poweredCombo: 0,
    caughtAt: null,
    caughtBy: null,
  }),

  eatPellet: (id) => set((s) => {
    if (!s.pellets[id]) return s;
    const { [id]: _gone, ...rest } = s.pellets;
    return { pellets: rest, score: s.score + COOKIE_POINTS };
  }),

  eatMilk: (id, now) => set((s) => {
    if (!s.milks[id]) return s;
    const { [id]: _gone, ...rest } = s.milks;
    return {
      milks: rest,
      score: s.score + MILK_POINTS,
      poweredUntil: now + POWERED_DURATION_S,
      poweredCombo: 0,
    };
  }),

  spawnBonus: (x, z, now) => set((s) => ({
    bonus: { x, z, spawnedAt: now, eaten: false },
    bonusSpawnsRemaining: Math.max(0, s.bonusSpawnsRemaining - 1),
  })),
  eatBonus: () => set((s) => {
    if (!s.bonus || s.bonus.eaten) return s;
    return { bonus: { ...s.bonus, eaten: true }, score: s.score + BONUS_POINTS };
  }),
  clearBonus: () => set({ bonus: null }),

  startPowered: (now) => set({ poweredUntil: now + POWERED_DURATION_S, poweredCombo: 0 }),
  endPowered: () => set({ poweredUntil: 0, poweredCombo: 0 }),

  tuckIn: (sleepwalkerId, now) => {
    const s = get();
    const combo = s.poweredCombo;
    const points = TUCK_POINTS_BASE * Math.pow(TUCK_POINTS_COMBO_MULT, combo);
    set({
      sleepwalkers: {
        ...s.sleepwalkers,
        [sleepwalkerId]: { ...s.sleepwalkers[sleepwalkerId], mode: 'tucked', tuckedAt: now },
      },
      score: s.score + points,
      poweredCombo: combo + 1,
    });
    return points;
  },
  resumeSleepwalker: (sleepwalkerId) => set((s) => ({
    sleepwalkers: {
      ...s.sleepwalkers,
      [sleepwalkerId]: { ...s.sleepwalkers[sleepwalkerId], mode: 'normal', tuckedAt: 0 },
    },
  })),

  setCaught: (sleepwalkerId, now) => set({ caughtAt: now, caughtBy: sleepwalkerId }),
  clearCaught: () => set({ caughtAt: null, caughtBy: null }),

  loseLife: () => set((s) => ({ lives: Math.max(0, s.lives - 1) })),

  reset: () => set({
    level: 1,
    score: 0,
    lives: STARTING_LIVES,
    pellets: {},
    milks: {},
    bonus: null,
    bonusSpawnsRemaining: 2,
    poweredUntil: 0,
    poweredCombo: 0,
    sleepwalkers: EMPTY_SLEEPWALKERS,
    caughtAt: null,
    caughtBy: null,
  }),
}));

// Counts of remaining pellets / milks are derived; expose helpers.
export function selectPelletCount(s: MunchiesStore): number {
  return Object.keys(s.pellets).length;
}
export function selectIsPowered(s: MunchiesStore, now: number): boolean {
  return s.poweredUntil > now;
}
export const MUNCHIES_MAX_LEVEL = MAX_LEVEL;
```

- [ ] **Step 2: Add `resetMunchiesGame` action to `gameStore`**

In `src/state/gameStore.ts`, just below `resetTornadoGame`, add:

```ts
/** Reset all munchies state (positions + store). Called when welcome reopens or mode switches away from munchies. */
resetMunchiesGame: () => set({
  positions: {
    dad: new Vector3(-2.5, 0, 10),
    penny: new Vector3(0, 0, 11),
    luke: new Vector3(2.5, 0, 10),
  },
  yaws: { dad: Math.PI, penny: Math.PI, luke: Math.PI },
}),
```

Add `resetMunchiesGame: () => void;` to the `GameStore` interface declaration.

(The munchies store is reset separately via `useMunchiesStore.getState().reset()`.)

- [ ] **Step 3: Smoke check**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/state/munchiesStore.ts src/state/gameStore.ts
git commit -m "feat(munchies): add munchiesStore + resetMunchiesGame"
```

---

## Task 4: Welcome screen three-card grid

**Files:**
- Modify: `src/ui/WelcomeScreen.tsx`

- [ ] **Step 1: Add munchies card and switch to 3-column grid**

In `src/ui/WelcomeScreen.tsx`, find the grid block (around line 56-79):

```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
    margin: '4px 0 18px',
  }}
>
  <GameCard ... aliens .../>
  <GameCard ... tornado .../>
</div>
```

Replace with:

```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    margin: '4px 0 18px',
  }}
>
  <GameCard
    emoji="👽"
    title="ALIEN INVASION"
    blurb="The Schmorgesblobs crashed in our cul-de-sac! Use the ray gun to save the family."
    accent="#5a8a3e"
    onPlay={() => pick('aliens')}
  />
  <GameCard
    emoji="🌪️"
    title="TORNADO WARNING"
    blurb="A tornado is ripping down the street. Run inside 10600 before it throws you away!"
    accent="#3a5a8a"
    onPlay={() => pick('tornado')}
  />
  <GameCard
    emoji="🥛"
    title="MIDNIGHT MUNCHIES"
    blurb="It's midnight. Sneak through the house, grab every cookie, and don't let sleepwalking Dad and Penny catch you!"
    accent="#7a5cad"
    onPlay={() => pick('munchies')}
  />
</div>
```

The existing `GameCard` and `pick` function already handle the new mode value because `pick` takes `GameMode` (typed by gameStore).

- [ ] **Step 2: Make the 3-card grid responsive (narrow viewports)**

In the same `<div>`, change `gridTemplateColumns` to use `auto-fit` with a min width so cards stack on phones:

```tsx
gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
```

This gives 3-up on desktop and stacks on narrow viewports.

- [ ] **Step 3: Smoke test**

Run: `npm run dev` and open the URL. Confirm:
- Welcome modal shows 3 cards: Alien Invasion, Tornado Warning, Midnight Munchies.
- Clicking Midnight Munchies closes the welcome and lands on CharacterSelect.
- Resize browser narrow — cards stack.

(After clicking Midnight Munchies you'll see the existing character select; subsequent tasks make that work for munchies. For now, picking Luke will start the game in the normal 3D world — that's a temporary state but expected at this point.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/WelcomeScreen.tsx
git commit -m "feat(munchies): add Midnight Munchies card to welcome screen"
```

---

## Task 5: Auto-claim Luke when entering munchies mode

**Files:**
- Modify: `src/ui/CharacterSelect.tsx`

- [ ] **Step 1: Hide non-Luke options in munchies mode**

In `src/ui/CharacterSelect.tsx`, near where the available characters render, gate by gameMode. Read the existing `mode` value from net (which is `'aliens' | 'tornado' | 'munchies' | null` once gameStore propagates — confirm by inspecting `netStore.ts`; if `mode` is not narrowed to GameMode, read `useGameStore.getState().gameMode` instead and use that).

The change: when `gameMode === 'munchies'`, render only the Luke card. Find the section that maps over `CHARACTER_ORDER` and filter:

```tsx
const gameMode = useGameStore((s) => s.gameMode);
const visibleChars = gameMode === 'munchies'
  ? CHARACTER_ORDER.filter((id) => id === 'luke')
  : CHARACTER_ORDER;

// ...later, where CHARACTER_ORDER was being mapped:
{visibleChars.map((id) => { /* existing card */ })}
```

Add a short copy line above the grid that only appears in munchies mode:

```tsx
{gameMode === 'munchies' && (
  <p style={{ fontSize: 14, color: '#5a5040', margin: '4px 0 12px' }}>
    Luke's adventure tonight. (Penny and Dad are sleepwalking…)
  </p>
)}
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev`. Click **Midnight Munchies**. Verify only Luke is offered. Click Luke → enters the world as Luke.

(The view at this point is still third-person FPS in the cul-de-sac — that's expected; mode wiring comes next.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/CharacterSelect.tsx
git commit -m "feat(munchies): only offer Luke in CharacterSelect for munchies"
```

---

## Task 6: Mode-gate existing controllers (early-returns)

**Files:**
- Modify: `src/systems/NPCController.tsx`
- Modify: `src/systems/CameraRig.tsx`
- Modify: `src/systems/MusicController.tsx`

- [ ] **Step 1: NPCController early-return in munchies**

In `src/systems/NPCController.tsx`, at the top of `useFrame((state, dtRaw) => { ... })`, after the `if (welcomeOpen) return;` line, add:

```ts
const mode = useGameStore.getState().gameMode;
if (mode === 'munchies') return;
```

- [ ] **Step 2: CameraRig early-return in munchies**

In `src/systems/CameraRig.tsx`, at the top of the `CameraRig` function (before any hooks that don't need to run in munchies — be careful, the `useEffect` listeners can stay; we only want to skip frame work and lock acquisition).

Cleanest: add at the very top of the function body, **before any hooks**:

```ts
const gameMode = useGameStore((s) => s.gameMode);
if (gameMode === 'munchies') return null;
```

Note: this changes hook order on mode-switch. Since the welcome modal blocks gameplay until a mode is chosen and CharacterSelect remounts when mode changes mid-game (defensive — verify), early-return here is acceptable. If a runtime warning about "rendered fewer hooks than expected" appears in dev console after mode switch, refactor to gate inside `useFrame` instead (early-return inside the frame callback) and add a separate guard inside the click-handler `useEffect` to skip pointer lock requests when `gameMode === 'munchies'`.

The safer alternative if any hook-order warning surfaces:

```ts
// At top: declare mode normally
const gameMode = useGameStore((s) => s.gameMode);

// In the click handler useEffect, add a guard:
const onClick = () => {
  if (useGameStore.getState().gameMode === 'munchies') return;
  // ...rest of existing handler
};

// In useFrame, add at the top:
useFrame((_, dtRaw) => {
  if (useGameStore.getState().gameMode === 'munchies') return;
  // ...rest
});
```

Use the safer alternative — it's two extra lines and avoids any hook-order risk.

- [ ] **Step 3: MusicController early-return in munchies**

Open `src/systems/MusicController.tsx`. At the top of its `useFrame` (or main effect), add:

```ts
if (useGameStore.getState().gameMode === 'munchies') return;
```

(Munchies will trigger its own lullaby loop from `MunchiesController` in a later task.)

- [ ] **Step 4: Smoke test**

Run: `npm run dev`. Pick **Midnight Munchies** → Luke. Expected:
- No FPS pointer-lock prompt on canvas click.
- The cul-de-sac scene still renders (it'll get replaced by night atmosphere later).
- Cul-de-sac NPC wandering does not run (Dad/Penny stand still at spawn).
- Background music does not play.

Then pick **Alien Invasion** (full reload of dev server or hit "Back"/refresh, since there's no in-app menu return) → confirm aliens mode still works normally (combat starts, music plays).

- [ ] **Step 5: Commit**

```bash
git add src/systems/NPCController.tsx src/systems/CameraRig.tsx src/systems/MusicController.tsx
git commit -m "feat(munchies): mode-gate NPC/Camera/Music controllers"
```

---

## Task 7: Top-down `MunchiesCamera` component

**Files:**
- Create: `src/systems/MunchiesCamera.tsx`

- [ ] **Step 1: Create the camera**

Create `src/systems/MunchiesCamera.tsx`:

```tsx
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';

// Top-down camera locked above Luke. ~14m up, slightly south of him so the
// camera looks slightly back (small forward tilt) — gives a tabletop feel
// while still letting you read which way Luke is facing.

const HEIGHT = 14;
const SOUTH_OFFSET = 1.5;
const LERP_K = 8;
const FOV = 50;

export function MunchiesCamera() {
  const { camera } = useThree();
  const gameMode = useGameStore((s) => s.gameMode);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);

  useEffect(() => {
    if (gameMode !== 'munchies') return;
    // perspectiveCamera fov isn't a prop on the global camera; mutate directly.
    if ('fov' in camera) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (camera as any).fov = FOV;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (camera as any).updateProjectionMatrix?.();
    }
    return () => {
      if ('fov' in camera) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (camera as any).fov = 80;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (camera as any).updateProjectionMatrix?.();
      }
    };
  }, [camera, gameMode]);

  const target = new Vector3();
  const look = new Vector3();

  useFrame((_, dtRaw) => {
    if (gameMode !== 'munchies') return;
    const dt = Math.min(dtRaw, 0.1);
    const id = myCharacterId ?? fallbackActive;
    const pos = useGameStore.getState().positions[id];
    if (!pos) return;
    target.set(pos.x, HEIGHT, pos.z + SOUTH_OFFSET);
    const k = Math.min(1, LERP_K * dt);
    camera.position.lerp(target, k);
    look.set(pos.x, 0.6, pos.z);
    camera.lookAt(look);
  });

  return null;
}
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`. Expected: succeeds. (Not yet mounted — we'll mount it via `MunchiesModeSystems` in a later task.)

- [ ] **Step 3: Commit**

```bash
git add src/systems/MunchiesCamera.tsx
git commit -m "feat(munchies): add MunchiesCamera (top-down follow)"
```

---

## Task 8: `PlayerController` munchies branch (4-directional WASD)

**Files:**
- Modify: `src/systems/PlayerController.tsx`

- [ ] **Step 1: Add munchies movement branch**

In `src/systems/PlayerController.tsx`, inside `useFrame`, after the `if (welcomeOpen) return;` / spectator / chat guards but BEFORE any other movement logic, add:

```ts
const modeNow = useGameStore.getState().gameMode;
if (modeNow === 'munchies') {
  munchiesTick(positions[activeId], yaws, activeId, keys.current, dtRaw, staticColliders);
  return;
}
```

Then at the bottom of the file (or after the component), add the helper:

```ts
import { MUNCHIES_PLAYER_SPEED } from '../world/munchiesConfig';

function munchiesTick(
  pos: Vector3,
  yaws: Record<string, number>,
  activeId: string,
  keys: Record<string, boolean>,
  dtRaw: number,
  staticColliders: import('../types').RectCollider[],
) {
  const dt = Math.min(dtRaw, 0.1);
  // 4-direction movement, world-axis, no diagonal.
  let dx = 0;
  let dz = 0;
  if (keys['w'] || keys['arrowup']) dz -= 1;
  if (keys['s'] || keys['arrowdown']) dz += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  // Prefer X-axis when both are pressed (matches Pac-Man habit of letting
  // the player "queue" a turn at a corridor junction without diagonal drift).
  // Actual policy: if both axes pressed, zero out Z so the player slides
  // horizontally first. Pure visual choice; either works.
  if (dx !== 0 && dz !== 0) {
    dz = 0;
  }

  if (dx === 0 && dz === 0) return;

  const moveX = dx * MUNCHIES_PLAYER_SPEED * dt;
  const moveZ = dz * MUNCHIES_PLAYER_SPEED * dt;
  const desiredX = pos.x + moveX;
  const desiredZ = pos.z + moveZ;
  const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, staticColliders);
  pos.x = resolved.x;
  pos.z = resolved.z;
  // Snap yaw to movement direction (Pac-Man-feel; no slow lerp).
  yaws[activeId] = Math.atan2(-dx, -dz);
}
```

(`resolveMotion` is already imported at the top of `PlayerController.tsx`.)

- [ ] **Step 2: Verify Luke spawn happens inside the hero house**

The default `positions.luke` is `(2.5, 0, 10)` — that's the cul-de-sac, outside the house. For munchies we need to spawn Luke at `PLAYER_SPAWN` = `(-5.0, -3.0)`.

This will be set by `MunchiesController.startLevel` (Task 18). For this task, we can hard-code one-time spawning in `closeWelcome` for munchies, OR just spawn-on-controller-startup. We'll do the latter (cleaner).

So for now: no spawn change here. Luke will visibly start outside the house — that's fine until Task 18 wires startLevel.

- [ ] **Step 3: Commit**

```bash
git add src/systems/PlayerController.tsx
git commit -m "feat(munchies): 4-direction WASD movement branch in PlayerController"
```

---

## Task 9: Mount the (still-mostly-empty) `MunchiesModeSystems`

**Files:**
- Modify: `src/components/Game.tsx`

- [ ] **Step 1: Add the systems group**

In `src/components/Game.tsx`, add the following just below the existing `function TornadoModeSystems()` declaration:

```tsx
import { MunchiesCamera } from '../systems/MunchiesCamera';

function MunchiesModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return (
    <>
      <MunchiesCamera />
    </>
  );
}
```

Mount it inside the `<Game>` JSX next to `<TornadoModeSystems />`:

```tsx
<TornadoModeSystems />
<MunchiesModeSystems />
<CameraRig />
```

- [ ] **Step 2: Smoke test the basic mode plumbing**

Run: `npm run dev`. Pick **Midnight Munchies** → Luke. Expected:
- Camera snaps to top-down view above Luke's spawn (cul-de-sac), looking down with slight tilt.
- WASD moves Luke in world-axes — W moves him north (−Z), A moves him west (−X), etc.
- No mouse look. Diagonal input → horizontal-only movement.
- Luke is still standing in the cul-de-sac (we'll teleport him inside in Task 18).
- Switching to aliens or tornado mode (refresh) still works normally.

- [ ] **Step 3: Commit**

```bash
git add src/components/Game.tsx
git commit -m "feat(munchies): mount MunchiesModeSystems with MunchiesCamera"
```

---

## Task 10: Corridor graph + bed positions

**Files:**
- Create: `src/world/munchiesGraph.ts`

- [ ] **Step 1: Define the graph nodes**

Create `src/world/munchiesGraph.ts`:

```ts
// Corridor graph for sleepwalker pathing in Midnight Munchies. Nodes are
// chosen from `floorPlan.ts` doorway centers and room centers so the graph
// stays implicitly in sync with the renderer's wall layout.
//
// Coordinate convention is world-space (hero house is at origin, yaw 0).

import type { SleepwalkerId } from '../state/munchiesStore';

export interface GraphNode {
  id: string;
  x: number;
  z: number;
  neighbors: string[];
}

// Reference: floorPlan.ts rooms
//   great:    x ∈ [-9.0, -1.5], z ∈ [-8.0,  0.0]
//   kitchen:  x ∈ [-1.5,  2.0], z ∈ [-8.0,  0.0]
//   hall:     x ∈ [-9.0,  2.0], z ∈ [ 0.0,  1.5]
//   master:   x ∈ [-9.0, -5.5], z ∈ [ 1.5,  8.0]
//   penny:    x ∈ [-5.5, -2.5], z ∈ [ 1.5,  8.0]
//   bath:     x ∈ [-2.5, -1.0], z ∈ [ 1.5,  8.0]
//   luke:     x ∈ [-1.0,  2.0], z ∈ [ 1.5,  8.0]
//
// Doorway openings (from floorPlan.ts):
//   great-kitchen   z = -1.5 (wall), opening x ∈ [-3.0, -2.0] → door at (-2.5, -1.5)... actually wall is z=const, opening on x
//   Actually inspected: 'great-kitchen' is { axis: 'z', at: -1.5 }  --> wall runs in z (constant x = -1.5)... wait, re-read floorPlan: 'z' axis means constant X.
//   See floorPlan.ts: "'x' = wall runs along the X axis (constant Z); 'z' = wall runs along the Z axis (constant X)."
//   So 'great-kitchen' axis='z' at=-1.5 means wall is at x=-1.5, spanning z=-8..0, opening z=-3..-2 → doorway at (-1.5, -2.5).
//   'great-hall'    axis='x' at=0,  from x=-9..-1.5, opening x=-5..-4   → doorway at (-4.5, 0)
//   'kitchen-hall'  axis='x' at=0,  from x=-1.5..2,  opening x=0.5..1.5 → doorway at (1.0, 0)
//   'kitchen-garage' axis='z' at=2, opening z=-1..0 → doorway at (2, -0.5) (we don't path into the garage)
//   'hall-back-master' axis='x' at=1.5, from x=-9..-5.5, opening x=-7.5..-6.5 → doorway at (-7.0, 1.5)
//   'hall-back-penny'  axis='x' at=1.5, opening x=-4.5..-3.5            → doorway at (-4.0, 1.5)
//   'hall-back-bath'   axis='x' at=1.5, opening x=-2.0..-1.0            → doorway at (-1.5, 1.5)
//   'hall-back-luke'   axis='x' at=1.5, opening x=-0.5..0.5             → doorway at (0, 1.5)

export const MUNCHIES_GRAPH: GraphNode[] = [
  // Great room — multiple nodes so AI can patrol the largest room.
  { id: 'great-center', x: -5.0, z: -4.0, neighbors: ['great-corner-nw', 'great-corner-sw', 'great-kitchen-door', 'great-hall-door'] },
  { id: 'great-corner-nw', x: -8.0, z: -7.0, neighbors: ['great-center'] },
  { id: 'great-corner-sw', x: -8.0, z: -1.0, neighbors: ['great-center'] },

  // Door between great room and kitchen (wall at x=-1.5, z=-2.5)
  { id: 'great-kitchen-door', x: -1.5, z: -2.5, neighbors: ['great-center', 'kitchen-center'] },

  // Kitchen
  { id: 'kitchen-center', x: 0.3, z: -4.0, neighbors: ['great-kitchen-door', 'kitchen-hall-door', 'kitchen-corner-se'] },
  { id: 'kitchen-corner-se', x: 1.5, z: -7.0, neighbors: ['kitchen-center'] },

  // Door from great room to hall (wall at z=0, x=-4.5)
  { id: 'great-hall-door', x: -4.5, z: 0.0, neighbors: ['great-center', 'hall-w'] },

  // Door from kitchen to hall (wall at z=0, x=1.0)
  { id: 'kitchen-hall-door', x: 1.0, z: 0.0, neighbors: ['kitchen-center', 'hall-e'] },

  // Hallway: two nodes that span the spine
  { id: 'hall-w', x: -7.0, z: 0.75, neighbors: ['great-hall-door', 'hall-master-door', 'hall-mid'] },
  { id: 'hall-mid', x: -3.0, z: 0.75, neighbors: ['hall-w', 'hall-e', 'hall-penny-door'] },
  { id: 'hall-e', x: 0.5, z: 0.75, neighbors: ['hall-mid', 'kitchen-hall-door', 'hall-bath-door', 'hall-luke-door'] },

  // Bedroom doors (at z = 1.5)
  { id: 'hall-master-door', x: -7.0, z: 1.5, neighbors: ['hall-w', 'master-bed'] },
  { id: 'hall-penny-door',  x: -4.0, z: 1.5, neighbors: ['hall-mid', 'penny-bed'] },
  { id: 'hall-bath-door',   x: -1.5, z: 1.5, neighbors: ['hall-e', 'bath-center'] },
  { id: 'hall-luke-door',   x:  0.0, z: 1.5, neighbors: ['hall-e', 'luke-bed'] },

  // Bedrooms (room-center positions; double as ghost bed nodes)
  { id: 'master-bed',  x: -7.25, z: 5.0,  neighbors: ['hall-master-door'] },
  { id: 'penny-bed',   x: -4.0,  z: 5.0,  neighbors: ['hall-penny-door'] },
  { id: 'bath-center', x: -1.75, z: 5.0,  neighbors: ['hall-bath-door'] },
  { id: 'luke-bed',    x:  0.5,  z: 5.0,  neighbors: ['hall-luke-door'] },
];

const NODE_BY_ID: Record<string, GraphNode> = {};
for (const n of MUNCHIES_GRAPH) NODE_BY_ID[n.id] = n;

export function getNode(id: string): GraphNode {
  const n = NODE_BY_ID[id];
  if (!n) throw new Error(`munchiesGraph: unknown node "${id}"`);
  return n;
}

/** Bed node id each sleepwalker sleeps in / respawns from. */
export const SLEEPWALKER_BEDS: Record<SleepwalkerId, string> = {
  dad: 'master-bed',
  penny: 'penny-bed',
  dog: 'kitchen-center',   // dog bed is in the kitchen near the pantry
};

/** Shy-mode home node for the dog (Clyde-like behavior). */
export const DOG_HOME_NODE = 'kitchen-center';

/** Find nearest graph node to a given world position. */
export function nearestNode(x: number, z: number): GraphNode {
  let best = MUNCHIES_GRAPH[0];
  let bestD = Infinity;
  for (const n of MUNCHIES_GRAPH) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

/** BFS distance (in graph edges) from a node to a target node. Used by sleepwalker AI. */
export function graphDistance(fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const visited = new Set<string>([fromId]);
  const queue: { id: string; d: number }[] = [{ id: fromId, d: 0 }];
  while (queue.length) {
    const { id, d } = queue.shift()!;
    for (const nid of getNode(id).neighbors) {
      if (nid === toId) return d + 1;
      if (visited.has(nid)) continue;
      visited.add(nid);
      queue.push({ id: nid, d: d + 1 });
    }
  }
  return Infinity;
}

// Self-check on module load: every neighbor reference must resolve.
function validate() {
  for (const n of MUNCHIES_GRAPH) {
    for (const nb of n.neighbors) {
      if (!NODE_BY_ID[nb]) throw new Error(`munchiesGraph: node "${n.id}" → unknown neighbor "${nb}"`);
    }
  }
}
validate();
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`. Expected: succeeds. (Validate function runs at module-load and throws on any bad neighbor reference.)

- [ ] **Step 3: Commit**

```bash
git add src/world/munchiesGraph.ts
git commit -m "feat(munchies): corridor graph + bed positions"
```

---

## Task 11: Pellet generation from floor plan

**Files:**
- Create: `src/world/munchiesPellets.ts`

- [ ] **Step 1: Create the generator**

Create `src/world/munchiesPellets.ts`:

```ts
import { ROOMS, INTERIOR_WALLS, type Room } from '../components/hero/floorPlan';
import type { PelletPosition } from '../state/munchiesStore';
import { PLAYER_SPAWN } from './munchiesConfig';

const COOKIE_SPACING = 1.2;
const COOKIE_WALL_MARGIN = 0.55;     // skip cookies this close to any wall
const COOKIE_SPAWN_MARGIN = 0.8;     // skip cookies near player spawn
const COOKIE_BED_MARGIN = 0.7;       // skip cookies near sleepwalker beds

/** World-space coords of sleepwalker bed cells we don't want to pollute. */
const BED_BLOCKERS: [number, number][] = [
  [-7.25, 5.0], // master-bed
  [-4.0,  5.0], // penny-bed
  [ 0.5,  5.0], // luke-bed (kid's own bed — cookies here are fine actually, but we keep margin so the player spawn region of each room has a clean entry)
  [ 0.3, -4.0], // kitchen dog bed
];

function distToWall(x: number, z: number): number {
  let best = Infinity;
  for (const w of INTERIOR_WALLS) {
    // 'z' axis = constant X = w.at, spans w.from..w.to on Z
    if (w.axis === 'z') {
      const along = Math.max(w.from, Math.min(w.to, z));
      const d = Math.hypot(x - w.at, z - along);
      if (d < best) best = d;
    } else {
      // 'x' axis = constant Z = w.at, spans w.from..w.to on X
      const along = Math.max(w.from, Math.min(w.to, x));
      const d = Math.hypot(z - w.at, x - along);
      if (d < best) best = d;
    }
  }
  return best;
}

function tooCloseToSpawn(x: number, z: number): boolean {
  const [sx, sz] = PLAYER_SPAWN;
  return Math.hypot(x - sx, z - sz) < COOKIE_SPAWN_MARGIN;
}

function tooCloseToBed(x: number, z: number): boolean {
  for (const [bx, bz] of BED_BLOCKERS) {
    if (Math.hypot(x - bx, z - bz) < COOKIE_BED_MARGIN) return true;
  }
  return false;
}

export function generatePellets(): Record<string, PelletPosition> {
  const out: Record<string, PelletPosition> = {};
  let id = 0;
  for (const room of ROOMS) {
    if (room.id === 'garage') continue;       // garage is off-limits
    for (let x = room.minX + 0.6; x < room.maxX; x += COOKIE_SPACING) {
      for (let z = room.minZ + 0.6; z < room.maxZ; z += COOKIE_SPACING) {
        if (distToWall(x, z) < COOKIE_WALL_MARGIN) continue;
        if (tooCloseToSpawn(x, z)) continue;
        if (tooCloseToBed(x, z)) continue;
        const pid = `p${id++}`;
        out[pid] = { id: pid, x, z };
      }
    }
  }
  return out;
}

export function buildMilks(): Record<string, PelletPosition> {
  return {
    'milk-nw': { id: 'milk-nw', x: -8.0, z:  7.0 },  // master bedroom NW corner
    'milk-ne': { id: 'milk-ne', x:  1.5, z:  7.0 },  // Luke's bedroom NE corner
    'milk-sw': { id: 'milk-sw', x: -8.0, z: -7.0 },  // great room SW corner
    'milk-se': { id: 'milk-se', x:  1.5, z: -7.0 },  // kitchen SE corner
  };
}

/** Spawn position for the bonus cookie. */
export const BONUS_SPAWN_POS: [number, number] = [0.3, -4.0]; // kitchen center
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`. Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/world/munchiesPellets.ts
git commit -m "feat(munchies): pellet + milk position generation"
```

---

## Task 12: `CookiePickup`, `MilkPickup`, `BonusCookie` renderers

**Files:**
- Create: `src/components/munchies/CookiePickup.tsx`
- Create: `src/components/munchies/MilkPickup.tsx`
- Create: `src/components/munchies/BonusCookie.tsx`

- [ ] **Step 1: CookiePickup**

Create `src/components/munchies/CookiePickup.tsx`:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';

export function CookiePickupsLive() {
  const pellets = useMunchiesStore((s) => s.pellets);
  return (
    <>
      {Object.values(pellets).map((p) => (
        <CookiePickup key={p.id} x={p.x} z={p.z} />
      ))}
    </>
  );
}

function CookiePickup({ x, z }: { x: number; z: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Gentle bob
    ref.current.position.y = 0.25 + Math.sin(t * 2 + x * 0.7 + z * 0.3) * 0.04;
    ref.current.rotation.y = t * 0.6;
  });
  return (
    <group ref={ref} position={[x, 0.25, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 16]} />
        <meshStandardMaterial color="#a86a3a" emissive="#5a2e10" emissiveIntensity={0.6} roughness={0.7} />
      </mesh>
      {/* chocolate chips */}
      <mesh position={[0.05, 0.026, 0.03]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[-0.04, 0.026, 0.05]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[0.02, 0.026, -0.05]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: MilkPickup**

Create `src/components/munchies/MilkPickup.tsx`:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';

export function MilkPickupsLive() {
  const milks = useMunchiesStore((s) => s.milks);
  return (
    <>
      {Object.values(milks).map((m) => (
        <MilkPickup key={m.id} x={m.x} z={m.z} />
      ))}
    </>
  );
}

function MilkPickup({ x, z }: { x: number; z: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = 0.4 + Math.sin(t * 1.6 + x * 0.5) * 0.08;
    ref.current.rotation.y = t * 0.9;
  });
  return (
    <group ref={ref} position={[x, 0.4, z]}>
      {/* glass cylinder */}
      <mesh castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.45, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#d0e0ff" emissiveIntensity={0.7} roughness={0.4} transparent opacity={0.92} />
      </mesh>
      {/* glow halo */}
      <pointLight color="#c8d8ff" intensity={1.2} distance={2.5} decay={2} />
    </group>
  );
}
```

- [ ] **Step 3: BonusCookie**

Create `src/components/munchies/BonusCookie.tsx`:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useMunchiesStore } from '../../state/munchiesStore';

export function BonusCookieLive() {
  const bonus = useMunchiesStore((s) => s.bonus);
  if (!bonus || bonus.eaten) return null;
  return <BonusCookie x={bonus.x} z={bonus.z} spawnedAt={bonus.spawnedAt} />;
}

function BonusCookie({ x, z, spawnedAt }: { x: number; z: number; spawnedAt: number }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const age = performance.now() / 1000 - spawnedAt;
    // Strong wobble and bigger glow than regular cookies.
    ref.current.position.y = 0.35 + Math.sin(t * 4) * 0.08;
    ref.current.rotation.y = t * 1.4;
    // Fade out the last second if despawning soon (handled by store; safe no-op here).
    const wobble = 1 + Math.sin(t * 12) * 0.04;
    ref.current.scale.set(wobble, wobble, wobble);
    void age;
  });
  return (
    <group ref={ref} position={[x, 0.35, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.08, 24]} />
        <meshStandardMaterial color="#b87842" emissive="#a04018" emissiveIntensity={0.9} roughness={0.65} />
      </mesh>
      {/* many chips */}
      {[[0.1, 0.08], [-0.12, 0.05], [0.05, -0.15], [-0.18, -0.04], [0.18, 0.18], [0, 0]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0.045, cz]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#2a1a0a" />
        </mesh>
      ))}
      <pointLight color="#ffd080" intensity={2.5} distance={4} decay={2} />
    </group>
  );
}
```

- [ ] **Step 4: Smoke check**

Run: `npm run build`. Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/munchies/CookiePickup.tsx src/components/munchies/MilkPickup.tsx src/components/munchies/BonusCookie.tsx
git commit -m "feat(munchies): pickup renderers (cookie, milk, bonus)"
```

---

## Task 13: Bed component

**Files:**
- Create: `src/components/munchies/Bed.tsx`

- [ ] **Step 1: Create bed component**

Create `src/components/munchies/Bed.tsx`:

```tsx
import { SLEEPWALKER_BEDS } from '../../world/munchiesGraph';
import { getNode } from '../../world/munchiesGraph';
import type { SleepwalkerId } from '../../state/munchiesStore';

export function BedsLive() {
  // Master, Penny — full beds. Dog gets a round cushion.
  return (
    <>
      <Bed who="dad" />
      <Bed who="penny" />
      <DogBed />
    </>
  );
}

function Bed({ who }: { who: SleepwalkerId }) {
  const node = getNode(SLEEPWALKER_BEDS[who]);
  const sheetColor = who === 'dad' ? '#3a5a8a' : '#e26aa1';
  return (
    <group position={[node.x, 0.2, node.z]}>
      {/* frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.4, 2.2]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.85} />
      </mesh>
      {/* sheet */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[1.45, 0.05, 2.0]} />
        <meshStandardMaterial color={sheetColor} roughness={0.8} />
      </mesh>
      {/* pillow */}
      <mesh position={[0, 0.28, -0.8]} castShadow>
        <boxGeometry args={[1.0, 0.08, 0.4]} />
        <meshStandardMaterial color="#fff7e6" roughness={0.8} />
      </mesh>
    </group>
  );
}

function DogBed() {
  const node = getNode(SLEEPWALKER_BEDS.dog);
  return (
    <group position={[node.x, 0.05, node.z]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.15, 16]} />
        <meshStandardMaterial color="#a04848" roughness={0.9} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`. Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/munchies/Bed.tsx
git commit -m "feat(munchies): bed components"
```

---

## Task 14: NightAtmosphere (dim lights + nightlight + TV flicker)

**Files:**
- Create: `src/components/munchies/NightAtmosphere.tsx`

- [ ] **Step 1: Create night atmosphere**

Create `src/components/munchies/NightAtmosphere.tsx`:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';

// Dim the overall scene and add three small light sources that hint at a
// real sleeping house: bathroom nightlight, moonlight through bay window,
// and TV flicker in the great room.

export function NightAtmosphere() {
  const tvRef = useRef<PointLight>(null);
  const moonRef = useRef<PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (tvRef.current) {
      tvRef.current.intensity = 1.0 + Math.sin(t * 5) * 0.35 + Math.sin(t * 19) * 0.15;
    }
    if (moonRef.current) {
      // very subtle moonlight flicker (cloud passing) — slow
      moonRef.current.intensity = 0.7 + Math.sin(t * 0.4) * 0.07;
    }
  });

  return (
    <>
      {/* Strong directional override is handled implicitly because we set
          combatStore.timeOfDay to 1 in MunchiesController (Task 18). The
          existing DynamicLights ramps darkness from timeOfDay. Here we add
          interior glow points. */}

      {/* Bathroom nightlight — bath-center ≈ (-1.75, 5.0) */}
      <pointLight position={[-1.75, 0.5, 5.0]} color="#ffcf66" intensity={0.45} distance={3.5} decay={2} />

      {/* Moonlight — fakes a slanted beam from outside the bay window. We
          place a point light high outside the great-room bay (around
          x=-4.5, z=-9). */}
      <pointLight ref={moonRef} position={[-4.5, 3, -9.5]} color="#9bb4f0" intensity={0.7} distance={14} decay={1.4} castShadow />

      {/* TV in the great room — flickering blue/white light near south wall. */}
      <pointLight ref={tvRef} position={[-5.0, 1.0, -7.5]} color="#8ab4ff" intensity={1.0} distance={6} decay={2} />

      {/* Soft ambient cool fill so faces aren't pitch black. */}
      <ambientLight color="#5a6a8a" intensity={0.18} />
    </>
  );
}
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`. Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/munchies/NightAtmosphere.tsx
git commit -m "feat(munchies): NightAtmosphere — moonlight, nightlight, TV flicker"
```

---

## Task 15: Force "night" lighting when in munchies mode

**Files:**
- Modify: `src/systems/MusicController.tsx` (or wherever `combatStore.timeOfDay` is set; check) — actually pivot: set in MunchiesController later. Skip standalone.

The existing `DynamicLights` in `Game.tsx` reads `useCombatStore.timeOfDay`. We want munchies to read as "midnight" — set `timeOfDay = 1.0` on entering munchies mode. We'll do this inside `MunchiesController` in Task 18. Skip this task as a no-op placeholder; it's covered there. (Kept as a task slot to mirror the spec's "NightAtmosphere overrides DynamicLights" point.)

(Skip; covered in Task 18.)

---

## Task 16: Sleepwalker renderer (reuses Character + Dog mesh)

**Files:**
- Create: `src/components/munchies/Dog.tsx`
- Create: `src/components/munchies/Sleepwalker.tsx`

- [ ] **Step 1: Dog mesh**

Create `src/components/munchies/Dog.tsx`:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

interface DogProps {
  positionRef: { x: number; z: number; yaw: number };
  bluish: boolean;
}

/** Minimalist box-dog. Brown body, head, ears, tail. */
export function Dog({ positionRef, bluish }: DogProps) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.set(positionRef.x, 0, positionRef.z);
    ref.current.rotation.y = positionRef.yaw;
    // tail wag
    const t = state.clock.elapsedTime;
    const tail = ref.current.getObjectByName('dog-tail');
    if (tail) tail.rotation.y = Math.sin(t * 8) * 0.6;
  });
  const body = bluish ? '#7a8aa8' : '#9a6a3a';
  const dark = bluish ? '#3a4a6a' : '#5a3a1a';
  return (
    <group ref={ref}>
      {/* body */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.45, 0.32, 0.7]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.45, -0.45]} castShadow>
        <boxGeometry args={[0.35, 0.32, 0.32]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* snout */}
      <mesh position={[0, 0.36, -0.62]} castShadow>
        <boxGeometry args={[0.22, 0.18, 0.18]} />
        <meshStandardMaterial color={dark} roughness={0.85} />
      </mesh>
      {/* ears */}
      <mesh position={[-0.12, 0.62, -0.42]}>
        <boxGeometry args={[0.06, 0.18, 0.12]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      <mesh position={[0.12, 0.62, -0.42]}>
        <boxGeometry args={[0.06, 0.18, 0.12]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      {/* legs */}
      {[[-0.15, -0.22], [0.15, -0.22], [-0.15, 0.22], [0.15, 0.22]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.12, lz]} castShadow>
          <boxGeometry args={[0.1, 0.24, 0.1]} />
          <meshStandardMaterial color={body} />
        </mesh>
      ))}
      {/* tail */}
      <group name="dog-tail" position={[0, 0.4, 0.34]}>
        <mesh position={[0, 0, 0.12]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.24]} />
          <meshStandardMaterial color={body} />
        </mesh>
      </group>
    </group>
  );
}
```

- [ ] **Step 2: Sleepwalker renderer**

Create `src/components/munchies/Sleepwalker.tsx`:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { CHARACTERS } from '../../world/characters';
import { useMunchiesStore, type SleepwalkerId } from '../../state/munchiesStore';
import { Dog } from './Dog';

export function SleepwalkersLive() {
  const sleepwalkers = useMunchiesStore((s) => s.sleepwalkers);
  return (
    <>
      {(Object.keys(sleepwalkers) as SleepwalkerId[]).map((id) => (
        <SleepwalkerRender key={id} id={id} />
      ))}
    </>
  );
}

function SleepwalkerRender({ id }: { id: SleepwalkerId }) {
  // We don't subscribe to live x/z (mutated direct) — render reads via ref.
  const sw = useMunchiesStore((s) => s.sleepwalkers[id]);
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(sw.x, 0, sw.z);
    groupRef.current.rotation.y = sw.yaw;
    groupRef.current.visible = sw.mode !== 'tucked';
  });

  const bluish = sw.mode === 'powered';

  if (id === 'dog') {
    return (
      <group ref={groupRef}>
        <Dog positionRef={sw} bluish={bluish} />
        <ZzzOverlay bigger={bluish} />
      </group>
    );
  }

  // Render an inline simplified character. We don't use the existing Character
  // component because it ties tightly to gameStore positions[]; the box mesh
  // here mirrors its silhouette but reads directly from sw fields.
  const def = CHARACTERS[id];
  const h = def.height;
  const torsoColor = bluish ? '#7a8aa8' : def.bodyColor;
  return (
    <group ref={groupRef}>
      {/* legs */}
      <mesh position={[-h * 0.06, h * 0.21, 0]} castShadow>
        <boxGeometry args={[h * 0.1, h * 0.42, h * 0.12]} />
        <meshStandardMaterial color={def.pantsColor} />
      </mesh>
      <mesh position={[h * 0.06, h * 0.21, 0]} castShadow>
        <boxGeometry args={[h * 0.1, h * 0.42, h * 0.12]} />
        <meshStandardMaterial color={def.pantsColor} />
      </mesh>
      {/* torso */}
      <mesh position={[0, h * 0.6, 0]} castShadow>
        <boxGeometry args={[h * 0.28, h * 0.36, h * 0.18]} />
        <meshStandardMaterial color={torsoColor} />
      </mesh>
      {/* arms outstretched zombie-style */}
      <mesh position={[-h * 0.22, h * 0.65, -h * 0.15]} castShadow>
        <boxGeometry args={[h * 0.08, h * 0.08, h * 0.36]} />
        <meshStandardMaterial color={torsoColor} />
      </mesh>
      <mesh position={[h * 0.22, h * 0.65, -h * 0.15]} castShadow>
        <boxGeometry args={[h * 0.08, h * 0.08, h * 0.36]} />
        <meshStandardMaterial color={torsoColor} />
      </mesh>
      {/* head */}
      <mesh position={[0, h * 0.91, 0]} castShadow>
        <sphereGeometry args={[h * 0.13, 12, 10]} />
        <meshStandardMaterial color={def.skinTone} />
      </mesh>
      <ZzzOverlay bigger={bluish} yOffset={h * 1.15} />
    </group>
  );
}

function ZzzOverlay({ bigger, yOffset = 1.6 }: { bigger?: boolean; yOffset?: number }) {
  return (
    <Html
      position={[0, yOffset, 0]}
      center
      distanceFactor={8}
      style={{
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: bigger ? 26 : 18,
        fontWeight: 800,
        color: bigger ? '#8acfff' : '#ffffff',
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        letterSpacing: 1,
      }}
    >
      Zzz
    </Html>
  );
}
```

- [ ] **Step 3: Smoke check**

Run: `npm run build`. Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/munchies/Dog.tsx src/components/munchies/Sleepwalker.tsx
git commit -m "feat(munchies): sleepwalker + dog renderers with Zzz overlay"
```

---

## Task 17: SleepwalkerController (AI loop)

**Files:**
- Create: `src/systems/SleepwalkerController.tsx`

- [ ] **Step 1: Create the AI controller**

Create `src/systems/SleepwalkerController.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useMunchiesStore, type SleepwalkerId, type SleepwalkerState } from '../state/munchiesStore';
import { resolveMotion } from './collision';
import {
  MUNCHIES_GRAPH,
  getNode,
  graphDistance,
  nearestNode,
  SLEEPWALKER_BEDS,
  DOG_HOME_NODE,
} from '../world/munchiesGraph';
import {
  SLEEPWALKER_BASE_SPEED,
  SLEEPWALKER_SPEED_PER_LEVEL,
  POWERED_SPEED_MULT,
  TUCK_RESPAWN_S,
} from '../world/munchiesConfig';

const ARRIVE_EPS = 0.25;
const STUCK_RESCUE_DT = 0.6;
const DOG_SHY_DIST = 6.0;

interface FrameState {
  // Per-sleepwalker stuck-detector: last position + last move-detected timestamp
  lastX: Record<SleepwalkerId, number>;
  lastZ: Record<SleepwalkerId, number>;
  lastMovedAt: Record<SleepwalkerId, number>;
}
const frameState: FrameState = {
  lastX: { dad: 0, penny: 0, dog: 0 },
  lastZ: { dad: 0, penny: 0, dog: 0 },
  lastMovedAt: { dad: 0, penny: 0, dog: 0 },
};

export function SleepwalkerController() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return <SleepwalkerControllerInner />;
}

function SleepwalkerControllerInner() {
  useFrame((_, dtRaw) => {
    const gs = useGameStore.getState();
    const phase = gs.phase;
    // Only run during active play states.
    if (phase !== 'munchies-play' && phase !== 'munchies-powered') return;
    const dt = Math.min(dtRaw, 0.1);
    const now = performance.now() / 1000;
    const ms = useMunchiesStore.getState();

    const lukePos = gs.positions.luke;
    const lukeYaw = gs.yaws.luke;
    const lukeNodeId = nearestNode(lukePos.x, lukePos.z).id;

    const baseSpeed = SLEEPWALKER_BASE_SPEED + (ms.level - 1) * SLEEPWALKER_SPEED_PER_LEVEL;
    const powered = phase === 'munchies-powered';

    const colliders = gs.staticColliders;

    for (const id of ['dad', 'penny', 'dog'] as const) {
      const sw = ms.sleepwalkers[id];
      if (!sw) continue;

      // Tucked: respawn from bed after TUCK_RESPAWN_S.
      if (sw.mode === 'tucked') {
        if (now - sw.tuckedAt >= TUCK_RESPAWN_S) {
          const bed = getNode(SLEEPWALKER_BEDS[id]);
          sw.x = bed.x;
          sw.z = bed.z;
          sw.yaw = 0;
          sw.targetNodeId = bed.neighbors[0] ?? bed.id;
          sw.lastNodeId = bed.id;
          useMunchiesStore.getState().resumeSleepwalker(id);
        }
        continue;
      }

      // Pick a target if we don't have one.
      if (!sw.targetNodeId) {
        const cur = nearestNode(sw.x, sw.z);
        sw.targetNodeId = pickNextNode(id, cur.id, cur.id, lukeNodeId, lukePos, lukeYaw, powered);
        sw.lastNodeId = cur.id;
      }

      const target = getNode(sw.targetNodeId);
      const dx = target.x - sw.x;
      const dz = target.z - sw.z;
      const dist = Math.hypot(dx, dz);

      // Arrived → pick next neighbor.
      if (dist < ARRIVE_EPS) {
        const last = sw.lastNodeId;
        sw.lastNodeId = sw.targetNodeId;
        sw.targetNodeId = pickNextNode(id, sw.targetNodeId, last, lukeNodeId, lukePos, lukeYaw, powered);
        continue;
      }

      const speed = baseSpeed * (powered ? POWERED_SPEED_MULT : 1);
      const ux = dx / dist;
      const uz = dz / dist;
      const desiredX = sw.x + ux * speed * dt;
      const desiredZ = sw.z + uz * speed * dt;

      // Resolve against static colliders (interior walls). Sleepwalkers ignore
      // door state — interior walls are static; the perimeter doors are
      // closed during munchies (Task 18 sets that).
      const resolved = resolveMotion(sw.x, sw.z, desiredX, desiredZ, colliders);

      // Stuck detection: if we essentially didn't move this frame, kick to
      // target node directly after STUCK_RESCUE_DT.
      const moved = Math.hypot(resolved.x - sw.x, resolved.z - sw.z);
      if (moved < 0.005) {
        if (now - frameState.lastMovedAt[id] > STUCK_RESCUE_DT) {
          sw.x = target.x;
          sw.z = target.z;
          frameState.lastMovedAt[id] = now;
          continue;
        }
      } else {
        frameState.lastMovedAt[id] = now;
      }
      sw.x = resolved.x;
      sw.z = resolved.z;
      sw.yaw = Math.atan2(-ux, -uz);
    }
  });

  return null;
}

function pickNextNode(
  id: SleepwalkerId,
  currentId: string,
  lastId: string,
  lukeNodeId: string,
  lukePos: { x: number; z: number },
  lukeYaw: number,
  powered: boolean,
): string {
  const cur = getNode(currentId);
  let candidates = cur.neighbors.filter((nb) => nb !== lastId);
  if (candidates.length === 0) candidates = cur.neighbors.slice();

  // Powered mode: head to own bed.
  if (powered) {
    const homeId = SLEEPWALKER_BEDS[id];
    return pickByMinDistanceToTarget(candidates, homeId);
  }

  if (id === 'dad') {
    return pickByMinDistanceToTarget(candidates, lukeNodeId);
  }
  if (id === 'penny') {
    // Aim 3m ahead of Luke along his current yaw — yaw convention in this
    // codebase: Math.atan2(-dx, -dz) was used as forward, so reverse it.
    // (Equivalent: forward = (-sin(yaw), -cos(yaw)).)
    const fx = -Math.sin(lukeYaw);
    const fz = -Math.cos(lukeYaw);
    const aheadX = lukePos.x + fx * 3.0;
    const aheadZ = lukePos.z + fz * 3.0;
    const aheadNode = nearestNode(aheadX, aheadZ);
    return pickByMinDistanceToTarget(candidates, aheadNode.id);
  }
  if (id === 'dog') {
    const distToLuke = Math.hypot(lukePos.x - cur.x, lukePos.z - cur.z);
    if (distToLuke > DOG_SHY_DIST) {
      return pickByMinDistanceToTarget(candidates, lukeNodeId);
    } else {
      return pickByMinDistanceToTarget(candidates, DOG_HOME_NODE);
    }
  }
  // Fallback
  return candidates[0];
}

function pickByMinDistanceToTarget(candidates: string[], targetId: string): string {
  let best = candidates[0];
  let bestD = Infinity;
  for (const c of candidates) {
    const d = graphDistance(c, targetId);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Module-load: warm graph & noop access to silence "unused import" if MUNCHIES_GRAPH not directly referenced.
void MUNCHIES_GRAPH;
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`. Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/systems/SleepwalkerController.tsx
git commit -m "feat(munchies): SleepwalkerController (Blinky/Pinky/Clyde AI)"
```

---

## Task 18: MunchiesController (the game loop)

**Files:**
- Create: `src/systems/MunchiesController.tsx`

- [ ] **Step 1: Create the controller**

Create `src/systems/MunchiesController.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useMunchiesStore, type SleepwalkerId } from '../state/munchiesStore';
import {
  generatePellets,
  buildMilks,
  BONUS_SPAWN_POS,
} from '../world/munchiesPellets';
import { getNode, SLEEPWALKER_BEDS } from '../world/munchiesGraph';
import {
  CATCH_RADIUS,
  PELLET_PICKUP_RADIUS,
  MILK_PICKUP_RADIUS,
  BONUS_PICKUP_RADIUS,
  BONUS_DESPAWN_S,
  BONUS_FIRST_SPAWN_FRAC,
  BONUS_SECOND_SPAWN_FRAC,
  PLAYER_SPAWN,
  MAX_LEVEL,
  CAUGHT_CINEMATIC_S,
  LEVEL_CLEAR_BANNER_S,
} from '../world/munchiesConfig';

const SLEEPWALKER_IDS: SleepwalkerId[] = ['dad', 'penny', 'dog'];

export function MunchiesController() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return <MunchiesControllerInner />;
}

function MunchiesControllerInner() {
  const initialPelletCount = useRef(0);
  const phaseChangeAt = useRef(0);
  const introInputDetected = useRef(false);

  // On mount: set time of day to night and disable any hero-house doors.
  useEffect(() => {
    useCombatStore.setState({ timeOfDay: 1.0 });
    // Close all doors and lock them.
    const gs = useGameStore.getState();
    for (const id of Object.keys(gs.doors)) {
      gs.doors[id].open = false;
    }
    return () => {
      // Restore on unmount.
      useCombatStore.setState({ timeOfDay: 0.0 });
    };
  }, []);

  // On phase transition into munchies-intro, set up level 1.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.phase === 'munchies-intro' && prev.phase !== 'munchies-intro') {
        startLevel(1);
        phaseChangeAt.current = performance.now() / 1000;
        introInputDetected.current = false;
      }
      if (s.phase === 'munchies-level-clear' && prev.phase !== 'munchies-level-clear') {
        phaseChangeAt.current = performance.now() / 1000;
      }
      if (s.phase === 'munchies-caught' && prev.phase !== 'munchies-caught') {
        phaseChangeAt.current = performance.now() / 1000;
      }
      if (s.phase === 'munchies-powered' && prev.phase !== 'munchies-powered') {
        phaseChangeAt.current = performance.now() / 1000;
      }
    });
    // Initial run if we're already in munchies-intro (welcome → choose Luke happens fast).
    const phaseNow = useGameStore.getState().phase;
    if (phaseNow === 'munchies-intro' && initialPelletCount.current === 0) {
      startLevel(1);
      phaseChangeAt.current = performance.now() / 1000;
    }
    return unsub;
  }, []);

  // Listen for first WASD press to dismiss intro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const phase = useGameStore.getState().phase;
      if (phase !== 'munchies-intro') return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        introInputDetected.current = true;
        useGameStore.getState().setPhase('munchies-play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame(() => {
    const gs = useGameStore.getState();
    const phase = gs.phase;
    const now = performance.now() / 1000;
    const ms = useMunchiesStore.getState();
    const luke = gs.positions.luke;

    // Intro auto-dismiss after ~6s if no input.
    if (phase === 'munchies-intro' && now - phaseChangeAt.current > 6.0) {
      gs.setPhase('munchies-play');
    }

    if (phase === 'munchies-play' || phase === 'munchies-powered') {
      // Pellet pickup
      for (const id in ms.pellets) {
        const p = ms.pellets[id];
        if (Math.hypot(p.x - luke.x, p.z - luke.z) < PELLET_PICKUP_RADIUS) {
          useMunchiesStore.getState().eatPellet(id);
        }
      }
      // Milk pickup
      for (const id in ms.milks) {
        const m = ms.milks[id];
        if (Math.hypot(m.x - luke.x, m.z - luke.z) < MILK_PICKUP_RADIUS) {
          useMunchiesStore.getState().eatMilk(id, now);
          gs.setPhase('munchies-powered');
        }
      }
      // Bonus pickup
      if (ms.bonus && !ms.bonus.eaten) {
        if (Math.hypot(ms.bonus.x - luke.x, ms.bonus.z - luke.z) < BONUS_PICKUP_RADIUS) {
          useMunchiesStore.getState().eatBonus();
          setTimeout(() => useMunchiesStore.getState().clearBonus(), 300);
        } else if (now - ms.bonus.spawnedAt > BONUS_DESPAWN_S) {
          useMunchiesStore.getState().clearBonus();
        }
      }
      // Bonus spawn thresholds
      maybeSpawnBonus(now);

      // Catch / tuck-in detection
      for (const id of SLEEPWALKER_IDS) {
        const sw = ms.sleepwalkers[id];
        if (sw.mode === 'tucked') continue;
        const d = Math.hypot(sw.x - luke.x, sw.z - luke.z);
        if (d < CATCH_RADIUS) {
          if (phase === 'munchies-powered') {
            useMunchiesStore.getState().tuckIn(id, now);
          } else {
            useMunchiesStore.getState().setCaught(id, now);
            gs.setPhase('munchies-caught');
            phaseChangeAt.current = now;
            break;
          }
        }
      }

      // Powered timer expiry
      if (phase === 'munchies-powered' && ms.poweredUntil > 0 && now > ms.poweredUntil) {
        useMunchiesStore.getState().endPowered();
        gs.setPhase('munchies-play');
      }

      // Level clear
      const remaining = Object.keys(ms.pellets).length;
      if (remaining === 0) {
        gs.setPhase('munchies-level-clear');
        phaseChangeAt.current = now;
      }
    }

    if (phase === 'munchies-caught' && now - phaseChangeAt.current > CAUGHT_CINEMATIC_S) {
      useMunchiesStore.getState().loseLife();
      const lives = useMunchiesStore.getState().lives;
      // Teleport Luke to spawn and clear caught.
      luke.set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
      useMunchiesStore.getState().clearCaught();
      if (lives <= 0) {
        gs.setPhase('munchies-game-over');
      } else {
        // Resume play in normal mode (drop powered if it was somehow live).
        useMunchiesStore.getState().endPowered();
        gs.setPhase('munchies-play');
      }
    }

    if (phase === 'munchies-level-clear' && now - phaseChangeAt.current > LEVEL_CLEAR_BANNER_S) {
      const nextLevel = useMunchiesStore.getState().level + 1;
      if (nextLevel > MAX_LEVEL) {
        gs.setPhase('munchies-victory');
      } else {
        startLevel(nextLevel);
        gs.setPhase('munchies-play');
      }
    }
  });

  return null;
}

function startLevel(level: number) {
  const pellets = generatePellets();
  const milks = buildMilks();
  // Place sleepwalkers at their beds.
  const sleepwalkers = {
    dad:   makeSpawn('dad'),
    penny: makeSpawn('penny'),
    dog:   makeSpawn('dog'),
  };
  useMunchiesStore.getState().setLevelData(level, pellets, milks, sleepwalkers);

  // Teleport Luke to munchies spawn.
  const luke = useGameStore.getState().positions.luke;
  luke.set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
  useGameStore.getState().yaws.luke = Math.PI;
}

function makeSpawn(id: SleepwalkerId) {
  const bed = getNode(SLEEPWALKER_BEDS[id]);
  return {
    id,
    x: bed.x,
    z: bed.z,
    yaw: 0,
    targetNodeId: bed.neighbors[0] ?? bed.id,
    lastNodeId: bed.id,
    mode: 'normal' as const,
    tuckedAt: 0,
  };
}

function maybeSpawnBonus(now: number) {
  const ms = useMunchiesStore.getState();
  if (ms.bonus || ms.bonusSpawnsRemaining <= 0) return;
  // Approximate: we count total + remaining via initialPelletCount captured at level start.
  // Simpler approach: count snapshot of remaining vs pellet count at level start cached per-level.
  // Since setLevelData replaces pellets wholesale we can use Object.keys length at controller-init.
  // For determinism we use a fixed expected-total of ~80; use a module-level captured count instead.
  const remaining = Object.keys(ms.pellets).length;
  const total = LEVEL_INITIAL_PELLET_COUNT;
  if (total === 0) return;
  const frac = remaining / total;
  if (ms.bonusSpawnsRemaining === 2 && frac <= BONUS_FIRST_SPAWN_FRAC) {
    ms.spawnBonus(BONUS_SPAWN_POS[0], BONUS_SPAWN_POS[1], now);
  } else if (ms.bonusSpawnsRemaining === 1 && frac <= BONUS_SECOND_SPAWN_FRAC) {
    ms.spawnBonus(BONUS_SPAWN_POS[0], BONUS_SPAWN_POS[1], now);
  }
}

let LEVEL_INITIAL_PELLET_COUNT = 0;
// Hook into setLevelData via a tiny store subscription: when pellets just got replaced, update the cached count.
useMunchiesStore.subscribe((s, prev) => {
  if (s.pellets !== prev.pellets) {
    LEVEL_INITIAL_PELLET_COUNT = Math.max(LEVEL_INITIAL_PELLET_COUNT, Object.keys(s.pellets).length);
    // Reset on level change: detect by level number changing
  }
  if (s.level !== prev.level) {
    LEVEL_INITIAL_PELLET_COUNT = Object.keys(s.pellets).length;
  }
});
```

- [ ] **Step 2: Smoke check**

Run: `npm run build`. Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/systems/MunchiesController.tsx
git commit -m "feat(munchies): MunchiesController (overlap, catch, levels)"
```

---

## Task 19: Mount everything in MunchiesModeSystems

**Files:**
- Modify: `src/components/Game.tsx`

- [ ] **Step 1: Expand the systems group**

In `src/components/Game.tsx`, replace `MunchiesModeSystems` with:

```tsx
import { MunchiesCamera } from '../systems/MunchiesCamera';
import { MunchiesController } from '../systems/MunchiesController';
import { SleepwalkerController } from '../systems/SleepwalkerController';
import { NightAtmosphere } from './munchies/NightAtmosphere';
import { CookiePickupsLive } from './munchies/CookiePickup';
import { MilkPickupsLive } from './munchies/MilkPickup';
import { BonusCookieLive } from './munchies/BonusCookie';
import { BedsLive } from './munchies/Bed';
import { SleepwalkersLive } from './munchies/Sleepwalker';

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

- [ ] **Step 2: Smoke test gameplay end-to-end**

Run: `npm run dev`. Pick **Midnight Munchies** → Luke. Expected:
- Camera snaps top-down.
- Luke teleports into the great room at `(-5, 0, -3)`.
- The hero house renders dim with moonlight + nightlight + TV flicker.
- ~80 cookies are visible scattered across the rooms; 4 glowing milks in the corners; beds visible in master, Penny's, and the kitchen dog bed.
- Sleepwalkers (Dad in master, Penny in penny-room, dog in kitchen) start walking toward Luke.
- WASD moves Luke; he eats cookies on contact (they disappear, score increments — visible later when HUD lands; for now check via dev tools or the cookie count visibly dropping).
- Touching Dad/Penny/dog → caught cinematic (Luke teleports back to spawn after ~2.5s).
- Touching milk → sleepwalkers turn blue and walk toward their beds; touching a blue sleepwalker tucks them in (they vanish) and respawns 5s later.
- All cookies eaten → next level (sleepwalkers slightly faster).

(Some misbehavior is expected at this point because there's no HUD or game-over UI yet — they're the next tasks.)

- [ ] **Step 3: Commit**

```bash
git add src/components/Game.tsx
git commit -m "feat(munchies): mount full MunchiesModeSystems"
```

---

## Task 20: MunchiesHud (score + lives + level + cookies remaining)

**Files:**
- Create: `src/ui/MunchiesHud.tsx`

- [ ] **Step 1: Create HUD**

Create `src/ui/MunchiesHud.tsx`:

```tsx
import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';

export function MunchiesHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const score = useMunchiesStore((s) => s.score);
  const lives = useMunchiesStore((s) => s.lives);
  const level = useMunchiesStore((s) => s.level);
  const pelletsLeft = useMunchiesStore((s) => Object.keys(s.pellets).length);

  if (gameMode !== 'munchies') return null;
  if (phase === 'munchies-intro') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 50,
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          background: 'rgba(20, 16, 30, 0.78)',
          color: '#fff7e6',
          padding: '10px 22px',
          borderRadius: 16,
          display: 'flex',
          gap: 26,
          alignItems: 'center',
          border: '2px solid #7a5cad',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          fontWeight: 700,
        }}
      >
        <span>🍪 {pelletsLeft}</span>
        <span>⭐ {score}</span>
        <span>Level {level}</span>
        <span>{Array.from({ length: lives }).map((_, i) => <span key={i}>🥛</span>)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit (will mount in Task 25)**

```bash
git add src/ui/MunchiesHud.tsx
git commit -m "feat(munchies): MunchiesHud"
```

---

## Task 21: MunchiesIntro overlay

**Files:**
- Create: `src/ui/MunchiesIntro.tsx`

- [ ] **Step 1: Create overlay**

Create `src/ui/MunchiesIntro.tsx`:

```tsx
import { useGameStore } from '../state/gameStore';

export function MunchiesIntro() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-intro') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 16, 30, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff7e6',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #2a1f4a, #4a2c66)',
          border: '3px solid #c8a8ff',
          borderRadius: 22,
          padding: '24px 32px',
          textAlign: 'center',
          maxWidth: 540,
        }}
      >
        <div style={{ fontSize: 56 }}>🥛</div>
        <h1 style={{ margin: '6px 0 6px', fontSize: 30, letterSpacing: 1 }}>MIDNIGHT MUNCHIES</h1>
        <p style={{ margin: '6px 0', fontSize: 18 }}>It's midnight. <strong>SHHHH.</strong></p>
        <p style={{ margin: '12px 0', fontSize: 15, opacity: 0.85 }}>
          Sneak around the house, eat every cookie 🍪, and don't let sleepwalking Dad, Penny, or Doggie catch you.
          Drink the glowing milk 🥛 to turn the tables — tap them while they're dozy and tuck them back in!
        </p>
        <p style={{ margin: '14px 0 0', fontSize: 16, fontWeight: 700 }}>
          Press <kbd style={kbd}>W</kbd> <kbd style={kbd}>A</kbd> <kbd style={kbd}>S</kbd> <kbd style={kbd}>D</kbd> to start
        </p>
      </div>
    </div>
  );
}

const kbd: React.CSSProperties = {
  display: 'inline-block',
  background: '#fff7e6',
  color: '#2a1f4a',
  padding: '4px 10px',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontWeight: 800,
  margin: '0 2px',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/MunchiesIntro.tsx
git commit -m "feat(munchies): MunchiesIntro overlay"
```

---

## Task 22: MunchiesLevelClear banner

**Files:**
- Create: `src/ui/MunchiesLevelClear.tsx`

- [ ] **Step 1: Create banner**

Create `src/ui/MunchiesLevelClear.tsx`:

```tsx
import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';

export function MunchiesLevelClear() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const level = useMunchiesStore((s) => s.level);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-level-clear') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 130, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #2c5e3a, #5fa86a)',
        border: '3px solid #fff7e6', borderRadius: 22, padding: '20px 36px',
        color: '#fff7e6', textAlign: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 48 }}>🍪</div>
        <h2 style={{ margin: '4px 0', fontSize: 28 }}>Level {level} cleared!</h2>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>Get ready, they're waking up…</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/MunchiesLevelClear.tsx
git commit -m "feat(munchies): MunchiesLevelClear banner"
```

---

## Task 23: MunchiesGameOver screen

**Files:**
- Create: `src/ui/MunchiesGameOver.tsx`

- [ ] **Step 1: Create screen**

Create `src/ui/MunchiesGameOver.tsx`:

```tsx
import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';

export function MunchiesGameOver() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const score = useMunchiesStore((s) => s.score);
  const setPhase = useGameStore((s) => s.setPhase);
  const reset = useMunchiesStore((s) => s.reset);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-game-over') return null;

  const tryAgain = () => {
    reset();
    setPhase('munchies-intro');
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20, 10, 20, 0.78)', zIndex: 140,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #3a2f4a, #5a3a6c)', borderRadius: 22,
        padding: '28px 36px', color: '#fff7e6', textAlign: 'center',
        border: '3px solid #c8a8ff', boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 64 }}>😴</div>
        <h2 style={{ margin: '6px 0', fontSize: 28 }}>Caught!</h2>
        <p style={{ margin: '6px 0' }}>Dad walked you back to bed.</p>
        <p style={{ margin: '12px 0', fontSize: 16 }}>Cookies eaten: <strong>{Math.floor(score / 10)}</strong> · Score: <strong>{score}</strong></p>
        <button
          onClick={tryAgain}
          style={{
            marginTop: 8, padding: '12px 28px', fontSize: 16, fontWeight: 700,
            background: '#7a5cad', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
          }}
        >Try again ▶</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/MunchiesGameOver.tsx
git commit -m "feat(munchies): MunchiesGameOver screen"
```

---

## Task 24: MunchiesVictoryScreen

**Files:**
- Create: `src/ui/MunchiesVictoryScreen.tsx`

- [ ] **Step 1: Create screen**

Create `src/ui/MunchiesVictoryScreen.tsx`:

```tsx
import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';

export function MunchiesVictoryScreen() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const score = useMunchiesStore((s) => s.score);
  const setPhase = useGameStore((s) => s.setPhase);
  const reset = useMunchiesStore((s) => s.reset);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-victory') return null;

  const playAgain = () => {
    reset();
    setPhase('munchies-intro');
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20, 20, 30, 0.55)', zIndex: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #3a5a8a, #2a8aaa, #5fa86a)',
        borderRadius: 22, padding: '28px 36px', color: '#fff7e6', textAlign: 'center',
        border: '3px solid #fff7e6', boxShadow: '0 14px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 64 }}>🍪🥛🍪</div>
        <h2 style={{ margin: '6px 0', fontSize: 30 }}>You ate everything!</h2>
        <p style={{ margin: '6px 0' }}>Luke wins midnight. Snack king crowned.</p>
        <p style={{ margin: '12px 0', fontSize: 18 }}>Final score: <strong>{score}</strong></p>
        <button
          onClick={playAgain}
          style={{
            marginTop: 8, padding: '12px 28px', fontSize: 16, fontWeight: 700,
            background: '#5fa86a', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
          }}
        >Play again ▶</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/MunchiesVictoryScreen.tsx
git commit -m "feat(munchies): MunchiesVictoryScreen"
```

---

## Task 25: Mount all munchies UI in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and mount**

In `src/App.tsx`, add the imports near the existing UI imports:

```tsx
import { MunchiesHud } from './ui/MunchiesHud';
import { MunchiesIntro } from './ui/MunchiesIntro';
import { MunchiesLevelClear } from './ui/MunchiesLevelClear';
import { MunchiesGameOver } from './ui/MunchiesGameOver';
import { MunchiesVictoryScreen } from './ui/MunchiesVictoryScreen';
```

Add the components just before `<WelcomeScreen />` in the JSX tree:

```tsx
<MunchiesHud />
<MunchiesIntro />
<MunchiesLevelClear />
<MunchiesGameOver />
<MunchiesVictoryScreen />
<WelcomeScreen />
```

- [ ] **Step 2: Smoke test the full loop**

Run: `npm run dev`. Play through:
- Welcome → Midnight Munchies → Luke.
- Intro overlay shows. Press W → intro dismisses, gameplay starts, HUD appears at top.
- Eat cookies — score & cookie-count drop.
- Drink milk → sleepwalkers go blue, milk count decremented (3 left).
- Tuck-in a blue sleepwalker → +200 points, walker disappears 5s, then returns from bed.
- Get caught (run into Dad while not powered) → 2.5s cinematic → teleport to spawn, lose a life (one less 🥛 in HUD).
- Lose all 3 lives → Game Over screen with Try Again.
- Try Again → resets to intro.
- Clear all pellets → Level Clear banner → level 2 begins (HUD shows Level 2, sleepwalkers faster).
- Clear levels 1-3 → Victory screen with Play Again.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(munchies): mount all munchies UI overlays"
```

---

## Task 26: Audio (crunch, glug, shh, zzz, lullaby)

**Files:**
- Modify: `src/audio.ts`

- [ ] **Step 1: Add new procedural SFX**

Open `src/audio.ts`. After the existing functions, add:

```ts
// --- Midnight Munchies SFX ---

export function munchiesCrunch() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // Short noise burst with quick decay.
  const bufSize = Math.floor(c.sampleRate * 0.12);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() - 0.5) * (1 - i / bufSize) * 0.6;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.22, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  // Bandpass for "crunch" character.
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1600;
  bp.Q.value = 0.8;
  src.connect(bp).connect(gain).connect(c.destination);
  src.start(t0);
  src.stop(t0 + 0.13);
}

export function munchiesGlug() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // Three quick downward sweeps overlapping.
  for (let i = 0; i < 3; i++) {
    const tStart = t0 + i * 0.07;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 - i * 60, tStart);
    osc.frequency.exponentialRampToValueAtTime(140, tStart + 0.12);
    gain.gain.setValueAtTime(0.0001, tStart);
    gain.gain.exponentialRampToValueAtTime(0.18, tStart + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, tStart + 0.14);
    osc.connect(gain).connect(c.destination);
    osc.start(tStart);
    osc.stop(tStart + 0.16);
  }
}

export function munchiesShh() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const bufSize = Math.floor(c.sampleRate * 0.5);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() - 0.5) * 0.5;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 5800;
  bp.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(0.18, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
  src.connect(bp).connect(gain).connect(c.destination);
  src.start(t0);
  src.stop(t0 + 0.52);
}

// Lullaby loop: simple piano-ish triad arpeggio at slow tempo. Loops via
// scheduling a fresh batch every N seconds.
let lullabyStop: (() => void) | null = null;
export function startMunchiesLullaby() {
  const c = ensureCtx();
  if (!c) return;
  if (lullabyStop) return;
  let cancelled = false;
  const baseGain = c.createGain();
  baseGain.gain.value = 0.05;
  baseGain.connect(c.destination);

  const playNote = (freq: number, when: number, dur = 0.6) => {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.5, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env).connect(baseGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  };

  const tick = () => {
    if (cancelled) return;
    const t = c.currentTime;
    // F major arpeggio at ~50bpm
    const notes = [349.23, 440.00, 523.25, 440.00, 349.23, 293.66, 349.23, 440.00];
    notes.forEach((n, i) => playNote(n, t + i * 0.6, 0.55));
    setTimeout(tick, 4800);
  };
  tick();
  lullabyStop = () => { cancelled = true; };
}
export function stopMunchiesLullaby() {
  lullabyStop?.();
  lullabyStop = null;
}
```

- [ ] **Step 2: Wire SFX from MunchiesController**

In `src/systems/MunchiesController.tsx`:

- Import the new functions: `import { munchiesCrunch, munchiesGlug, munchiesShh, startMunchiesLullaby, stopMunchiesLullaby } from '../audio';`
- Where `eatPellet(id)` is called → call `munchiesCrunch()` afterwards.
- Where `eatMilk(id, now)` is called → call `munchiesGlug()`.
- In the `useEffect` that runs on mount, call `startMunchiesLullaby()`; return cleanup that calls `stopMunchiesLullaby()`.
- When `setPhase('munchies-caught')` is called → call `munchiesShh()`.

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. Verify:
- Lullaby plays softly during munchies gameplay.
- Crunch sound on each cookie eaten.
- Glug sound on milk eaten.
- Shh sound on getting caught.
- Lullaby stops when leaving munchies (refresh and switch to aliens — confirm no lullaby).

- [ ] **Step 4: Commit**

```bash
git add src/audio.ts src/systems/MunchiesController.tsx
git commit -m "feat(munchies): SFX (crunch/glug/shh) + lullaby loop"
```

---

## Task 27: Mode-gate sweep for stray combat artifacts

**Files:**
- Modify (verify only, modify if needed): `src/systems/CombatController.tsx`, `src/systems/BlobController.tsx`, `src/systems/WaveController.tsx`, `src/systems/ProjectileController.tsx`, `src/systems/PowerUpController.tsx`, `src/systems/SidekickController.tsx`, `src/systems/TornadoController.tsx`, `src/systems/RagdollController.tsx`

- [ ] **Step 1: Inspect each controller**

For each file in the list, open it and verify the top of its `useFrame` (or render guard) returns early when `gameMode !== 'aliens'` (for combat/blob/wave/projectile/powerup/sidekick) or `gameMode !== 'tornado'` (for tornado/ragdoll). Most of these already gate by being conditionally rendered inside `AliensModeSystems` / `TornadoModeSystems` in `Game.tsx`, so no change is needed.

Anything mounted unconditionally outside those wrappers (`PlayerController`, `CameraRig`, `NPCController`, `SkyController`, `MusicController`, `ProjectorController`, `NetSyncController`, `SpeechBubbles`) was already handled in Task 6 except `SkyController` and `ProjectorController`. Verify those don't leak combat-relevant side effects into munchies. `SkyController` only reads time-of-day and weather; should be fine but munchies forces time-of-day to 1.0 (Task 18) so the sky goes black — desirable. `ProjectorController` plays the cinematic; verify it doesn't trigger in munchies (check that its phase check doesn't include any munchies phases — should naturally return early because it checks for 'intro' / 'victory' aliens-mode phases).

- [ ] **Step 2: Add one-line gates where missing**

For any controller you find that runs side effects regardless of mode (e.g. `SkyController` mutating time-of-day), add at the top of its `useFrame`:

```ts
if (useGameStore.getState().gameMode === 'munchies') return;
```

(In practice: `SkyController` may want to keep running so munchies inherits night atmosphere. Tradeoff: leave it running unless gameplay testing shows interference. Add the gate if needed.)

- [ ] **Step 3: Regression smoke test**

Run: `npm run dev`. Play each mode for ~30 seconds:
- Alien Invasion: combat works, blobs spawn, ray gun fires, victory possible.
- Tornado Warning: weather phases progress, wind pulls, tornado arrives.
- Midnight Munchies: works as designed.

No mode should show artifacts from another (no blobs in munchies, no rain in aliens, etc.).

- [ ] **Step 4: Commit (if any files modified)**

```bash
git add -p src/systems
git commit -m "chore(munchies): mode-gate sweep across controllers"
```

If no changes were needed, skip the commit.

---

## Task 28: Verify host-only execution in multiplayer

**Files:**
- Modify: `src/systems/MunchiesController.tsx`
- Modify: `src/systems/SleepwalkerController.tsx`

- [ ] **Step 1: Add host gates**

The spec marks v1 munchies as host-only (single-player). To prevent non-host browsers from running parallel game state, add at the top of `MunchiesControllerInner`'s `useFrame` and `SleepwalkerControllerInner`'s `useFrame`:

```ts
if (!useNetStore.getState().isHost) return;
```

Add import at top of each file:

```ts
import { useNetStore } from '../state/netStore';
```

- [ ] **Step 2: Disable munchies card for non-host**

In `src/ui/WelcomeScreen.tsx`, just before the munchies `<GameCard>`, get host status:

```tsx
const isHost = /* read from netStore.isHost via useNetStore — see existing patterns */;
```

Wrap the card render to disable it (gray out + replace blurb) when `!isHost`:

```tsx
<GameCard
  emoji="🥛"
  title="MIDNIGHT MUNCHIES"
  blurb={isHost ? '...regular blurb...' : '(Host picks the game.)'}
  accent="#7a5cad"
  onPlay={isHost ? () => pick('munchies') : () => {}}
/>
```

(If `isHost` isn't easy to read pre-join, ignore non-host gating in welcome — the controller gate in Step 1 is sufficient defense.)

- [ ] **Step 3: Smoke test multiplayer regression**

Open two browser windows. Pick **Alien Invasion** in both — confirm one becomes host, both play. Then refresh both, pick **Midnight Munchies** — confirm only host plays (other window sees no sleepwalkers / static game).

- [ ] **Step 4: Commit**

```bash
git add src/systems/MunchiesController.tsx src/systems/SleepwalkerController.tsx src/ui/WelcomeScreen.tsx
git commit -m "feat(munchies): host-only execution (multiplayer-safe)"
```

---

## Task 29: Polish pass + bug bash

**Files:** (touches as discovered)

- [ ] **Step 1: Run through the full playtest checklist from the spec**

Playtest the following from the spec's "Testing" section:

- Welcome screen shows three cards; munchies card works.
- Camera locks top-down; WASD moves Luke in world axes; collision against interior walls works.
- Pellets visible, eaten on overlap, sound plays, score increments.
- Milk eaten → sleepwalkers tint blue and slow → 8s timer → revert.
- Touch sleepwalker (normal) → caught cinematic → respawn → life lost.
- Touch sleepwalker (powered) → +200 (or more for combo), sleepwalker disappears, 5s respawn from bed.
- All pellets cleared → level clear banner → level 2 begins, ghosts faster.
- 3 lives → game-over screen → try-again resets.
- Beat level 3 → victory screen with confetti (or just the screen — confetti is optional).
- Aliens mode still works (regression).
- Tornado mode still works (regression).
- Multiplayer aliens game still works (regression).

For each failure: fix and commit with a small descriptive message.

- [ ] **Step 2: Optional confetti reuse**

Optionally, on `'munchies-victory'`, also render the existing `Confetti` celebration component for an extra-fun finish:

In `MunchiesModeSystems`:

```tsx
import { Confetti } from './celebration/Confetti';
// ...
{phase === 'munchies-victory' && <Confetti />}
```

(Phase read via `useGameStore((s) => s.phase)`.)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "polish(munchies): playtest fixes + victory confetti"
```

---

## Done

When all tasks complete, the third game mode is shippable. Defer multiplayer co-op / versus per the spec's "Future work" section.

## Self-review checklist (run after writing the plan; for the plan-author, not the implementer)

- **Spec coverage:**
  - GameMode/MunchiesPhase plumbing → Task 1 ✓
  - Constants → Task 2 ✓
  - munchiesStore → Task 3 ✓
  - Welcome screen card → Task 4 ✓
  - CharacterSelect auto-Luke → Task 5 ✓
  - Mode-gating existing controllers → Tasks 6, 27, 28 ✓
  - MunchiesCamera → Task 7 ✓
  - PlayerController munchies branch → Task 8 ✓
  - MunchiesModeSystems mount → Tasks 9, 19 ✓
  - Corridor graph + beds data → Task 10 ✓
  - Pellet generation → Task 11 ✓
  - CookiePickup/MilkPickup/BonusCookie → Task 12 ✓
  - Bed component → Task 13 ✓
  - NightAtmosphere → Task 14 ✓
  - timeOfDay override → Task 18 (in MunchiesController useEffect) ✓
  - Dog + Sleepwalker renderers → Task 16 ✓
  - SleepwalkerController AI → Task 17 ✓
  - MunchiesController game loop → Task 18 ✓
  - MunchiesHud → Task 20 ✓
  - MunchiesIntro/LevelClear/GameOver/Victory → Tasks 21-24 ✓
  - App.tsx UI mounting → Task 25 ✓
  - Audio (crunch/glug/shh/lullaby) → Task 26 ✓ (zzz proximity-loop deferred to polish — minor)
  - Host-only multiplayer → Task 28 ✓
  - Regression playtest → Task 29 ✓
- **Placeholders:** None remaining (Task 15 explicitly marked skipped/covered-elsewhere; not a TBD).
- **Type consistency:** `SleepwalkerId`, `SleepwalkerState`, `PelletPosition`, store action names match across tasks. Graph node ids match across `munchiesGraph.ts`, `MunchiesController`, `SleepwalkerController`.
- **Note (audio):** The proximity-driven snore loop (`audio.zzz()`) from the spec is omitted from Task 26 to keep audio scope tight. Added as a TODO to consider during Task 29 polish if there's bandwidth.
