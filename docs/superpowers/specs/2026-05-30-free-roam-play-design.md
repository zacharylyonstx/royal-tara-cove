# Free-Roam Play — Design (rideable bikes + playable basketball)

**Date:** 2026-05-30
**Status:** Design — approved, proceeding to plan
**Context:** Follow-on to the Royal Tara Cove realism Pass 1 (shipped). This is the
"family warmth & play" direction: give Dad/Penny/Luke real things to *do*
together in the neighborhood. Visual realism Pass 2 is a separate later spec.

---

## 1. Goal

Turn two decorative props into real play:
- **Rideable bikes** with a third-person chase camera (Mario-Kart feel).
- **Playable basketball**: pick up the ball, aim-shoot with assist, score.
- **Co-op sync**: peers see each other riding and see "X scored!" celebrations.

Both start with the interaction the kids already know: **walk up → press E**.
Gated to non-combat free-roam so it never fights the ray gun or other modes.

## 2. Resolved decisions

| Choice | Decision |
|---|---|
| Bike camera | **Third-person chase cam** while riding; clean return to FPS on dismount |
| Basketball control | **Pick up & aim-shoot with auto-assist** (kids reliably make baskets); existing walk-into-kick stays as casual dribbling |
| Multiplayer | **Sync the fun**: broadcast riding-state (+ bike color) and basket events; ball arc stays locally simulated by the shooter |
| Scoreboard | **Family total** (shared "🏀 Baskets: N"), with a per-basket toast naming the scorer |
| Where | Bikes ride anywhere in the cove (soft boundary); basketball at any driveway hoop |

## 3. What already exists (build on it)

- `components/props/Basketball.tsx` — a ball with gravity + bounce + "walk into it to kick it." Reuse the physics; add held/shoot/scoring.
- `components/props/BasketballHoop.tsx` — hoop with rim at local `(0, 2.85, 0.65)`. Need its world rim position for scoring.
- `components/props/Bike.tsx` — static bike prop (color, scale). Becomes mountable; a copy renders under the rider.
- Placement: `world/props.ts` tags (`hoop`, `bike`, `kidsBikes`) + `components/HouseProps.tsx` render them per house.
- Interaction pattern: `PlayerController` E → nearest interactable; `InteractPrompt` shows the cue; treehouse mode shows richer E-actions (the template to follow).
- `systems/CameraRig.tsx` (FPS), `systems/NetSyncController.tsx` + `net/room.ts` (peer state + room messages), `audio.ts` (sound effects), `ui/FloatingNumbers.tsx` (floaters).

## 4. Architecture & units

New/changed files, each with one clear responsibility:

- **`state/playStore.ts`** *(new)* — free-roam play state:
  - `riding: Record<CharacterId, { bikeColor: string; heading: number; speed: number } | null>`
  - `heldBall: { by: CharacterId } | null`
  - `familyBaskets: number`, `lastBasket: { by: CharacterId; at: number } | null`
  - `hoops: { x: number; z: number; rimY: number; rimR: number; facingYaw: number }[]` (registered by HouseProps)
  - actions: `mount/dismount`, `pickUpBall/dropBall`, `registerHoops`, `scoreBasket`.
- **`systems/PlayerController.tsx`** — free-play branch additions:
  - Nearest-prop detection (bike / ball) within interact radius → set a contextual `hoverPlay` ('ride' | 'getoff' | 'pickup' | 'shoot').
  - E handling: mount/dismount bike; pick up/drop ball.
  - **Bike movement model** when riding (replaces strafe): `W` accelerate, `S` brake/reverse, `A/D` steer heading; momentum + max ~13 m/s + turn-rate limit; still routed through `resolveMotion` (no riding through houses); soft cove boundary.
  - **Shoot**: while holding the ball, click or space launches it (see §6).
- **`systems/CameraRig.tsx`** — chase-cam branch: when the local player is riding, position camera behind+above the heading and `lookAt` ahead (lerped); on dismount, seed the FPS yaw ref from the heading so there's no snap. (Disabled in munchies/treehouse as today.)
- **`systems/BasketballController.tsx`** *(new)* — owns the active (held/in-flight) ball: holds it in front of the holder, simulates the shot arc, and runs the **rim score sensor** against `playStore.hoops`.
- **`components/props/RiddenBike.tsx`** *(new)* — a bike + sitting pose rendered under any character (local or peer) whose `riding` is set.
- **`components/HouseProps.tsx`** — register each hoop's world rim into `playStore.hoops` on mount; pass bike world positions/colors so the controller can find the nearest mountable bike.
- **`ui/InteractPrompt.tsx`** — generalize to show the contextual cue (door OR `hoverPlay`).
- **`ui/Scoreboard.tsx`** *(new)* — small "🏀 N" family counter (free-roam only).
- **`ui/BasketToast.tsx`** *(new)* — brief "Penny scored! 🏀" celebration.
- **`net/room.ts` + `netStore` + `NetSyncController`** — add `riding` (+ bikeColor) to broadcast peer state; add a `basket` room message ({ shooter }) → toast + cheer + increment shared count.
- **`audio.ts`** — add `bikeWhir` (loop while riding), `swish`, `cheer`, `bounce` (optional) SFX.

## 5. Bike feature

- **Mount:** E within ~2 m of a bike (and not already riding, not holding ball) → `riding[me] = { bikeColor, heading: currentYaw, speed: 0 }`; the static world bike at that spot hides while ridden; a `RiddenBike` renders under the player; camera swings to chase.
- **Control:** `W` accelerates toward max speed, `S` brakes then reverses slowly, `A/D` steer `heading` (turn rate scales down with speed so it's controllable), coasting decelerates. Player `yaw` follows `heading`. Movement resolved against colliders; soft boundary pulls you back if you leave the cove (reuse `COVE_BOUND_RADIUS`).
- **Dismount:** E → clear `riding[me]`, place the player just beside the bike (nudged to a non-colliding spot), restore FPS camera from `heading`. The world bike reappears at its spot.
- **Peers:** a peer with `riding` set renders a `RiddenBike` under their synced position/heading.

## 6. Basketball feature

- **Pick up:** E within ~1.5 m of the nearest ball → `heldBall = { by: me }`; the ball floats at chest height in front of the holder, following them.
- **Shoot (assisted):** click or space → find the nearest hoop within a forward cone (fallback: nearest hoop overall). Solve a projectile arc from the ball to a point just above the rim with a fixed, pleasing apex; apply small random error (±) so it isn't robotic but kids mostly score. Ball enters free flight (gravity + bounce via the existing physics), `heldBall = null`.
- **Score sensor:** each frame the in-flight ball is tested against `playStore.hoops`: if it is within `rimR` of a rim center in XZ, **moving downward**, and crossing `rimY` this frame → make. → `scoreBasket(shooter)`: `familyBaskets++`, swish + cheer, "SWISH! 🏀" floater at the rim, and (if host/networked) broadcast a `basket` message.
- **Dribbling:** when no one holds it, the existing walk-into-kick remains (casual fun).
- **Conflict guard:** shoot input (click/space) is only active while `heldBall.by === me` AND phase is non-combat, so it never collides with the ray gun's click-to-fire or jump.

## 7. Gating & edge cases

- **Active only in non-combat free-roam:** enabled when `gameMode==='aliens'` and `phase ∈ {pre-intro, free-play, victory}` (and the calm pre-combat). Disabled during `combat`, `tornado`, `munchies`, `treehouse` (those have their own controllers / input meanings). Mounting/holding auto-cancels if the phase changes into combat.
- **Click conflict:** in combat, click fires the ray gun — so ball-shoot is gated off there (see §6).
- **Dismount into geometry:** search a few offsets around the bike for a non-colliding drop point; fall back to the player's current spot.
- **Multiple balls/hoops:** only the nearest ball is pick-up-able; the score sensor checks all registered hoops, nearest match wins.
- **Net staleness:** riding flag / basket events are best-effort; a dropped message at worst means a missed bike-visual or toast — never a desync that blocks play.

## 8. Out of scope (YAGNI)

Networked ball physics (only the celebration syncs), bike tricks/jumps/wheelies, racing or time-trials, other vehicles, riding/hoops during combat or weather modes, leaderboards/persistence.

## 9. Performance

P2P, up to 3 players, Zoom screen-share. One active ball and one ridden bike per player at a time; hoop sensor is a handful of distance checks per frame; chase cam is camera math only. Net adds two tiny fields + an occasional event. No new per-frame allocation hotspots. Re-check FPS after.

## 10. Verification (no test harness)

`npm run build` + `npm run lint` (only NEW errors matter — pre-existing debt stands), then live-drive:
1. Ride a full lap of the cove on the chase cam; confirm steering, collisions, and clean dismount (no camera snap).
2. Pick up a ball, sink several baskets; confirm swish/cheer/score/floater and that misses bounce naturally.
3. Two-tab P2P: each kid rides a bike and the other sees it; one scores and the other gets the toast + count.
4. Smoke aliens combat, tornado, munchies, treehouse — all unaffected (no input bleed).
