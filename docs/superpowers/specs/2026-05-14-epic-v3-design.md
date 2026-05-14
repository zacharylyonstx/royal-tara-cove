# Royal Tara Cove — Epic Pass v3

**Date:** 2026-05-14
**Status:** Approved (--auto, --i-believe-you-can-make-this-epic)

## Goal

Push the schmorgesblob invasion from "neat tech demo" to "legitimately
fun game my kids will play multiple times." That means waves with
escalating drama, more enemy types, a final boss, kids who participate
during the fight, atmospheric day-night progression, character
dialogue, a mini-map for awareness, and a satisfying cinematic
finish.

## Major changes

### 1. Wave system

Replace the single 8-blob spawn with three waves:

| Wave | Composition | Notes |
|---|---|---|
| 1 | 6 hoppers (existing schmorgesblob) | Tutorial-feel intro |
| 2 | 4 hoppers, 4 sprinters, 4 splitters (12) | Variety + complexity |
| 3 | 1 BOSS + 6 hopper minions, summons more | Climax |

Wave manager (`systems/WaveController.tsx`) state machine:

```
idle → spawning(N) → fighting → cleared → intermission(5s) → next wave
```

`combatStore` adds:
- `waveIndex: number`         (0 = none, 1..3)
- `waveState: 'spawning' | 'fighting' | 'cleared' | 'intermission' | 'won'`
- `intermissionEndsAt: number`

UI: a wave intermission overlay (`WaveBanner.tsx`) shows
"WAVE 2 INCOMING" with a countdown ring. After Wave 3 with the
boss dead → victory.

### 2. Enemy variety

Each enemy is a `BlobKind`. Existing fields go on a base interface;
specialized fields per kind. The `combatStore.Blob` gets a `kind`
field.

```ts
type BlobKind = 'hopper' | 'sprinter' | 'splitter' | 'boss';

interface Blob {
  ...existing,
  kind: BlobKind;
  hp: number;          // varies per kind
  scale: number;       // 1 default; boss is ~3
}
```

**Sprinter**
- Smaller, lower HP (1).
- Constant ground locomotion (no hopping). Slides toward player at 4 m/s.
- Visual: more elongated body, no antennae, single big cyclops eye, two extra tentacles.
- Color palette: vivid red/orange (urgent feel).

**Splitter**
- 2 HP. When killed, spawns 2 baby hoppers (HP 1) at its position with a small spread.
- Visual: bulgier body with three glowing pustules on top that pop on death.
- Color: poison-purple.

**Boss**
- 25 HP. Scale 3.0.
- Visual: giant translucent dome, three eyes (vertical stack), CROWN of glowing spikes (suggests "alpha"), four tentacles, no individual mouth — instead a giant maw on the underside.
- AI:
  - **Slam attack**: every 6s, jumps high then crashes down, generating a shock ring that knocks player back + drains 2 HP if within 3m.
  - **Summon attack**: every 8s, spawns 1-2 hopper minions from underneath.
  - **Charge attack**: when player is far (>20m), charges toward player at 6 m/s for 2s.
- Death: large explosion, splits into a giant goo splat, triggers global slow-mo + cinematic zoom.

`BlobController` already iterates blobs; refactor it to dispatch per
kind and reuse `Schmorgesblob.tsx` as the base renderer with
appropriate visual variants. Boss gets its own `BossBlob.tsx`.

### 3. Kid sidekicks autoshoot

When the active character is in combat phase, the **non-active** kids
(Penny + Luke) periodically fire at the nearest blob within 18m if
they have line-of-sight.

- Fire rate: 1 shot per 2s (vs the player's 0.18s cooldown).
- Damage: 1 (same as the player).
- Range: 18m.
- Beam visual: thinner, kid-character-tinted (Penny pink, Luke green).
- Each kid has a tiny "kid blaster" mesh (smaller than the dad ray gun) anchored at their hand each frame.

`systems/SidekickController.tsx` runs the AI. They fire only when
`phase === 'combat'` and their distance to nearest blob is in range
and they're not the active character.

### 4. Day-night cycle

Tied to wave progression rather than wall-clock:
- **Wave 1**: golden hour — sun low, warm tint, long shadows.
- **Wave 2**: dusk — sun setting, sky purpling.
- **Wave 3**: night — sun near horizon, stars visible, point lights on houses light up.
- **Victory**: pre-dawn — first hint of sun returning.

Implemented via a `SkyController.tsx` that interpolates:
- Drei `<Sky>` `sunPosition` and `turbidity` based on `currentTimeOfDay`.
- Directional light intensity + color.
- Hemisphere light tint.
- A `<Stars>` (custom Points) component that fades in at night.

`combatStore.timeOfDay` value (0..1, 0 = noon, 0.5 = sunset, 1 = midnight) is
derived from `waveIndex` and lerps smoothly during intermissions.

### 5. Dialogue popups

`ui/Dialogue.tsx` overlay shows speech bubbles tied to characters at
scripted moments:

| Trigger | Speaker | Text |
|---|---|---|
| Game start (welcome closes) | Penny | "Dad, what's that thing in the sky?!" |
| UFO 2s into descent | Luke | "It's a SPACESHIP!" |
| UFO impact | Dad | "EVERYONE BEHIND ME!" |
| Combat start | Dad | "Time to test the ray gun." |
| Wave 1 cleared | Penny | "We got 'em!" |
| Wave 2 starts | Luke | "More are coming!" |
| Wave 3 starts | Dad | "That one's HUGE." |
| Boss summons | Penny | "WATCH OUT!" |
| Player low HP (≤3) | Luke | "Dad, we're losing!" |
| Boss death | Dad | "Earth defended!" |
| Defeat | Penny | "...we'll get them next time." |

Each bubble: rounded white box with a tail, fades in/out over 3s,
positioned over the speaker's head (projected from world space to
screen).

`combatStore.dialogue: { speaker, text, until }[]` queue, manager
adds entries; `Dialogue.tsx` renders each with a CSS animation.

### 6. Mini-map HUD

`ui/MiniMap.tsx` — a circular SVG in the top-right, ~140px diameter.
Shows:
- Blue triangle for active player, oriented to facing.
- Yellow dots for non-active kids.
- Red dots for blobs (alive only). Boss = bigger dot.
- Yellow circle for the UFO.
- Black background, slight glow border.
- Range: 60m radius around the active player.

### 7. Boss-kill slow-mo + zoom

When the boss's HP hits 0:
- `combatStore.slowMo = 0.25` (time scale multiplier).
- `combatStore.slowMoEndsAt = now + 1.4s`.
- `CameraRig` reads `slowMo` and applies it via... actually time scaling at the frame level is tricky in R3F. Simpler: set a global `slowFactor` ref that all `useFrame` consumers multiply their `dt` by. Most relevant systems (BlobController, NPCController, PlayerController, SmokeColumn) already use `dt`. We add a `useSlowMo` hook that returns the effective multiplier.
- Camera zooms in (target distance shrinks to 4m) and tilts.
- After 1.4s, slowMo resets to 1.

### 8. Victory stats

Track in `combatStore`:
- `gameStartedAt: number` (set when phase=intro)
- `shotsFired: number`
- `shotsHit: number`
- `kills: number` (already exists)

Victory screen displays:
- Time to victory (mm:ss.s)
- Kills / 21 (total enemies)
- Accuracy (hits / shots)
- Rating: S (≥80% accuracy + <90s), A (≥60% + <120s), B (≥40%), C (otherwise)

## Architecture

```
src/state/combatStore.ts          # ADD wave fields, enemy kind support,
                                  #     slowMo, dialogue queue, stats
src/systems/WaveController.tsx    # NEW
src/systems/SidekickController.tsx # NEW
src/systems/SkyController.tsx     # NEW

src/components/aliens/
  Schmorgesblob.tsx               # MODIFIED — handle 'sprinter', 'splitter' visuals
  BossBlob.tsx                    # NEW
  Stars.tsx                       # NEW

src/components/weapons/
  KidBlaster.tsx                  # NEW — small gun rendered for kids

src/ui/
  WaveBanner.tsx                  # NEW
  Dialogue.tsx                    # NEW
  MiniMap.tsx                     # NEW
  CombatHud.tsx                   # MODIFIED — wave # display
  VictoryScreen.tsx               # MODIFIED — stats + rating
  DefeatScreen.tsx                # MODIFIED — stats too

src/audio.ts                       # ADD bossRoar(), bossSlam(), waveAlarm()
```

## Tradeoffs / risks

- **Performance**: 12-15 blobs simultaneously + boss + particles + Day-Night could spike. We'll measure; can simplify particles if needed.
- **Boss balance**: 25 HP × 1 dmg/shot = 25 shots. At 0.18s cooldown that's 4.5s of pure shooting. Fast enough not to feel grindy.
- **Slow-mo with multiplayer-style sidekicks**: They share the same time multiplier so it works.
- **Sky transitions** during intermissions look better than instant flips.
- **Dialogue overload**: Cap to one bubble per speaker at a time; quick-fade if a higher-priority line comes in.

## Out of scope

- Save/leaderboards across sessions.
- Mouse-aimed shooting (still uses character facing).
- Weapon switching / inventory.
- Boss multi-phase forms.
- Cutscene cinematics beyond the existing UFO crash.
