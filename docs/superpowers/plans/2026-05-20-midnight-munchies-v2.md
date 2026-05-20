# Midnight Munchies v2 — Sibling Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Midnight Munchies playable as Penny too, both solo and in 2-player co-op with Luke. Adds a 4th sleepwalker (the Schmorgesblob, swapped in when Penny plays), difficulty toggle, sibling proximity bonus, per-character stat tweaks, score persistence, and a goodnight victory cinematic.

**Architecture:** Builds incrementally on the v1 munchies code. The roster (which 3 sleepwalkers patrol) is derived per-level from which characters are actively played, computed by a new `munchiesRoster.ts` helper. The Schmorgesblob is a new sleepwalker ID with its own minimal mesh + Penny's AI rule (Pinky-like, 3m ambush ahead of the nearest player). 2-player co-op leverages the existing Trystero `WorldStateMsg` snapshot — extended with a `munchies` field, broadcast by the host, applied by peers. Difficulty + best score live in localStorage.

**Tech Stack:** Same as v1 — React 19, @react-three/fiber 9, Three.js 0.184, Zustand, TypeScript, Trystero for multiplayer.

**Reference spec:** `docs/superpowers/specs/2026-05-20-midnight-munchies-v2-design.md`
**Reference v1 plan:** `docs/superpowers/plans/2026-05-20-midnight-munchies.md`

**Conventions:**
- World coordinates same as v1 (hero house at origin).
- `now` = `performance.now() / 1000`.
- "Smoke test" = `npm run build` clean. Browser playtest is the final task (Task 15).

---

## Task 1: Types & config additions

**Files:**
- Modify: `src/state/munchiesStore.ts`
- Modify: `src/world/munchiesConfig.ts`

- [ ] **Step 1: Extend `SleepwalkerId` union to include `'schmorgesblob'`**

In `src/state/munchiesStore.ts`, change:

```ts
export type SleepwalkerId = 'dad' | 'penny' | 'dog';
```

to:

```ts
export type SleepwalkerId = 'dad' | 'penny' | 'dog' | 'schmorgesblob';
```

Also update `EMPTY_SLEEPWALKERS` to include the new ID:

```ts
const EMPTY_SLEEPWALKERS: Record<SleepwalkerId, SleepwalkerState> = {
  dad:           { id: 'dad',           x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  penny:         { id: 'penny',         x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  dog:           { id: 'dog',           x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  schmorgesblob: { id: 'schmorgesblob', x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
};
```

- [ ] **Step 2: Update `SLEEPWALKER_BEDS` to include the alien**

In `src/world/munchiesGraph.ts`, change:

```ts
export const SLEEPWALKER_BEDS: Record<SleepwalkerId, string> = {
  dad: 'master-bed',
  penny: 'penny-bed',
  dog: 'kitchen-center',
};
```

to:

```ts
export const SLEEPWALKER_BEDS: Record<SleepwalkerId, string> = {
  dad: 'master-bed',
  penny: 'penny-bed',
  dog: 'kitchen-center',
  schmorgesblob: 'master-bed', // crashed in Dad's room; shares his bed area
};
```

- [ ] **Step 3: Add character stats + difficulty types to munchiesConfig.ts**

Append to `src/world/munchiesConfig.ts`:

```ts
// --- v2 additions ---

export type PlayableCharacter = 'luke' | 'penny';

/** Per-character gameplay tweaks. */
export const CHARACTER_STATS: Record<PlayableCharacter, {
  catchRadius: number;
  poweredDurationS: number;
}> = {
  luke:  { catchRadius: 0.51, poweredDurationS: 8.0 },   // -15% catch radius — quick on his feet
  penny: { catchRadius: 0.6,  poweredDurationS: 10.0 },  // +25% milk window — times runs better
};

export type Difficulty = 'sleepy' | 'awake';

/** Difficulty multipliers applied on top of base values. */
export const DIFFICULTY_MULT: Record<Difficulty, { speed: number; poweredMult: number }> = {
  sleepy: { speed: 0.7, poweredMult: 1.5 },
  awake:  { speed: 1.0, poweredMult: 1.0 },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'sleepy';

/** Distance threshold (m) for the sibling-bond bonus in co-op. */
export const SIBLING_BOND_DIST = 3.0;
/** Multiplier (×) applied to cookie scoring while siblings are within bond distance. */
export const SIBLING_BOND_MULT = 1.5;
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/state/munchiesStore.ts src/world/munchiesConfig.ts src/world/munchiesGraph.ts
git commit -m "feat(munchies-v2): SleepwalkerId+schmorgesblob, character stats, difficulty config"
```

---

## Task 2: `munchiesRoster.ts` — roster + activePlayers helpers

**Files:**
- Create: `src/world/munchiesRoster.ts`

- [ ] **Step 1: Create the file**

```ts
// Roster + active-player helpers for Midnight Munchies v2.
// The ghost lineup depends on which characters are being played.

import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import type { CharacterId } from '../types';
import type { SleepwalkerId } from '../state/munchiesStore';

/** Returns the 3-ghost roster based on which kids are playing. */
export function ghostRosterFor(activeChars: CharacterId[]): SleepwalkerId[] {
  const pennyIsPlayer = activeChars.includes('penny');
  return pennyIsPlayer
    ? ['dad', 'dog', 'schmorgesblob']
    : ['dad', 'dog', 'penny'];
}

/** Returns the playable-character IDs currently claimed across all peers. */
export function activePlayers(): CharacterId[] {
  const claimed = new Set<CharacterId>();
  const peers = useNetStore.getState().peers;
  for (const p of Object.values(peers)) {
    if (p.characterId === 'luke' || p.characterId === 'penny') {
      claimed.add(p.characterId);
    }
  }
  // Single-window / dev-fallback: if no peer claimed, use gameStore.activeCharacterId.
  if (claimed.size === 0) {
    const ac = useGameStore.getState().activeCharacterId;
    if (ac === 'luke' || ac === 'penny') claimed.add(ac);
    else claimed.add('luke');
  }
  return Array.from(claimed);
}

export interface PlayerSnapshot {
  characterId: CharacterId;
  x: number;
  z: number;
  yaw: number;
}

/** Snapshot of every active player's current position. */
export function playerSnapshots(): PlayerSnapshot[] {
  const gs = useGameStore.getState();
  return activePlayers().map((id) => ({
    characterId: id,
    x: gs.positions[id].x,
    z: gs.positions[id].z,
    yaw: gs.yaws[id],
  }));
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/world/munchiesRoster.ts
git commit -m "feat(munchies-v2): ghostRosterFor + activePlayers helpers"
```

---

## Task 3: `munchiesScoreStorage.ts` — localStorage helpers

**Files:**
- Create: `src/world/munchiesScoreStorage.ts`

- [ ] **Step 1: Create the file**

```ts
// Tiny localStorage wrappers for munchies persistence.
// Safe against quota/disabled-storage exceptions.

import type { Difficulty } from './munchiesConfig';
import type { PlayableCharacter } from './munchiesConfig';

const BEST_KEY = (c: PlayableCharacter) => `munchies.best.${c}`;
const DIFFICULTY_KEY = 'munchies.difficulty';

export function loadBestScore(character: PlayableCharacter): number {
  try {
    const raw = localStorage.getItem(BEST_KEY(character));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(character: PlayableCharacter, score: number): void {
  try {
    if (score > loadBestScore(character)) {
      localStorage.setItem(BEST_KEY(character), String(score));
    }
  } catch {
    /* localStorage blocked; silent no-op */
  }
}

export function loadDifficulty(): Difficulty {
  try {
    const raw = localStorage.getItem(DIFFICULTY_KEY);
    if (raw === 'awake') return 'awake';
    return 'sleepy';
  } catch {
    return 'sleepy';
  }
}

export function saveDifficulty(d: Difficulty): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY, d);
  } catch {
    /* silent */
  }
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/world/munchiesScoreStorage.ts
git commit -m "feat(munchies-v2): localStorage helpers for high-score + difficulty"
```

---

## Task 4: `munchiesStore` extensions — difficulty, addScore, activeRoster

**Files:**
- Modify: `src/state/munchiesStore.ts`

- [ ] **Step 1: Add new fields, actions, and localStorage hydration**

In `src/state/munchiesStore.ts`:

Add imports:

```ts
import { loadDifficulty, saveDifficulty } from '../world/munchiesScoreStorage';
import type { Difficulty } from '../world/munchiesConfig';
```

Extend the `MunchiesStore` interface (place the new fields in a sensible order, e.g. after `caughtBy`):

```ts
interface MunchiesStore {
  // ...existing fields...

  /** Selected difficulty; loaded from localStorage on init. */
  difficulty: Difficulty;
  /** Which ghost IDs are active this level (computed by MunchiesController.startLevel). */
  activeRoster: import('./munchiesStore').SleepwalkerId[];

  // ...existing actions...

  setDifficulty: (d: Difficulty) => void;
  addScore: (n: number) => void;
  setActiveRoster: (ids: import('./munchiesStore').SleepwalkerId[]) => void;
}
```

(The `import('./munchiesStore').SleepwalkerId` self-reference is to avoid circular import issues — but since we're already inside that file, just use `SleepwalkerId` directly:)

Actually replace with the direct local type reference:

```ts
interface MunchiesStore {
  // ...existing fields...
  difficulty: Difficulty;
  activeRoster: SleepwalkerId[];

  // ...existing actions...
  setDifficulty: (d: Difficulty) => void;
  addScore: (n: number) => void;
  setActiveRoster: (ids: SleepwalkerId[]) => void;
}
```

In the `create<MunchiesStore>` body, add initial values:

```ts
difficulty: loadDifficulty(),
activeRoster: ['dad', 'dog', 'penny'],
```

Add the new actions:

```ts
setDifficulty: (d) => {
  saveDifficulty(d);
  set({ difficulty: d });
},
addScore: (n) => set((s) => ({ score: s.score + n })),
setActiveRoster: (ids) => set({ activeRoster: ids }),
```

Also update `reset()` to keep difficulty but clear activeRoster:

```ts
reset: () => set((s) => ({
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
  // keep difficulty + activeRoster (these are session-level)
  activeRoster: s.activeRoster,
  difficulty: s.difficulty,
})),
```

- [ ] **Step 2: Update `setLevelData` to accept a roster argument (additive — keep old callers working)**

Currently `setLevelData` takes `(level, pellets, milks, sleepwalkers)`. We'll keep the signature and pull roster from store state set separately by the controller.

No change to `setLevelData` signature. The controller will call `setActiveRoster(ids)` immediately before/after `setLevelData`.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/state/munchiesStore.ts
git commit -m "feat(munchies-v2): store fields for difficulty, addScore, activeRoster"
```

---

## Task 5: `SchmorgesGhost` component

**Files:**
- Create: `src/components/munchies/SchmorgesGhost.tsx`

- [ ] **Step 1: Create the alien-ghost mesh**

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';

interface Props {
  positionRef: { x: number; z: number; yaw: number };
  bluish: boolean; // tinted when powered
}

/**
 * Stripped-down "ghost" version of the Schmorgesblob from the aliens game.
 * Smaller, semi-translucent, cyan-tinted; bobs softly with floating tentacles.
 */
export function SchmorgesGhost({ positionRef, bluish }: Props) {
  const ref = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const leftEye = useRef<Mesh>(null);
  const rightEye = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.set(positionRef.x, 0.4 + Math.sin(t * 1.5) * 0.08, positionRef.z);
    ref.current.rotation.y = positionRef.yaw;
    if (body.current) {
      body.current.scale.y = 1 + Math.sin(t * 2.4) * 0.04;
    }
    // Eyes wobble independently for a dazed-sleep look.
    if (leftEye.current) leftEye.current.position.y = 0.05 + Math.sin(t * 3.1) * 0.015;
    if (rightEye.current) rightEye.current.position.y = 0.05 + Math.sin(t * 3.1 + 1.5) * 0.015;
  });

  // Color palette: powered → bright cyan; normal → calmer teal.
  const bodyColor = bluish ? '#8acfff' : '#5fa890';
  const eyeColor = '#fff7e6';
  const pupilColor = bluish ? '#1f5a8a' : '#1a3a2a';

  return (
    <group ref={ref}>
      {/* Body blob */}
      <mesh ref={body} position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.4, 16, 12]} />
        <meshStandardMaterial
          color={bodyColor}
          transparent
          opacity={0.86}
          roughness={0.5}
          emissive={new THREE.Color(bodyColor)}
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Eye whites */}
      <group position={[0, 0.1, -0.32]}>
        <mesh ref={leftEye} position={[-0.13, 0.05, 0]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={eyeColor} />
        </mesh>
        <mesh ref={rightEye} position={[0.13, 0.05, 0]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={eyeColor} />
        </mesh>
        {/* Pupils */}
        <mesh position={[-0.13, 0.05, -0.07]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={pupilColor} />
        </mesh>
        <mesh position={[0.13, 0.05, -0.07]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={pupilColor} />
        </mesh>
      </group>
      {/* Three floppy tentacles below */}
      {[-0.18, 0, 0.18].map((tx, i) => (
        <mesh key={i} position={[tx, -0.32, 0]} castShadow>
          <coneGeometry args={[0.07, 0.32, 6]} />
          <meshStandardMaterial color={bodyColor} transparent opacity={0.82} />
        </mesh>
      ))}
      {/* Cyan glow ring */}
      <pointLight color={bluish ? '#bce6ff' : '#a8e6c8'} intensity={1.2} distance={2.6} decay={2} />
    </group>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/components/munchies/SchmorgesGhost.tsx
git commit -m "feat(munchies-v2): SchmorgesGhost — alien ghost mesh"
```

---

## Task 6: Dispatch `'schmorgesblob'` from `Sleepwalker.tsx`

**Files:**
- Modify: `src/components/munchies/Sleepwalker.tsx`

- [ ] **Step 1: Add a schmorgesblob branch**

In `src/components/munchies/Sleepwalker.tsx`, add the import:

```tsx
import { SchmorgesGhost } from './SchmorgesGhost';
```

In `SleepwalkerRender`, just after the existing `if (id === 'dog')` block, add:

```tsx
if (id === 'schmorgesblob') {
  return (
    <group ref={groupRef}>
      <SchmorgesGhost positionRef={sw} bluish={bluish} />
      <ZzzOverlay bigger={bluish} yOffset={0.9} />
    </group>
  );
}
```

The schmorgesblob mesh sits between 0 and ~0.5 y, so the Zzz overlay at 0.9 y feels right.

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/components/munchies/Sleepwalker.tsx
git commit -m "feat(munchies-v2): render schmorgesblob ghost in Sleepwalker dispatcher"
```

---

## Task 7: `SleepwalkerController` — multi-player AI + schmorgesblob + difficulty

**Files:**
- Modify: `src/systems/SleepwalkerController.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/systems/SleepwalkerController.tsx`, add:

```ts
import { activePlayers, playerSnapshots, type PlayerSnapshot } from '../world/munchiesRoster';
import { DIFFICULTY_MULT } from '../world/munchiesConfig';
```

(Remove the now-unused single-player accessor pattern — see Step 2.)

- [ ] **Step 2: Replace single-player target with multi-player logic in `useFrame`**

In the `useFrame` callback inside `SleepwalkerControllerInner`, find:

```ts
const lukePos = gs.positions.luke;
const lukeYaw = gs.yaws.luke;
const lukeNodeId = nearestNode(lukePos.x, lukePos.z).id;
```

Replace with:

```ts
const players = playerSnapshots();
if (players.length === 0) return;
```

(`players` is `PlayerSnapshot[]` — at least one element always.)

Apply difficulty speed multiplier — find:

```ts
const baseSpeed = SLEEPWALKER_BASE_SPEED + (ms.level - 1) * SLEEPWALKER_SPEED_PER_LEVEL;
```

Replace with:

```ts
const diffMult = DIFFICULTY_MULT[ms.difficulty].speed;
const baseSpeed = (SLEEPWALKER_BASE_SPEED + (ms.level - 1) * SLEEPWALKER_SPEED_PER_LEVEL) * diffMult;
```

Inside the `for (const id of [...])` loop, change:

```ts
for (const id of ['dad', 'penny', 'dog'] as const) {
```

to:

```ts
for (const id of ms.activeRoster) {
```

(The roster is the 3 IDs set by MunchiesController.startLevel — this skips inactive sleepwalkers entirely.)

Replace the `pickNextNode(...)` calls that previously took `lukeNodeId, lukePos, lukeYaw` to instead take the `players` list. Both call sites become:

```ts
sw.targetNodeId = pickNextNode(id, cur.id, cur.id, sw, players, powered);
```

and:

```ts
sw.targetNodeId = pickNextNode(id, sw.targetNodeId, last, sw, players, powered);
```

- [ ] **Step 3: Update `pickNextNode` and helpers to take a players list**

Replace the entire `pickNextNode` function with:

```ts
function pickNextNode(
  id: SleepwalkerId,
  currentId: string,
  lastId: string,
  sw: { x: number; z: number },
  players: PlayerSnapshot[],
  powered: boolean,
): string {
  const cur = getNode(currentId);
  let candidates = cur.neighbors.filter((nb) => nb !== lastId);
  if (candidates.length === 0) candidates = cur.neighbors.slice();

  if (powered) {
    const homeId = SLEEPWALKER_BEDS[id];
    return pickByMinDistanceToTarget(candidates, homeId);
  }

  // Pick the closer player as the target.
  const target = pickClosestPlayer(sw, players);
  const targetNodeId = nearestNode(target.x, target.z).id;

  if (id === 'dad') {
    return pickByMinDistanceToTarget(candidates, targetNodeId);
  }
  if (id === 'penny' || id === 'schmorgesblob') {
    // Ambush 3m ahead of the target player along their yaw.
    const fx = -Math.sin(target.yaw);
    const fz = -Math.cos(target.yaw);
    const aheadX = target.x + fx * 3.0;
    const aheadZ = target.z + fz * 3.0;
    const aheadNodeId = nearestNode(aheadX, aheadZ).id;
    return pickByMinDistanceToTarget(candidates, aheadNodeId);
  }
  if (id === 'dog') {
    const dist = Math.hypot(target.x - cur.x, target.z - cur.z);
    if (dist > DOG_SHY_DIST) {
      return pickByMinDistanceToTarget(candidates, targetNodeId);
    } else {
      return pickByMinDistanceToTarget(candidates, DOG_HOME_NODE);
    }
  }
  return candidates[0];
}

function pickClosestPlayer(sw: { x: number; z: number }, players: PlayerSnapshot[]): PlayerSnapshot {
  let best = players[0];
  let bestD = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - sw.x, p.z - sw.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
```

(Leave `pickByMinDistanceToTarget` unchanged.)

- [ ] **Step 4: Remove the unused `activePlayers` import if unused**

If `activePlayers` was imported but isn't directly referenced, remove its import. We use `playerSnapshots` instead.

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add src/systems/SleepwalkerController.tsx
git commit -m "feat(munchies-v2): SleepwalkerController multi-player AI + schmorgesblob + difficulty"
```

---

## Task 8: `MunchiesController` — roster, per-char catch, milk window, sibling bond, high score

**Files:**
- Modify: `src/systems/MunchiesController.tsx`

- [ ] **Step 1: Update imports**

Add to imports at the top:

```ts
import { ghostRosterFor, activePlayers } from '../world/munchiesRoster';
import {
  CHARACTER_STATS,
  DIFFICULTY_MULT,
  SIBLING_BOND_DIST,
  SIBLING_BOND_MULT,
  type PlayableCharacter,
} from '../world/munchiesConfig';
import { saveBestScore } from '../world/munchiesScoreStorage';
```

(`CATCH_RADIUS` was already imported; you'll stop using the global constant in Step 3, but leave the import for now in case other uses exist; remove only if unused.)

- [ ] **Step 2: Rewrite `startLevel` to use the roster**

Find the existing `startLevel(level)` function and replace it with:

```ts
function startLevel(level: number) {
  const pellets = generatePellets();
  const milks = buildMilks();
  // Compute roster from currently-claimed players.
  const players = activePlayers();
  const roster = ghostRosterFor(players);
  useMunchiesStore.getState().setActiveRoster(roster);

  // Build sleepwalker spawn objects ONLY for the active roster.
  // Inactive sleepwalkers stay at default {0,0,0} and are skipped by the renderer because
  // they're not in activeRoster (controllers iterate ms.activeRoster, not all keys).
  const sleepwalkers: Record<SleepwalkerId, SleepwalkerState> = {
    dad:           makeSpawn('dad'),
    penny:         makeSpawn('penny'),
    dog:           makeSpawn('dog'),
    schmorgesblob: makeSpawn('schmorgesblob'),
  };
  // Hide non-active sleepwalkers by setting their mode to 'tucked' (renderer hides on tucked).
  for (const id of (['dad', 'penny', 'dog', 'schmorgesblob'] as const)) {
    if (!roster.includes(id)) sleepwalkers[id].mode = 'tucked';
  }
  useMunchiesStore.getState().setLevelData(level, pellets, milks, sleepwalkers);
  LEVEL_INITIAL_PELLET_COUNT = Object.keys(pellets).length;

  // Teleport every active player to munchies spawn.
  const gs = useGameStore.getState();
  for (const id of players) {
    gs.positions[id].set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
    gs.yaws[id] = Math.PI;
  }
}
```

Note: the `SleepwalkerState` type needs to be imported. Add at top:

```ts
import { useMunchiesStore, type SleepwalkerId, type SleepwalkerState } from '../state/munchiesStore';
```

(Replace the existing import line of `useMunchiesStore` to include `SleepwalkerState`.)

- [ ] **Step 3: Update useFrame body to iterate active players**

Inside the `useFrame((... ) => { ... })` body, find the pellet pickup loop. Replace the entire `if (phase === 'munchies-play' || phase === 'munchies-powered')` block with this:

```ts
if (phase === 'munchies-play' || phase === 'munchies-powered') {
  const players = activePlayers();
  if (players.length === 0) return;

  // Per-player overlap checks. Each player can eat cookies on their own.
  for (const pid of players) {
    const pl = gs.positions[pid];
    const stats = CHARACTER_STATS[pid as PlayableCharacter];

    // Pellet pickup (with sibling bond bonus in co-op).
    let siblingBonusActive = false;
    if (players.length === 2) {
      const other = gs.positions[players.find((p) => p !== pid)!];
      if (Math.hypot(pl.x - other.x, pl.z - other.z) < SIBLING_BOND_DIST) {
        siblingBonusActive = true;
      }
    }
    for (const id in ms.pellets) {
      const p = ms.pellets[id];
      if (Math.hypot(p.x - pl.x, p.z - pl.z) < PELLET_PICKUP_RADIUS) {
        useMunchiesStore.getState().eatPellet(id);
        if (siblingBonusActive) {
          useMunchiesStore.getState().addScore(Math.round(10 * (SIBLING_BOND_MULT - 1)));
        }
        munchiesCrunch();
      }
    }

    // Milk pickup — per-character + difficulty-multiplied powered window.
    for (const id in ms.milks) {
      const m = ms.milks[id];
      if (Math.hypot(m.x - pl.x, m.z - pl.z) < MILK_PICKUP_RADIUS) {
        // Compute custom poweredUntil and overwrite store's value (it was just set to base).
        useMunchiesStore.getState().eatMilk(id, now);
        const charDur = stats?.poweredDurationS ?? 8.0;
        const diffMult = DIFFICULTY_MULT[ms.difficulty].poweredMult;
        useMunchiesStore.setState({ poweredUntil: now + charDur * diffMult });
        gs.setPhase('munchies-powered');
        munchiesGlug();
      }
    }

    // Bonus pickup
    if (ms.bonus && !ms.bonus.eaten) {
      if (Math.hypot(ms.bonus.x - pl.x, ms.bonus.z - pl.z) < BONUS_PICKUP_RADIUS) {
        useMunchiesStore.getState().eatBonus();
        setTimeout(() => useMunchiesStore.getState().clearBonus(), 300);
      } else if (now - ms.bonus.spawnedAt > BONUS_DESPAWN_S) {
        useMunchiesStore.getState().clearBonus();
      }
    }

    // Catch / tuck-in detection — per-character catch radius.
    const catchR = stats?.catchRadius ?? CATCH_RADIUS;
    for (const id of ms.activeRoster) {
      const sw = ms.sleepwalkers[id];
      if (!sw || sw.mode === 'tucked') continue;
      const d = Math.hypot(sw.x - pl.x, sw.z - pl.z);
      if (d < catchR) {
        if (phase === 'munchies-powered') {
          useMunchiesStore.getState().tuckIn(id, now);
        } else {
          useMunchiesStore.getState().setCaught(id, now);
          gs.setPhase('munchies-caught');
          phaseChangeAt.current = now;
          munchiesShh();
          break;
        }
      }
    }
  }

  maybeSpawnBonus(now);

  // Powered timer expiry
  if (phase === 'munchies-powered' && ms.poweredUntil > 0 && now > ms.poweredUntil) {
    useMunchiesStore.getState().endPowered();
    gs.setPhase('munchies-play');
  }

  // Level clear
  if (Object.keys(ms.pellets).length === 0) {
    gs.setPhase('munchies-level-clear');
    phaseChangeAt.current = now;
  }
}
```

- [ ] **Step 4: Update the "caught" cinematic-exit to teleport all active players**

Find the `if (phase === 'munchies-caught' && now - phaseChangeAt.current > CAUGHT_CINEMATIC_S)` block. Replace its body with:

```ts
useMunchiesStore.getState().loseLife();
const lives = useMunchiesStore.getState().lives;
const players = activePlayers();
for (const pid of players) {
  gs.positions[pid].set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
}
useMunchiesStore.getState().clearCaught();
if (lives <= 0) {
  saveAllBestScores();
  gs.setPhase('munchies-game-over');
} else {
  useMunchiesStore.getState().endPowered();
  gs.setPhase('munchies-play');
}
```

- [ ] **Step 5: Persist best scores on victory and game-over**

Above the existing `function maybeSpawnBonus` add:

```ts
function saveAllBestScores() {
  const ms = useMunchiesStore.getState();
  for (const id of activePlayers()) {
    if (id === 'luke' || id === 'penny') saveBestScore(id, ms.score);
  }
}
```

In the `munchies-level-clear` → next-level transition, when `nextLevel > MAX_LEVEL`, before `gs.setPhase('munchies-victory')` add:

```ts
saveAllBestScores();
```

- [ ] **Step 6: Build + commit**

```bash
npm run build
git add src/systems/MunchiesController.tsx
git commit -m "feat(munchies-v2): roster-driven controller, multi-player overlaps, sibling bond, high score"
```

---

## Task 9: `MunchiesDifficultyToggle` + CharacterSelect (Penny + toggle)

**Files:**
- Create: `src/ui/MunchiesDifficultyToggle.tsx`
- Modify: `src/ui/CharacterSelect.tsx`

- [ ] **Step 1: Create the toggle component**

```tsx
// src/ui/MunchiesDifficultyToggle.tsx
import { useMunchiesStore } from '../state/munchiesStore';
import type { Difficulty } from '../world/munchiesConfig';

const opts: { value: Difficulty; label: string; emoji: string }[] = [
  { value: 'sleepy', label: 'Sleepy',  emoji: '😴' },
  { value: 'awake',  label: 'Awake',   emoji: '😬' },
];

export function MunchiesDifficultyToggle() {
  const difficulty = useMunchiesStore((s) => s.difficulty);
  const setDifficulty = useMunchiesStore((s) => s.setDifficulty);

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        margin: '4px 0 12px',
      }}
    >
      {opts.map((o) => {
        const selected = difficulty === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setDifficulty(o.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: `2px solid ${selected ? '#7a5cad' : '#bba8d8'}`,
              background: selected ? '#7a5cad' : 'rgba(255,255,255,0.85)',
              color: selected ? '#fff' : '#3a2858',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 80ms ease',
            }}
          >
            {o.emoji} {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update CharacterSelect to show Luke + Penny + Toggle in munchies mode**

In `src/ui/CharacterSelect.tsx`, change the existing munchies filter from:

```tsx
const visibleChars = gameMode === 'munchies'
  ? CHARACTER_ORDER.filter((id) => id === 'luke')
  : CHARACTER_ORDER;
```

to:

```tsx
const visibleChars = gameMode === 'munchies'
  ? CHARACTER_ORDER.filter((id) => id === 'luke' || id === 'penny')
  : CHARACTER_ORDER;
```

Add an import for the toggle:

```tsx
import { MunchiesDifficultyToggle } from './MunchiesDifficultyToggle';
```

And change the existing munchies hint paragraph to also include the toggle. Replace:

```tsx
{gameMode === 'munchies' && (
  <p style={{ fontSize: 14, color: '#5a5040', margin: '4px 0 12px' }}>
    Luke's adventure tonight. (Penny and Dad are sleepwalking…)
  </p>
)}
```

with:

```tsx
{gameMode === 'munchies' && (
  <>
    <p style={{ fontSize: 14, color: '#5a5040', margin: '4px 0 8px' }}>
      Pick a sneaker. Penny and Luke can both play — or team up in two windows.
    </p>
    <MunchiesDifficultyToggle />
  </>
)}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/ui/MunchiesDifficultyToggle.tsx src/ui/CharacterSelect.tsx
git commit -m "feat(munchies-v2): Penny in CharacterSelect + difficulty toggle"
```

---

## Task 10: `MunchiesHud` — show best score

**Files:**
- Modify: `src/ui/MunchiesHud.tsx`

- [ ] **Step 1: Show best score next to current**

In `src/ui/MunchiesHud.tsx`, add imports:

```tsx
import { useEffect, useState } from 'react';
import { useNetStore } from '../state/netStore';
import { loadBestScore } from '../world/munchiesScoreStorage';
import type { PlayableCharacter } from '../world/munchiesConfig';
```

In the `MunchiesHud` component, just below the existing `pelletsLeft` selector, add:

```tsx
const myCharacterId = useNetStore((s) => s.myCharacterId);
const localChar: PlayableCharacter = (myCharacterId === 'penny' ? 'penny' : 'luke');
const [best, setBest] = useState<number>(() => loadBestScore(localChar));
useEffect(() => { setBest(loadBestScore(localChar)); }, [localChar]);
useEffect(() => {
  // Refresh best when score exceeds previous best (after a save).
  if (score > best) setBest(score);
}, [score, best]);
```

In the rendered chip strip, change:

```tsx
<span>⭐ {score}</span>
```

to:

```tsx
<span>⭐ {score} <span style={{ opacity: 0.65, fontWeight: 500, fontSize: 13 }}>· Best {best}</span></span>
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/ui/MunchiesHud.tsx
git commit -m "feat(munchies-v2): MunchiesHud shows best score per character"
```

---

## Task 11: `SiblingBond` component + Game.tsx mount

**Files:**
- Create: `src/components/munchies/SiblingBond.tsx`
- Modify: `src/components/Game.tsx`

- [ ] **Step 1: Create SiblingBond**

```tsx
// src/components/munchies/SiblingBond.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { activePlayers } from '../../world/munchiesRoster';
import { SIBLING_BOND_DIST } from '../../world/munchiesConfig';

/**
 * Renders a glowing line between Luke and Penny when both are claimed AND
 * within the bond distance. The line brightens with proximity.
 */
export function SiblingBond() {
  const lineRef = useRef<THREE.Line>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  useFrame(() => {
    const line = lineRef.current;
    const mat = matRef.current;
    if (!line || !mat) return;
    const players = activePlayers();
    if (players.length !== 2) { line.visible = false; return; }
    const gs = useGameStore.getState();
    const a = gs.positions[players[0]];
    const b = gs.positions[players[1]];
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    if (dist > SIBLING_BOND_DIST * 1.5) { line.visible = false; return; }
    line.visible = true;
    const geom = line.geometry as THREE.BufferGeometry;
    const arr = (geom.attributes.position.array as Float32Array);
    arr[0] = a.x; arr[1] = 1.0; arr[2] = a.z;
    arr[3] = b.x; arr[4] = 1.0; arr[5] = b.z;
    geom.attributes.position.needsUpdate = true;
    // Brightness scales with proximity inside the bond zone.
    const k = Math.max(0, 1 - dist / SIBLING_BOND_DIST);
    mat.opacity = 0.25 + 0.55 * k;
  });

  return (
    // eslint-disable-next-line react/no-unknown-property
    <line ref={lineRef as unknown as React.RefObject<THREE.Line>}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array([0, 1, 0, 0, 1, 0]), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial ref={matRef} color="#ffd86a" transparent opacity={0.5} linewidth={2} />
    </line>
  );
}
```

- [ ] **Step 2: Mount SiblingBond in Game.tsx**

In `src/components/Game.tsx`, add the import near the other munchies imports:

```tsx
import { SiblingBond } from './munchies/SiblingBond';
```

In `MunchiesModeSystems`, add `<SiblingBond />` to the returned fragment (anywhere inside the existing `<></>`):

```tsx
function MunchiesModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
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
      <SiblingBond />
      {phase === 'munchies-victory' && <Confetti />}
    </>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/components/munchies/SiblingBond.tsx src/components/Game.tsx
git commit -m "feat(munchies-v2): sibling-bond visible line in co-op"
```

---

## Task 12: `MunchiesGoodnightOverlay` + App.tsx mount

**Files:**
- Create: `src/ui/MunchiesGoodnightOverlay.tsx`
- Modify: `src/ui/MunchiesVictoryScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the overlay**

```tsx
// src/ui/MunchiesGoodnightOverlay.tsx
import { useGameStore } from '../state/gameStore';

/**
 * Pre-victory cinematic: stars + moon fade-in over a dimmed sky.
 * Renders one z-layer BELOW MunchiesVictoryScreen so the card sits on top.
 */
export function MunchiesGoodnightOverlay() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  if (gameMode !== 'munchies' || phase !== 'munchies-victory') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 145, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(20,20,50,0.45) 0%, rgba(8,5,22,0.92) 80%)',
        animation: 'munchies-goodnight-in 1.8s ease-out forwards',
        overflow: 'hidden',
      }}
    >
      {/* Moon */}
      <div
        style={{
          position: 'absolute',
          top: '14%',
          right: '12%',
          fontSize: 96,
          opacity: 0,
          animation: 'munchies-moon-in 2.2s ease-out 0.4s forwards',
        }}
      >🌙</div>
      {/* Twinkling stars (CSS-only) */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${(i * 53) % 90 + 4}%`,
            left: `${(i * 31) % 92 + 3}%`,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: '#fff7e6',
            opacity: 0,
            animation: `munchies-star-twinkle 2.6s ease-in-out ${0.6 + (i % 7) * 0.18}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes munchies-goodnight-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes munchies-moon-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes munchies-star-twinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Bump MunchiesVictoryScreen zIndex to 160**

In `src/ui/MunchiesVictoryScreen.tsx`, find:

```tsx
position: 'fixed', inset: 0, background: 'rgba(20, 20, 30, 0.55)', zIndex: 150,
```

Change `zIndex: 150` to `zIndex: 160`.

- [ ] **Step 3: Mount the overlay in App.tsx**

In `src/App.tsx`, add the import alongside the other munchies imports:

```tsx
import { MunchiesGoodnightOverlay } from './ui/MunchiesGoodnightOverlay';
```

Add `<MunchiesGoodnightOverlay />` BEFORE `<MunchiesVictoryScreen />` in the JSX tree.

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/ui/MunchiesGoodnightOverlay.tsx src/ui/MunchiesVictoryScreen.tsx src/App.tsx
git commit -m "feat(munchies-v2): goodnight cinematic overlay on victory"
```

---

## Task 13: Co-op net sync — extend `WorldStateMsg` + `applyWorldSnapshot`

**Files:**
- Modify: `src/net/room.ts`

- [ ] **Step 1: Add the munchies snapshot type**

In `src/net/room.ts`, add the type just below the existing `WorldStateMsg` interface:

```ts
export interface MunchiesNetSnapshot {
  level: number;
  score: number;
  lives: number;
  sleepwalkers: Record<string, { x: number; z: number; yaw: number; mode: string; tuckedAt: number }>;
  pellets: { id: string; x: number; z: number }[];
  milks: { id: string; x: number; z: number }[];
  bonus: { x: number; z: number; spawnedAt: number; eaten: boolean } | null;
  poweredUntil: number;
  difficulty: string;
  roster: string[];
}
```

Extend `WorldStateMsg`:

```ts
export interface WorldStateMsg {
  // ...existing fields unchanged...
  /** munchies — undefined when not in munchies mode. */
  munchies?: MunchiesNetSnapshot;
}
```

- [ ] **Step 2: Apply the munchies snapshot on peer side**

At the bottom of `applyWorldSnapshot`, before its closing brace, add:

```ts
// Munchies — only when host's snapshot includes it.
if (s.munchies) {
  applyMunchiesSnapshot(s.munchies);
}
```

Define the helper just below `applyWorldSnapshot`:

```ts
function applyMunchiesSnapshot(m: MunchiesNetSnapshot): void {
  // Lazy-import to avoid circular issues at module load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = require('../state/munchiesStore') as typeof import('../state/munchiesStore');
  const ms = store.useMunchiesStore.getState();

  // Replace pellets / milks if sizes differ (cheap signal).
  if (Object.keys(ms.pellets).length !== m.pellets.length) {
    store.useMunchiesStore.setState({
      pellets: Object.fromEntries(m.pellets.map((p) => [p.id, p])),
    });
  }
  if (Object.keys(ms.milks).length !== m.milks.length) {
    store.useMunchiesStore.setState({
      milks: Object.fromEntries(m.milks.map((mm) => [mm.id, mm])),
    });
  }

  // Sleepwalkers — mutate live x/z/yaw directly; update mode through setState only if changed.
  let sleepwalkersChanged = false;
  const updated = { ...ms.sleepwalkers };
  for (const id of Object.keys(m.sleepwalkers)) {
    const src = m.sleepwalkers[id];
    const target = updated[id as store.SleepwalkerId];
    if (!target) continue;
    target.x = src.x;
    target.z = src.z;
    target.yaw = src.yaw;
    if (target.mode !== src.mode) {
      updated[id as store.SleepwalkerId] = { ...target, mode: src.mode as store.SleepwalkerMode, tuckedAt: src.tuckedAt };
      sleepwalkersChanged = true;
    }
  }
  if (sleepwalkersChanged) {
    store.useMunchiesStore.setState({ sleepwalkers: updated });
  }

  // Scalars
  store.useMunchiesStore.setState({
    level: m.level,
    score: m.score,
    lives: m.lives,
    bonus: m.bonus,
    poweredUntil: m.poweredUntil,
    difficulty: (m.difficulty === 'awake' ? 'awake' : 'sleepy'),
    activeRoster: m.roster.filter(isSleepwalkerId),
  });
}

function isSleepwalkerId(s: string): s is 'dad' | 'penny' | 'dog' | 'schmorgesblob' {
  return s === 'dad' || s === 'penny' || s === 'dog' || s === 'schmorgesblob';
}
```

Note on the `require()` use: it sidesteps a known Vite/TS circular-import issue between net/room and state stores. If the existing codebase imports munchiesStore from net/room directly elsewhere without trouble, you can switch to a normal `import` — try the normal import first. The plan author defaults to require-style to be safe.

Actually — try a top-of-file import first:

```ts
import { useMunchiesStore, type SleepwalkerId, type SleepwalkerMode } from '../state/munchiesStore';
```

…and use it directly. If a circular-import error appears at runtime (rare), fall back to the require pattern.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/net/room.ts
git commit -m "feat(munchies-v2): co-op net sync — munchies snapshot in WorldStateMsg"
```

---

## Task 14: `NetSyncController` — include munchies snapshot on host

**Files:**
- Modify: `src/systems/NetSyncController.tsx`

- [ ] **Step 1: Find the host's WorldStateMsg construction**

Open `src/systems/NetSyncController.tsx`. Locate the function/section that builds the `WorldStateMsg` object passed to `broadcastWorldState()` (host-side, runs at ~10Hz).

If the construction looks like:

```ts
const msg: WorldStateMsg = {
  phase: gs.phase,
  // ...
};
broadcastWorldState(msg);
```

- [ ] **Step 2: Add the munchies branch**

Add imports at the top:

```ts
import { useMunchiesStore } from '../state/munchiesStore';
import type { MunchiesNetSnapshot } from '../net/room';
```

Just before `broadcastWorldState(msg)`, add:

```ts
if (gs.gameMode === 'munchies') {
  const ms = useMunchiesStore.getState();
  const swSerial: Record<string, { x: number; z: number; yaw: number; mode: string; tuckedAt: number }> = {};
  for (const id of Object.keys(ms.sleepwalkers)) {
    const sw = ms.sleepwalkers[id as keyof typeof ms.sleepwalkers];
    swSerial[id] = { x: sw.x, z: sw.z, yaw: sw.yaw, mode: sw.mode, tuckedAt: sw.tuckedAt };
  }
  const snap: MunchiesNetSnapshot = {
    level: ms.level,
    score: ms.score,
    lives: ms.lives,
    sleepwalkers: swSerial,
    pellets: Object.values(ms.pellets),
    milks: Object.values(ms.milks),
    bonus: ms.bonus,
    poweredUntil: ms.poweredUntil,
    difficulty: ms.difficulty,
    roster: ms.activeRoster,
  };
  msg.munchies = snap;
}
```

(Adjust to match the variable name actually used for the constructed message in the existing file — `msg`, `worldMsg`, etc.)

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/systems/NetSyncController.tsx
git commit -m "feat(munchies-v2): host broadcasts munchies snapshot in WorldStateMsg"
```

---

## Task 15: Playtest + polish

**Files:** (as discovered)

- [ ] **Step 1: Run dev server, drive the browser**

Use Playwright or Chrome-DevTools MCP if available. Otherwise run `npm run dev` and do a manual playtest (focus on the build being clean if browser tools aren't accessible).

Verify the full v2 checklist from the spec's Testing section:

1. **Solo Luke**: identical to v1. Dad + Penny + Dog ghosts; small-but-noticeable smaller catch radius.
2. **Solo Penny**: Dad + Dog + Schmorgesblob; milk window lasts 10s (or 15s on Sleepy difficulty).
3. **Co-op (two browser windows)**: both kids in. Ghosts target whichever is closer. Sibling line appears within 3m. Score bonus applies on close pellets.
4. **Difficulty toggle**: switch to Awake — ghosts noticeably faster, milk window shorter.
5. **High score**: clear a level, refresh, re-enter → HUD shows the previous best.
6. **Goodnight cinematic**: complete level 3 → 2-second moon/stars fade-in → victory card on top.
7. **Aliens & Tornado modes** unchanged.

- [ ] **Step 2: Fix any issues**

Commit each fix separately if issues are found.

- [ ] **Step 3: Final summary commit (if anything changed)**

```bash
git add -A
git commit -m "polish(munchies-v2): playtest fixes"
```

---

## Done

When all tasks complete, Penny is fully playable solo and in co-op, the Schmorgesblob completes the ghost roster, difficulty is configurable, sibling bond rewards teamwork, high scores persist, and victory ends with a moon-and-stars cinematic.

---

## Self-review checklist

**Spec coverage:**
- Penny playable in CharacterSelect → Task 9 ✓
- Per-character stats → Task 1 (config), Task 8 (applied) ✓
- Schmorgesblob ghost roster swap → Task 1 (type), Task 5 (mesh), Task 6 (dispatch), Task 7 (AI), Task 8 (roster computed at startLevel) ✓
- 2-player co-op via WorldStateMsg → Tasks 13, 14 ✓
- Sibling-bond bonus → Task 8 (logic) + Task 11 (visible line) ✓
- Difficulty toggle → Task 1 (config), Task 3 (storage), Task 4 (store), Task 9 (toggle + mount), Task 7 (applied to speed), Task 8 (applied to milk window) ✓
- High-score persistence → Task 3 (storage), Task 8 (save), Task 10 (display) ✓
- Goodnight cinematic → Task 12 ✓
- Manual playtest → Task 15 ✓

**Placeholders:** None — all code blocks complete.

**Type consistency:**
- `SleepwalkerId = 'dad' | 'penny' | 'dog' | 'schmorgesblob'` — consistent across Tasks 1, 4, 5, 7, 13.
- `Difficulty = 'sleepy' | 'awake'` — consistent across Tasks 1, 3, 4, 9.
- `CHARACTER_STATS`, `DIFFICULTY_MULT`, `SIBLING_BOND_DIST`, `SIBLING_BOND_MULT` — referenced by name in later tasks where used.
- `activePlayers()` and `playerSnapshots()` and `ghostRosterFor()` defined in Task 2, used in Tasks 7, 8, 11.
- `MunchiesNetSnapshot` defined in Task 13, used in Task 14.
- Store actions `addScore`, `setActiveRoster`, `setDifficulty` defined in Task 4, used in Task 8.

All consistent.
