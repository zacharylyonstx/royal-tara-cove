# Free Play: "Town Life" — PRD + live tracker (2026-08-19)

Source: Zak's playtest transcript with Penny (8) + Luke (6), distilled by ChatGPT,
re-triaged here against the ACTUAL code. Goal for today: ship the biggest
kid-visible improvements with the smallest, safest changes **before the call in
~3 hours**, one release at a time, each verified in the running game before push.

Design north star (from the transcript): **build toys, not missions.** Free Play stays
calm, low-UI, imaginative. No currency, no quests, no timers.

## Triage — what I can do alone vs. what needs Zak

| # | Request | Can do solo? | Why / blocker |
|---|---------|--------------|---------------|
| 13 | Sparky steals E from the door | ✅ | pure code (interaction selector) |
| 15 | R "shoots you down the street" | ✅ | R teleports to (0,0,-90) mid-street today |
| 14 | Duplicate character → broken MP (invisible peers) | ✅ | whoami claim has no conflict resolution; NetSync skips remote state for my own characterId → the other kid is literally invisible |
| 12 | World-state sync (doors / Sparky / parked cars) | ✅ | extend trystero actions + host snapshot |
| 6 | Ducks pettable | ✅ | ducks aren't registered as interactables |
| 9/10 | Sparky gets lost when you drive off / should ride along | ✅ | FOLLOW_RANGE 13 m + trot 4.6 m/s vs 12 m/s cars |
| 7/8 | Ride together + truck bed | ✅ | passenger attach to driver transform + net field |
| 5 | Friendship levels | ✅ | localStorage counter + prompt badge + behaviours |
| 3 | Clothing store | ✅ | reuse WardrobeOverlay from a Plaza storefront |
| 4 | Pet shop / adoption | ✅ | generalize FamilyDog → adoptable pups (bigger) |
| 1 | School by the pond | ✅ (biggest) | procedural building + classroom props |
| 18 | Stuck-vehicle recovery | ✅ | small |
| 20 | Treehouse "under construction" | ✅ | label only |
| 16 | Pointer-lock / "can't look" | ✅ | hint + re-lock on click |
| 11 | TV channels | ⚠️ mechanism only | needs Zak's videos/photos (only public/luke.mov exists) |
| 19/21 | Invisible in Munchies/Treehouse | ✅ likely same root cause as #14 | verify after the claim fix |
| 25 | Kessler mode | ❌ not today | separate app; not a kid request |
| 26 | Memorable domain | ❌ Zak | needs a domain purchase / Netlify DNS |
| HeyGen | — | avoid | no paid plan; nothing here needs it |

## Ranked releases (impact ÷ effort). Each = verify → commit → push (auto-deploys) → STOP for Zak to test.

| Rel | Name | Contents | Size | Status |
|-----|------|----------|------|--------|
| R1 | **"Free Play feels right"** — the frustration fixes | (a) ONE contextual interaction selector: door/car/bike/ball/dresser/pet scored by distance + facing, single prompt ("E open door" vs "E pet Sparky"); (b) R = hold 1 s to go home, lands at the real Free Play spawn (no more mid-street launch), never while driving; (c) duplicate-claim resolver: earliest joiner keeps the character, the other is bounced back to the picker with a banner, picker shows "Being played by a friend"; (d) doors synced (toggle broadcast + joiner catch-up); (e) parked-car positions synced so the truck doesn't snap home on other screens (+ can't drive a truck someone's already driving); (f) ducks pettable (quack + hearts); (g) BONUS root-cause fixes: your own avatar was hidden in Munchies/Treehouse (3rd-person) — "we disappeared!"; no more hovering at 8 m after the treehouse ("I'm flying"); touch prompt shows ✋ not E | S/M | 🚀 |
| R2 | **"Ride together"** | passenger seats in every car (sedan 3, truck 1 + 2 in the BED, golf cart 1): E near an occupied vehicle → "ride along" / "hop in the back"; E to hop out; passengers attach to the driver's vehicle (no lag — peers derive from the driver); sitting pose; Sparky hops in the truck bed / back seat when his person drives and never gets lost (sprint + catch-up) | M | ⬜ |
| R3 | **"Sparky loves you back"** | friendship levels (New → Friend → Good Friend → Best Friend) from petting + time together, persisted; prompt shows ♥ badge; behaviours unlock (follows from Friend, sits when you stop at Good Friend, happy spin + bark at Best Friend); Sparky position synced from host so everyone sees the same dog; petting hearts visible to all | M | ⬜ |
| R4 | **"Plaza shops open"** | clothing boutique storefront (mannequins + racks) → "E shop outfits" opens the wardrobe; Woof Gang pet shop with 3 adoptable pups → "adopt Biscuit" → follows you, barks, rides along, name tag; synced so others see your pup | M/L | ⬜ |
| R5 | **"Avery Ranch Elementary"** | school west of the pond: enterable building, hallway w/ lockers, 2 classrooms (teacher desk, student desks you can SIT at, whiteboard), cafeteria tables, playground; doors; colliders; minimap label | L | ⬜ |
| R6 | Polish grab-bag | stuck-vehicle reset (hold R while driving = set upright on the nearest road), Treehouse card "under construction", pointer-lock hint, TV channel cycling mechanism (+ instructions for Zak's media) | S | ⬜ |

Legend: ⬜ todo · 🔧 in progress · ✅ verified locally · 🚀 LIVE

## Verification recipe (per release)
1. `npm run build` + `npm run lint` → 0 errors.
2. Headed browser on http://localhost:5173 → Free Play card → "Let's play" → claim DAD (welcomeOpen gates the controller).
3. Walk/drive the real player path for the feature (WASD via dispatched KeyboardEvents; `__cam.set(yaw,pitch)` to aim; `__game`/`__play`/`__zone` DEV globals), screenshot from ≥2 angles.
4. For net features: 2-tab P2P (second tab claims PENNY), confirm both sides.
5. `git push origin main` → Netlify auto-deploys (~60 s); confirm the live bundle + 0 console errors at royal-tara-cove.netlify.app.

## Log
- 15:14 — kickoff; codebase map fanned out (8 explorers); dev server up on :5173.
- 15:55 — R1 built + verified (single-tab: door vs Sparky facing test, R tap/hold, duck pet w/ hearts; 2-tab: claim race bounced in 2.2 s w/ banner, door open synced, truck park synced exactly, late joiner catch-up; all 6 modes boot with 0 errors). Pushing.
