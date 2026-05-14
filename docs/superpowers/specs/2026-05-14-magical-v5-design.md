# Magical v5 — Make It Sparkle

**Date:** 2026-05-14
**Audience:** Penny (8) and Luke (6) playing the game with their dad.

## Goal

The game now works. This pass makes it *delightful* — the kind of thing
the kids will want to play again, and again, and again. Five additions:

1. **Power-ups** drop from defeated blobs — random pickups that change how
   you play for a few seconds. Big yellow shimmering objects that scream
   "PICK ME UP."
2. **Combo + score** — chaining kills within 2 seconds gives a multiplier;
   floating "+10!" "+50!" damage numbers spray out of every hit. Kid candy.
3. **Penny + Luke get their own weapons** — Penny throws bouncy bombs,
   Luke fires a spread-shot Lego launcher. Switching characters becomes
   meaningful instead of just cosmetic.
4. **Victory dance party** — when you win, the cul-de-sac doesn't just
   show a victory screen. The world erupts into a party: fireworks
   exploding overhead, confetti raining, surviving blobs become friendly
   and dance, disco point-lights pulse in time, family characters do a
   little dance.
5. **Procedural background music** — three synth layers that build with
   intensity: peaceful before combat, tense during, triumphant at victory.

## Magical details (smaller stuff sprinkled in)

- **Confetti & sparkle particles** on power-up pickup.
- **"COMBO BREAK!"** with a sad slide-down sound if combo expires.
- **"DOUBLE!" "TRIPLE!" "MEGA!"** screen text on milestone combos.
- **Fireflies at night** (during wave 3) — drift around 10600 with
  pulsing yellow points.

## Power-ups

Each defeated blob has a 30% chance to drop a power-up at its death point.
Power-ups float just above the ground, slowly bob, and emit a glow.
Walking within 1m picks them up. Five types (equal weight when rolled):

| Power-up | Effect | Duration |
|---|---|---|
| ⚡ Rapid Fire | Cooldown 0.18s → 0.06s | 8s |
| 🔫 Big Laser | Beam width × 3, damage × 3 | 6s |
| ❄️ Freeze Ray | Hits freeze blobs in place for 1s | 8s |
| 🛡️ Shield | Player takes no damage | 6s |
| ⭐ Triple Shot | Each shot fires 3 beams in a fan | 6s |

State in `combatStore`:

```ts
type PowerUpKind = 'rapidFire' | 'bigLaser' | 'freezeRay' | 'shield' | 'tripleShot';
interface PowerUpDrop { id; x; z; kind; spawnedAt; }
interface ActivePowerUp { kind; expiresAt; }
```

`Pickup.tsx` renders the floating glowing object for each drop, bobbing.
`PowerUpHud.tsx` shows active power-ups in the corner with their remaining
time bar.

## Combos & floating numbers

Track in `combatStore`:
- `comboCount: number` (0 by default)
- `lastKillAt: number`

When a blob dies:
- If `now - lastKillAt < 2.0`, increment combo. Else reset to 1.
- Compute score for kill: `baseScore[kind] * comboCount`.
- Push a "+N!" floating-text element above the kill location.
- Update `lastKillAt`.

Base scores: hopper 10, sprinter 15, splitter 20, boss 200.

A `ComboHud.tsx` shows current combo `×3` etc. and total score below.
At combo 5, 10, 15 → "TRIPLE!", "MEGA!", "ULTRA!" big-text overlay.

Floating numbers use `Text3D` from drei or just CSS-projected — keep it
simple with screen-projected `<div>` overlays that fade up over 1s.

## Penny + Luke weapons

The active character determines weapon. Each is its own component glued
to the active character's hand each frame (extracted into a `Weapon`
abstraction so the rendering layer is uniform).

- **Dad — Ray Gun** (current).
- **Penny — Bouncy Bombs**: Click lobs a small pink ball in a parabolic
  arc. On landing, it bounces 2-3 times and explodes on touch with any
  blob, or after 2 seconds. Splash radius 2m, damage 2 (vs 1 for ray
  gun). Cooldown 0.6s.
- **Luke — Lego Launcher**: Click fires three fan-spread Lego blocks
  (10° apart). Each block is a small projectile that travels 18m at
  20 m/s and damages on hit. Damage 1 each. Cooldown 0.4s.

CombatController dispatches based on `activeId`:

```ts
function fire(activeId): void {
  if (activeId === 'dad') fireRayGun();
  else if (activeId === 'penny') lobBomb();
  else if (activeId === 'luke') fireLegoSpread();
}
```

Each weapon's projectiles + effects (bombs, blocks) are stored in
`combatStore.projectiles` and rendered by a generic `Projectiles.tsx`.

The HUD shows the current weapon icon at bottom-center: 🔫 / 💣 / 🧱.

## Victory dance party

When `phase === 'victory'`:
- Replace the modal-overlay-only victory screen with an in-world
  party. The screen overlay still shows stats, but with a transparent
  background so you see the action behind.
- All surviving blobs (post-shot any remaining wave-3 minions) get
  `dancing = true` and bob/spin in place with happy color cycling.
- Fireworks: every 0.5s, spawn a colorful burst from a random sky position
  above the cul-de-sac. Burst = particle expansion + brief light.
- Confetti rain: drift down across the whole sky, mixed colors.
- Disco point-lights at house corners pulse in red/green/blue/cyan in time.
- The 3 family characters do a little dance: bobbing up + arm wave.
- Procedural music switches to "victory" channel.

## Music

`audio.ts` adds a music subsystem. Three loops that mix dynamically:

- `peaceful` — single sine pad with chord changes every 8 beats.
- `combat` — drum-machine + bass + arpeggio, tempo 120bpm.
- `victory` — major triad cascading + faux brass.

A `MusicController.tsx` (not in canvas, just a singleton) runs in the
React tree and adjusts gain on each loop based on phase and combat
intensity (active blobs / max blobs).

Implementation: each loop is a manually-scheduled set of OscillatorNode
notes that re-schedule themselves at loop boundaries. No assets.

## Architecture

```
src/state/combatStore.ts            # ADD powerups, projectiles, combo, score
src/state/musicStore.ts             # NEW — music control state

src/audio.ts                        # ADD music helpers
src/systems/MusicController.tsx     # NEW

src/components/pickups/
  Pickup.tsx                        # NEW — floating glowing power-up

src/components/projectiles/
  Projectiles.tsx                   # NEW — render bouncy bombs + lego blocks
  Bomb.tsx                          # NEW — bouncy bomb mesh + explosion
  LegoBlock.tsx                     # NEW

src/components/weapons/
  PennyBomber.tsx                   # NEW — gun mesh for Penny
  LukeLegoLauncher.tsx              # NEW — gun mesh for Luke
  RayGun.tsx                        # MOD — only when active=dad

src/systems/CombatController.tsx    # MOD — dispatch by active character
src/systems/BlobController.tsx      # MOD — drop powerups on death
src/systems/PowerUpController.tsx   # NEW — pickup detection + active timers

src/ui/
  ComboHud.tsx                      # NEW
  PowerUpHud.tsx                    # NEW
  FloatingNumbers.tsx               # NEW
  WeaponIcon.tsx                    # NEW

src/components/celebration/
  Fireworks.tsx                     # NEW
  Confetti.tsx                      # NEW
  DiscoLights.tsx                   # NEW
  DancingBlobs.tsx                  # NEW (modifies blob behavior in victory phase)
  Fireflies.tsx                     # NEW (night ambient)
```

## Tradeoffs

- **Performance**: Particles + music + projectiles + power-ups + dancing
  blobs is a lot. Cap fireworks to 4 simultaneous; particles ≤ 100;
  confetti ≤ 200.
- **Music**: Procedural music can sound cheesy. We accept that — chiptune
  vibe matches the cartoonish blob aesthetic.
- **Switching weapons mid-fight**: Cooldowns reset on switch (no exploit).
- **Power-ups are visible**: Big and glowing so kids can find them.

## Build sequence

1. State scaffold (combat store extensions + music store).
2. Floating numbers + combo system (cheap, instant satisfaction).
3. Power-up drop + pickup + active effects.
4. Penny + Luke weapons (refactor CombatController dispatch).
5. Victory dance party (fireworks, confetti, disco, dancing blobs).
6. Procedural music (peaceful / combat / victory layers).
7. Fireflies at night.
8. Smoke test, commit.
