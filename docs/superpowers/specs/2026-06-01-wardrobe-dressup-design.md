# The Wardrobe — Dress-Up System + Character Glow-Up

**Date:** 2026-06-01
**Status:** Approved (design + 3 key decisions confirmed by Zak)

## Goal

A delightful dress-up feature for the kids: walk up to a dresser in your bedroom,
open a great dress-up UI, pick an outfit, and have it **persist on your character
throughout the game**. Plus a visual glow-up so the family looks great (no more
box feet). Strictly additive — **no gameplay/physics/scoring/controls change**
(character collision is a fixed `PLAYER_RADIUS`, independent of the mesh).

## Confirmed decisions

1. **Co-op:** outfits **sync** — each kid sees the other's chosen look in real time.
2. **Dresser ownership:** each bedroom's dresser dresses **its owner** (Penny's
   pink room → Penny, Luke's green room → Luke, Dad's master → Dad). A solo player
   can visit all three.
3. **Catalog:** **rich & varied** — ~6–8 items per slot + color variants.

## Character looks (glow-up)

Rebuild the family mesh, keeping the existing animation rig (walk swing, ride pose,
torso bob) intact:
- Rounder head, friendly face (eyes + simple smile), real **sneaker** shoes.
- Slimmer rounded limbs; clothing layers ride the animated limb groups.
- **Penny** (age 8): long reddish-blonde hair. **Luke** (age 6): short tousled
  brown hair. **Dad**: tall, short brown hair + light beard.

## Architecture (new/changed modules)

- `src/world/wardrobe.ts` — slot types (`hair|top|bottom|shoes|hat|accessory`),
  the item **catalog** per slot (id, label, emoji, render-kind, color options),
  the `Appearance` type, and per-character **defaults** (preserve pink/green/blue).
- `src/world/wardrobeStorage.ts` — localStorage load/save (`wardrobe.v1`), mirrors
  `treehouseStorage`.
- `src/state/wardrobeStore.ts` — zustand: `appearances: Record<CharacterId, Appearance>`
  (local + remote), `open`/`openFor`, registered dressers, actions
  `openWardrobe/close/equip/setColor/reset/registerDresser/setRemoteAppearance`.
  Persists local changes; broadcasts on change.
- `src/components/CharacterModel.tsx` — pure presentational, appearance-driven mesh
  (hair/face/top/bottom/shoes/hat/accessory). Shared by in-world + preview.
- `src/components/Character.tsx` — wraps `CharacterModel` with the gameplay rig.
- `src/components/hero/Dresser.tsx` — a good-looking dresser; registers its world
  position + owner into `wardrobeStore` on mount. Placed in the 3 upstairs bedrooms
  inside `HeroHouse10600` (house-local coords inherit the house transform).
- Interaction: `PlayerController` detects the nearest registered dresser within
  reach, sets a wardrobe hover, and opens the owner's wardrobe on E / touch Action.
  `InteractPrompt` shows "open wardrobe". (Same pattern as doors/bikes.)
- `src/ui/WardrobeOverlay.tsx` — full-screen overlay: a small `<Canvas>` with a
  slowly-spinning live `CharacterModel` preview, category tabs + colorful item
  cards + color swatches, instant try-on, **Done** saves + closes. Touch + mouse.
  Mounted in `App.tsx`.
- Net sync: a low-frequency `wardrobe` trystero action in `src/net/room.ts`
  (`{characterId, appearance}`), broadcast on change + on peer join; received into
  `wardrobeStore.setRemoteAppearance` so remote characters render the right look.

## Data flow

Dresser proximity → hover → E/Action → `openWardrobe(owner)` → overlay → `equip`/
`setColor` updates `appearances[owner]` → persisted + broadcast → in-world Character
(and the other kid's client) re-renders from `appearances[id]`.

## Out of scope (later)

Unlockables/currency, seasonal items, saving named outfit presets.
