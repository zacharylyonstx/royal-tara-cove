# 10600 Polish + The Schmorgesblob Invasion

**Date:** 2026-05-14
**Status:** Approved (--auto / --full-auto / --blow-my-mind-with-awesomeness)
**Audience:** Penny (8) and Luke (6) defending the family home from goofy alien blobs.

## Goal

Two stacked goals:

1. **Make 10600 feel like the family's actual home** — the previous pass shipped a porch + interior, but the exterior reads as a generic Avery Ranch tract. Add the lived-in details: shutters, gutters, coach lights, porch railing, doormat, **LYONS** mailbox, back deck, pool, holiday string lights.
2. **Drop a UFO into the backyard** at game start. Cute hostile blobs (the **Schmorgesblobs**) pour out. Player picks up a ray gun and defends the house. Win = clear the wave. Lose = blobs reach you and drain all your HP.

The vibe is *Animal Crossing meets early Saturday-morning cartoons* — silly, colorful, kid-safe. Blobs squish into goo splats; no gore.

## Non-goals

- Multi-wave / endless mode (single starter wave only).
- Multiplayer co-op (Penny + Luke can switch between, but only one shoots at a time).
- Detailed weapon inventory.
- Aliens that follow you indoors (they stick to outside).

## 10600 polish (Phase A)

Drop into `HeroHouse10600.tsx` and `HouseProps.tsx`:

- **Window shutters** flanking the great-room window and bedroom windows (dark forest green).
- **Coach lights** on either side of the garage door (warm point lights, lit during the day too — adds glow).
- **Gutter** along the eaves with downspouts at corners.
- **Porch railing** between the columns, plus a welcome doormat ("HOWDY") at the door.
- **Wreath** on the front door.
- **Mailbox** rebadged with the family name `LYONS` in white vinyl letters.
- **Back deck** off the patio slider — wood planks, with the existing patio set moved onto it.
- **Pool** in the backyard — kidney-shaped (well, rounded rectangle) with blue water surface, brick coping, two lounge chairs.
- **String lights** zig-zagging across the back deck (warm yellow points).
- **House numbers** spelled out larger on the stone wainscot near the porch column.
- **Driveway connector**: small concrete apron joining the driveway to the cul-de-sac asphalt.
- **Big address numbers** "10600" in copper on the stone wainscot column.

## Alien invasion (Phase B)

### Game state machine

A new state slice in `gameStore`:

```ts
type Phase =
  | 'pre-intro'   // welcome screen still up
  | 'intro'       // UFO descends, crashes, dramatic camera shake
  | 'combat'      // blobs active, player can fire
  | 'victory'     // all blobs defeated
  | 'defeat';     // player HP reached 0
```

Welcome screen "Let's play!" → `phase = 'intro'`.

### UFO crash cinematic (~6 seconds)

`UFOCrash.tsx` lives in `components/aliens/`. State machine inside:

| t (s) | Behavior |
|---|---|
| 0–4 | UFO descends from (-18.7, 80, 32.4) toward (-18.7, 5, 50) (above 10600 backyard), wobbling, sirens flashing |
| 4–4.6 | Sudden plummet, smoke trail, "boom" sound effect |
| 4.6 | Impact: bright flash, particle burst, ground crater appears |
| 4.6–6 | UFO sits crashed at angle, smoke pluming, hatch opens |
| 6+ | Schmorgesblobs spawn one by one (stagger 0.3s) and the camera relinquishes control to player |

During the cinematic, the camera ignores the player and instead points at the UFO from a flying side-angle.

### Schmorgesblobs

`Schmorgesblob.tsx` in `components/aliens/`:

- Round translucent gel body (sphere with `meshPhysicalMaterial`, transmission 0.5, light color).
- Two big white sclera spheres with offset black pupils that track the active player.
- Wobble: vertical squash/stretch (sine on Y scale, antiphase on X/Z scale).
- Hop locomotion: short hops toward nearest non-defeated player. Hop = parabolic Y trajectory + horizontal step. Cooldown 0.7s between hops.
- HP: 3. Each ray hit subtracts 1 and tints the blob redder for 0.15s.
- Death: hop-burst — squash flat into a goo splat decal that fades over 4s.
- Color variants: 4 color schemes (lime, magenta, cyan, lavender), seeded by spawn index.

Blob count: **8** for the starter wave. Spawn from the UFO hatch over 3s.

AI manager `BlobController.tsx` runs the swarm. Per-blob:
- `target = nearest active character`
- if dist > 30, idle (wobble in place).
- otherwise, hop toward target.
- if dist < 1.0 with player, attack (player HP -1) and recoil away.

### Ray gun + shooting

`RayGun.tsx`: a small mesh attached to the active character's right hand position. Visible only during `phase === 'combat'`. Stylized: cylindrical barrel + handle + glowing tip.

`CombatController.tsx`:
- **Mouse click** = fire one shot. Cooldown 0.18s.
- Each shot: raycast from gun tip in player facing direction, range 25m. Use simplified ray-sphere intersection against active blobs.
- On hit: blob HP -1; spawn a `HitParticles` burst at hit point.
- Visual: a brief beam mesh (cyan thick line) drawn from gun tip to hit point or 25m. Fades over 0.12s.
- **Muzzle flash**: a small scale point light + bright disc at gun tip for 0.08s.

We use raycast-based hit, not full simulated projectiles, for simplicity.

### Combat HUD

`CombatHud.tsx` overlay:
- Top-left: player HP bar (10 hp max, red gradient).
- Top-center: blobs remaining indicator.
- After all blobs defeated → `VictoryScreen` overlay: "Earth saved!" + retry.
- After player HP = 0 → `DefeatScreen` overlay: "The Schmorgesblobs got us!" + retry.
- "Retry" reloads the page.

### Sound (Web Audio API)

`audio.ts` — procedural one-shots, no asset files:
- `laserZap()` — descending sine sweep, 0.18s.
- `blobSquish()` — square wave noise burst with low-pass.
- `ufoCrash()` — white-noise low-pass swept down + low-frequency thump.
- `blobAttack()` — short blip.
- `victory()` — major-third arpeggio.
- `defeat()` — minor-third descending.

All gated behind a one-time user-gesture unlock.

## Architecture

```
src/state/gameStore.ts
  + phase: Phase
  + playerHp: number
  + setPhase(p)
  + damagePlayer(n)

src/state/combatStore.ts          # NEW — separate to avoid noise in main store
  blobs: Blob[]                   # mutable list (refs, not React-managed)
  spawnBlob(pos)
  damageBlob(id, n)
  killBlob(id)
  goSplats: GooSplat[]
  hitParticles: HitParticle[]

src/audio.ts                       # NEW — Web Audio singleton

src/components/aliens/
  UFOCrash.tsx                     # cinematic + crashed UFO mesh + hatch + crater
  Schmorgesblob.tsx                # one blob (renders + per-blob behavior)
  GooSplat.tsx                     # death decal
  HitFx.tsx                        # hit particle burst

src/components/weapons/
  RayGun.tsx                       # gun mesh attached to active char hand
  Beam.tsx                         # brief firing beam
  MuzzleFlash.tsx

src/systems/
  CombatController.tsx             # input + raycast + spawn fx + damage
  BlobController.tsx               # AI + spawn manager

src/ui/CombatHud.tsx
src/ui/VictoryScreen.tsx
src/ui/DefeatScreen.tsx

src/components/Game.tsx            # MODIFIED — wire phase-based rendering
src/components/hero/HeroHouse10600.tsx + new HousePropsRenderer
                                  # MODIFIED — coach lights, gutter, shutters,
                                  # railing, doormat, wreath, deck, pool,
                                  # string lights, address numbers
```

### Data flow

```
welcome.close → phase=intro
intro timer → phase=combat
              → BlobController spawns 8 blobs from UFO hatch
combat:
  player click → CombatController.fire()
                  → raycast → hit blob → damageBlob → maybe killBlob
                  → spawn HitFx
                  → spawn Beam
  BlobController frame → for each blob, AI step
                          → if attack → damagePlayer(1)
  damagePlayer if HP=0 → phase=defeat
  killBlob if blobs.length=0 → phase=victory
```

## Build sequence

1. House polish (HeroHouse10600 additions + LYONS mailbox + back deck + pool).
2. State + audio scaffolding.
3. UFO model + crash cinematic.
4. Schmorgesblob model + manager.
5. Ray gun + combat controller + beam/muzzle/hit particles.
6. Combat HUD + victory/defeat overlays.
7. Wire phase machine in Game.tsx.
8. Build verify, dev server smoke test, commit.

## Tradeoffs / risks

- **No projectile physics** — raycast firing is gameplay-correct but less satisfying than visible bullets. We compensate with the beam visual and hit particles. Adequate for the kid-friendly tone.
- **8 blobs is a small wave** — keeps it kid-friendly and shippable; if it feels short we make a sequel.
- **Pool is decorative** — water doesn't physically interact with the player; we don't want to drown anyone.
- **Single shared HP across characters** — Dad/Penny/Luke share the same family HP pool to keep it simple.
- **Audio gesture unlock** — Web Audio requires a user gesture; the welcome "Let's play!" click serves as that gesture.

## Future work (not in scope)

- Multi-wave with escalating difficulty.
- Boss schmorgesblob (giant final fight).
- Penny + Luke fire alongside Dad as autonomous helpers.
- Schmorgesblob power-ups (slow, frozen, exploding).
- Customizable ray gun (charge shot, spread shot).
