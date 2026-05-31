# Solidity, Street Polish & the 10600 Memory Rebuild — Design

**Date:** 2026-05-31
**Source memory spec:** the user-provided "Royal Tara Cove House Accuracy Spec" (10600), adapted to codebase scale.
**Decisions:** 10600 = slightly larger + open rebuild (natural beside neighbors); projector on the double-height formal-room wall; tasteful backyard (no playscape); solidity = the high-value cases.

## Phase 1 — Make solid things solid

**Basketballs vs. walls** (`src/components/props/Basketball.tsx`): the ball only ground-bounces today. After integrating XZ each frame, test the new position against the house-wall colliders (`useGameStore.getState().staticColliders`) + the ramp colliders; on penetration, reflect the horizontal velocity off the blocked axis and push the ball back to the surface. Keep it cheap (only while near a player, as today).

**Ramp solid from back/sides, open to the launch** (`src/components/props/Ramp.tsx`, `src/systems/PlayerController.tsx`):
- On foot: register the ramp deck as a sloped `Floor` so the player walks up and over it (never through).
- Bike: in `rideBikeTick`, when grounded and the resolved position enters the ramp footprint while NOT moving up-ramp (`movingUp <= 0.3`), clamp it out (treat as a wall). The launch path (`movingUp > 0.4`) is unaffected, and airborne motion passes over freely (so a jump is never interrupted).
- Ball: include the ramp footprint in the ball's collider set so balls bounce off it.

## Phase 2 — Street & yard polish

**Crepe myrtle off the door** (`src/components/Game.tsx` `LotVegetation`): the tree is placed on the door side. Move it to a front *corner* on the garage side (`sideLocalX = (garageOnLeft ? -1 : 1) * (halfW + 1.2)`, pushed toward the street), clear of the centered-ish door walkway and the driveway. Skip the generic crepe myrtle for the hero (it gets its own memory oak).

**Space 10600's neighbors** (`src/world/houses.ts`): the bulb packs 10600 (wide) next to 10604 (135°)/10601 with edges ~4u apart. Widen the flanking angles and/or nudge their radius so there is clear space beside the hero. Verify no overlap with 10605.

## Phase 3 — Rebuild 10600 to the memory

Footprint: **width 20, depth 18, 2-story**, front −Z / backyard +Z (was 18×16). Files: `src/components/hero/HeroHouse10600.tsx` (exterior + colliders + floors), `src/components/hero/Interior10600.tsx`, and its room sub-components (`Kitchen`, `LivingRoom`, `StairsAndLoft`, `Bedroom`, `Bathroom`, `ProjectorScreen`), plus `floorPlan.ts`.

**Front elevation (memory landmarks):** garage on the right (white 2-car paneled door, broad flared driveway); **recessed porch just left of garage** (square white columns, brown wood door set back, arched header above door, 2–4 concrete steps, black metal handrail, American flag on a column); **arched 2nd-story window above garage**; **tall arched formal-room window** left-front; tan/beige brick primary + cream upper siding + white trim + grey/tan roof; **big live oak on the left yard** with circular brick edging + rounded shrub mass at the porch.

**Interior (the emotional core):** front door → small foyer → **double-height formal living/dining** (wood floor, tall arched window, chandelier over dining, big blank wall = **projector wall**, upstairs **loft railing visible overhead**). **Open stairs on the right** rise to the **loft/game room** overlooking the formal room. Behind: **yellow kitchen** (tan tile, honey-oak cabinets, island, pantry, stove+microwave, sink by window) open to **breakfast nook** + **family room** (olive/taupe walls, **centered brick fireplace**, ceiling fan, **glass back door**). Sightlines: entry → formal room + stairs + railing; kitchen → fireplace; family room → patio; loft → down into formal room.

**Projector:** mount `ProjectorScreen` on the formal-room's tall blank wall, facing the seating; keep `getProjectorTexture()` video playing. Re-aim its normal toward the seating/loft.

**Rear & backyard:** cream rear siding with white-trim windows; **attached covered patio** (concrete slab, white square posts, light-cream ceiling, small light, wind chime, bench/table); back glass door from family room; **big grassy backyard**, dominant oaks (one large left/back), **wood privacy fence**, **dense greenbelt tree backdrop**. No playscape.

**Colliders/floors:** rebuild `buildHeroExteriorColliders` (front wall split around the front door, rear split around the back glass door, solid sides), `buildInteriorColliders` (walls around the open formal room / kitchen / family room — keep the formal room OPEN, fence only real walls), and `buildHeroFloors` (stairs ramp + loft platform over the formal room). House must stay enterable and the upstairs walkable.

## Verification (no test harness)

`npm run build` + lint (no NEW errors); Playwright on the dev server driving `__game/__play` — confirm: (1) a ball thrown at a wall bounces, not passes through; (2) you cannot ride/walk through the ramp in reverse, but the launch still works; (3) no tree blocks any front door; (4) clear space beside 10600; (5) the 10600 front reads as the memory (porch left-of-garage, oak left, arched windows); (6) entering shows the tall formal room + loft railing + stairs; (7) kitchen→fireplace→patio sightline; (8) projector video still plays. Then commit + push to prod (standing auth) + bundle-hash confirm.
