# Free-Roam Play Implementation Plan

> **For agentic workers:** Executed inline this session (user delegated: "do what you think is best, I trust you --auto"). Steps use checkbox (`- [ ]`). Spec: `docs/superpowers/specs/2026-05-30-free-roam-play-design.md`.

**Goal:** Rideable bikes (third-person chase cam) + playable basketball (pick-up/assisted-shoot/score) in free-roam, with co-op sync of riding + basket celebrations.

**Architecture:** A free-roam activity layer inside the existing FPS `PlayerController` (default/aliens free-play). New `playStore` holds riding + held-ball + score + registered hoops. Camera gains a chase-cam branch; net broadcasts a riding flag + basket events. Build on the existing ball physics, bike/hoop props, and E-interaction pattern.

**Tech Stack:** React 19, @react-three/fiber, three.js, zustand, trystero (P2P), Vite.

**Verification model (no test harness):** `npm run build` + `npm run lint` (only NEW errors count), live-drive via Playwright + `window.__game/__net/__combat/__play` stores + FPS, and smoke all 4 modes. Each task ends with build + a live check + commit.

---

### Task 1: Play store + contextual interact prompt + hoop registration
**Files:** Create `src/state/playStore.ts`; modify `src/systems/PlayerController.tsx`, `src/ui/InteractPrompt.tsx`, `src/components/HouseProps.tsx`.
- [ ] `playStore.ts`: zustand store with `riding: Record<CharacterId, {bikeColor,heading,speed}|null>` (default all null), `heldBall: {by}|null`, `familyBaskets: number`, `lastBasket`, `hoops: HoopReg[]`, `hoverPlay: 'ride'|'getoff'|'pickup'|'shoot'|null`, and actions `setHoverPlay`, `mount`, `dismount`, `pickUpBall`, `dropBall`, `registerHoops`, `scoreBasket`. Expose `window.__play` in DEV.
- [ ] `HouseProps.tsx`: collect each rendered hoop's WORLD rim `{x,z,rimY:2.85,rimR:0.28,facingYaw}` and each bike's world `{x,z,color}`; register hoops into `playStore` via an effect, and publish bikes into the store (or a module list) for nearest-bike lookup.
- [ ] `PlayerController.tsx` free-play branch: compute nearest bike (≤2 m) / ball (≤1.5 m) and set `hoverPlay` accordingly (only when `gameMode==='aliens'` & non-combat phase). No actions yet.
- [ ] `InteractPrompt.tsx`: if `hoverPlay` set, show its label ("ride bike"/"get off"/"pick up ball"/"shoot"); else existing door behavior.
- [ ] build + lint; live: walk near 10600's hoop/bike → prompt shows. Commit.

### Task 2: Basketball — pick up, hold, drop
**Files:** Modify `src/components/props/Basketball.tsx`; `src/systems/PlayerController.tsx`. Create `src/systems/BasketballController.tsx`.
- [ ] Refactor the ball so the active/held ball is owned by `BasketballController` (one ball at a time). When `heldBall.by===id`, the ball floats ~0.4 m in front of the holder at chest height, following position/yaw. Idle balls keep the existing kick-on-contact.
- [ ] `PlayerController`: E with `hoverPlay==='pickup'` → `pickUpBall(id, ballRef)`. E again or walking away >3 m → drop.
- [ ] build + lint; live: E picks up the nearest ball; it tracks in front; drop works. Commit.

### Task 3: Basketball — assisted shoot, rim scoring, scoreboard + FX
**Files:** `src/systems/BasketballController.tsx`, `src/systems/PlayerController.tsx`; create `src/ui/Scoreboard.tsx`, `src/ui/BasketToast.tsx`; modify `src/audio.ts`, `src/components/Game.tsx` (mount controller), `src/App.tsx` (mount UI).
- [ ] Shoot input: while `heldBall.by===me` and non-combat, click OR space → solve arc. Target = nearest hoop in a forward cone (fallback nearest). With `g=18`, pick `T=clamp(dist/7,0.65,1.4)`; `vx=(tx-x0)/T`, `vz=(tz-z0)/T`, `vy=(rimY+0.25-y0+0.5*g*T*T)/T`; add ±5% error to vx/vz and ±0.4 to vy. Release ball into existing physics; `heldBall=null`.
- [ ] Rim sensor (per frame, in-flight ball): for each `hoops[]`, if XZ-dist to rim < `rimR`, `vy<0`, and `prevY≥rimY>curY` → `scoreBasket(shooter)`: `familyBaskets++`, `swish()`+`cheer()`, "SWISH! 🏀" floater at rim (reuse FloatingNumbers pattern), set `lastBasket`.
- [ ] `Scoreboard.tsx`: small "🏀 {familyBaskets}" top-center, shown only in non-combat free-roam. `BasketToast.tsx`: 1.5 s "{Name} scored! 🏀" from `lastBasket`.
- [ ] `audio.ts`: add `swish()` (short whoosh) + `cheer()` (kids cheer) using the existing WebAudio helpers.
- [ ] build + lint; live: shoot at 10600's hoop, score increments, swish + toast + floater; misses bounce. Commit.

### Task 4: Bikes — mount/dismount + ride movement + RiddenBike
**Files:** `src/state/playStore.ts`, `src/systems/PlayerController.tsx`; create `src/components/props/RiddenBike.tsx`; modify `src/components/HouseProps.tsx` (hide the world bike that's being ridden), `src/components/Character.tsx` or Game render (mount `RiddenBike` under riders).
- [ ] Mount: E with `hoverPlay==='ride'` & not holding ball → `mount(id,{bikeColor,heading:yaw,speed:0})`; hide that world bike.
- [ ] Ride model (when `riding[id]`): `A/D` steer `heading` at `turn=2.4*min(1,speed/3)` rad/s; `W` accel to max 13 m/s, `S` brake/reverse to -3, coast friction; `pos += forward(heading)*speed*dt` through `resolveMotion`; `yaw=heading`; soft cove boundary (reuse `COVE_BOUND_RADIUS`). `forward(h)=(-sin h,0,-cos h)`.
- [ ] Dismount: E → search ring offsets for a non-colliding spot beside the bike, place player there, `dismount(id)`, world bike reappears.
- [ ] `RiddenBike.tsx`: a `Bike` + seated character pose, rendered under any char with `riding` set (local + peers), at their pos/heading.
- [ ] build + lint; live (first-person for now): ride a lap, collide with a house (blocked), dismount cleanly. Commit.

### Task 5: Third-person chase camera
**Files:** `src/systems/CameraRig.tsx`.
- [ ] Add a branch (before FPS): if local player `riding`, `F=forward(heading)`; `camPos = lerp(cam, playerPos - F*4.2 + (0,2.4,0))`; `lookAt(playerPos + F*3 + (0,0.6,0))`. Disable mouse-look while riding.
- [ ] On dismount, seed the FPS `yaw` ref from `heading` so there's no camera snap.
- [ ] build + lint; live: ride with chase cam (steering reads naturally), dismount → smooth hand-back to FPS. Commit.

### Task 6: Multiplayer sync (riding + basket celebrations)
**Files:** `src/state/netStore.ts`, `src/systems/NetSyncController.tsx`, `src/net/room.ts`; `src/ui/BasketToast.tsx`.
- [ ] Add `riding` (bool) + `bikeColor` to the per-peer broadcast state; `RiddenBike` renders under peers whose `riding` is true (at their synced pos/heading).
- [ ] Add a `basket` room message `{shooter}`; on receive (non-shooter) → `BasketToast` + `cheer()` + increment shared `familyBaskets` (guard against double-count on host).
- [ ] build + lint; live 2-tab P2P: each tab rides a bike visible to the other; one scores → other sees toast + count. Commit.

### Task 7: Gating polish + full verification + deploy
**Files:** `src/systems/PlayerController.tsx`, `src/state/playStore.ts` as needed.
- [ ] Auto-cancel riding/held-ball if phase changes into `combat`/`tornado` or mode changes; ensure shoot input never fires the ray gun (gated to held-ball + non-combat).
- [ ] Full verification: `npm run build` + lint clean of NEW errors; smoke all 4 modes (aliens combat, tornado, munchies, treehouse) for input bleed; ride + score once more.
- [ ] Commit; push `main`; confirm Netlify prod deploy (bundle-hash match). HOLD the push if anything feels janky — report instead.

---

## Self-review
- **Spec coverage:** §5 bikes→T4+T5; §6 basketball→T2+T3; §4 playStore/units→T1–T6; camera→T5; sync→T6; UI prompt/scoreboard/toast→T1/T3/T6; gating→T7; verification→T7. Covered.
- **Type consistency:** `riding[id]={bikeColor,heading,speed}`, `heldBall={by}`, `familyBaskets`, `hoops[].{x,z,rimY,rimR,facingYaw}`, `hoverPlay` union — used consistently across tasks.
- **Placeholders:** none — each task names exact files + concrete mechanic + the arc/sensor formulas + a live check.
- **Ordering:** T1–T3 (basketball) and T4–T5 (bikes) are independently shippable; T6 sync layers on; each leaves the app working.
