# The Treehouse Club — fourth game mode

**Date:** 2026-05-21

A cozy adventure game that gives Penny and Luke a permanent home in Royal Tara Cove: a treehouse in 10600's backyard where they accept letter-driven missions around the neighborhood and collect souvenirs that persist forever on the treehouse shelf. No combat. No fail states. The "safe" game.

## Goals

- A fourth selectable game mode on the welcome screen, sibling to Aliens, Tornado, and Munchies.
- A 3D treehouse in 10600's backyard that Penny and Luke own. Climb a ladder to enter.
- A "letter board" inside the treehouse showing the current mission letter from a cove neighbor.
- Three starter missions, each ~5 minutes, completable in daytime, no fail state.
- Mission completion awards a **persistent souvenir** (sticker/item) that appears on the treehouse shelf and survives between sessions via localStorage.
- Solo or 2-player co-op (Penny + Luke). Both playable; both spawn in the backyard at game start.
- Atmospheric: warm afternoon lighting, cozy guitar/piano music loop, the existing cove neighborhood seen through a different lens.
- Easy to add new missions later: each mission is a single small file with a definition + a completion predicate.

## Non-goals (v1)

- NPC characters that walk around the cove. Letters are signed by neighbors but the neighbors themselves are not yet rendered as walking people. (Future feature.)
- Time-of-day cycle / night missions. (Starter missions are all daytime.)
- Player-to-player letter writing between Penny and Luke. (Future feature.)
- Treehouse customization (paint, furniture placement). (Future.)
- Achievements, leaderboards, scores. The souvenir shelf IS the scoreboard.
- Combat, enemies, damage, death.

## Player experience flow

```
Welcome screen
  └─ 🌳 The Treehouse Club card → setGameMode('treehouse')
       └─ CharacterSelect — Luke and Penny both visible (co-op friendly)
            └─ Pick character → spawns in 10600's backyard, facing the live oak with the treehouse
                 └─ Welcome overlay: "Welcome to The Treehouse Club! Climb up to read your first letter."
                      └─ [free play]
                           ├─ Walk around backyard, climb ladder
                           ├─ Inside treehouse: walls, shelf (empty initially), letter board
                           ├─ Click letter board → letter overlay opens
                           ├─ Read letter → mission becomes "active"
                           ├─ HUD shows mission goal: "🎯 Touch all 10 mailboxes"
                           └─ Walk around the cove, complete the goal
                                └─ Mission complete toast: "+1 sticker: 🌳 Treehouse Founder"
                                     └─ Sticker appears on shelf (persistent)
                                          └─ Next letter auto-pinned to board
```

## Visual feel

- **Time of day:** afternoon (timeOfDay = 0.25, golden light, long shadows). Existing DynamicSky/DynamicLights produce this look automatically.
- **Music:** cozy acoustic-guitar-style loop — sparse, warm, sustains. New procedural loop in audio.ts.
- **Atmosphere:** the existing cove with all its houses, mailboxes, yards, trees, hedges — all just as you've already built. The treehouse is the one new building.
- **Treehouse:** 3m × 3m wooden platform 4m up in the live oak in 10600's backyard. Wooden walls ~2.2m tall, simple gabled roof. A wooden ladder leading down to ground level. One doorway facing the patio (south). Inside: rough wood floor, a souvenir shelf along the back wall, a letter board on a side wall, a small chalkboard with "PENNY & LUKE'S CLUB" written on it.

## Architecture

### Game mode + phase

`src/state/gameStore.ts`:

```ts
export type GameMode = 'aliens' | 'tornado' | 'munchies' | 'treehouse';

export type TreehousePhase =
  | 'treehouse-welcome'      // first-time overlay on entry
  | 'treehouse-play'         // default — free exploration / mission active
  | 'treehouse-letter-open'  // letter overlay is showing
  | 'treehouse-complete';    // post-completion toast for a few seconds

export type GamePhase = /* existing */ | TreehousePhase;
```

`closeWelcome()` updated:

```ts
phase:
  s.gameMode === 'tornado'   ? 'calm' :
  s.gameMode === 'munchies'  ? 'munchies-intro' :
  s.gameMode === 'treehouse' ? 'treehouse-welcome' :
  'intro'
```

### `treehouseStore` (new — `src/state/treehouseStore.ts`)

```ts
interface TreehouseStore {
  /** Mission IDs the player has completed (in order). Persisted to localStorage. */
  completedMissions: string[];

  /** Souvenirs earned, keyed by sticker id. */
  souvenirs: Record<string, {
    id: string;
    emoji: string;
    label: string;
    earnedAt: number;          // Date.now() when earned
  }>;

  /** ID of the active mission, if any. */
  activeMissionId: string | null;

  /** ID of the "next" mission to offer (set by controller after completion). */
  pendingMissionId: string;

  /** Position and live mutation state for any mission item currently in the world (e.g. the gnome). */
  missionItem: {
    id: string;
    x: number; z: number;       // current position
    carriedBy: 'luke' | 'penny' | null;  // null = on the ground
  } | null;

  /** First-time welcome overlay shown? Persisted. */
  hasSeenWelcome: boolean;

  // Actions
  setActiveMission: (id: string | null) => void;
  setPendingMission: (id: string) => void;
  completeMission: (id: string, sticker: { id: string; emoji: string; label: string }) => void;
  spawnMissionItem: (id: string, x: number, z: number) => void;
  pickUpMissionItem: (who: 'luke' | 'penny') => void;
  dropMissionItem: (x: number, z: number) => void;
  setMissionItemPos: (x: number, z: number) => void;
  markWelcomeSeen: () => void;
  reset: () => void;
}
```

Initial values hydrate from localStorage on store create (key: `treehouse.v1`). All non-runtime fields persist: `completedMissions`, `souvenirs`, `pendingMissionId`, `hasSeenWelcome`.

### Mission definitions (`src/world/treehouseMissions.ts`)

```ts
export interface MissionLetter {
  id: string;
  sender: string;          // "Mrs. Patel from 10625"
  title: string;           // "The Missing Gnome"
  bodyMarkdown: string;    // letter body
  goalHint: string;        // shown in HUD: "🎯 Find Gnomey and drop him in 10625's mailbox"
  sticker: { id: string; emoji: string; label: string };
  setup?: () => void;      // called on activation (e.g. spawn the gnome at a random hidden spot)
  isComplete: () => boolean;  // called per frame; true when mission goal met
  teardown?: () => void;   // called on completion (e.g. despawn the gnome)
}
```

Three starter missions:

**M1 — "Welcome to the Cove" (always first, given by Dad):**
- Sender: "Dad"
- Goal: walk to a marker by the basketball-hoop area near 10617's driveway, stay for 1 second
- Marker: a glowing yellow ring on the ground at the target spot, visible from afar
- Sticker: 🌳 "Treehouse Founder"

**M2 — "The Missing Gnome":**
- Sender: "Mrs. Patel from 10625"
- Goal: find the gnome (spawned at a fixed hiding spot — behind 10609's mailbox), pick it up (E to interact), drop it in 10625's mailbox (E when standing within 3m of 10625's mailbox while carrying)
- Setup: spawn a gnome mesh at the hiding spot
- Sticker: 🪻 "Gnome Rescuer"

**M3 — "Where's Sparky?":**
- Sender: "the cul-de-sac"
- Goal: a "Sparky" (small dog mesh, reuses the Dog component from munchies but tame and friendly) is wandering the cove. Find Sparky, walk close enough (within 4m) — Sparky now follows you. Lead Sparky back to a marker at 10600's front walkway.
- Setup: spawn Sparky at a random known position from a fixed list (3 candidate spots)
- Sticker: 🐕 "Dog Whisperer"

After all 3 are done: a "thank you" letter appears with no goal (free play remains). Future missions can be added to the list and they'll appear in order.

### Components

**`src/components/treehouse/Treehouse.tsx`** — the building itself. Wooden box on stilts up in the live oak. Static mesh. Includes:
- Floor (3m × 3m wood plank)
- Four walls with one doorway (south-facing)
- Gabled roof
- Interior chalkboard with painted "PENNY & LUKE'S CLUB" text (rendered with drei `<Text>` so we don't need a texture)
- Letter board (a cork-textured rectangle on one wall) — clickable
- Souvenir shelf (wooden plank along the back wall)

Position: in the live oak at 10600's backyard. The hero house is at world (-50, 0, -50) approximately (from world/lots.ts); the live oak is at `(backWX, 0, backWZ)` for hero house — computed in Game.tsx LotVegetation. Treehouse goes at y=4 (in the tree canopy), x/z matching the live oak's world position.

**`src/components/treehouse/Ladder.tsx`** — a vertical wooden ladder at the treehouse doorway, going from y=0 to y=4. Climbing mechanic: when player is within 1m of the ladder base AND presses W (or arrow up), they ascend at 2 m/s. When at y ≥ 4 they step onto the treehouse floor. Coming down: walking toward the doorway edge of the treehouse triggers descent.

Simpler v1 approach: a single **"climb" interactable** at the ladder base. Press E to teleport up to the treehouse floor. Press E inside the treehouse (anywhere near the doorway) to teleport down. (Realistic climbing animation is v2.)

**`src/components/treehouse/SouvenirShelf.tsx`** — renders the collected stickers as little floating emoji on the shelf. Each sticker is a drei `<Html>` element with the emoji + a tooltip on hover showing the label. Cumulative across sessions.

**`src/components/treehouse/MissionItem.tsx`** — renders the active mission item (gnome / Sparky) at its store-tracked position. Mesh chosen by item id: gnome = small pointed cone+sphere; Sparky reuses the existing Dog mesh from munchies.

**`src/components/treehouse/MissionMarker.tsx`** — for missions that have a target ground spot (M1, M3), renders a glowing yellow ring on the ground at the target position. Click/walk over to complete.

### Systems

**`src/systems/TreehouseController.tsx`** — game loop:
- On mount: read `pendingMissionId` from store; if no active mission, activate it (call its `setup()`).
- Every frame: if there's an active mission, call `mission.isComplete()`. If true → award sticker → archive letter → set next pending mission → start next.
- Handle pickup/drop interactions for mission items.

**`src/systems/TreehouseCamera.tsx`** — 3rd-person behind-the-back camera. No pointer lock. Auto-orients to player movement direction with slight lag. Height ~3m above player, distance ~6m back. Same FOV as base (80°). Smoother than the FPS rig — calm vibe.

**Mode-gated** existing controllers: PlayerController gets a treehouse branch (no jump, optional Shift run for fun, E interact for ladder + mission items, no door interact), CameraRig early-returns in treehouse mode, NPCController early-returns, MusicController plays the treehouse loop.

### UI

**`src/ui/TreehouseWelcomeOverlay.tsx`** — full-screen warm overlay shown on first-ever entry to the mode. Skippable. After first dismissal, `hasSeenWelcome = true` persists; next sessions skip straight to play.

**`src/ui/TreehouseLetterOverlay.tsx`** — opens when phase = `'treehouse-letter-open'`. Renders a paper-textured card with the letter body. "Accept Mission" button activates it; "Maybe Later" closes the overlay. Multiple letters? For v1: only the active letter is shown. (Archive is invisible — past letters live on the shelf via their stickers.)

**`src/ui/TreehouseHud.tsx`** — small chip at the top of the screen showing the active mission goal hint (e.g. "🎯 Find Gnomey and drop him in 10625's mailbox") and a count of stickers earned. Hidden during the welcome overlay.

**`src/ui/TreehouseMissionCompleteToast.tsx`** — celebratory toast: "🪻 You earned a sticker: Gnome Rescuer!" with a fade-in + bounce + fade-out over 3 seconds. Plays a cheerful chime SFX.

### Audio

`src/audio.ts` adds:
- `startTreehouseTheme() / stopTreehouseTheme()` — slow acoustic-guitar-like loop. Simple plucked-triangle arpeggio at moderate tempo with a sustained bass.
- `treehouseChime()` — sticker-earned celebration sound. 3-note ascending chime (C5–E5–G5).
- `treehousePickup()` — soft pop when picking up a mission item.
- `treehouseDoorOpen()` — wood-creak when entering/leaving treehouse (optional in v1).

### Data flow

```
PlayerController
  → moves character locally
  → presses E near ladder → store: set position to treehouse floor
  → presses E near mission item → store: pickUpMissionItem(activeId)
  → presses E near mailbox (carrying item) → store: dropMissionItem at mailbox

TreehouseController (useFrame)
  → reads activeMissionId, runs mission.isComplete()
  → if complete: completeMission(id, sticker) → setNextMission → setup next

CameraRig disabled; TreehouseCamera takes over.

UI renders from store: TreehouseHud shows goal hint, SouvenirShelf shows stickers, MissionItem renders at store pos.
```

### Co-op

Treehouse mode supports both Luke and Penny via the existing Trystero multiplayer. Mission state is host-authoritative; peer sees mission item position via existing PlayerStateMsg-style broadcasts. For v1, mission items are NOT in WorldStateMsg — keeping co-op simple by making the mission state host-only:
- Host runs the mission logic.
- Peer's character walks around but doesn't independently award stickers.
- Souvenirs are local to each player's localStorage on their own machine. (Sticker collection is a personal achievement; both kids can earn stickers on their own browsers.)

This is intentional v1 scope — full WorldStateMsg sync of mission state is v2.

### Files summary

**New (14):**

```
src/state/treehouseStore.ts
src/world/treehouseMissions.ts
src/world/treehouseStorage.ts
src/systems/TreehouseController.tsx
src/systems/TreehouseCamera.tsx
src/components/treehouse/Treehouse.tsx
src/components/treehouse/Ladder.tsx
src/components/treehouse/SouvenirShelf.tsx
src/components/treehouse/MissionItem.tsx
src/components/treehouse/MissionMarker.tsx
src/ui/TreehouseWelcomeOverlay.tsx
src/ui/TreehouseLetterOverlay.tsx
src/ui/TreehouseHud.tsx
src/ui/TreehouseMissionCompleteToast.tsx
```

**Modified (8):**

```
src/state/gameStore.ts            # GameMode union, TreehousePhase, closeWelcome branch, resetTreehouse
src/ui/WelcomeScreen.tsx          # 4th card
src/ui/CharacterSelect.tsx        # Luke + Penny visible in treehouse mode
src/components/Game.tsx           # mount TreehouseModeSystems
src/systems/CameraRig.tsx         # gate off in treehouse mode
src/systems/NPCController.tsx     # gate off in treehouse mode
src/systems/MusicController.tsx   # gate off in treehouse (TreehouseController starts theme)
src/systems/PlayerController.tsx  # treehouse movement branch (3rd person, E interact)
src/App.tsx                       # mount Treehouse UI overlays
src/audio.ts                      # treehouse theme + chime + pickup SFX
```

## Error handling / edge cases

- **Player picks up the gnome then leaves the cove entirely:** the bounds clamp (similar to munchies) keeps them within the cove footprint. Alternative: pressing R returns to the treehouse and re-spawns the gnome.
- **Player completes mission but localStorage is full / blocked:** completion still works in-session; sticker just doesn't persist. Console.warn.
- **Mission item drop location is mid-air:** drop logic computes the player's current x/z (ground-level).
- **Co-op peer joins mid-mission:** they see whatever state the host has via PlayerStateMsg, but they don't run mission logic locally. Sticker awards stay host-side.
- **Welcome overlay shows every time despite `hasSeenWelcome`:** verify localStorage hydration order — store is created before first render. We hydrate inline at store init.

## Testing

Manual playtest checklist:

1. Welcome screen shows 4 cards. 🌳 Treehouse Club card works.
2. Solo Luke: spawns in backyard near live oak.
3. Solo Penny: same backyard spawn.
4. Welcome overlay shows on first session; click dismiss; refresh — overlay does NOT show again.
5. Climb the ladder (E near base) → arrive on treehouse floor.
6. Inside: chalkboard, letter board, empty shelf visible.
7. Click letter board → letter overlay opens with M1 content. Accept Mission → HUD shows the goal hint.
8. Climb back down. Walk to the 10617 marker. Stay 1s. Mission complete toast appears. Climb back up. Sticker is on the shelf.
9. New letter is on the board (M2 — Missing Gnome).
10. Find the gnome at the hiding spot (behind 10609's mailbox). E to pick up. HUD updates: "Drop Gnomey in 10625's mailbox". Walk there. E. Toast appears.
11. M3 — Sparky. Find. Sparky follows you. Lead to marker. Done.
12. After all 3 done, "Thank You" letter on board, no active goal. Free play continues.
13. Refresh browser → all 3 stickers still on shelf.
14. Aliens / Tornado / Munchies modes unaffected.
15. Co-op: open second browser, both pick treehouse mode + characters. Both spawn in backyard. Both walk around. Stickers earned in browser-A do not appear in browser-B's shelf (intentional v1).

## Future work (v2+)

- NPCs walking the cove (Mrs. Patel, the cat Mr. Whiskers).
- Player-to-player letter writing — sibling pen-pal system.
- Treehouse customization (paint walls, place furniture).
- Time-of-day cycle so night-time missions become possible ("First Star Tonight", "Catch the Fireflies").
- Seasonal letters (Halloween, winter holidays, summer birthdays — calendar-aware).
- Dad-authored letters: a way for the parent to schedule a private letter that the kids discover next session.
- Multi-player co-op mission completion sync via WorldStateMsg.
- Trophy display: items collected from other modes (defeated alien plush from Aliens, bent weather-vane from Tornado, cookie jar from Munchies) appear on the shelf when those modes are beaten.
