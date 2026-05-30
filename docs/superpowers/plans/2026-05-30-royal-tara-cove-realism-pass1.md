# Royal Tara Cove Realism Pass 1 — Implementation Plan

> **For agentic workers:** Executed inline this session (user directive: "just do your best and push it to prod --auto"). Steps use checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-05-29-royal-tara-cove-realism-pass1-design.md`.

**Goal:** Make the street and 10600 match the real Royal Tara Cove and read like a bright, real Texas neighborhood, then deploy to prod.

**Architecture:** Incremental edits to the R3F scene, ordered lowest- to highest- integration-risk so each increment leaves the app working and verified. No new systems; data + constants + material additions only.

**Tech Stack:** React 19, @react-three/fiber, three.js, zustand, Vite, Netlify.

**Verification model (no test harness exists — substitute for TDD):**
- `npm run build` (tsc -b + vite build) passes
- `npm run lint` passes
- Live drive (vite dev + Playwright, `window.__game`/`__net`/`__combat` stores) → before/after screenshots at 3 vantages (cul-de-sac overview, 10600 eye-level, straight-section streetscape)
- Smoke-test all 4 modes (aliens, tornado, munchies, treehouse): launch, no crash, player not falling through floor, objectives/pellets present

---

### Task 0: Baseline
- [ ] Confirm `git status` clean, on `main`. Baseline shots already captured (`diag-*.jpeg`).
- [ ] `npm run build` to confirm a green starting point.

### Task 1: Lighting & atmosphere (spec §4.A)
**Files:** `src/systems/SkyController.tsx`, `src/components/Game.tsx` (`DynamicLights`).
- [ ] `SkyController.TARGETS_BY_WAVE[0]` 0.15 → 0.05 (bright midday base); `[1]` 0.25 → 0.18.
- [ ] `DynamicLights`: raise hemisphere floor and ambient minimum so dark-albedo props keep form (no pure-black silhouettes) at midday.
- [ ] Verify `Stars` stays invisible below `timeOfDay 0.45` (no code change expected).
- [ ] build + lint; screenshot streetscape + hero eye-level → bright sunny day, truck legible.
- [ ] Commit.

### Task 2: Roofs (spec §4.E)
**Files:** `src/components/Roof.tsx`, roof-height usage in `src/components/House.tsx` & `src/components/hero/HeroHouse10600.tsx`.
- [ ] `HippedRoof`: rewind triangles so all face normals point outward/up (fixes the see-through hero roof); add `side: THREE.DoubleSide` safeguard on the shingle material path.
- [ ] Steepen pitch for gable + hip to ~6:12 (roof height ≈ depth/4), capped for 2-story.
- [ ] build + lint; overview screenshot → no see-through houses; pitched roofs.
- [ ] Commit.

### Task 3: Open front yards (spec §4.D)
**Files:** `src/world/lots.ts` (`shouldFenceEdge`, gate slots), `src/components/Yard.tsx`.
- [ ] Make side fences (straight) / radial spokes (bulb) start at the house front building line, not the lot/sidewalk front. Front yard open; gate at the building line.
- [ ] build + lint; overview + streetscape → open front lawns, backyards still enclosed.
- [ ] Commit.

### Task 4: Cul-de-sac scale (spec §4.B)
**Files:** `src/world/streetLayout.ts`.
- [ ] `STREET_RADIUS` 22 → 14.5. Verify dependent constants recompute.
- [ ] Verify spawn (≈0,0,10) stays on pavement; 4 bulb wedge lots don't overlap (widen hero wedge if needed); 10600 still in front of spawn.
- [ ] Smoke aliens (UFO crash clear) + treehouse (oak/treehouse position).
- [ ] build + lint; overview screenshot.
- [ ] Commit.

### Task 5: Brick + lap-siding material system (spec §4.F)
**Files:** `src/types.ts` (`HouseConfig`), `src/world/textures.ts`, `src/world/materials.ts`, `src/components/House.tsx`, `src/components/hero/HeroHouse10600.tsx`.
- [ ] `HouseConfig`: add `brickColor` (front) + `sidingColor` (upper/side/rear); make `hasStone`/`stoneColor` optional.
- [ ] `textures.ts`: add `lapSidingTexture(color)` (horizontal lap shadow lines); generalize `brickTexture(color)` to accept a brick color (cache by color).
- [ ] `materials.ts`: `mat.brick(color)` cached-by-color; add `mat.lapSiding(color)`.
- [ ] `House.tsx` / `HeroHouse10600.tsx`: front wall brick (first-story brick band + siding above for 2-story); side + back walls lap siding. Keep windows/trim/garage/door.
- [ ] Provide temporary brick/siding values so build is green before Task 6 finalizes the palette.
- [ ] build + lint; streetscape → brick-front homes with tan siding.
- [ ] Commit.

### Task 6: Real roster + street length + footprints + integration audit (spec §4.C, §5) — HIGH RISK
**Files:** `src/world/streetLayout.ts`, `src/world/houses.ts`, `src/components/Game.tsx` (background trees), plus any of: `src/world/munchiesGraph.ts`, `src/world/munchiesPellets.ts`, tornado/NPC/minimap modules per audit.
- [ ] `STRAIGHT_END_Z` → `-STREET_RADIUS - 165`.
- [ ] Rewrite `HOUSES` to the real 25-address roster (spec §2 table): addresses, sides (odds east/evens west, kept), stories, right-sized footprints from real sqft, gray roof colors, `hipped: true` for 10600, brick/siding palette per house, `source` honesty. Keep 10600 shell ~current size.
- [ ] Reposition hard-coded common-area trees in `Game.tsx` to span the new ~−15…−180 length.
- [ ] **Audit & fix** coordinate-coupled systems: spawn/camera, UFO crash + blob spawns, `munchiesGraph`/`munchiesPellets`, tornado path/safe-zone, treehouse position, `MiniMap` extent. Read each; adjust constants/coords.
- [ ] build + lint; **smoke all 4 modes** + screenshots (overview, streetscape, hero).
- [ ] Commit.
- [ ] **Fallback gate:** if a mode breaks unfixably, revert Task 6's street-length/roster expansion (keep Tasks 1–5,7) and ship that rather than broken geometry; note in report.

### Task 7: Hero 10600 accuracy (spec §2 hero, §4.F)
**Files:** `src/components/hero/HeroHouse10600.tsx` (+ its config in `houses.ts`).
- [ ] Brick front + tan lap siding sides/rear; gray hip roof that caps cleanly (Task 2 fix applies); keep porch/bay/garage/deck/pool/interior. Config metadata corrected (2,129 sqft / 2-story / hip).
- [ ] build + lint; hero eye-level screenshot.
- [ ] Commit.

### Task 8: Final verification + deploy
- [ ] `npm run build` + `npm run lint` clean.
- [ ] All 4 modes smoke pass; before/after screenshots assembled.
- [ ] Commit any final touch-ups; push `main`.
- [ ] Confirm Netlify prod deploy succeeded (Netlify MCP or build log).
- [ ] Report with evidence; HOLD the push if verification is red.

---

## Self-review
- **Spec coverage:** A→T1, B→T4, C→T6, D→T3, E→T2, F→T5+T7, §5 audit→T6, §6 perf→ongoing, §8 verify→T8. All covered.
- **Ordering:** T1–T5 are low/no integration risk and individually shippable; T6 isolates the risky street expansion with an explicit fallback gate. Good.
- **Placeholders:** none — each task names exact files + concrete change + verification. Detailed per-house values live in spec §2 (single source of truth).
