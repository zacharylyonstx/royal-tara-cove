# Royal Tara Cove — Realism Pass 1 ("Real bones, bright day, brick homes")

**Date:** 2026-05-29
**Status:** Design — awaiting review before plan
**Scope decision:** "Bones + brick look now" (the full Pass 1, including the material swap)

---

## 1. Context & goal

Royal Tara Cove is a stylized recreation of the family's old Avery Ranch
neighborhood — a personal game Dad plays with the kids over screen-share.
Today the street and the family home at **10600 Royal Tara Cove** "feel broken
and crappy": a giant parking-lot cul-de-sac, gloomy permanent-dusk light, plain
flat-roofed box houses, fenced-off front yards, and a hero house whose roof
doesn't even cap it.

The goal of this pass: make the street and 10600 **match the real Royal Tara
Cove** and read like a real, sunny Texas neighborhood — without re-architecting
the game's systems.

This is Pass 1 of a two-pass plan. Pass 2 (separate spec) adds deeper material
variety, landscaping depth, varied massing, and a greenbelt backdrop.

---

## 2. Real-world reference (sourced)

Researched 2026-05-29 against Williamson CAD parcels, MLS listings (Compass /
Redfin / HAR / Homes.com), the 2008 MLS tour video of 10600
(`youtube zkX-LAXz6ew`), and OpenStreetMap + Esri satellite measurement. Full
output: recon task `wxhqd8ksz` (saved with per-field confidence + source URLs).

### Street geometry

| Property | Current model | **Real value** | Confidence |
|---|---|---|---|
| Shape | lollipop, bulb at south ✓ | lollipop, bulb **south**, T's into Avery Ranch Blvd at north | high |
| Bulb pavement radius | 22 m | **~14.5 m** (22 m is ~1.5× too big) | high |
| Straight "stick" length | 95 m | **~165 m** | med-high |
| Total houses | 18 (caps at 10633) | **25** (10600–10649) | high |
| On the bulb | 4 | **4**: 10600, 10601, 10604, 10605 | high (4=inference) |
| On the straight | 14 | **21** | high |
| Front-yard treatment | wood privacy fences | **open lawns, NO front fence**; fencing is **rear-only** | high |
| Front setback | 7 m | ~6–7.5 m (keep ~7) | high |
| Interior lot width | — | ~14.5 m | medium |

### House roster (the real 25)

Even side and odd side are on opposite (≈E/W) sides; **which side is east vs
west is NOT verified** — we keep the existing assumption *odds = east, evens =
west* and flag it as flippable. Note the real **address gap: no 10606/10608/10610**
(even straight starts at 10612, after bulb 10604). Footprints below are *suggested* — derived from
real per-floor area (1-story ≈ full sqft; 2-story ≈ ~55% of total per floor) —
tune for fit and visual variety.

| Address | Side | Where | Stories | Real sqft | Suggested footprint (w×d m) | Notes |
|---|---|---|---|---|---|---|
| **10600** | even | bulb | 2 | 2,129 | **keep current ~18×16** | HERO — preserve interior; brick front, gray hip |
| 10601 | odd | bulb | 2 | 2,311 | 13×9 | backs greenbelt; largest bulb lot |
| 10604 | even | bulb | 2 | 2,488 | 13×9.5 | largest bulb lot |
| 10605 | odd | bulb | 1 | 1,697 | 13×12 | confirmed brick+Hardiplank, comp shingle, slab |
| 10609 | odd | straight | 2 | 2,231 | 12×8.6 | |
| 10612 | even | straight | 2 | 2,129 | 11.5×8.4 | **same floorplan as hero** (twin) |
| 10613 | odd | straight | 2 | 2,040 | 11.5×8.2 | |
| 10616 | even | straight | 2 | 2,090 | 11.5×8.3 | |
| 10617 | odd | straight | 2 | ~2,000 | 11.5×8.4 | sqft conflicted; treat 2-story |
| 10620 | even | straight | 2 | 2,322 | 12×8.8 | |
| 10621 | odd | straight | 1 | 1,695 | 13×12 | |
| 10624 | even | straight | 2 | 2,129 | 11.5×8.4 | |
| 10625 | odd | straight | 1 | 1,594 | 12.5×12 | |
| 10628 | even | straight | 2 | 2,275 | 12×8.6 | backs greenbelt; wrought-iron rear fence |
| 10629 | odd | straight | 1 | 1,818 | 13×13 | infill (2010) |
| 10632 | even | straight | 2 | 2,634 | 13×9.5 | downstairs master; infill (2009) |
| 10633 | odd | straight | 1 | 1,786 | 13×12.8 | infill (2009) |
| 10636 | even | straight | 2 | 2,258 | 12×8.6 | infill |
| 10637 | odd | straight | 1 | 1,668 | 12.5×12.4 | HOA-maintained front yard; infill |
| 10640 | even | straight | 2 | 2,124 | 11.5×8.4 | infill |
| 10641 | odd | straight | 2 | ~2,100 | 11.5×8.4 | partial data |
| 10644 | even | straight | 2 | 1,987 | 11.5×8.1 | infill |
| 10645 | odd | straight | 2 | 1,786 | 11×8 | infill |
| 10648 | even | straight | 2 | 1,791 | 11×8 | partial data |
| 10649 | odd | straight | 2 | unknown | 11.5×8.4 | highest address; default 2-story |

### Architecture palette (Avery Ranch West, D.R. Horton, ~2004–2010)

- **Walls:** brick veneer dominant on the **front** elevation (red-brown earth
  tones), **tan/cream HardiPlank horizontal lap siding** on upper story, sides,
  and rear. Occasional limestone accent (optional, a few houses). Slab-on-grade.
- **Roofs:** composition/asphalt shingle, **grayish**, gable/hip mix, **moderate
  pitch (~6:12–8:12)**. 10600 is **hip**.
- **Garages:** attached 2-car, **front-facing**, single door.
- **Landscaping:** open St. Augustine lawns, foundation shrubs, ≥1 mature shade
  tree (live oak) + crepe myrtle per lot.
- **Story mix:** 6 single-story (10605, 10621, 10625, 10629, 10633, 10637); the
  rest two-story.

### 10600 — the family home (hero)

2-story, 2,129 sqft (1,021 down / 1,108 up), **3 bed / 2.0 bath** (not 2.5),
built 2004 by D.R. Horton, on the bulb on a large ~9,422 sqft pie lot. **Brick
front + tan lap siding** sides/rear, **gray composition hip roof**, slab,
front-facing 2-car garage, covered front **and** rear porch, fireplace, upstairs
game room, mature live oak in a wood-privacy-fenced backyard. (Front-elevation
photo was bot-blocked, so the exact brick/siding split + garage orientation are
WCAD-code + neighbor inference, not a direct photo.)

---

## 3. Goals / non-goals

**Pass 1 goals (this spec)**
- Bright sunny-day base; no permanent-dusk gloom; darks no longer crush to black.
- Cul-de-sac at real scale (no parking-lot bulb).
- Real street geometry + the real 25-house roster, with right-sized footprints.
- Open front yards; fences rear-only.
- Roofs that cap correctly, at a believable pitch, gray shingle.
- Brick-front + tan-lap-siding material system across all houses.
- 10600 corrected and reading as a finished, real home.

**Non-goals (Pass 2)**
- Per-house massing variety (L-plans, varied rooflines, dormers).
- Foundation shrubs / richer landscaping, greenbelt + park backdrop.
- Wrought-iron "view" fencing detailing, better vehicles, contact-shadow/AO polish.
- Resizing the hero **interior** (kept as-is in Pass 1).

---

## 4. Design by area

### A. Lighting & atmosphere
**Files:** `src/systems/SkyController.tsx`, `src/components/Game.tsx`
(`DynamicSky`, `DynamicLights`), `src/components/aliens/Stars.tsx` (verify only).

- Brighten the **base/exploration** time of day. `SkyController.TARGETS_BY_WAVE[0]`
  (pre-combat / the value all non-combat modes rest at) goes from `0.15`
  ("late afternoon") to **~0.05** ("bright midday"). Aliens wave progression to
  dusk/night (waves 1–3) is unchanged — the dramatic darkening still works.
- Lift **fill light** so dark-albedo props (the truck, bins) stop reading as
  pure black: raise the hemisphere-light floor and the ambient-light minimum in
  `DynamicLights`. Target: shadowed surfaces stay legible at midday.
- Keep the sun whiter/cooler at midday (it already trends white at low `t`).
- **Stars** already fade in only above `timeOfDay 0.45` — confirm no daytime
  stars in the new base state (the daytime stars seen earlier were a stale
  combat-session artifact, not a standing bug).

**Acceptance:** free-play / exploration looks like a bright sunny Texas day; no
stars in daytime; the truck and trash bins show form, not silhouette.

### B. Cul-de-sac scale
**Files:** `src/world/streetLayout.ts`

- `STREET_RADIUS` 22 → **14.5**. Dependent constants (`LOT_FRONT_RADIUS`,
  `HOUSE_FRONT_RADIUS`, `STRAIGHT_START_Z`) recompute automatically.
- Re-verify the 4 bulb wedge lots don't overlap at the smaller radius (widen the
  hero's wedge if needed) and that the bulb↔straight curb join still reads clean.

**Acceptance:** the bulb reads as a residential turnaround, not a parking lot;
houses sit a believable ~7 m back from the curb.

### C. Real street geometry + roster (+ right-sized footprints)
**Files:** `src/world/streetLayout.ts`, `src/world/houses.ts`,
`src/components/Game.tsx` (hard-coded common-area trees).

- `STRAIGHT_END_Z` → `-STREET_RADIUS - 165` (straight 95 → ~165 m).
- Rebuild `HOUSES` to the real 25-address roster (Section 2): correct addresses,
  sides, story counts, and **right-sized footprints** from real sqft. The
  per-side straight ordering increases with address northward; odd side has 11
  straight houses, even side 10. **Exception:** keep 10600's shell ~current size
  to preserve its hand-built interior (`Interior10600`, `floorPlan.ts`,
  interior/floor/porch colliders).
- Update the hard-coded background trees in `Game.tsx` (currently at
  z ≈ −40…−110) to spread along the new ~−15…−180 length.

**Acceptance:** walking the street, the house count, spacing, story-mix, and
length match the real Royal Tara Cove; no overlapping lots; neighbors look
proportionate (not bloated).

### D. Open front yards
**Files:** `src/world/lots.ts` (`shouldFenceEdge` / gate slots),
`src/components/Yard.tsx` (fence rendering).

- Side fences must **start at the front building line** (house front plane),
  not at the sidewalk/lot front — leaving the front yard open to the street.
  Gate sits at that line. Applies to both straight rectangles (side edges) and
  bulb wedges (radial spokes).
- Rear + side-behind-house fences remain (wood, 1.7 m). Front edge stays
  unfenced (already true). Greenbelt-backing lots (10601, 10628) may use
  wrought-iron rear fencing — **optional in Pass 1**, full treatment in Pass 2.

**Acceptance:** front yards are open lawn to the sidewalk; no fence "compounds";
backyards still enclosed.

### E. Roofs
**Files:** `src/components/Roof.tsx`, roof-height constants in `House.tsx` /
`HeroHouse10600.tsx`, gray roof colors in `houses.ts`, `src/world/materials.ts`
(shingle).

- **Fix `HippedRoof`**: the hand-rolled `BufferGeometry`'s front/back slopes
  wind face-down, so their normals point down and the faces backface-cull from
  above (you see *through* the hero roof into the interior). Rewind all triangles
  so normals point outward/up; add `side: DoubleSide` on the shingle material as
  a safeguard.
- **Steepen pitch** for both gable and hip to ~6:12 (roof height ≈ depth/4),
  capped so 2-story homes don't get cartoonishly tall.
- Roof color → **gray composition** shingle across the roster (the real look);
  keep a little tone variety.

**Acceptance:** no house is see-through from above; roofs read as pitched
shingle roofs, not flat slabs; 10600 has a clean gray hip.

### F. Brick + lap-siding material system
**Files:** `src/world/textures.ts` (new `lapSidingTexture`, generalize
`brickTexture` to take a color), `src/world/materials.ts` (`mat.brick(color)`,
new `mat.lapSiding(color)`), `src/types.ts` (`HouseConfig`), `src/world/houses.ts`
(palette per house), `src/components/House.tsx` + `HeroHouse10600.tsx` (apply
brick to front, siding elsewhere).

- New `HouseConfig` fields: `brickColor` (front, red-brown variants) and
  `sidingColor` (upper/side/rear, tan/cream variants); keep `trimColor`,
  `roofColor` (now grays), `doorColor`. `hasStone`/`stoneColor` become optional
  (default off; a couple of houses may keep a stone accent for variety).
- **House front** renders brick (at minimum the first story; ideally first-story
  brick band + lap siding on the second story for the authentic D.R. Horton
  look). **Side + back walls** render tan lap siding. Garage door, windows,
  trim, door unchanged.
- 10600: brick front + tan lap siding sides/rear, matching the real home.

**Acceptance:** from the street, houses read as brick-front Avery Ranch tract
homes with tan siding, not stucco earth-tone boxes.

---

## 5. Integration risks & required audit

Lengthening the street (95 → 165 m), shrinking the bulb (22 → 14.5 m), and
re-rostering houses moves world coordinates that other systems may hard-code.
**Pass 1 must audit and update** (and re-test all four game modes):

- **Spawn + camera:** family spawn (`gameStore` positions ≈ (0,0,10)) must stay
  on bulb pavement and in front of 10600 after rescale.
- **Aliens:** UFO crash zone + blob spawns in 10600's backyard must stay clear
  and on-ground; `EnemyArrow`/`MiniMap` bounds.
- **Munchies:** `munchiesGraph.ts` / `munchiesPellets.ts` likely encode street
  coordinates — verify the pellet maze still fits the new geometry.
- **Tornado:** storm/tornado path + safe zones referencing street coords.
- **Treehouse:** treehouse sits in 10600's backyard oak — verify position after
  the bulb/house move.
- **Colliders:** non-hero colliders auto-derive from `HOUSES` (safe); hero
  interior/exterior/porch/floor colliders are bespoke — unaffected if the hero
  shell size is preserved (it is).
- **`MiniMap`** world-extent / scaling for the longer street.

**Acceptance:** all four modes (aliens, tornado, munchies, treehouse) launch and
play without the player falling through, spawning inside geometry, or losing
pellets/objectives.

---

## 6. Performance

Runs over Zoom screen-share, P2P, up to 3 players. Pass 1 stays geometry-light:
24 simple neighbor houses + 1 detailed hero, **shared cached materials** (brick
and siding cached by color like stucco/stone already are), procedural canvas
textures (no asset loads), no new per-frame work. 25 houses vs 18 is a modest
increase; watch draw calls but expect no regression. Re-check FPS after the
roster expansion.

---

## 7. Open assumptions

- **Odds = east / evens = west** is unverified (recon LOW confidence on which
  side is which). Kept as-is; flippable later, low visual impact.
- **Hero shell kept ~current size** (stylized-large) to preserve the playable
  interior; neighbors are right-sized to real footprints. Accept the mild
  inconsistency (10600 a touch bigger than life).
- **Brick/siding split on 10600** (and most houses) is inferred from WCAD codes
  + neighbor listings, not a front photo.
- A few houses have partial data (10604, 10617, 10641, 10648, 10649) — use the
  neighborhood-norm defaults and mark `source: 'inferred'` in `houses.ts`
  (matching the existing convention).

---

## 8. Verification plan

Drive the live app (dev server + Playwright, `window.__game`/`__net`/`__combat`
stores, spectator orbital cam + FPS at fixed spots) and capture **before/after**
screenshots at three vantages used during diagnosis:
1. Cul-de-sac overview (orbital) — bulb scale + open yards + roofs.
2. Eye-level in front of 10600 — hero home accuracy + roof cap + brick.
3. Streetscape down the straight section — lighting + roster + brick row.

Plus: launch each of the four modes and confirm Section 5 acceptance.
