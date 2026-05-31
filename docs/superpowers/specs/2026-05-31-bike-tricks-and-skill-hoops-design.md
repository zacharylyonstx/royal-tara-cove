# Bike Tricks, Ramp & Skill-Based Hoops — Design

**Date:** 2026-05-31
**Mode scope:** the free-roam play layer (Free Play, Treehouse, Aliens non-combat). Movement/physics only — no networking protocol changes (riding/shot state already syncs through the existing stores).

## Goal

Make the neighborhood *play* feel epic and earned:
1. Basketball you can actually miss (skill + range), not an auto-make.
2. A bike that doesn't randomly stop mid-street.
3. Bunny-hops, a launch ramp, and front/back flips you have to land.

## 1. Skill-based basketball

**Current bug:** `doShoot()` (PlayerController.tsx) computes a *perfect* parabola to the nearest/forward hoop every time, so you always score even facing away. The make/miss *sensor* (Basketball.tsx: descending through `rimY` within `rimR`) already works correctly — only the launch is cheating.

**Change:** shoot along the player's facing with distance-scaled power. A *gentle* aim-assist engages only when a hoop is inside a forward cone (`cos(angle) ≥ 0.84`, ≈ ±32°) **and** within range (≤ 12 m): it biases `vx/vz` toward the rim by a blend factor (~0.55), never 100%, and always adds spread (`±4%` lateral, `±0.35` vertical). Outside the cone/range → the ball flies straight where you aimed and clanks.

- Power model: aim point is `facing * targetDist` where `targetDist` = clamp(assistedHoopDist or a default 6 m, 3, 12). Arc time `T` from distance as today.
- `rimR` tightened from 0.5 → ~0.42 (still kid-generous).
- Feel polish: light rim/backboard bounce so a near-miss *clanks* instead of passing through (Basketball.tsx — add a rim-plane reflection when the ball crosses `rimY` outside `rimR` but within `rimR*2.2`).
- Result: aimed-and-in-range from a sensible spot makes most shots (Luke-friendly); bad angle / too far misses.

## 2. Bike "stops midway" fixes

`rideBikeTick()` two culprits:
- **Line 461** `speed *= 0.4` on *any* >0.02 m resolution delta — fires on driveway lips, mailboxes, micro-jitter. Replace with **proportional** loss: compare achieved forward progress to desired; only bleed speed when blocked > 45 % of the step, and scale by the block fraction (a graze barely slows you).
- **`COVE_BOUND_RADIUS = 75`** soft wall pulls you back mid-street. Widen the *ride* bound so the full rideable street (centerline to ≈ z = −130) is open; houses/fences already bound the sides. (Keep the on-foot bound as is, or widen consistently.)

## 3. Bunny-hop, air, flips, wipeouts

Extend `RidingState` (playStore.ts): add `vy: number`, `y: number` (bike height), `airborne: boolean`, `flip: { active: boolean; dir: 1 | -1; angle: number } | null`, and `hopArmed`/`flipArmed` edge tracking lives in the controller.

`rideBikeTick()` gains vertical integration:
- **Bunny-hop:** tap Space while grounded → `vy = HOP_V` (~4.5). Edge-triggered via the existing `shootRef` is wrong (that's shooting) — add a dedicated `jumpPressedRef` set on Space keydown; while riding, Space means hop, not shoot (you can't hold a ball while riding, so no conflict).
- **Gravity/air:** integrate `y += vy*dt; vy -= GRAVITY*dt`; land when `y ≤ 0`.
- **Ramp launch:** if the bike crosses the registered ramp trigger moving roughly along the ramp heading with `speed ≥ 4`, set `vy = LAUNCH_BASE + speed*LAUNCH_PER_SPEED` and a forward speed bump. (Trigger, not a collider — never blocks.)
- **Flip:** while airborne, tapping Space again (second press) starts a flip; `dir = +1` if W held (front) / `−1` if S held (default front if neither). `flip.angle += FLIP_RATE*dir*dt` each frame.
- **Landing check:** on land, if a flip ran, snap to nearest full `2π`. If `|angle − nearest2π| ≤ LAND_TOL` (~0.9 rad, generous) → **stick it**: zero the flip, keep riding, bump `trickCount`, set `lastTrick` ("Front Flip!"/"Back Flip!"/"Double Front Flip!" by full-turns). Else → **wipeout**: dismount, trigger a brief tumble (reuse `gameStore.startRagdoll` at the player position) + input-lock ~1 s, then auto-stand; set `lastTrick = "Wipeout! 💥"`.

**Rendering the flip:** `RidingState.y` + `flip.angle` drive pitch.
- `RiddenBike.tsx`: `g.position.set(x, r.y, z)`; `g.rotation.order='YXZ'; g.rotation.y = heading + π/2; g.rotation.x = flip?.angle ?? 0` (sign chosen so front flips rotate forward).
- `Character.tsx`: while `riding`, set `groupRef.rotation.order='YXZ'`, copy `positionRef` (already includes `y` if we write bike `y` into the gameStore position) — controller writes `pos.y = riding.y` while riding so the rider rises with the bike — and apply `rotation.x = flip?.angle ?? 0`.

Trick + wipeout state added to playStore: `lastTrick: { text: string; at: number } | null`, `trickCount: number`, `setTrick()`.

## 4. The ramp

New `src/components/props/Ramp.tsx`: a stylized plywood/dirt launch ramp (angled deck, side cheeks, a painted stripe), ~3 m wide × 4 m deep, lip ~1.1 m. **No blocking collider.** Rendered once in Game.tsx's always-on scene block. On mount it registers a launch trigger in playStore: `ramp = { x, z, heading, halfLen, halfWid }` (single ramp; `registerRamp`).

**Placement:** midway down the straight street, on the centerline — `x = 0, z ≈ −48`, `heading = π` (ride down-street, −Z, up the ramp and launch). On foot the deck is a sloped `Floor` so you can run up and jump the lip too (optional; bikes use the trigger).

## 5. Trick HUD

`src/ui/TrickHud.tsx`: small bottom-center popup showing `lastTrick.text` (fades after ~1.6 s) and a session `🤸 ×N` trick counter. Shown in Free Play / Treehouse / Aliens-non-combat (same gating as the Scoreboard). DOM overlay, not in the canvas.

## Files

- `src/state/playStore.ts` — RidingState air/flip fields; `ramp` + `registerRamp`; `lastTrick`/`trickCount`/`setTrick`.
- `src/systems/PlayerController.tsx` — `doShoot` aim rework; `rideBikeTick` air/hop/flip/ramp-launch/wipeout + speed-leech fix; `jumpPressedRef`; write `pos.y` while riding; widen bound.
- `src/components/props/RiddenBike.tsx` — render `y` + flip pitch.
- `src/components/Character.tsx` — rider follows `y` + flip pitch while riding.
- `src/components/props/Basketball.tsx` — rim/backboard clank on near-miss; tighter make tolerance via `rimR`.
- `src/components/props/Ramp.tsx` — **new** ramp mesh + trigger registration.
- `src/components/Game.tsx` — mount `<Ramp />` in the always-on block.
- `src/components/HouseProps.tsx` — set hero `rimR` ~0.42 (was 0.5).
- `src/ui/TrickHud.tsx` — **new**; mounted alongside Scoreboard.

## Tuning constants (initial)

`HOP_V 4.5`, `LAUNCH_BASE 4.5`, `LAUNCH_PER_SPEED 0.55`, `FLIP_RATE 9.0 rad/s`, `LAND_TOL 0.9 rad`, `BIKE_AIR_GRAVITY 20`, aim cone `cos ≥ 0.84`, aim range `12 m`, assist blend `0.55`, `rimR 0.42`. All tuned live via Playwright.

## Verification (no test harness)

Per existing practice: `npm run build` + lint (no NEW errors), then Playwright on the dev server driving `__game/__play` — confirm: (a) shots miss when facing away / too far and swish when aimed; (b) bike rides the full street without random stops; (c) Space hops, ramp launches, second-tap flips, clean land vs wipeout; (d) trick HUD updates. Then commit + push to prod (standing authorization) + bundle-hash confirm.
