# Siren Head Night — Co-op Hide-and-Survive Mode

**Date:** 2026-06-13
**Status:** Approved (auto) — building autonomously
**Mode slug:** `night` · **Menu title:** 🔦 SIREN HEAD

A new multiplayer game mode for **Royal Tara Cove**: the family's cul-de-sac at
night, in fog, with the horror-sensation monster **Siren Head** (Trevor Henderson,
2018) roaming the street. 2–4 players (Dad / Penny / Luke) sneak out together to
**light up the block before he finds them.** Designed to be *thrilling-not-traumatizing*
for an 8- and 6-year-old who already love Siren Head (Dad cosplayed him for Halloween).

This doc is both the design spec and the file-by-file implementation plan.

---

## 1. North Star & Tone

Spooky **tag** with a giant the family outsmarts together — a "safe scare," never
dread or gore. Reference vibe: Luigi's Mansion ghosts, R.L. Stine's "safe scare."

**Kid-safety rules (hard constraints):**
- Siren Head reads spooky-*silly*: faceted low-poly cartoon, empty horn cones, **no teeth, no face, no blood**.
- **Caught = comedic "BONK!" + soft whoosh launch + respawn "downed" at base.** No death, no game-over.
- **No full-screen jumpscare, no scream stings, no silence-then-BANG.** Danger always telegraphed (rising directional siren).
- Caught is framed **"Regroup!"**, never "you died / you failed."
- Always an obvious glowing **safe zone** he can't enter; the round **always ends positively** (lights on, monster leaves, family cheers).
- Tuned to the youngest: escapable, head-start when spotted, generous stamina + forgiving detection.
- Co-op shared win, **no elimination**, players free each other.
- One-tap exit (the existing 🏠 Games button) that doesn't read as losing.

## 2. Core Loop — "Light the Block"

1. Round opens with a short intro card (make-believe framing) → deep night + fog.
2. **5 glowing lanterns** spawn around the cul-de-sac (street, yards, dock area, plaza edge).
3. Players walk up to a lantern → **E / Grab** to carry it (you glow + a brief "noise spike" makes you riskier while carrying).
4. Carry it back to the **porch base at 10600** → drop → meter ticks `n / 5`.
5. Deliver all 5 → **the block lights up**, Siren Head retreats, **WIN** (survive-to-dawn fanfare + confetti).
6. **Soft-lose:** there is no hard loss. If *all* claimed players are downed simultaneously → brief **"Regroup!"** → everyone respawns at base, lanterns-in-hand drop where they were, progress kept. Round continues.

**Win condition:** `lanternsDelivered >= LANTERN_GOAL (5)`.
**No lose condition.** (Round timer exists only as an optional "dawn" pacing element; default generous / effectively cosmetic. We may surface "Survive to dawn" but never punish.)

## 3. Siren Head — Visual

Towering (~12 m feel) emaciated faceted humanoid. Long thin pole-like arms/legs,
big bony hands, gaunt ribbed torso. **No head, no face:** a thin neck-pole topped
with **two rusted air-raid siren horns mounted back-to-back, facing opposite
directions** (the icon). Coiling black wires down the neck. Dried rust-brown
leathery skin + weathered grey metal. Muted earthy palette. **Stylized low-poly**
so it never tips into body-horror.

**Asset:** Meshy text-to-3D `public/assets/models/sirenhead.glb` (two variants
generated, best picked). **Static mesh, NOT rigged** — animated procedurally
(whole-body stop-motion lurch + slow bob + slight limb-group sway). Rigged skeletal
animation is forbidden here (see `project_photoreal_characters` — runtime-scaled
rigs distort into "monsters"; stop-motion lurch is both safer *and* on-canon).

## 4. Siren Head — Behavior (host-authoritative AI)

Modeled on `TornadoController` (the roaming-street-hazard template) + `BlobController`
(`nearestPlayerPos`, chase). Lives in a new `SirenHeadController`, host-only sim,
state in `nightStore`, broadcast via `WorldStateMsg.night`.

**State machine:** `patrol → alerted → chase` (+ `retreat` on win).
- **patrol:** wander the drivable street region (reuse `clampToStreet` bounds), slow
  lurching steps (~2.6 m/s), occasionally pause and "listen" (turn horns). Distant
  siren-wail audio, faint.
- **Detection** (host computes per claimed player each frame):
  - base **proximity** radius (`ALERT_RADIUS ≈ 16 m`), increased by the player's
    **noise level** (sprinting +, carrying-a-lantern brief +, flashlight aimed at
    him within a cone +, slamming +), and gated by **line-of-sight** (raycast against
    static colliders — hiding behind a house blocks it).
  - **Crouch-still in the dark** or **inside a hide/safe zone** → undetectable.
  - When detection crosses threshold and player not hidden → **alerted**.
- **alerted:** stand, snap horns toward the player, ~1.2 s dread pause + a siren
  "lock-on" wail, then **chase**.
- **chase:** lurch toward the player at `CHASE_SPEED ≈ 4.3 m/s` (slower than player
  sprint `SPRINT_SPEED 14`, faster than walk `5.5` — escapable but pressuring). If
  player breaks LOS / enters hide zone / crouches in dark for `LOS_BREAK_DELAY ≈ 2 s`
  → lose interest → back to patrol.
- **catch:** `dist < CATCH_RADIUS (1.9 m)` and player not in a safe/immune window →
  **swat** (Section 6). Then Siren Head turns away and re-patrols (won't camp the spawn).

All movement uses `resolveMotion` against `staticColliders` (NPC-style, no `py` so
all colliders block). Audio cues distance-scaled + panned (Section 7).

## 5. Player Tools (PlayerController `night` branch)

New constants + a `gameMode === 'night'` branch (before the munchies/treehouse branches):
- **Sprint + stamina:** `SPRINT_SPEED 14`, `STAMINA_MAX 3.5 s`, drain `1/s`, regen `0.5/s`.
  Shift / far touch-stick = sprint (reuse existing shift mapping). Sprinting raises noise.
- **Crouch:** toggle `c` / touch button. Lowers eye height (CameraRig reads `nightStore.crouching`),
  −40% speed, near-zero noise. Crouch-still in dark = hidden.
- **Flashlight:** on by default; toggle `f` / touch button. Lights your way + reveals
  lantern sparkle; **aiming it at Siren Head within a cone spikes his attention.**
- **Lantern interaction:** reuse `interactPressedRef` + a `zoneStore`-style scan. Near a
  lantern → prompt "Grab lantern (E)"; carrying → near base → auto-deliver or "Drop (E)".
- **Revive:** near a downed teammate → prompt "Help up (E)" → revives them.

## 6. Caught → Comedic Swat → Respawn

Reuse `RagdollController` (host-authoritative, already drives per-character launch):
- Remove the `gameMode !== 'tornado'` guard → allow `'night'`.
- Night branch: instead of spiraling into the funnel, **launch the caught player up &
  AWAY from Siren Head** in a single comedic arc (`SWAT_DURATION ≈ 1.8 s`, peak ~8 m),
  spinning, with a cartoon **BONK** sound. No camera horror — a brief light shake.
- On land: player is **`down`** at/near the base (or in place), shows "Downed — a
  teammate can help you up!" A teammate `E` revive, or **auto-revive after ~6 s**.
- `nightStore.playerNightStates[id] = 'down'`; host broadcasts via `sirenCaught` one-shot
  + continuous `WorldStateMsg.night`. Each peer's own character ragdolls on its own screen
  (RagdollController writes `positions[myCharacterId]`).
- **All claimed players down at once → "Regroup!"**: brief overlay, reposition all at
  base, clear `down`, keep lantern progress.

## 7. Atmosphere & Audio

**Night look** (`gameMode === 'night'`):
- `SkyController`: snap `timeOfDay → 0.92` (deep night) for the mode, no tween; restore on exit.
- `SceneFog`: thick cool branch `fog('#1a2230', near 8, far 55)` — claustrophobic.
- `PostFX`: night branch — Vignette darkness `0.85`, Bloom threshold up (only flashlight
  glints), N8AO up, add subtle `Noise` film grain. Desktop-only (existing gate).
- **Flashlight:** new `components/horror/Flashlight.tsx` — a `SpotLight` parented to the
  camera (cool white, 18° cone, slight flicker), desktop-gated; iPad gets a brighter
  ambient floor so it's playable without the spot.
- Stars already appear at night (`Stars.tsx`). Porch/practical lights stay on for safe-zone glow.

**Audio** (new fns in `audio.ts`, wired through `master()` + `MusicController`):
- `startHorrorTheme/stopHorrorTheme` — slow minor-key tense loop (nod to *Horror Skunx –
  "Run Away"*); swells in chase, drops to a warm relief bed on safe/win.
- `startNightSiren/stopNightSiren` — distant looping civil-defense wail (volume scaled by
  Siren Head proximity, like the tornado roar).
- `staticBurst()` — radio crackle (far/dormant tell).
- `sirenAlertStab()` — one-shot lock-on wail on `patrol→alerted`.
- `bonkHit()` — comedic cartoon bonk on catch.
- `heartbeat(prox)` — two-thump, rate+volume rise as Siren Head nears.
- Win: reuse celebration fanfare + confetti.
- All telegraphed; no shriek stings.

## 8. Multiplayer (extend existing P2P / trystero)

Follow the verified `fire`/`emote`/world-snapshot patterns. **Critical:** use the
**delta round-timer** pattern (send `roundEndsInSeconds`, not an absolute
`performance.now()`), and **`netGuard` every new receiver**.

- **`nightStore`** (new): siren transform/state/target, `lanterns[]` (pos, state:
  idle|carried-by|delivered, carrier), `lanternsDelivered`, `playerNightStates`
  (alive|down|safe), `nightRound` phase, `roundEndsInSeconds`, hide/safe zones,
  `stamina` (HUD), `crouching`, regroup flag. Host writes sim; guests get it via snapshot.
- **`WorldStateMsg.night?`** (room.ts): continuous host→guest snapshot of the above
  (transform, states, lanterns, phase, timer-delta). `applyNightSnapshot()` on guests;
  serialize in `NetSyncController` host block when `gameMode === 'night'`.
- **`sirenCaught` action** (room.ts): one-shot `{ characterId, result, t }` so the catch/swat
  fires crisply on all peers (host applies locally first; receiver fires on guests).
- **Per-player `safe`** via `PlayerStateMsg.safe?` (each client computes whether it's in a
  hide/safe zone — like `riding`), applied into `nightStore.playerNightStates`.
- Host election, `joinRoom('night')`, `isHost` gating: unchanged / free.

## 9. Files

**New files:**
- `src/state/nightStore.ts` — all mode state (flat zustand, `INITIAL` + `reset()`, DEV `__night`).
- `src/systems/SirenHeadController.tsx` — host-only roaming AI + phase machine + detection + catch (returns null).
- `src/components/horror/SirenHead.tsx` — GLB render + procedural stop-motion animation (reads nightStore).
- `src/components/horror/Lanterns.tsx` — emissive lantern props + point lights + carried-follow (reads nightStore).
- `src/components/horror/Flashlight.tsx` — camera-parented SpotLight, desktop-gated.
- `src/ui/NightHud.tsx` — intro card, lantern meter `n/5`, stamina bar, downed/revive + "Regroup!" toast, win overlay, control hints.
- `src/world/nightLayout.ts` — lantern spawn points, base/porch zone, hide & safe zones (data).

**Edited files:**
- `src/state/gameStore.ts` — `'night'` in `GameMode`; `NightPhase` in `GamePhase`; `closeWelcome` branch; `resetNightGame()`.
- `src/world/models.ts` — register `sirenhead` (fitHeight ~12, rotationY as verified, no tint or subtle).
- `src/net/room.ts` — `SirenCaughtMsg`, `sendSirenCaught`, action pair + receiver (`netGuard`), `broadcastSirenCaught`, `WorldStateMsg.night?`, `applyNightSnapshot`, null on leave, import nightStore.
- `src/systems/NetSyncController.tsx` — serialize `snap.night` in host block; add `safe` to `PlayerStateMsg` send + apply.
- `src/state/netStore.ts` — `safe?` on `RemotePlayerState` (if needed).
- `src/systems/PlayerController.tsx` — `night` branch: sprint/stamina, crouch, flashlight toggle + aim-noise, lantern grab/deliver, revive; noise computation.
- `src/systems/CameraRig.tsx` — read `nightStore.crouching` to lower eye height; (optional) catch shake.
- `src/systems/RagdollController.tsx` — allow `night`; launch-away-from-siren branch; shorter duration; respawn hook.
- `src/components/Game.tsx` — `NightModeSystems` group (controller + SirenHead + Lanterns + Flashlight + zone registration); `SceneFog` night branch; `DynamicLights`/practical light tweak if needed.
- `src/components/PostFX.tsx` — night branch (vignette/bloom/AO/noise).
- `src/systems/SkyController.tsx` — snap to night for `'night'`.
- `src/audio.ts` — `startHorrorTheme`/`stop`, `startNightSiren`/`stop`, `staticBurst`, `sirenAlertStab`, `bonkHit`, `heartbeat`.
- `src/systems/MusicController.tsx` — start/stop horror theme + night siren by mode.
- `src/ui/WelcomeScreen.tsx` — 🔦 SIREN HEAD card.
- `src/ui/CharacterSelect.tsx` — `night` label/accent; allow all 3 characters; `resetNightGame()` on host claim.
- `src/ui/MenuButton.tsx` — `night` teardown branch (stop audio, reset nightStore, restore day).
- `src/ui/TouchControls.tsx` — sprint / crouch / flashlight / interact buttons in night mode (iPad).
- `src/App.tsx` — mount `<NightHud />`.

## 10. Verification Plan

Per `feedback_verify_3d_walkthrough` + `project_royal_tara_realism` gotchas:
- `npm run build` + `npm run lint` clean (lint is 0-debt now; any error is real).
- **Real player walkthrough** (Playwright, headed — rAF runs live): enter via the SIREN
  HEAD card → claim DAD → confirm night+fog+flashlight render; walk the street; verify
  Siren Head is roaming, detects on approach, chases, and the swat launches + respawns;
  grab a lantern, deliver to base, confirm meter; force all-down → "Regroup!"; deliver
  all 5 → win. Screenshot from the **player's eye** at multiple angles (a staged angle
  hides broken geometry).
- **2-tab P2P** (the verified recipe): two tabs join `night`, confirm both see Siren Head
  at the same spot, a guest sees the host's lantern deliveries + a peer getting swatted,
  and the round timer/phase agree. Assert fast (idle players, combat timing caveats).
- Verify the Meshy `sirenhead.glb` **visually** from a clean angle before shipping (no
  distortion, correct facing, reads as Siren Head) — pick the better of the two variants.
- Smoke-test the other 4 modes still boot clean (no regressions from shared-file edits).

## 11. Out of Scope (v1)

No competitive/PvP "one player is Siren Head" mode (family is 2–3 players over the net;
revisit later). No new street geometry. Lanterns are procedural (no Meshy). No Mom (n/a —
monster mode). Hard "dawn" timer loss is intentionally omitted (soft-reset only).
