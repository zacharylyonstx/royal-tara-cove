# Midnight Munchies v2 — Sibling Edition

**Date:** 2026-05-20
**Builds on:** `2026-05-20-midnight-munchies-design.md` (v1, shipped today)

A focused enhancement to Midnight Munchies: **Penny is now playable**, both solo and in **2-player co-op** with Luke. The ghost roster reshuffles based on who's playing, with a 👽 **Schmorgesblob** filling the empty slot — a delightful lore callback to the Alien Invasion mode. Adds a difficulty toggle, sibling-proximity bonus, per-character stat tweaks, high-score persistence, and a goodnight victory cinematic.

## Goals

- Penny is selectable on the munchies CharacterSelect alongside Luke.
- True 2-player co-op via existing Trystero multiplayer infrastructure: Luke and Penny on different browsers, in the same room, sharing lives + score, ghosts coordinated by the host.
- Ghost roster always = 3, swapping in the Schmorgesblob when needed.
- The kids' play feels distinct without being confusingly asymmetric.
- Difficulty is toggleable (Sleepy / Awake) and remembered.
- Nothing is removed or regressed from v1. Solo-Luke play remains identical to today's experience unless the player opts into v2 features.

## Non-goals (v2)

- More than 2 simultaneous players. (Trystero room supports it but the gameplay isn't tuned for it.)
- New maze layouts.
- Sleepwalker animations beyond the existing zombie-pose-and-Zzz.
- Customizable pajamas / character skins. (Future v3.)
- An achievements system.

## Visual / feel changes

- The character-select screen, when munchies is the active mode, shows both Luke and Penny cards (instead of Luke only).
- Above the cards, a hint shows the current difficulty (Sleepy 😴 / Awake 😬) with a small toggle button.
- In co-op, when Luke and Penny are within 3m, a soft glowing gold-yellow line (`<line>` or thin cylinder) connects them, and a small "🤝 +50%" badge briefly appears next to score on each pellet eaten.
- The Schmorgesblob ghost is rendered with a stripped-down "ghost" look — same alien silhouette but smaller (scale 0.6), slightly translucent, cyan-tinted, with a Zzz overhead like the other sleepwalkers. The kids will recognize it from the Alien Invasion game.
- Victory cinematic: 2-second camera pull-back, scene dims, stars + 🌙 fade in over the house, then "Sweet dreams" text → Play Again button.

## Architecture

### Roster logic

```ts
// src/world/munchiesRoster.ts (new)
export function ghostRosterFor(activeCharacters: CharacterId[]): SleepwalkerId[] {
  // Always returns exactly 3 ghost IDs.
  // Rule: 'dad', 'dog' always included.
  // Third slot:
  //   - If Penny is NOT a playing character → 'penny'
  //   - If Penny IS a playing character (or in co-op) → 'schmorgesblob'
  const pennyIsPlayer = activeCharacters.includes('penny');
  return pennyIsPlayer ? ['dad', 'dog', 'schmorgesblob'] : ['dad', 'dog', 'penny'];
}
```

`activeCharacters` is computed from `useNetStore`:
- Solo: `[myCharacterId]` (one of `'luke'` | `'penny'`).
- Co-op: any character that has a claimed peer. Typically `['luke', 'penny']`.

When the host starts a level (`MunchiesController.startLevel`), it computes the roster and passes it to `setLevelData` along with pellets, milks, and the matching sleepwalker spawn objects.

### `SleepwalkerId` type extends to include the alien

```ts
// src/state/munchiesStore.ts (modified)
export type SleepwalkerId = 'dad' | 'penny' | 'dog' | 'schmorgesblob';
```

Adding `'schmorgesblob'` to the union — that's all. (No `'luke'` yet; if a future variant wants Luke as a ghost, extend the union then.)

### SleepwalkerController AI rule for the Schmorgesblob

The Schmorgesblob slot inherits Penny's AI (Pinky-like: ambush 3m ahead of the target player). This keeps the difficulty curve constant when she's swapped in/out. Bed node = master bedroom (it sleeps in Dad's room — pretend it crashed there after the alien invasion). Tints cyan instead of blue when powered.

In **co-op** there are two target players. The AI picks the closer of the two for chase logic. Penny's ambush projection uses whichever player the ghost is currently targeting.

```ts
// src/systems/SleepwalkerController.tsx (modified pickNextNode + helper)
function pickTargetPlayer(sw: SleepwalkerState, players: PlayerSnapshot[]): PlayerSnapshot {
  let best = players[0];
  let bestD = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - sw.x, p.z - sw.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
```

`PlayerSnapshot` is `{ characterId, x, z, yaw }` derived from `gameStore.positions[id]` for every claimed character. In solo this list has 1 entry; in co-op it has 2.

### Player roster derivation

A new shared helper:

```ts
// src/world/munchiesRoster.ts
export function activePlayers(): CharacterId[] {
  const claimed = new Set<CharacterId>();
  const peers = useNetStore.getState().peers;
  for (const p of Object.values(peers)) {
    if (p.characterId === 'luke' || p.characterId === 'penny') claimed.add(p.characterId);
  }
  // Fallback (single-window dev with no claim): use gameStore active.
  if (claimed.size === 0) {
    const ac = useGameStore.getState().activeCharacterId;
    if (ac === 'luke' || ac === 'penny') claimed.add(ac);
    else claimed.add('luke');
  }
  return Array.from(claimed);
}
```

Catch detection iterates over `activePlayers()` instead of hard-coding `luke`.

### Per-character stat tweaks

```ts
// src/world/munchiesConfig.ts (new exports)
export const CHARACTER_STATS: Record<'luke' | 'penny', {
  catchRadius: number;
  poweredDurationS: number;
}> = {
  luke:  { catchRadius: 0.51, poweredDurationS: 8.0 },   // -15% catch radius (was 0.6)
  penny: { catchRadius: 0.6,  poweredDurationS: 10.0 },  // +25% milk window (was 8s)
};
```

Catch detection uses each player's own `catchRadius`. When a player eats milk, the duration used for `poweredUntil` comes from that player's stat. (In co-op, simplest is: use the eater's stat. So if Penny drinks milk, the global powered window is 10s; if Luke drinks one, it's 8s.)

### Difficulty toggle

Stored in localStorage under `munchies.difficulty` = `'sleepy'` or `'awake'`. Default `'sleepy'`.

```ts
// src/world/munchiesConfig.ts (new exports)
export type Difficulty = 'sleepy' | 'awake';
export const DIFFICULTY_MULT: Record<Difficulty, { speed: number; poweredMult: number }> = {
  sleepy: { speed: 0.7, poweredMult: 1.5 },
  awake:  { speed: 1.0, poweredMult: 1.0 },
};
```

Sleepwalker `baseSpeed` is multiplied by `DIFFICULTY_MULT[difficulty].speed`. Powered milk duration is multiplied by `DIFFICULTY_MULT[difficulty].poweredMult` (applied at eat time on top of the character's base).

A small UI toggle lives on `CharacterSelect` (munchies mode only): two pill buttons "😴 Sleepy" / "😬 Awake", with the selected one filled. Click toggles + writes to localStorage.

Lives in a new `munchiesStore` field:

```ts
difficulty: Difficulty;
setDifficulty: (d: Difficulty) => void;
```

Loaded from localStorage on store init.

### Sibling-bond bonus

In `MunchiesController`'s per-frame pellet pickup loop, when the pellet is eaten check:

```ts
// In co-op only (two players claimed)
const players = activePlayers();
if (players.length === 2) {
  const a = gs.positions[players[0]];
  const b = gs.positions[players[1]];
  const proximity = Math.hypot(a.x - b.x, a.z - b.z);
  if (proximity < 3.0) {
    // 1.5x multiplier — eat the pellet, then bonus the extra +5
    useMunchiesStore.getState().addScore(COOKIE_POINTS * 0.5);
    // ...optional toast/HUD signal
  }
}
```

(`addScore` is a new action on the store that just bumps score by N.)

The visible bond is a `<line>` between Luke and Penny when within 3m, rendered in a new `<SiblingBond />` component in `MunchiesModeSystems`. Color glows brighter when within the threshold.

### Multiplayer wiring

The existing v1 host-gate means non-host browsers currently see nothing. v2 makes munchies network-aware so peers receive ghost positions + pellet state.

#### WorldStateMsg extension (`src/net/room.ts`)

```ts
export interface WorldStateMsg {
  // ...existing fields unchanged...

  /** munchies — undefined when not in munchies mode. */
  munchies?: MunchiesNetSnapshot;
}

export interface MunchiesNetSnapshot {
  level: number;
  score: number;
  lives: number;
  /** Sleepwalker live state for visible/AI parity. */
  sleepwalkers: Record<string, { x: number; z: number; yaw: number; mode: 'normal' | 'powered' | 'tucked'; tuckedAt: number }>;
  /** Remaining pellet IDs only — peer can derive positions from the deterministic pellet generator if it matches; or we can send positions inline. For simplicity send {id, x, z} but only for pellets still alive. */
  pellets: { id: string; x: number; z: number }[];
  milks: { id: string; x: number; z: number }[];
  bonus: { x: number; z: number; spawnedAt: number; eaten: boolean } | null;
  poweredUntil: number;
  difficulty: 'sleepy' | 'awake';
  /** Active ghost roster — host's chosen IDs this level. */
  roster: string[];
}
```

#### Host broadcast

`NetSyncController` already broadcasts WorldStateMsg every N ms on the host. Extend its munchies branch:

```ts
// In NetSyncController, when building the snapshot, add:
if (gs.gameMode === 'munchies') {
  const ms = useMunchiesStore.getState();
  worldMsg.munchies = {
    level: ms.level, score: ms.score, lives: ms.lives,
    sleepwalkers: serializeSleepwalkers(ms.sleepwalkers),
    pellets: Object.values(ms.pellets),
    milks: Object.values(ms.milks),
    bonus: ms.bonus,
    poweredUntil: ms.poweredUntil,
    difficulty: ms.difficulty,
    roster: ms.activeRoster,
  };
}
```

#### Peer apply

In `applyWorldSnapshot`, add:

```ts
if (s.munchies) {
  const ms = useMunchiesStore.getState();
  // Replace pellets/milks if cardinality differs (cheap signal).
  if (Object.keys(ms.pellets).length !== s.munchies.pellets.length) {
    useMunchiesStore.setState({
      pellets: Object.fromEntries(s.munchies.pellets.map((p) => [p.id, p])),
    });
  }
  // ...same for milks
  // Mutate sleepwalkers in-place to avoid re-renders (same pattern as host).
  for (const id in s.munchies.sleepwalkers) {
    const target = ms.sleepwalkers[id as SleepwalkerId];
    const src = s.munchies.sleepwalkers[id];
    if (target && src) {
      target.x = src.x; target.z = src.z; target.yaw = src.yaw;
      if (target.mode !== src.mode) {
        useMunchiesStore.setState({
          sleepwalkers: { ...ms.sleepwalkers, [id]: { ...target, mode: src.mode, tuckedAt: src.tuckedAt } },
        });
      }
    }
  }
  // Set scalars
  useMunchiesStore.setState({
    level: s.munchies.level,
    score: s.munchies.score,
    lives: s.munchies.lives,
    bonus: s.munchies.bonus,
    poweredUntil: s.munchies.poweredUntil,
    difficulty: s.munchies.difficulty,
  });
}
```

Peer behavior: peer's `MunchiesController` and `SleepwalkerController` host-gate remains, so they don't run game logic. They only render based on store state.

Peer's `PlayerController` munchies-branch still runs (each peer moves their own character). The host's pellet-eat detection is based on the host's view of all players' positions — which it gets via `PlayerStateMsg` (already broadcast). So Luke (peer) moving on his browser sends his position to the host, host sees Luke overlap a cookie, host eats it, host broadcasts state, peer sees pellet vanish. Standard.

### High-score persistence

```ts
// src/world/munchiesScoreStorage.ts (new)
export function loadBestScore(character: 'luke' | 'penny'): number {
  try { return parseInt(localStorage.getItem(`munchies.best.${character}`) ?? '0', 10) || 0; }
  catch { return 0; }
}
export function saveBestScore(character: 'luke' | 'penny', score: number): void {
  try {
    const prev = loadBestScore(character);
    if (score > prev) localStorage.setItem(`munchies.best.${character}`, String(score));
  } catch { /* localStorage blocked */ }
}
```

On `'munchies-victory'` and `'munchies-game-over'` phases (host only), `MunchiesController` calls `saveBestScore(myChar, score)` for each active character on this side.

HUD shows `⭐ 540  ·  Best 1240`. The "Best" is loaded once on HUD mount.

### Goodnight cinematic

A new component `<MunchiesGoodnightOverlay />` in `src/ui/`:

- Renders only on `phase === 'munchies-victory'`.
- Composes an existing victory layer: keep `MunchiesVictoryScreen.tsx` exactly as today, but mount this overlay one zIndex below it with a 2-second entry animation.
- Components: a stars background (reuse `<Fireflies />` is too aliens-themed — write a tiny custom CSS-animated star field), a 🌙 emoji, an opacity-faded gradient. After 2 seconds, the existing victory card slides in on top.

Implementation: pure CSS + JSX, no Three.js needed (the canvas keeps rendering underneath but dimmed).

```tsx
export function MunchiesGoodnightOverlay() {
  // CSS-keyframes animated overlay: dark gradient + tiny twinkling stars + moon
  // Mount duration: while phase === 'munchies-victory'
  // Z-index: below MunchiesVictoryScreen (which is z=150)
}
```

Set `MunchiesVictoryScreen` to z=160 to ensure layering.

## Component diagram (additions)

```
src/world/munchiesRoster.ts             (new)  — ghostRosterFor + activePlayers
src/world/munchiesScoreStorage.ts       (new)  — localStorage helpers
src/components/munchies/SchmorgesGhost.tsx (new) — alien ghost mesh (stripped Schmorgesblob)
src/components/munchies/SiblingBond.tsx    (new) — line connecting kids in co-op
src/ui/MunchiesDifficultyToggle.tsx     (new)  — Sleepy/Awake pill toggle
src/ui/MunchiesGoodnightOverlay.tsx     (new)  — pre-victory cinematic
```

Modified:
- `src/state/munchiesStore.ts` — `SleepwalkerId` adds `'schmorgesblob'`; new `difficulty`, `addScore`, `activeRoster` fields.
- `src/world/munchiesConfig.ts` — `CHARACTER_STATS`, `Difficulty`, `DIFFICULTY_MULT`.
- `src/systems/MunchiesController.tsx` — uses `activePlayers()` for catch + sibling bond; applies per-character catch/powered stats; applies difficulty mults; saves high score; writes `activeRoster` on `startLevel`.
- `src/systems/SleepwalkerController.tsx` — iterates `activePlayers()` for chase logic; supports `'schmorgesblob'` ID with Penny's AI rule + cyan tint + master-bed spawn.
- `src/components/munchies/Sleepwalker.tsx` — dispatches `'schmorgesblob'` ID to `SchmorgesGhost` mesh.
- `src/ui/CharacterSelect.tsx` — when munchies mode: show Luke + Penny cards; show difficulty toggle.
- `src/ui/MunchiesHud.tsx` — append "Best: NNN" after score.
- `src/components/Game.tsx` — `MunchiesModeSystems` adds `<SiblingBond />`.
- `src/App.tsx` — mount `<MunchiesGoodnightOverlay />`.
- `src/net/room.ts` — extend `WorldStateMsg`; add munchies branch to `applyWorldSnapshot`.
- `src/systems/NetSyncController.tsx` — include munchies snapshot when in munchies mode.

## Data flow (per frame, host in co-op)

```
PlayerController (each peer)
  → moves own character locally → sends PlayerStateMsg

NetSyncController (host)
  → reads positions of all claimed characters (host's own + peer broadcasts)
  → host's MunchiesController + SleepwalkerController run
  → broadcasts WorldStateMsg with .munchies = { sleepwalkers, pellets, milks, score, lives, ... }

NetSyncController (peer)
  → applies WorldStateMsg → mutates munchiesStore
  → peer's renderers (CookiePickupsLive, MilkPickupsLive, SleepwalkersLive) re-render from store
```

## Error handling / edge cases

- **Solo with the dev-mode fallback** (no claimed character because no NetSync running yet): `activePlayers()` falls back to `gameStore.activeCharacterId` for the single-player case so the catch + bond logic still works.
- **Peer joins mid-game**: the host's next WorldStateMsg fills the peer's munchies store. PelletsLive re-renders. Sleepwalkers appear (already-mutated x/z fields).
- **One player gets caught in co-op**: lives are shared. Both get teleported to spawn. Add explicit "both characters move to spawn" in the caught cinematic exit.
- **localStorage blocked**: `loadBestScore`/`saveBestScore` return 0 / no-op. Game still works.
- **Schmorgesblob spawns in a bed that doesn't exist**: it uses master-bed (existing node). No extra bed mesh needed — visually it shares Dad's room as if it crashed there.

## Testing (manual)

1. Solo Luke: identical to v1 behavior (Dad + Penny + Dog ghosts; Luke's smaller catch radius doesn't change the basic feel meaningfully).
2. Solo Penny: Dad + Dog + 👽 Schmorgesblob; +25% longer powered milk window.
3. Co-op: two browser windows on the same network. Luke + Penny both move independently. Ghosts respond to whichever is closer. Sibling line glows when within 3m. Eating cookies while close gives the +50% bonus.
4. Difficulty toggle: switch to Awake → ghosts noticeably faster, milk window shorter.
5. High score: clear a level, refresh, re-enter → HUD shows previous Best.
6. Goodnight cinematic: complete level 3 → 2-second moon/stars fade-in → victory card.
7. Aliens & Tornado modes still work (no regressions).
8. Multiplayer aliens game still works (WorldStateMsg additions are optional fields, peers ignore unknown).

## Files summary

**New files (6):**
```
src/world/munchiesRoster.ts
src/world/munchiesScoreStorage.ts
src/components/munchies/SchmorgesGhost.tsx
src/components/munchies/SiblingBond.tsx
src/ui/MunchiesDifficultyToggle.tsx
src/ui/MunchiesGoodnightOverlay.tsx
```

**Modified files (11):**
```
src/state/munchiesStore.ts
src/world/munchiesConfig.ts
src/systems/MunchiesController.tsx
src/systems/SleepwalkerController.tsx
src/components/munchies/Sleepwalker.tsx
src/ui/CharacterSelect.tsx
src/ui/MunchiesHud.tsx
src/components/Game.tsx
src/App.tsx
src/net/room.ts
src/systems/NetSyncController.tsx
```

## Future work (out of scope for v2)

- "Daddy's slipper" throwable defensive item.
- Pajama customization on CharacterSelect.
- Speedrun-mode with a visible timer.
- Pet-the-dog mechanic (walk slowly → dog ignores you).
- Penny solo with Luke as a 3rd ghost variant (the SleepwalkerId union has room).
